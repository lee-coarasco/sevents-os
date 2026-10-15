import type {
  AddConditionInput,
  AddNodeInput,
  AddTransitionInput,
  CreateDefinitionInput,
  InsertConfigurationChangeInput,
  InsertPublishedConfigurationInput,
  InsertRollbackEventInput,
  InsertVersionInput,
  RecordApprovalInput,
  WorkflowRepository,
} from "../modules/workflow/repository.js";
import type {
  ConfigurationApproval,
  ConfigurationChange,
  ConfigurationRollbackEvent,
  DefinitionFilters,
  DefinitionStatus,
  PublishedConfiguration,
  WorkflowCondition,
  WorkflowDefinition,
  WorkflowNode,
  WorkflowTransition,
  WorkflowVersion,
  WorkflowVersionGraph,
} from "../modules/workflow/types.js";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

const TENANT_ID = "tenant-a";

/**
 * In-memory stand-in for WorkflowRepository. Unlike FakeCatalogueRepository
 * (platform-wide, nullable tenant), these tables are per-tenant NOT NULL
 * (DECISIONS.md 2026-10-15), so every row carries a fixed tenant id —
 * this fake doesn't need to resolve it per access token since no test
 * in this ticket exercises cross-tenant isolation (that's covered at
 * the RLS/migration level, same as every prior module's fake).
 */
export class FakeWorkflowRepository implements WorkflowRepository {
  definitionsById = new Map<string, WorkflowDefinition>();
  versionsById = new Map<string, WorkflowVersion>();
  nodesById = new Map<string, WorkflowNode>();
  transitionsById = new Map<string, WorkflowTransition>();
  conditionsById = new Map<string, WorkflowCondition>();
  changes: ConfigurationChange[] = [];
  approvals: ConfigurationApproval[] = [];
  publishedConfigurations: PublishedConfiguration[] = [];
  rollbackEvents: ConfigurationRollbackEvent[] = [];

  async createDefinition(_accessToken: string, input: CreateDefinitionInput) {
    const definition: WorkflowDefinition = {
      id: nextId("workflow-def"),
      tenant_id: TENANT_ID,
      key: input.key,
      name: input.name,
      description: input.description,
      capability_key: input.capabilityKey,
      status: "draft",
      current_version: null,
      created_by: input.createdBy,
      updated_by: input.createdBy,
    };
    this.definitionsById.set(definition.id, definition);

    const version: WorkflowVersion = {
      id: nextId("workflow-version"),
      tenant_id: TENANT_ID,
      workflow_definition_id: definition.id,
      version: 1,
      status: "draft",
      effective_from: null,
      effective_to: null,
      rollback_of_version: null,
      published_by: null,
      published_at: null,
      created_by: input.createdBy,
      created_at: new Date(0).toISOString(),
    };
    this.versionsById.set(version.id, version);

    return { definition, version };
  }

  async getDefinition(_accessToken: string, id: string): Promise<WorkflowDefinition | null> {
    return this.definitionsById.get(id) ?? null;
  }

  async listDefinitions(_accessToken: string, filters: DefinitionFilters): Promise<WorkflowDefinition[]> {
    return [...this.definitionsById.values()].filter((definition) => {
      if (filters.status && definition.status !== filters.status) return false;
      if (filters.key && definition.key !== filters.key) return false;
      return true;
    });
  }

  async updateDefinitionStatus(
    _accessToken: string,
    id: string,
    status: DefinitionStatus,
    currentVersion: number | null,
    updatedBy: string | null,
  ): Promise<WorkflowDefinition> {
    const existing = this.definitionsById.get(id);
    if (!existing) throw new Error(`updateDefinitionStatus: ${id} not found`);
    const updated: WorkflowDefinition = { ...existing, status, current_version: currentVersion, updated_by: updatedBy };
    this.definitionsById.set(id, updated);
    return updated;
  }

  async insertVersion(_accessToken: string, input: InsertVersionInput): Promise<WorkflowVersion> {
    const version: WorkflowVersion = {
      id: nextId("workflow-version"),
      tenant_id: TENANT_ID,
      workflow_definition_id: input.definitionId,
      version: input.version,
      status: input.status,
      effective_from: null,
      effective_to: null,
      rollback_of_version: input.rollbackOfVersion,
      published_by: null,
      published_at: null,
      created_by: input.createdBy,
      created_at: new Date(0).toISOString(),
    };
    this.versionsById.set(version.id, version);
    return version;
  }

  async getVersion(_accessToken: string, id: string): Promise<WorkflowVersion | null> {
    return this.versionsById.get(id) ?? null;
  }

  async listVersions(_accessToken: string, definitionId: string): Promise<WorkflowVersion[]> {
    return [...this.versionsById.values()]
      .filter((v) => v.workflow_definition_id === definitionId)
      .sort((a, b) => a.version - b.version);
  }

  async markVersionPublished(
    _accessToken: string,
    id: string,
    publishedBy: string | null,
    effectiveFrom: string,
  ): Promise<WorkflowVersion> {
    const existing = this.versionsById.get(id);
    if (!existing) throw new Error(`markVersionPublished: ${id} not found`);
    const updated: WorkflowVersion = {
      ...existing,
      status: "published",
      published_by: publishedBy,
      published_at: effectiveFrom,
      effective_from: effectiveFrom,
    };
    this.versionsById.set(id, updated);
    return updated;
  }

  async addNode(_accessToken: string, input: AddNodeInput): Promise<WorkflowNode> {
    const node: WorkflowNode = {
      id: nextId("workflow-node"),
      tenant_id: TENANT_ID,
      workflow_version_id: input.versionId,
      node_key: input.nodeKey,
      node_type: input.nodeType,
      config: input.config,
    };
    this.nodesById.set(node.id, node);
    return node;
  }

  async addTransition(_accessToken: string, input: AddTransitionInput): Promise<WorkflowTransition> {
    const transition: WorkflowTransition = {
      id: nextId("workflow-transition"),
      tenant_id: TENANT_ID,
      workflow_version_id: input.versionId,
      from_node_id: input.fromNodeId,
      to_node_id: input.toNodeId,
      condition_id: input.conditionId,
      order_index: input.orderIndex,
    };
    this.transitionsById.set(transition.id, transition);
    return transition;
  }

  async addCondition(_accessToken: string, input: AddConditionInput): Promise<WorkflowCondition> {
    const condition: WorkflowCondition = {
      id: nextId("workflow-condition"),
      tenant_id: TENANT_ID,
      workflow_version_id: input.versionId,
      expression: input.expression,
      description: input.description,
    };
    this.conditionsById.set(condition.id, condition);
    return condition;
  }

  async getVersionGraph(_accessToken: string, versionId: string): Promise<WorkflowVersionGraph> {
    return {
      nodes: [...this.nodesById.values()].filter((n) => n.workflow_version_id === versionId),
      transitions: [...this.transitionsById.values()].filter((t) => t.workflow_version_id === versionId),
      conditions: [...this.conditionsById.values()].filter((c) => c.workflow_version_id === versionId),
    };
  }

  async recordApproval(_accessToken: string, input: RecordApprovalInput): Promise<ConfigurationApproval> {
    const approval: ConfigurationApproval = {
      id: nextId("approval"),
      tenant_id: TENANT_ID,
      workflow_version_id: input.versionId,
      approver_id: input.approverId,
      decision: input.decision,
      comment: input.comment,
      decided_at: new Date(0).toISOString(),
    };
    this.approvals.push(approval);
    return approval;
  }

  async insertPublishedConfiguration(
    _accessToken: string,
    input: InsertPublishedConfigurationInput,
  ): Promise<PublishedConfiguration> {
    const row: PublishedConfiguration = {
      id: nextId("published"),
      tenant_id: TENANT_ID,
      workflow_definition_id: input.definitionId,
      workflow_version_id: input.versionId,
      effective_from: input.effectiveFrom,
      published_by: input.publishedBy,
      published_at: new Date(0).toISOString(),
    };
    this.publishedConfigurations.push(row);
    return row;
  }

  async insertRollbackEvent(_accessToken: string, input: InsertRollbackEventInput): Promise<ConfigurationRollbackEvent> {
    const row: ConfigurationRollbackEvent = {
      id: nextId("rollback"),
      tenant_id: TENANT_ID,
      workflow_definition_id: input.definitionId,
      from_version: input.fromVersion,
      to_version: input.toVersion,
      rolled_back_by: input.rolledBackBy,
      reason: input.reason,
      created_at: new Date(0).toISOString(),
    };
    this.rollbackEvents.push(row);
    return row;
  }

  async insertConfigurationChange(_accessToken: string, input: InsertConfigurationChangeInput): Promise<ConfigurationChange> {
    const row: ConfigurationChange = {
      id: nextId("change"),
      tenant_id: TENANT_ID,
      entity_type: "workflow_definition",
      entity_id: input.entityId,
      workflow_version_id: input.workflowVersionId,
      change_type: input.changeType,
      diff: input.diff,
      reason: input.reason,
      changed_by: input.changedBy,
      created_at: new Date(0).toISOString(),
    };
    this.changes.push(row);
    return row;
  }
}
