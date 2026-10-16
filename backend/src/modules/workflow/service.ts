import type { AuthorityRepository } from "../authority/repository.js";
import { checkSegregationOfDuties, isWithinApprovalLimit } from "../authority/service.js";
import { normalizeApprovalChainConfig, pendingApproverIds, resolveChainOutcome } from "./approvals.js";
import { computeImpactSummary, isOpenStepInstance } from "./migration.js";
import type {
  AddConditionInput,
  AddNodeInput,
  AddTransitionInput,
  CreateEscalationRungInput,
  CreateSlaDefinitionInput,
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
import { computeStepSlaState, type StepSlaState } from "./sla.js";
import { NODE_TYPES } from "./types.js";
import type {
  ApprovalChainDecision,
  ApprovalDecisionRecord,
  ApprovalDetail,
  ConfigurationSimulationRun,
  ConfigurationValidationRun,
  DefinitionFilters,
  EscalationRung,
  GateException,
  SimulationTestCase,
  SlaDefinition,
  TaskQueueEntry,
  WorkflowCondition,
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowMigration,
  WorkflowMigrationInstanceResult,
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
export class MigrationNotFoundError extends Error {}
export class MigrationVersionMismatchError extends Error {}
export class MigrationNotPreviewedError extends Error {}
export class MigrationNotApprovedError extends Error {}
export class MigrationAlreadyFinalError extends Error {}
/** Ticket 0081 (M31a): a step's node config references an sla_definitions key that doesn't exist in this tenant. */
export class SlaDefinitionNotFoundError extends Error {}
export class NotAnApprovalStepError extends Error {}
export class NotAnEligibleApproverError extends Error {}
export class MissingApprovalReasonError extends Error {}
export class ApprovalLimitFieldsMissingError extends Error {}
export class ApprovalLimitExceededError extends Error {}
export class SegregationOfDutiesViolationError extends Error {}
export class ApprovalDecisionNotFoundError extends Error {}
export class ApprovalDecisionAlreadyRevokedError extends Error {}
export class MissingRevocationReasonError extends Error {}
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

// ---------------------------------------------------------------------------
// Task metadata, blocking, comments & evidence (ticket 0070, M07a)
// ---------------------------------------------------------------------------

export class MissingBlockReasonError extends Error {}

function requireOpenStep(step: WorkflowStepInstance): void {
  if (step.status === "completed" || step.status === "skipped" || step.status === "failed") {
    throw new StepInstanceNotActionableError(`step instance ${step.id} is ${step.status}, not waiting/active`);
  }
}

/** FR-TASK-004: blocked requires a reason. Legal only while the step is still open (waiting/active). */
export async function setTaskBlocked(
  repository: WorkflowRepository,
  accessToken: string,
  stepInstanceId: string,
  reason: string,
): Promise<WorkflowStepInstance> {
  if (!reason.trim()) throw new MissingBlockReasonError("a blocked task requires a non-empty reason");
  const step = await requireStepInstance(repository, accessToken, stepInstanceId);
  requireOpenStep(step);
  const blockedAt = new Date().toISOString();
  const updated = await repository.updateStepInstance(accessToken, stepInstanceId, {
    blockedReason: reason,
    blockedAt,
  });
  await repository.insertEvent(accessToken, {
    instanceId: step.workflow_instance_id,
    stepInstanceId: step.id,
    eventType: "task_blocked",
    payload: { reason },
  });
  return updated;
}

export async function clearTaskBlocked(
  repository: WorkflowRepository,
  accessToken: string,
  stepInstanceId: string,
): Promise<WorkflowStepInstance> {
  const step = await requireStepInstance(repository, accessToken, stepInstanceId);
  requireOpenStep(step);
  const updated = await repository.updateStepInstance(accessToken, stepInstanceId, {
    blockedReason: null,
    blockedAt: null,
  });
  await repository.insertEvent(accessToken, {
    instanceId: step.workflow_instance_id,
    stepInstanceId: step.id,
    eventType: "task_unblocked",
    payload: {},
  });
  return updated;
}

export async function addTaskComment(
  repository: WorkflowRepository,
  accessToken: string,
  stepInstanceId: string,
  authorId: string | null,
  body: string,
) {
  const step = await requireStepInstance(repository, accessToken, stepInstanceId);
  const comment = await repository.addTaskComment(accessToken, {
    workflowStepInstanceId: stepInstanceId,
    authorId,
    body,
  });
  await repository.insertEvent(accessToken, {
    instanceId: step.workflow_instance_id,
    stepInstanceId: step.id,
    eventType: "comment_added",
    payload: { commentId: comment.id },
  });
  return comment;
}

export async function attachTaskEvidence(
  repository: WorkflowRepository,
  accessToken: string,
  stepInstanceId: string,
  fileObjectId: string,
): Promise<void> {
  const step = await requireStepInstance(repository, accessToken, stepInstanceId);
  await repository.attachEvidence(accessToken, fileObjectId, stepInstanceId);
  await repository.insertEvent(accessToken, {
    instanceId: step.workflow_instance_id,
    stepInstanceId: step.id,
    eventType: "evidence_attached",
    payload: { fileObjectId },
  });
}

// ---------------------------------------------------------------------------
// Task reassignment & delegation, audited (ticket 0072, M07c)
// ---------------------------------------------------------------------------

export class CrossTenantError extends Error {
  constructor(message = "the new assignee is not in this step instance's tenant") {
    super(message);
  }
}

/**
 * Shared by reassignTask/delegateTask: the target must be a real caller
 * in the same tenant as the step instance — same "resolve then compare"
 * shape as modules/authority's assignRole/CrossTenantError, just backed
 * by workflow's own getUserTenantId instead of authority's.
 */
async function requireSameTenantTarget(
  repository: WorkflowRepository,
  targetUserId: string,
  step: WorkflowStepInstance,
): Promise<void> {
  const targetTenantId = await repository.getUserTenantId(targetUserId);
  if (!targetTenantId || targetTenantId !== step.tenant_id) {
    throw new CrossTenantError();
  }
}

/** FR-TASK-005: reassignment is audited. Legal only while the step is still open (waiting/active), same guard as blocking. */
export async function reassignTask(
  repository: WorkflowRepository,
  accessToken: string,
  stepInstanceId: string,
  newAssigneeUserId: string,
  reason: string | null,
): Promise<WorkflowStepInstance> {
  const step = await requireStepInstance(repository, accessToken, stepInstanceId);
  requireOpenStep(step);
  await requireSameTenantTarget(repository, newAssigneeUserId, step);
  const from = step.assigned_to;
  const updated = await repository.updateStepInstance(accessToken, stepInstanceId, { assignedTo: newAssigneeUserId });
  await repository.insertEvent(accessToken, {
    instanceId: step.workflow_instance_id,
    stepInstanceId: step.id,
    eventType: "task_reassigned",
    payload: { from, to: newAssigneeUserId, reason },
  });
  return updated;
}

/**
 * Scope decision (see DECISIONS.md): a task "delegation" is a
 * reassignment that records `task_delegated` instead of
 * `task_reassigned`, not a second temporal Delegation entity like
 * ticket 0056's authority delegations — there is no auto-expiring
 * delegation window for tasks yet.
 */
export async function delegateTask(
  repository: WorkflowRepository,
  accessToken: string,
  stepInstanceId: string,
  delegateUserId: string,
  reason: string | null,
): Promise<WorkflowStepInstance> {
  const step = await requireStepInstance(repository, accessToken, stepInstanceId);
  requireOpenStep(step);
  await requireSameTenantTarget(repository, delegateUserId, step);
  const from = step.assigned_to;
  const updated = await repository.updateStepInstance(accessToken, stepInstanceId, { assignedTo: delegateUserId });
  await repository.insertEvent(accessToken, {
    instanceId: step.workflow_instance_id,
    stepInstanceId: step.id,
    eventType: "task_delegated",
    payload: { from, to: delegateUserId, reason, delegated: true },
  });
  return updated;
}

// ---------------------------------------------------------------------------
// My Work / Team Work queue views (ticket 0071, M07b)
// ---------------------------------------------------------------------------

/** BRD §8.3 FR-TASK-001's open statuses — a task is "in the queues" while waiting on or being actively worked. */
const OPEN_TASK_STATUSES: WorkflowStepInstance["status"][] = ["waiting", "active"];

/** Default window for Due Soon when the caller doesn't supply one — documented here, not a hard-coded business rule. */
export const DEFAULT_DUE_SOON_WINDOW_HOURS = 72;
/** Default lookback for Completed when the caller supplies no range — avoids an unbounded history query by default. */
export const DEFAULT_COMPLETED_RANGE_DAYS = 30;

export async function myWorkQueue(repository: WorkflowRepository, accessToken: string): Promise<TaskQueueEntry[]> {
  return repository.listMyWorkQueue(accessToken);
}

/** "Team" is left undefined by BRD/PRD — this defaults to every open task in the caller's tenant; see DECISIONS.md. */
export async function teamWorkQueue(repository: WorkflowRepository, accessToken: string): Promise<TaskQueueEntry[]> {
  return repository.listTaskQueue(accessToken, { statuses: OPEN_TASK_STATUSES });
}

export async function dueSoonQueue(
  repository: WorkflowRepository,
  accessToken: string,
  windowHours: number = DEFAULT_DUE_SOON_WINDOW_HOURS,
): Promise<TaskQueueEntry[]> {
  const now = new Date();
  const dueBefore = new Date(now.getTime() + windowHours * 60 * 60 * 1000).toISOString();
  return repository.listTaskQueue(accessToken, { statuses: OPEN_TASK_STATUSES, dueAfter: now.toISOString(), dueBefore });
}

export async function overdueQueue(repository: WorkflowRepository, accessToken: string): Promise<TaskQueueEntry[]> {
  return repository.listTaskQueue(accessToken, { statuses: OPEN_TASK_STATUSES, dueBefore: new Date().toISOString() });
}

export async function blockedQueue(repository: WorkflowRepository, accessToken: string): Promise<TaskQueueEntry[]> {
  return repository.listTaskQueue(accessToken, { statuses: OPEN_TASK_STATUSES, blockedOnly: true });
}

export async function waitingApprovalQueue(repository: WorkflowRepository, accessToken: string): Promise<TaskQueueEntry[]> {
  return repository.listTaskQueue(accessToken, { statuses: OPEN_TASK_STATUSES, nodeTypes: ["request_approval"] });
}

export async function completedQueue(
  repository: WorkflowRepository,
  accessToken: string,
  range: { from?: string; to?: string } = {},
): Promise<TaskQueueEntry[]> {
  const to = range.to ?? new Date().toISOString();
  const from = range.from ?? new Date(Date.parse(to) - DEFAULT_COMPLETED_RANGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  return repository.listTaskQueue(accessToken, { statuses: ["completed"], completedAfter: from, completedBefore: to });
}

// ---------------------------------------------------------------------------
// Migration of active instances to a newer version (ticket 0063, M06d)
// ---------------------------------------------------------------------------

async function requireMigration(repository: WorkflowRepository, accessToken: string, id: string): Promise<WorkflowMigration> {
  const migration = await repository.getMigration(accessToken, id);
  if (!migration) throw new MigrationNotFoundError(`workflow migration ${id} not found`);
  return migration;
}

/** Opens a draft migration between two versions of the same definition. Nothing is read/written about running instances yet — see previewMigration. */
export async function createMigration(
  repository: WorkflowRepository,
  accessToken: string,
  fromVersionId: string,
  toVersionId: string,
  createdBy: string | null,
): Promise<WorkflowMigration> {
  if (fromVersionId === toVersionId) {
    throw new MigrationVersionMismatchError("from and to version must be different versions");
  }
  const fromVersion = await requireVersion(repository, accessToken, fromVersionId);
  const toVersion = await requireVersion(repository, accessToken, toVersionId);
  if (fromVersion.workflow_definition_id !== toVersion.workflow_definition_id) {
    throw new MigrationVersionMismatchError(`versions ${fromVersionId} and ${toVersionId} belong to different definitions`);
  }
  return repository.createMigration(accessToken, {
    definitionId: fromVersion.workflow_definition_id,
    fromVersionId,
    toVersionId,
    createdBy,
  });
}

export async function getWorkflowMigration(repository: WorkflowRepository, accessToken: string, id: string): Promise<WorkflowMigration> {
  return requireMigration(repository, accessToken, id);
}

export async function listMigrationInstanceResults(
  repository: WorkflowRepository,
  accessToken: string,
  migrationId: string,
): Promise<WorkflowMigrationInstanceResult[]> {
  await requireMigration(repository, accessToken, migrationId);
  return repository.listMigrationInstanceResults(accessToken, migrationId);
}

/**
 * BRD §8.2 "preview with impact summary": read-only — computes, but
 * never writes to, any workflow_instance/workflow_step_instance row.
 * Re-running this (e.g. after fixing a draft's target version) just
 * overwrites the stored impact_summary and resets status back to
 * "previewed"; a migration can be previewed repeatedly before approval.
 */
export async function previewMigration(
  repository: WorkflowRepository,
  accessToken: string,
  migrationId: string,
): Promise<WorkflowMigration> {
  const migration = await requireMigration(repository, accessToken, migrationId);
  if (migration.status === "executed" || migration.status === "cancelled") {
    throw new MigrationAlreadyFinalError(`migration ${migrationId} is ${migration.status} and can no longer be previewed`);
  }

  const [fromGraph, toGraph] = await Promise.all([
    repository.getVersionGraph(accessToken, migration.from_version_id),
    repository.getVersionGraph(accessToken, migration.to_version_id),
  ]);
  const instances = await repository.listRunningInstancesForVersion(accessToken, migration.from_version_id);
  const instanceOpenSteps = await Promise.all(
    instances.map(async (instance) => ({
      workflowInstanceId: instance.id,
      openSteps: (await repository.listStepInstances(accessToken, instance.id)).filter(isOpenStepInstance),
    })),
  );

  const impactSummary = computeImpactSummary(migration.from_version_id, migration.to_version_id, fromGraph, toGraph, instanceOpenSteps);
  return repository.updateMigration(accessToken, migrationId, { status: "previewed", impactSummary });
}

/** Approving records who signed off and when; it never moves a single instance — see executeMigration. */
export async function approveMigration(
  repository: WorkflowRepository,
  accessToken: string,
  migrationId: string,
  approvedBy: string | null,
): Promise<WorkflowMigration> {
  const migration = await requireMigration(repository, accessToken, migrationId);
  if (migration.status !== "previewed") {
    throw new MigrationNotPreviewedError(`migration ${migrationId} is ${migration.status}, not previewed`);
  }
  return repository.updateMigration(accessToken, migrationId, { status: "approved", approvedBy, approvedAt: new Date().toISOString() });
}

export async function cancelMigration(repository: WorkflowRepository, accessToken: string, migrationId: string): Promise<WorkflowMigration> {
  const migration = await requireMigration(repository, accessToken, migrationId);
  if (migration.status === "executed" || migration.status === "cancelled") {
    throw new MigrationAlreadyFinalError(`migration ${migrationId} is already ${migration.status}`);
  }
  return repository.updateMigration(accessToken, migrationId, { status: "cancelled" });
}

/**
 * Moves only the instances the stored impact_summary marked
 * auto-mappable; everything else is left on its original version,
 * recorded as a "skipped" result. Cannot run without a prior
 * approveMigration call (status must be "approved").
 */
export async function executeMigration(
  repository: WorkflowRepository,
  accessToken: string,
  migrationId: string,
  executedBy: string | null,
): Promise<{ migration: WorkflowMigration; results: WorkflowMigrationInstanceResult[] }> {
  const migration = await requireMigration(repository, accessToken, migrationId);
  if (migration.status !== "approved") {
    throw new MigrationNotApprovedError(`migration ${migrationId} is ${migration.status}, not approved`);
  }
  const impactSummary = migration.impact_summary;
  if (!impactSummary) {
    throw new MigrationNotPreviewedError(`migration ${migrationId} has no stored impact summary — call previewMigration first`);
  }

  const results: WorkflowMigrationInstanceResult[] = [];

  for (const entry of impactSummary.entries) {
    if (!entry.autoMappable) {
      for (const oldStepInstanceId of entry.openStepInstanceIds) {
        results.push(
          await repository.insertMigrationInstanceResult(accessToken, {
            migrationId,
            workflowInstanceId: entry.workflowInstanceId,
            oldStepInstanceId,
            newStepInstanceId: null,
            outcome: "skipped",
            detail: "no safe 1:1 node_key mapping into the target version",
          }),
        );
      }
      continue;
    }

    try {
      await repository.migrateInstanceVersion(accessToken, entry.workflowInstanceId, migration.to_version_id);
      for (const oldStepInstanceId of entry.openStepInstanceIds) {
        const oldStep = await repository.getStepInstance(accessToken, oldStepInstanceId);
        const newNodeId = oldStep ? entry.nodeIdMap[oldStep.node_id] : undefined;
        if (!oldStep || !newNodeId) {
          results.push(
            await repository.insertMigrationInstanceResult(accessToken, {
              migrationId,
              workflowInstanceId: entry.workflowInstanceId,
              oldStepInstanceId,
              newStepInstanceId: null,
              outcome: "failed",
              detail: !oldStep ? "step instance no longer exists" : "node mapping missing at execute time",
            }),
          );
          continue;
        }

        const newStep = await repository.createStepInstance(accessToken, {
          instanceId: entry.workflowInstanceId,
          nodeId: newNodeId,
          status: oldStep.status,
          assignedTo: oldStep.assigned_to,
        });
        await repository.updateStepInstance(accessToken, oldStepInstanceId, {
          status: "skipped",
          output: { ...oldStep.output, migratedTo: newStep.id, migrationId },
        });
        await repository.insertEvent(accessToken, {
          instanceId: entry.workflowInstanceId,
          stepInstanceId: newStep.id,
          eventType: "migrated",
          payload: {
            migrationId,
            fromVersionId: migration.from_version_id,
            toVersionId: migration.to_version_id,
            oldStepInstanceId,
          },
        });
        results.push(
          await repository.insertMigrationInstanceResult(accessToken, {
            migrationId,
            workflowInstanceId: entry.workflowInstanceId,
            oldStepInstanceId,
            newStepInstanceId: newStep.id,
            outcome: "migrated",
            detail: null,
          }),
        );
      }
    } catch (error) {
      results.push(
        await repository.insertMigrationInstanceResult(accessToken, {
          migrationId,
          workflowInstanceId: entry.workflowInstanceId,
          oldStepInstanceId: null,
          newStepInstanceId: null,
          outcome: "failed",
          detail: error instanceof Error ? error.message : "unknown error",
        }),
      );
    }
  }

  const updatedMigration = await repository.updateMigration(accessToken, migrationId, {
    status: "executed",
    executedBy,
    executedAt: new Date().toISOString(),
  });
  return { migration: updatedMigration, results };
}

// ---------------------------------------------------------------------------
// Approvals & delegation (ticket 0066, M08)
// ---------------------------------------------------------------------------

async function requireApprovalNode(
  repository: WorkflowRepository,
  accessToken: string,
  step: WorkflowStepInstance,
  instance: WorkflowInstance,
): Promise<WorkflowNode> {
  const graph = await repository.getVersionGraph(accessToken, instance.workflow_version_id);
  const node = graph.nodes.find((n) => n.id === step.node_id);
  if (!node || node.node_type !== "request_approval") {
    throw new NotAnApprovalStepError(`step instance ${step.id} is not a request_approval step`);
  }
  return node;
}

/**
 * Decisions still in force for a step's chain — a revoked decision
 * (FR-APP-006) is kept in `approval_decisions` forever but excluded
 * here, so a revoked vote stops counting toward the chain's outcome
 * and (for a sequential chain) frees up that approver's turn again.
 */
async function activeApprovalDecisions(
  repository: WorkflowRepository,
  accessToken: string,
  stepInstanceId: string,
): Promise<ApprovalDecisionRecord[]> {
  const decisions = await repository.listApprovalDecisions(accessToken, stepInstanceId);
  const revocationLists = await Promise.all(
    decisions.map((d) => repository.listApprovalRevocations(accessToken, d.id)),
  );
  return decisions.filter((_, i) => revocationLists[i]!.length === 0);
}

/**
 * FR-APP-002: everything an approver needs before deciding — the
 * request (instance context), evidence (file ids surfaced via this
 * step's evidence_attached events, ticket 0070's attachEvidence),
 * policy/authority status, and audit history. riskFlags is always
 * empty: no risk-scoring engine exists in this codebase (TBD—Business
 * Owner Decision), never fabricated here.
 */
export async function getApprovalDetail(
  repository: WorkflowRepository,
  authorityRepo: AuthorityRepository,
  accessToken: string,
  stepInstanceId: string,
): Promise<ApprovalDetail> {
  const step = await requireStepInstance(repository, accessToken, stepInstanceId);
  const instance = await requireInstance(repository, accessToken, step.workflow_instance_id);
  const node = await requireApprovalNode(repository, accessToken, step, instance);
  const chainConfig = normalizeApprovalChainConfig(node);

  const [decisions, comments, events] = await Promise.all([
    repository.listApprovalDecisions(accessToken, stepInstanceId),
    repository.listTaskComments(accessToken, stepInstanceId),
    repository.listEvents(accessToken, instance.id),
  ]);
  const revocationLists = await Promise.all(decisions.map((d) => repository.listApprovalRevocations(accessToken, d.id)));
  const revocations = revocationLists.flat();

  const auditHistory = events.filter((e) => e.step_instance_id === stepInstanceId || e.step_instance_id === null);
  const evidenceFileObjectIds = events
    .filter((e) => e.step_instance_id === stepInstanceId && e.event_type === "evidence_attached")
    .map((e) => e.payload.fileObjectId)
    .filter((id): id is string => typeof id === "string");

  let authorityCheck: ApprovalDetail["authorityCheck"] = { configured: false, withinLimit: null };
  if (chainConfig?.approvalLimit) {
    const { amountField, currencyField, roleId, departmentId } = chainConfig.approvalLimit;
    const amount = instance.context[amountField];
    const currency = instance.context[currencyField];
    authorityCheck =
      typeof amount === "number" && typeof currency === "string"
        ? {
            configured: true,
            withinLimit: await isWithinApprovalLimit(
              authorityRepo,
              step.tenant_id,
              { roleId: roleId ?? null, departmentId: departmentId ?? null, currency, atIso: new Date().toISOString() },
              amount,
            ),
          }
        : { configured: true, withinLimit: null };
  }

  return {
    stepInstance: step,
    chainConfig,
    decisions,
    revocations,
    requestContext: instance.context,
    comments,
    evidenceFileObjectIds,
    auditHistory,
    authorityCheck,
    riskFlags: [],
  };
}

/**
 * FR-APP-001/003/004: records one approver's decision, checks it
 * against current authority/conflicts when the node asks for that, and
 * — once the chain resolves (immediately on any rejection/return, or
 * once enough approvals land) — completes the step via the same
 * `completeStepInstance` entrypoint any other step type uses, so the
 * ordinary FR-WI-009/010 fan-out and complete-node gate apply unchanged.
 */
export async function decideApprovalStep(
  repository: WorkflowRepository,
  authorityRepo: AuthorityRepository,
  accessToken: string,
  stepInstanceId: string,
  approverId: string,
  decision: ApprovalChainDecision,
  reason: string | null,
): Promise<{ stepInstance: WorkflowStepInstance; chainResolved: boolean }> {
  const step = await requireStepInstance(repository, accessToken, stepInstanceId);
  requireOpenStep(step);
  const instance = await requireInstance(repository, accessToken, step.workflow_instance_id);
  const node = await requireApprovalNode(repository, accessToken, step, instance);

  if (decision !== "approved" && !reason?.trim()) {
    throw new MissingApprovalReasonError("rejection/return-for-correction requires a non-empty reason");
  }

  const chainConfig = normalizeApprovalChainConfig(node) ?? {
    mode: "sequential" as const,
    approverUserIds: [step.assigned_to ?? approverId],
    requiredApprovals: 1,
  };
  const existingDecisions = await activeApprovalDecisions(repository, accessToken, stepInstanceId);
  const eligible = pendingApproverIds(chainConfig, existingDecisions).includes(approverId);
  if (!eligible) {
    throw new NotAnEligibleApproverError(`${approverId} is not an eligible approver for step instance ${stepInstanceId}`);
  }

  if (chainConfig.enforceSegregationOfDuties && !checkSegregationOfDuties({ enforced: true }, instance.started_by ?? "", approverId)) {
    throw new SegregationOfDutiesViolationError("the requester cannot also approve this request");
  }

  if (chainConfig.approvalLimit) {
    const { amountField, currencyField, roleId, departmentId } = chainConfig.approvalLimit;
    const amount = instance.context[amountField];
    const currency = instance.context[currencyField];
    if (typeof amount !== "number" || typeof currency !== "string") {
      throw new ApprovalLimitFieldsMissingError(
        `instance context is missing "${amountField}"/"${currencyField}" required by this node's approvalLimit check`,
      );
    }
    const withinLimit = await isWithinApprovalLimit(
      authorityRepo,
      step.tenant_id,
      { roleId: roleId ?? null, departmentId: departmentId ?? null, currency, atIso: new Date().toISOString() },
      amount,
    );
    if (!withinLimit) throw new ApprovalLimitExceededError(`${approverId} has no approval limit covering ${amount} ${currency}`);
  }

  const sequenceOrder = chainConfig.mode === "sequential" ? chainConfig.approverUserIds.indexOf(approverId) : null;
  const decisionRecord = await repository.insertApprovalDecision(accessToken, {
    workflowStepInstanceId: stepInstanceId,
    sequenceOrder,
    approverId,
    decision,
    reason,
    decidedBy: approverId,
  });
  await repository.insertEvent(accessToken, {
    instanceId: instance.id,
    stepInstanceId: step.id,
    eventType: "approval_decision_recorded",
    payload: { approverId, decision, reason, decisionId: decisionRecord.id },
  });

  const allDecisions = [...existingDecisions, decisionRecord];
  const resolution = resolveChainOutcome(chainConfig, allDecisions);

  if (!resolution.resolved) {
    const next = pendingApproverIds(chainConfig, allDecisions)[0] ?? null;
    const updated = await repository.updateStepInstance(accessToken, stepInstanceId, { assignedTo: next });
    return { stepInstance: updated, chainResolved: false };
  }

  await repository.insertEvent(accessToken, {
    instanceId: instance.id,
    stepInstanceId: step.id,
    eventType: "approval_chain_resolved",
    payload: { decision: resolution.decision, decisionIds: allDecisions.map((d) => d.id) },
  });
  const { stepInstances } = await completeStepInstance(repository, accessToken, stepInstanceId, {
    output: { decision: resolution.decision, approvalDecisionIds: allDecisions.map((d) => d.id) },
  });
  const completedStep = stepInstances.find((s) => s.id === stepInstanceId)!;
  return { stepInstance: completedStep, chainResolved: true };
}

/**
 * FR-APP-006: the only sanctioned way to undo an approval decision.
 * Never deletes or edits the original `approval_decisions` row — just
 * appends a revocation record. If the step is still open, the revoked
 * decision stops counting (activeApprovalDecisions excludes it), so a
 * sequential chain re-opens that approver's turn; if the step already
 * completed and the workflow has advanced past it, this only restores
 * the audit record to "revoked" — rewinding already-advanced workflow
 * progress is explicitly out of scope for this ticket (see
 * DECISIONS.md), same as ticket 0072 declined to build a full temporal
 * Delegation entity speculatively.
 */
export async function revokeApprovalDecision(
  repository: WorkflowRepository,
  accessToken: string,
  approvalDecisionId: string,
  revokedBy: string,
  reason: string,
): Promise<ApprovalDecisionRecord> {
  if (!reason.trim()) throw new MissingRevocationReasonError("a revocation requires a non-empty reason");
  const decisionRecord = await repository.getApprovalDecision(accessToken, approvalDecisionId);
  if (!decisionRecord) throw new ApprovalDecisionNotFoundError(`approval decision ${approvalDecisionId} not found`);
  const existingRevocations = await repository.listApprovalRevocations(accessToken, approvalDecisionId);
  if (existingRevocations.length > 0) {
    throw new ApprovalDecisionAlreadyRevokedError(`approval decision ${approvalDecisionId} is already revoked`);
  }

  const step = await requireStepInstance(repository, accessToken, decisionRecord.workflow_step_instance_id);
  await repository.insertApprovalRevocation(accessToken, { approvalDecisionId, revokedBy, reason });
  await repository.insertEvent(accessToken, {
    instanceId: step.workflow_instance_id,
    stepInstanceId: step.id,
    eventType: "approval_revoked",
    payload: { approvalDecisionId, revokedBy, reason },
  });
  return decisionRecord;
}

// ---------------------------------------------------------------------------
// SLA timers & escalation ladders (ticket 0081, M31a)
// ---------------------------------------------------------------------------

export async function createSlaDefinition(
  repository: WorkflowRepository,
  accessToken: string,
  input: CreateSlaDefinitionInput,
): Promise<SlaDefinition> {
  return repository.createSlaDefinition(accessToken, input);
}

export async function listSlaDefinitions(repository: WorkflowRepository, accessToken: string): Promise<SlaDefinition[]> {
  return repository.listSlaDefinitions(accessToken);
}

export async function createEscalationRung(
  repository: WorkflowRepository,
  accessToken: string,
  input: CreateEscalationRungInput,
): Promise<EscalationRung> {
  return repository.createEscalationRung(accessToken, input);
}

export async function listEscalationRungs(
  repository: WorkflowRepository,
  accessToken: string,
  slaDefinitionId: string,
): Promise<EscalationRung[]> {
  return repository.listEscalationRungs(accessToken, slaDefinitionId);
}

/**
 * The read path a GET endpoint calls: computes this step's current SLA
 * state from recorded data (its node's `config.slaDefinitionKey`, the
 * matching `sla_definitions`/`escalation_rungs` rows, and its own
 * `task_blocked`/`task_unblocked` events for pause time) and, exactly
 * like ticket 0075's baseline-change-request GET, applies the outcome
 * at most once per threshold: if this is the first time this step has
 * been observed in `warning` or `breached`, or the first time a given
 * escalation rung has been reached, it emits the already-declared-but-
 * previously-unused `timer_fired`/`escalated` workflow_events. No
 * background scheduler — SLA state only ever advances when something
 * reads it.
 */
export async function evaluateStepSla(
  repository: WorkflowRepository,
  accessToken: string,
  stepInstanceId: string,
): Promise<StepSlaState> {
  const step = await requireStepInstance(repository, accessToken, stepInstanceId);
  const instance = await requireInstance(repository, accessToken, step.workflow_instance_id);
  const graph = await repository.getVersionGraph(accessToken, instance.workflow_version_id);
  const indexed = indexGraph(graph);
  const node = indexed.nodesById.get(step.node_id);
  const slaDefinitionKey = node?.config?.slaDefinitionKey;

  if (typeof slaDefinitionKey !== "string" || !slaDefinitionKey) {
    return { status: "not_configured", elapsedSeconds: null, pausedSeconds: null, activeRungOrder: null };
  }

  const slaDefinition = await repository.getSlaDefinitionByKey(accessToken, slaDefinitionKey);
  if (!slaDefinition) {
    throw new SlaDefinitionNotFoundError(
      `step instance ${stepInstanceId}'s node references sla_definitions key "${slaDefinitionKey}", which does not exist in this tenant`,
    );
  }

  const [rungs, instanceEvents] = await Promise.all([
    repository.listEscalationRungs(accessToken, slaDefinition.id),
    repository.listEvents(accessToken, instance.id),
  ]);
  const stepEvents = instanceEvents.filter((e) => e.step_instance_id === step.id);
  const pauseEvents = stepEvents.filter((e) => e.event_type === "task_blocked" || e.event_type === "task_unblocked");

  const nowIso = new Date().toISOString();
  const state = computeStepSlaState(step, slaDefinition, rungs, pauseEvents, nowIso);

  if (state.status === "warning" || state.status === "breached") {
    const alreadyFired = stepEvents.some((e) => e.event_type === "timer_fired");
    if (!alreadyFired) {
      await repository.insertEvent(accessToken, {
        instanceId: instance.id,
        stepInstanceId: step.id,
        eventType: "timer_fired",
        payload: { slaDefinitionKey, status: state.status },
      });
    }
  }

  if (state.status === "breached" && state.activeRungOrder !== null) {
    const rung = rungs.find((r) => r.rung_order === state.activeRungOrder);
    const alreadyEscalatedThisRung = stepEvents.some(
      (e) => e.event_type === "escalated" && e.payload.rungOrder === state.activeRungOrder,
    );
    if (!alreadyEscalatedThisRung) {
      await repository.insertEvent(accessToken, {
        instanceId: instance.id,
        stepInstanceId: step.id,
        eventType: "escalated",
        payload: {
          slaDefinitionKey,
          rungOrder: state.activeRungOrder,
          actionType: rung?.action_type ?? null,
          actionRoleId: rung?.action_role_id ?? null,
        },
      });
    }
  }

  return state;
}
