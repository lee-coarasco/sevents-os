import type {
  AddConditionInput,
  AddNodeInput,
  AddTransitionInput,
  WorkflowRepository,
} from "./repository.js";
import {
  IncompleteGateError,
  UnregisteredServiceError,
  callRegisteredService,
  indexGraph,
  initialStepStatusFor,
  isGatedNodeType,
  predecessorsSatisfied,
  resolveNextNodeIds,
} from "./runtime.js";
import { pickNextTransition, simulateGraph } from "./simulation.js";
import { NODE_TYPES } from "./types.js";
import type {
  ConfigurationSimulationRun,
  ConfigurationValidationRun,
  DefinitionFilters,
  GateException,
  SimulationTestCase,
  WorkflowCondition,
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowNode,
  WorkflowStepInstance,
  WorkflowTransition,
  WorkflowVersion,
  WorkflowVersionGraph,
} from "./types.js";
import { findStartNodeIds, validateGraph } from "./validation.js";

export class WorkflowNotFoundError extends Error {}
export class VersionNotFoundError extends Error {}
export class InvalidNodeTypeError extends Error {}
export class VersionNotDraftError extends Error {}
export class DefinitionNotDraftError extends Error {}
export class DefinitionNotUnderReviewError extends Error {}
export class DefinitionNotApprovedError extends Error {}
export class RollbackTargetNotPublishedError extends Error {}
export class VersionNotValidatedError extends Error {}
export class NoStartNodeError extends Error {}
export class InstanceNotFoundError extends Error {}
export class StepInstanceNotFoundError extends Error {}
export class InstanceNotRunningError extends Error {}
export class InstanceNotPausedError extends Error {}
export class StepInstanceNotActionableError extends Error {}
export { IncompleteGateError, UnregisteredServiceError };

export interface CreateWorkflowDefinitionInput {
  key: string;
  name: string;
  description?: string | null;
  capabilityKey?: string | null;
}

export async function createWorkflowDefinition(
  repository: WorkflowRepository,
  accessToken: string,
  input: CreateWorkflowDefinitionInput,
  createdBy: string | null,
): Promise<{ definition: WorkflowDefinition; version: WorkflowVersion }> {
  const result = await repository.createDefinition(accessToken, {
    key: input.key,
    name: input.name,
    description: input.description ?? null,
    capabilityKey: input.capabilityKey ?? null,
    createdBy,
  });
  await repository.insertConfigurationChange(accessToken, {
    entityId: result.definition.id,
    workflowVersionId: result.version.id,
    changeType: "create",
    diff: { after: { key: input.key, name: input.name } },
    reason: null,
    changedBy: createdBy,
  });
  return result;
}

export async function listWorkflowDefinitions(
  repository: WorkflowRepository,
  accessToken: string,
  filters: DefinitionFilters,
): Promise<WorkflowDefinition[]> {
  return repository.listDefinitions(accessToken, filters);
}

export async function getWorkflowDefinition(
  repository: WorkflowRepository,
  accessToken: string,
  id: string,
): Promise<WorkflowDefinition | null> {
  return repository.getDefinition(accessToken, id);
}

async function requireDefinition(repository: WorkflowRepository, accessToken: string, id: string): Promise<WorkflowDefinition> {
  const definition = await repository.getDefinition(accessToken, id);
  if (!definition) throw new WorkflowNotFoundError(`workflow definition ${id} not found`);
  return definition;
}

async function requireVersion(repository: WorkflowRepository, accessToken: string, id: string): Promise<WorkflowVersion> {
  const version = await repository.getVersion(accessToken, id);
  if (!version) throw new VersionNotFoundError(`workflow version ${id} not found`);
  return version;
}

/**
 * Creates a new draft version for a definition, optionally cloning an
 * existing version's graph (BRD §5.4.2: edit a published workflow
 * without mutating its immutable published row). Only one new version
 * number is minted; the source version is read-only throughout.
 */
export async function createDraftVersion(
  repository: WorkflowRepository,
  accessToken: string,
  definitionId: string,
  createdBy: string | null,
  copyFromVersionId?: string,
): Promise<WorkflowVersion> {
  const definition = await requireDefinition(repository, accessToken, definitionId);
  const existingVersions = await repository.listVersions(accessToken, definitionId);
  const nextVersionNumber = existingVersions.reduce((max, v) => Math.max(max, v.version), 0) + 1;

  const version = await repository.insertVersion(accessToken, {
    definitionId,
    version: nextVersionNumber,
    status: "draft",
    rollbackOfVersion: null,
    createdBy,
  });

  if (copyFromVersionId) {
    const source = await requireVersion(repository, accessToken, copyFromVersionId);
    if (source.workflow_definition_id !== definitionId) {
      throw new VersionNotFoundError(`version ${copyFromVersionId} does not belong to definition ${definitionId}`);
    }
    await cloneGraphInto(repository, accessToken, copyFromVersionId, version.id);
  }

  // A new draft is now in progress for this definition; its own status
  // reflects the latest version's lifecycle (BRD §5.4.2), independent
  // of current_version, which keeps pointing at whichever version is
  // still published for existing/new instances until this one publishes.
  if (definition.status !== "draft") {
    await repository.updateDefinitionStatus(accessToken, definitionId, "draft", definition.current_version, createdBy);
  }

  await repository.insertConfigurationChange(accessToken, {
    entityId: definitionId,
    workflowVersionId: version.id,
    changeType: "create",
    diff: { after: { version: nextVersionNumber, clonedFrom: copyFromVersionId ?? null } },
    reason: null,
    changedBy: createdBy,
  });

  return version;
}

async function cloneGraphInto(
  repository: WorkflowRepository,
  accessToken: string,
  sourceVersionId: string,
  targetVersionId: string,
): Promise<void> {
  const graph = await repository.getVersionGraph(accessToken, sourceVersionId);

  const conditionIdMap = new Map<string, string>();
  for (const condition of graph.conditions) {
    const cloned = await repository.addCondition(accessToken, {
      versionId: targetVersionId,
      expression: condition.expression,
      description: condition.description,
    });
    conditionIdMap.set(condition.id, cloned.id);
  }

  const nodeIdMap = new Map<string, string>();
  for (const node of graph.nodes) {
    const cloned = await repository.addNode(accessToken, {
      versionId: targetVersionId,
      nodeKey: node.node_key,
      nodeType: node.node_type,
      config: node.config,
    });
    nodeIdMap.set(node.id, cloned.id);
  }

  for (const transition of graph.transitions) {
    const fromNodeId = nodeIdMap.get(transition.from_node_id);
    const toNodeId = nodeIdMap.get(transition.to_node_id);
    if (!fromNodeId || !toNodeId) continue;
    await repository.addTransition(accessToken, {
      versionId: targetVersionId,
      fromNodeId,
      toNodeId,
      conditionId: transition.condition_id ? conditionIdMap.get(transition.condition_id) ?? null : null,
      orderIndex: transition.order_index,
    });
  }
}

export interface AddNodeToVersionInput {
  nodeKey: string;
  nodeType: AddNodeInput["nodeType"];
  config?: Record<string, unknown>;
}

export async function addNodeToVersion(
  repository: WorkflowRepository,
  accessToken: string,
  versionId: string,
  input: AddNodeToVersionInput,
): Promise<WorkflowNode> {
  if (!(NODE_TYPES as readonly string[]).includes(input.nodeType)) {
    throw new InvalidNodeTypeError(`"${input.nodeType}" is not one of the BRD §5.4.3 supported step types`);
  }
  const version = await requireVersion(repository, accessToken, versionId);
  if (version.status !== "draft") {
    throw new VersionNotDraftError(`version ${versionId} is ${version.status}, not draft`);
  }
  return repository.addNode(accessToken, {
    versionId,
    nodeKey: input.nodeKey,
    nodeType: input.nodeType,
    config: input.config ?? {},
  });
}

export interface AddTransitionToVersionInput {
  fromNodeId: string;
  toNodeId: string;
  conditionId?: string | null;
  orderIndex?: number;
}

export async function addTransitionToVersion(
  repository: WorkflowRepository,
  accessToken: string,
  versionId: string,
  input: AddTransitionToVersionInput,
): Promise<WorkflowTransition> {
  const version = await requireVersion(repository, accessToken, versionId);
  if (version.status !== "draft") {
    throw new VersionNotDraftError(`version ${versionId} is ${version.status}, not draft`);
  }
  return repository.addTransition(accessToken, {
    versionId,
    fromNodeId: input.fromNodeId,
    toNodeId: input.toNodeId,
    conditionId: input.conditionId ?? null,
    orderIndex: input.orderIndex ?? 0,
  });
}

export interface AddConditionToVersionInput {
  expression: AddConditionInput["expression"];
  description?: string | null;
}

export async function addConditionToVersion(
  repository: WorkflowRepository,
  accessToken: string,
  versionId: string,
  input: AddConditionToVersionInput,
): Promise<WorkflowCondition> {
  const version = await requireVersion(repository, accessToken, versionId);
  if (version.status !== "draft") {
    throw new VersionNotDraftError(`version ${versionId} is ${version.status}, not draft`);
  }
  return repository.addCondition(accessToken, {
    versionId,
    expression: input.expression,
    description: input.description ?? null,
  });
}

export async function submitForApproval(
  repository: WorkflowRepository,
  accessToken: string,
  definitionId: string,
  versionId: string,
  submittedBy: string | null,
): Promise<WorkflowDefinition> {
  const definition = await requireDefinition(repository, accessToken, definitionId);
  const version = await requireVersion(repository, accessToken, versionId);
  if (version.workflow_definition_id !== definitionId) {
    throw new VersionNotFoundError(`version ${versionId} does not belong to definition ${definitionId}`);
  }
  if (definition.status !== "draft") {
    throw new DefinitionNotDraftError(`definition ${definitionId} is ${definition.status}, not draft`);
  }
  const updated = await repository.updateDefinitionStatus(accessToken, definitionId, "under_review", definition.current_version, submittedBy);
  await repository.insertConfigurationChange(accessToken, {
    entityId: definitionId,
    workflowVersionId: versionId,
    changeType: "submit",
    diff: { before: { status: "draft" }, after: { status: "under_review" } },
    reason: null,
    changedBy: submittedBy,
  });
  return updated;
}

export async function recordApproval(
  repository: WorkflowRepository,
  accessToken: string,
  definitionId: string,
  versionId: string,
  approverId: string | null,
  decision: "approved" | "rejected",
  comment: string | null,
): Promise<WorkflowDefinition> {
  const definition = await requireDefinition(repository, accessToken, definitionId);
  if (definition.status !== "under_review") {
    throw new DefinitionNotUnderReviewError(`definition ${definitionId} is ${definition.status}, not under_review`);
  }
  await repository.recordApproval(accessToken, { versionId, approverId, decision, comment });
  const nextStatus = decision === "approved" ? "approved" : "draft";
  const updated = await repository.updateDefinitionStatus(accessToken, definitionId, nextStatus, definition.current_version, approverId);
  await repository.insertConfigurationChange(accessToken, {
    entityId: definitionId,
    workflowVersionId: versionId,
    changeType: decision === "approved" ? "approve" : "reject",
    diff: { before: { status: "under_review" }, after: { status: nextStatus } },
    reason: comment,
    changedBy: approverId,
  });
  return updated;
}

export async function publishVersion(
  repository: WorkflowRepository,
  accessToken: string,
  definitionId: string,
  versionId: string,
  publishedBy: string | null,
  effectiveFrom?: string,
): Promise<WorkflowVersion> {
  const definition = await requireDefinition(repository, accessToken, definitionId);
  const version = await requireVersion(repository, accessToken, versionId);
  if (version.workflow_definition_id !== definitionId) {
    throw new VersionNotFoundError(`version ${versionId} does not belong to definition ${definitionId}`);
  }
  if (definition.status !== "approved") {
    throw new DefinitionNotApprovedError(`definition ${definitionId} is ${definition.status}, not approved`);
  }
  if (version.status !== "draft") {
    throw new VersionNotDraftError(`version ${versionId} is ${version.status}, not draft`);
  }
  const latestValidation = await repository.getLatestValidationRun(accessToken, versionId);
  if (!latestValidation || latestValidation.result !== "pass") {
    throw new VersionNotValidatedError(`version ${versionId} has no passing validation run — call validateVersion first`);
  }

  const effective = effectiveFrom ?? new Date().toISOString();
  const published = await repository.markVersionPublished(accessToken, versionId, publishedBy, effective);
  await repository.updateDefinitionStatus(accessToken, definitionId, "published", version.version, publishedBy);
  await repository.insertPublishedConfiguration(accessToken, {
    definitionId,
    versionId,
    effectiveFrom: effective,
    publishedBy,
  });
  await repository.insertConfigurationChange(accessToken, {
    entityId: definitionId,
    workflowVersionId: versionId,
    changeType: "publish",
    diff: { before: { current_version: definition.current_version }, after: { current_version: version.version } },
    reason: null,
    changedBy: publishedBy,
  });
  return published;
}

/**
 * BRD §5.4.2: "rollback means publish a previous configuration version
 * for future instances; never erase historical versions or rewrite
 * completed approvals." Clones the target version's graph into a brand
 * new version row (never touches the target's own row) and publishes
 * that clone directly — rollback is an operational restore, not a new
 * pass through the draft/under_review/approved cycle.
 */
export async function rollbackToVersion(
  repository: WorkflowRepository,
  accessToken: string,
  definitionId: string,
  targetVersionNumber: number,
  rolledBackBy: string | null,
  reason: string | null,
): Promise<WorkflowVersion> {
  const definition = await requireDefinition(repository, accessToken, definitionId);
  const versions = await repository.listVersions(accessToken, definitionId);
  const target = versions.find((v) => v.version === targetVersionNumber);
  if (!target) throw new VersionNotFoundError(`version ${targetVersionNumber} not found for definition ${definitionId}`);
  if (target.status !== "published") {
    throw new RollbackTargetNotPublishedError(`version ${targetVersionNumber} was never published`);
  }

  const nextVersionNumber = versions.reduce((max, v) => Math.max(max, v.version), 0) + 1;
  const newVersion = await repository.insertVersion(accessToken, {
    definitionId,
    version: nextVersionNumber,
    status: "draft",
    rollbackOfVersion: targetVersionNumber,
    createdBy: rolledBackBy,
  });
  await cloneGraphInto(repository, accessToken, target.id, newVersion.id);

  const effective = new Date().toISOString();
  const published = await repository.markVersionPublished(accessToken, newVersion.id, rolledBackBy, effective);
  await repository.updateDefinitionStatus(accessToken, definitionId, "published", nextVersionNumber, rolledBackBy);
  await repository.insertPublishedConfiguration(accessToken, {
    definitionId,
    versionId: newVersion.id,
    effectiveFrom: effective,
    publishedBy: rolledBackBy,
  });
  await repository.insertRollbackEvent(accessToken, {
    definitionId,
    fromVersion: definition.current_version,
    toVersion: nextVersionNumber,
    rolledBackBy,
    reason,
  });
  await repository.insertConfigurationChange(accessToken, {
    entityId: definitionId,
    workflowVersionId: newVersion.id,
    changeType: "rollback",
    diff: { before: { current_version: definition.current_version }, after: { current_version: nextVersionNumber, restoredFrom: targetVersionNumber } },
    reason,
    changedBy: rolledBackBy,
  });
  return published;
}

export async function getVersionGraph(repository: WorkflowRepository, accessToken: string, versionId: string) {
  await requireVersion(repository, accessToken, versionId);
  return repository.getVersionGraph(accessToken, versionId);
}

export async function listVersions(repository: WorkflowRepository, accessToken: string, definitionId: string): Promise<WorkflowVersion[]> {
  await requireDefinition(repository, accessToken, definitionId);
  return repository.listVersions(accessToken, definitionId);
}

/** BRD §5.4.2 structural validation, gating `publishVersion` (ticket 0061). */
export async function validateVersion(
  repository: WorkflowRepository,
  accessToken: string,
  versionId: string,
  runBy: string | null,
): Promise<ConfigurationValidationRun> {
  await requireVersion(repository, accessToken, versionId);
  const graph = await repository.getVersionGraph(accessToken, versionId);
  const knownRoleIds = new Set(await repository.listRoleIds(accessToken));
  const { result, findings } = validateGraph(graph, knownRoleIds);
  return repository.insertValidationRun(accessToken, { versionId, runBy, result, findings });
}

/** BRD §5.4.2 "simulate against representative sample cases... branch coverage and unreachable steps." */
export async function simulateVersion(
  repository: WorkflowRepository,
  accessToken: string,
  versionId: string,
  testCases: SimulationTestCase[],
  runBy: string | null,
): Promise<ConfigurationSimulationRun> {
  await requireVersion(repository, accessToken, versionId);
  const graph = await repository.getVersionGraph(accessToken, versionId);
  const [startNodeId] = findStartNodeIds(graph);
  if (!startNodeId) throw new NoStartNodeError(`version ${versionId} has no unambiguous start node to simulate from`);
  const result = simulateGraph(graph, startNodeId, testCases);
  return repository.insertSimulationRun(accessToken, { versionId, runBy, testCases, result });
}

// ---------------------------------------------------------------------------
// Runtime / instance engine (ticket 0062, M06c)
// ---------------------------------------------------------------------------

async function requireInstance(repository: WorkflowRepository, accessToken: string, id: string): Promise<WorkflowInstance> {
  const instance = await repository.getInstance(accessToken, id);
  if (!instance) throw new InstanceNotFoundError(`workflow instance ${id} not found`);
  return instance;
}

async function requireStepInstance(repository: WorkflowRepository, accessToken: string, id: string): Promise<WorkflowStepInstance> {
  const step = await repository.getStepInstance(accessToken, id);
  if (!step) throw new StepInstanceNotFoundError(`workflow step instance ${id} not found`);
  return step;
}

/**
 * Creates (or re-fetches, if one already exists for this node on this
 * instance) a step instance for `node`, records a step_activated
 * event, and — for node types the executor can resolve synchronously
 * in this same pass (everything except create_task/assign_role_user/
 * request_approval, the M07/M08 seam) — runs its handler immediately
 * and recurses into its successors. Returns every step instance
 * touched so the caller can report the whole batch.
 */
async function activateNode(
  repository: WorkflowRepository,
  accessToken: string,
  instance: WorkflowInstance,
  graph: WorkflowVersionGraph,
  indexed: ReturnType<typeof indexGraph>,
  node: WorkflowNode,
  touched: WorkflowStepInstance[],
): Promise<void> {
  const initialStatus = initialStepStatusFor(node.node_type);
  const step = await repository.createStepInstance(accessToken, {
    instanceId: instance.id,
    nodeId: node.id,
    status: initialStatus,
    assignedTo: resolveAssignee(node),
  });
  touched.push(step);
  await repository.insertEvent(accessToken, {
    instanceId: instance.id,
    stepInstanceId: step.id,
    eventType: "step_activated",
    payload: { nodeKey: node.node_key, nodeType: node.node_type, status: initialStatus },
  });

  if (initialStatus === "waiting") {
    // M07 (Tasks, My Work & Work Queues) will poll
    // workflow_step_instances where status = 'waiting' and node_type
    // in ('create_task', 'assign_role_user', 'request_approval') —
    // joined against workflow_nodes for node_type — to build its work
    // queues; M08 (Approvals & Delegation) will act on the
    // request_approval subset the same way. Nothing further happens
    // here until completeStepInstance is called from that side.
    return;
  }

  await resolveAndAdvance(repository, accessToken, instance, graph, indexed, node, step, touched);
}

function resolveAssignee(node: WorkflowNode): string | null {
  const roleId = typeof node.config.roleId === "string" ? node.config.roleId : null;
  const userId = typeof node.config.userId === "string" ? node.config.userId : null;
  return userId ?? roleId ?? null;
}

/**
 * Runs the handler for a non-waiting node type, writes its output onto
 * the step instance, completes it, and fans out into successor nodes
 * per FR-WI-009 semantics (resolveNextNodeIds / predecessorsSatisfied).
 * This is the dispatch map ticket 0062 asked for: one branch per BRD
 * §5.4.3 node type, not thirteen near-duplicate functions.
 */
async function resolveAndAdvance(
  repository: WorkflowRepository,
  accessToken: string,
  instance: WorkflowInstance,
  graph: WorkflowVersionGraph,
  indexed: ReturnType<typeof indexGraph>,
  node: WorkflowNode,
  step: WorkflowStepInstance,
  touched: WorkflowStepInstance[],
): Promise<void> {
  let output: Record<string, unknown> = {};
  let contextPatch: Record<string, unknown> = {};
  let terminal: "completed" | "cancelled" | null = null;

  switch (node.node_type) {
    case "evaluate_condition": {
      const outgoing = indexed.outgoingByNode.get(node.id) ?? [];
      // evaluate_condition always picks exactly one branch by its
      // condition, same single-pick evaluator ticket 0061 validated
      // with — never the fan-out path, regardless of how many
      // outgoing transitions exist.
      const picked = pickNextTransition(outgoing, indexed.conditionsById, instance.context);
      output = { pickedToNodeId: picked?.to_node_id ?? null };
      break;
    }
    case "call_service": {
      const serviceName = typeof node.config.service === "string" ? node.config.service : "";
      const serviceConfig = (node.config.config as Record<string, unknown> | undefined) ?? {};
      const result = await callRegisteredService(serviceName, serviceConfig, instance.context);
      output = { service: serviceName, result };
      contextPatch = result;
      await repository.insertEvent(accessToken, {
        instanceId: instance.id,
        stepInstanceId: step.id,
        eventType: "service_called",
        payload: { service: serviceName, result },
      });
      break;
    }
    case "send_notification": {
      output = { notified: true, config: node.config };
      await repository.insertEvent(accessToken, {
        instanceId: instance.id,
        stepInstanceId: step.id,
        eventType: "notification_sent",
        payload: { nodeKey: node.node_key, config: node.config },
      });
      break;
    }
    case "wait_event_time": {
      // No named event/timer infrastructure exists yet in this ticket's
      // scope; treat as immediately satisfied so the graph can still be
      // exercised end to end. A future ticket wiring real timers/events
      // would flip this node type into WAITING_NODE_TYPES instead.
      output = { waited: true };
      break;
    }
    case "collect_form_data": {
      output = { formSchema: node.config };
      break;
    }
    case "request_upload_evidence": {
      // Evidence collection also hands off to a human in practice, but
      // ticket scope only requires the gate (FR-WI-010) to observe this
      // node type's completion state — model it the same as the other
      // gated node types by leaving it waiting rather than auto-resolving.
      await repository.updateStepInstance(accessToken, step.id, { status: "waiting" });
      step.status = "waiting";
      return;
    }
    case "create_linked_followup": {
      output = { followup: node.config };
      break;
    }
    case "escalate": {
      output = { escalated: true };
      await repository.insertEvent(accessToken, {
        instanceId: instance.id,
        stepInstanceId: step.id,
        eventType: "escalated",
        payload: { nodeKey: node.node_key },
      });
      break;
    }
    case "complete": {
      const gateResult = await checkCompleteGate(repository, accessToken, instance);
      if (!gateResult.ok) {
        // FR-WI-010: block without throwing out of what may be a purely
        // automatic cascade (e.g. from startWorkflowInstance's initial
        // synchronous fan-out) — the node simply stays unreached, same
        // as any other node a predecessor check withholds. The caller
        // that explicitly tries to *act* on a gated step via
        // completeStepInstance is the one that surfaces
        // IncompleteGateError, since that caller can supply a
        // gateException and needs a signal to retry with one.
        await repository.updateStepInstance(accessToken, step.id, { status: "waiting" });
        step.status = "waiting";
        return;
      }
      terminal = "completed";
      break;
    }
    case "cancel": {
      terminal = "cancelled";
      break;
    }
    default:
      output = {};
  }

  const completedAt = new Date().toISOString();
  const mergedContext = { ...instance.context, ...contextPatch };
  instance.context = mergedContext;
  await repository.updateStepInstance(accessToken, step.id, { status: "completed", completedAt, output });
  step.status = "completed";
  step.completed_at = completedAt;
  step.output = output;
  await repository.insertEvent(accessToken, {
    instanceId: instance.id,
    stepInstanceId: step.id,
    eventType: "step_completed",
    payload: { nodeKey: node.node_key, nodeType: node.node_type, output },
  });

  if (Object.keys(contextPatch).length > 0) {
    await repository.updateInstance(accessToken, instance.id, { context: mergedContext });
  }

  if (terminal) {
    const endedAt = new Date().toISOString();
    await repository.updateInstance(accessToken, instance.id, { status: terminal, endedAt });
    instance.status = terminal;
    instance.ended_at = endedAt;
    await repository.insertEvent(accessToken, {
      instanceId: instance.id,
      stepInstanceId: step.id,
      eventType: terminal === "completed" ? "completed" : "cancelled",
      payload: { nodeKey: node.node_key },
    });
    return;
  }

  const outgoing = indexed.outgoingByNode.get(node.id) ?? [];
  const nextNodeIds =
    node.node_type === "evaluate_condition"
      ? [(output as { pickedToNodeId: string | null }).pickedToNodeId].filter((id): id is string => Boolean(id))
      : resolveNextNodeIds(outgoing, indexed.conditionsById, instance.context);

  for (const nextNodeId of nextNodeIds) {
    const nextNode = indexed.nodesById.get(nextNodeId);
    if (!nextNode) continue;
    const existingSteps = await repository.listStepInstances(accessToken, instance.id);
    const stepInstancesByNodeId = groupByNodeId(existingSteps);
    if (!predecessorsSatisfied(nextNodeId, indexed.incomingByNode, stepInstancesByNodeId)) {
      // Another branch feeding this node hasn't completed yet (FR-WI-009
      // "wait for all predecessors"); this fan-in node will be activated
      // once the last predecessor's call reaches here and finds every
      // incoming branch satisfied.
      continue;
    }
    if (stepInstancesByNodeId.has(nextNodeId)) {
      // Already activated by a previous predecessor in this same
      // fan-in; don't create a duplicate step instance.
      continue;
    }
    await activateNode(repository, accessToken, instance, graph, indexed, nextNode, touched);
  }
}

function groupByNodeId(steps: WorkflowStepInstance[]): Map<string, WorkflowStepInstance[]> {
  const map = new Map<string, WorkflowStepInstance[]>();
  for (const step of steps) {
    const list = map.get(step.node_id) ?? [];
    list.push(step);
    map.set(step.node_id, list);
  }
  return map;
}

/**
 * FR-WI-010: a `complete` node must not be reached while any
 * request_upload_evidence/request_approval step instance on this
 * instance is outstanding (not completed/skipped), unless an
 * authorized exception is recorded. Pure query, no side effects — see
 * checkCompleteGate (non-throwing, used by the synchronous executor
 * cascade) and enforceCompleteGateOrThrow (throwing, used by the
 * explicit completeStepInstance entrypoint) below.
 */
async function findOutstandingGatedSteps(
  repository: WorkflowRepository,
  accessToken: string,
  instance: WorkflowInstance,
  excludeStepId?: string,
): Promise<WorkflowStepInstance[]> {
  const steps = await repository.listStepInstances(accessToken, instance.id);
  const graph = await repository.getVersionGraph(accessToken, instance.workflow_version_id);
  const nodeTypeByStepNodeId = new Map(graph.nodes.map((n) => [n.id, n.node_type]));

  return steps.filter((s) => {
    if (s.id === excludeStepId) return false;
    const nodeType = nodeTypeByStepNodeId.get(s.node_id);
    return nodeType && isGatedNodeType(nodeType) && s.status !== "completed" && s.status !== "skipped";
  });
}

async function applyGateException(
  repository: WorkflowRepository,
  accessToken: string,
  instance: WorkflowInstance,
  exception: GateException,
  outstanding: WorkflowStepInstance[],
): Promise<void> {
  const mergedContext = {
    ...instance.context,
    gateExceptions: [
      ...((instance.context.gateExceptions as unknown[] | undefined) ?? []),
      { authorizedBy: exception.authorizedBy, reason: exception.reason, outstandingStepIds: outstanding.map((s) => s.id) },
    ],
  };
  instance.context = mergedContext;
  await repository.updateInstance(accessToken, instance.id, { context: mergedContext });
  await repository.insertEvent(accessToken, {
    instanceId: instance.id,
    stepInstanceId: null,
    eventType: "gate_exception",
    payload: {
      authorizedBy: exception.authorizedBy,
      reason: exception.reason,
      outstandingStepIds: outstanding.map((s) => s.id),
    },
  });
}

/**
 * Non-throwing gate check for the executor's own synchronous cascade
 * (e.g. a `complete` node reached automatically as part of
 * startWorkflowInstance's initial fan-out, or a cascade triggered by
 * completeStepInstance on some *other* step). A block here just leaves
 * the complete node unreached and records gate_blocked — it must never
 * throw out of what may be an automatic, caller-invisible walk.
 */
async function checkCompleteGate(
  repository: WorkflowRepository,
  accessToken: string,
  instance: WorkflowInstance,
): Promise<{ ok: true } | { ok: false }> {
  const outstanding = await findOutstandingGatedSteps(repository, accessToken, instance);
  if (outstanding.length === 0) return { ok: true };
  await repository.insertEvent(accessToken, {
    instanceId: instance.id,
    stepInstanceId: null,
    eventType: "gate_blocked",
    payload: { outstandingStepIds: outstanding.map((s) => s.id) },
  });
  return { ok: false };
}

/**
 * Throwing variant for completeStepInstance's direct call: the caller
 * explicitly asked to complete a step whose next hop is a `complete`
 * node, so a block must surface as IncompleteGateError (not silently
 * swallowed) — giving the caller the signal + shape needed to retry
 * with an authorized gateException if that's warranted. `excludeStepId`
 * lets the caller ask "excluding the very step I'm about to complete,
 * is anything else still outstanding?" so a blocked first attempt
 * doesn't burn the step before the caller can retry with an exception.
 */
async function enforceCompleteGateOrThrow(
  repository: WorkflowRepository,
  accessToken: string,
  instance: WorkflowInstance,
  exception?: GateException,
  excludeStepId?: string,
): Promise<void> {
  const outstanding = await findOutstandingGatedSteps(repository, accessToken, instance, excludeStepId);
  if (outstanding.length === 0) return;

  if (!exception) {
    await repository.insertEvent(accessToken, {
      instanceId: instance.id,
      stepInstanceId: null,
      eventType: "gate_blocked",
      payload: { outstandingStepIds: outstanding.map((s) => s.id) },
    });
    throw new IncompleteGateError(
      `cannot reach a complete node: ${outstanding.length} required evidence/approval step(s) are not completed`,
    );
  }

  await applyGateException(repository, accessToken, instance, exception, outstanding);
}

/**
 * Starts a new workflow instance from a definition's currently
 * published version, pinning workflow_version_id for the instance's
 * whole lifecycle (BRD §6.3) — this pin is never updated afterwards
 * even if a newer version of the same definition publishes later.
 */
export async function startWorkflowInstance(
  repository: WorkflowRepository,
  accessToken: string,
  definitionId: string,
  startedBy: string | null,
  initialContext: Record<string, unknown> = {},
): Promise<{ instance: WorkflowInstance; stepInstances: WorkflowStepInstance[] }> {
  const definition = await requireDefinition(repository, accessToken, definitionId);
  if (!definition.current_version) {
    throw new VersionNotFoundError(`definition ${definitionId} has no published version to instantiate`);
  }
  const versions = await repository.listVersions(accessToken, definitionId);
  const version = versions.find((v) => v.version === definition.current_version);
  if (!version) throw new VersionNotFoundError(`published version ${definition.current_version} not found for definition ${definitionId}`);

  const instance = await repository.createInstance(accessToken, {
    definitionId,
    versionId: version.id,
    startedBy,
    context: initialContext,
  });
  await repository.insertEvent(accessToken, {
    instanceId: instance.id,
    stepInstanceId: null,
    eventType: "started",
    payload: { workflowVersionId: version.id },
  });

  const graph = await repository.getVersionGraph(accessToken, version.id);
  const [startNodeId] = findStartNodeIds(graph);
  if (!startNodeId) throw new NoStartNodeError(`version ${version.id} has no unambiguous start node to run`);
  const startNode = graph.nodes.find((n) => n.id === startNodeId)!;

  const indexed = indexGraph(graph);
  const touched: WorkflowStepInstance[] = [];
  await activateNode(repository, accessToken, instance, graph, indexed, startNode, touched);

  const finalInstance = await requireInstance(repository, accessToken, instance.id);
  return { instance: finalInstance, stepInstances: touched };
}

export interface CompleteStepInstanceOptions {
  output?: Record<string, unknown>;
  /** Required if completing this step would otherwise unblock a `complete` node gated by FR-WI-010; see enforceCompleteGateOrThrow. */
  gateException?: GateException;
}

/**
 * Records a step instance's output (form data, evidence reference,
 * approval decision, etc — whatever M07/M08 or a direct caller
 * supplies) and resumes execution from that node, exactly the entry
 * point M07 (task completion) and M08 (approval decision) will call
 * once they exist.
 */
export async function completeStepInstance(
  repository: WorkflowRepository,
  accessToken: string,
  stepInstanceId: string,
  options: CompleteStepInstanceOptions = {},
): Promise<{ instance: WorkflowInstance; stepInstances: WorkflowStepInstance[] }> {
  const step = await requireStepInstance(repository, accessToken, stepInstanceId);
  if (step.status !== "waiting" && step.status !== "active") {
    throw new StepInstanceNotActionableError(`step instance ${stepInstanceId} is ${step.status}, not waiting/active`);
  }
  const instance = await requireInstance(repository, accessToken, step.workflow_instance_id);
  if (instance.status !== "running") {
    throw new InstanceNotRunningError(`workflow instance ${instance.id} is ${instance.status}, not running`);
  }

  const graph = await repository.getVersionGraph(accessToken, instance.workflow_version_id);
  const indexed = indexGraph(graph);
  const node = indexed.nodesById.get(step.node_id);
  if (!node) throw new StepInstanceNotFoundError(`step instance ${stepInstanceId} has no matching node`);

  // FR-WI-010: if completing this step would immediately unblock a
  // `complete` node (this step is the last outstanding predecessor),
  // check the gate — excluding this very step, since it is in the
  // process of being completed — before persisting anything, so a
  // blocked attempt leaves this step instance untouched and retryable
  // with a gateException rather than burning the step on a failed
  // first call. Only runs when the next hop actually is a complete
  // node; other transitions are unaffected.
  const outgoing = indexed.outgoingByNode.get(node.id) ?? [];
  const wouldReachComplete = outgoing.some((t) => indexed.nodesById.get(t.to_node_id)?.node_type === "complete");
  if (wouldReachComplete) {
    await enforceCompleteGateOrThrow(repository, accessToken, instance, options.gateException, step.id);
  }

  const completedAt = new Date().toISOString();
  const output = options.output ?? {};
  await repository.updateStepInstance(accessToken, step.id, { status: "completed", completedAt, output });
  step.status = "completed";
  step.completed_at = completedAt;
  step.output = output;
  await repository.insertEvent(accessToken, {
    instanceId: instance.id,
    stepInstanceId: step.id,
    eventType: "step_completed",
    payload: { nodeKey: node.node_key, nodeType: node.node_type, output },
  });

  const touched: WorkflowStepInstance[] = [step];
  const nextNodeIds = resolveNextNodeIds(outgoing, indexed.conditionsById, instance.context);

  for (const nextNodeId of nextNodeIds) {
    const nextNode = indexed.nodesById.get(nextNodeId);
    if (!nextNode) continue;
    const existingSteps = await repository.listStepInstances(accessToken, instance.id);
    const stepInstancesByNodeId = groupByNodeId(existingSteps);
    if (!predecessorsSatisfied(nextNodeId, indexed.incomingByNode, stepInstancesByNodeId)) continue;
    if (stepInstancesByNodeId.has(nextNodeId)) continue;
    await activateNode(repository, accessToken, instance, graph, indexed, nextNode, touched);
  }

  const finalInstance = await requireInstance(repository, accessToken, instance.id);
  return { instance: finalInstance, stepInstances: touched };
}

export async function pauseInstance(
  repository: WorkflowRepository,
  accessToken: string,
  instanceId: string,
): Promise<WorkflowInstance> {
  const instance = await requireInstance(repository, accessToken, instanceId);
  if (instance.status !== "running") {
    throw new InstanceNotRunningError(`workflow instance ${instanceId} is ${instance.status}, not running`);
  }
  const updated = await repository.updateInstance(accessToken, instanceId, { status: "paused" });
  await repository.insertEvent(accessToken, { instanceId, stepInstanceId: null, eventType: "paused", payload: {} });
  return updated;
}

export async function resumeInstance(
  repository: WorkflowRepository,
  accessToken: string,
  instanceId: string,
): Promise<WorkflowInstance> {
  const instance = await requireInstance(repository, accessToken, instanceId);
  if (instance.status !== "paused") {
    throw new InstanceNotPausedError(`workflow instance ${instanceId} is ${instance.status}, not paused`);
  }
  const updated = await repository.updateInstance(accessToken, instanceId, { status: "running" });
  await repository.insertEvent(accessToken, { instanceId, stepInstanceId: null, eventType: "resumed", payload: {} });
  return updated;
}

export async function cancelInstance(
  repository: WorkflowRepository,
  accessToken: string,
  instanceId: string,
  reason: string | null,
): Promise<WorkflowInstance> {
  const instance = await requireInstance(repository, accessToken, instanceId);
  if (instance.status !== "running" && instance.status !== "paused") {
    throw new InstanceNotRunningError(`workflow instance ${instanceId} is ${instance.status}, already terminal`);
  }
  const endedAt = new Date().toISOString();
  const updated = await repository.updateInstance(accessToken, instanceId, { status: "cancelled", endedAt });
  await repository.insertEvent(accessToken, { instanceId, stepInstanceId: null, eventType: "cancelled", payload: { reason } });
  return updated;
}

export async function getWorkflowInstance(
  repository: WorkflowRepository,
  accessToken: string,
  instanceId: string,
): Promise<{ instance: WorkflowInstance; stepInstances: WorkflowStepInstance[] }> {
  const instance = await requireInstance(repository, accessToken, instanceId);
  const stepInstances = await repository.listStepInstances(accessToken, instanceId);
  return { instance, stepInstances };
}
