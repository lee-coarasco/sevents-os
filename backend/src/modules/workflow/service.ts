import type {
  AddConditionInput,
  AddNodeInput,
  AddTransitionInput,
  WorkflowRepository,
} from "./repository.js";
import { simulateGraph } from "./simulation.js";
import { NODE_TYPES } from "./types.js";
import type {
  ConfigurationSimulationRun,
  ConfigurationValidationRun,
  DefinitionFilters,
  SimulationTestCase,
  WorkflowCondition,
  WorkflowDefinition,
  WorkflowNode,
  WorkflowTransition,
  WorkflowVersion,
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
