import type {
  AddConditionInput,
  AddNodeInput,
  AddTransitionInput,
  CreateDefinitionInput,
  CreateEscalationRungInput,
  CreateInstanceInput,
  CreateMigrationInput,
  CreateSlaDefinitionInput,
  CreateStepInstanceInput,
  CreateTaskCommentInput,
  InsertApprovalDecisionInput,
  InsertApprovalRevocationInput,
  InsertConfigurationChangeInput,
  InsertEventInput,
  InsertMigrationInstanceResultInput,
  InsertPublishedConfigurationInput,
  InsertRollbackEventInput,
  InsertSimulationRunInput,
  InsertValidationRunInput,
  InsertVersionInput,
  RecordApprovalInput,
  UpdateInstanceInput,
  UpdateMigrationInput,
  UpdateStepInstanceInput,
  WorkflowRepository,
} from "../modules/workflow/repository.js";
import type {
  ApprovalDecisionRecord,
  ApprovalRevocation,
  ConfigurationApproval,
  ConfigurationChange,
  ConfigurationRollbackEvent,
  ConfigurationSimulationRun,
  ConfigurationValidationRun,
  DefinitionFilters,
  DefinitionStatus,
  EscalationRung,
  PublishedConfiguration,
  SlaDefinition,
  WorkflowCondition,
  WorkflowDefinition,
  WorkflowEvent,
  WorkflowInstance,
  WorkflowMigration,
  WorkflowMigrationInstanceResult,
  WorkflowNode,
  WorkflowStepInstance,
  WorkflowTransition,
  WorkflowVersion,
  WorkflowVersionGraph,
  TaskComment,
  TaskQueueEntry,
  TaskQueueFilters,
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
  validationRuns: ConfigurationValidationRun[] = [];
  simulationRuns: ConfigurationSimulationRun[] = [];
  /** Stand-in for M03's role_definitions — seed with whatever role ids a test needs to resolve. */
  knownRoleIds = new Set<string>();
  instancesById = new Map<string, WorkflowInstance>();
  stepInstancesById = new Map<string, WorkflowStepInstance>();
  events: WorkflowEvent[] = [];
  migrationsById = new Map<string, WorkflowMigration>();
  migrationResults: WorkflowMigrationInstanceResult[] = [];
  taskComments: TaskComment[] = [];
  /** fileObjectId -> workflow_step_instance_id, standing in for file_objects.workflow_step_instance_id (that table lives in modules/tenancy, out of scope for this fake). */
  evidenceLinks = new Map<string, string>();
  /** accessToken -> caller user id, standing in for the Supabase auth.getUser() call listMyWorkQueue/resolveCallerUserId resolve against in the real repository. */
  sessions = new Map<string, string>();
  /** userId -> tenant id, standing in for the service-role app_users lookup getUserTenantId does in the real repository (same shape as FakeAuthorityRepository's userTenants). */
  userTenants = new Map<string, string>();
  approvalDecisions: ApprovalDecisionRecord[] = [];
  approvalRevocations: ApprovalRevocation[] = [];
  slaDefinitionsById = new Map<string, SlaDefinition>();
  escalationRungsById = new Map<string, EscalationRung>();

  addSession(accessToken: string, userId: string, tenantId?: string) {
    this.sessions.set(accessToken, userId);
    if (tenantId) this.userTenants.set(userId, tenantId);
  }

  setUserTenant(userId: string, tenantId: string) {
    this.userTenants.set(userId, tenantId);
  }

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

  async listRoleIds(_accessToken: string): Promise<string[]> {
    return [...this.knownRoleIds];
  }

  async insertValidationRun(_accessToken: string, input: InsertValidationRunInput): Promise<ConfigurationValidationRun> {
    const row: ConfigurationValidationRun = {
      id: nextId("validation-run"),
      tenant_id: TENANT_ID,
      workflow_version_id: input.versionId,
      run_by: input.runBy,
      result: input.result,
      findings: input.findings,
      started_at: new Date(0).toISOString(),
      finished_at: new Date(0).toISOString(),
    };
    this.validationRuns.push(row);
    return row;
  }

  async getLatestValidationRun(_accessToken: string, versionId: string): Promise<ConfigurationValidationRun | null> {
    const runs = this.validationRuns.filter((r) => r.workflow_version_id === versionId);
    return runs.length > 0 ? runs[runs.length - 1]! : null;
  }

  async insertSimulationRun(_accessToken: string, input: InsertSimulationRunInput): Promise<ConfigurationSimulationRun> {
    const row: ConfigurationSimulationRun = {
      id: nextId("simulation-run"),
      tenant_id: TENANT_ID,
      workflow_version_id: input.versionId,
      run_by: input.runBy,
      test_cases: input.testCases,
      result: input.result,
      started_at: new Date(0).toISOString(),
      finished_at: new Date(0).toISOString(),
    };
    this.simulationRuns.push(row);
    return row;
  }

  async createInstance(_accessToken: string, input: CreateInstanceInput): Promise<WorkflowInstance> {
    const instance: WorkflowInstance = {
      id: nextId("workflow-instance"),
      tenant_id: TENANT_ID,
      workflow_definition_id: input.definitionId,
      workflow_version_id: input.versionId,
      status: "running",
      started_by: input.startedBy,
      started_at: new Date(0).toISOString(),
      ended_at: null,
      context: input.context,
    };
    this.instancesById.set(instance.id, instance);
    return instance;
  }

  async getInstance(_accessToken: string, id: string): Promise<WorkflowInstance | null> {
    return this.instancesById.get(id) ?? null;
  }

  async updateInstance(_accessToken: string, id: string, input: UpdateInstanceInput): Promise<WorkflowInstance> {
    const existing = this.instancesById.get(id);
    if (!existing) throw new Error(`updateInstance: ${id} not found`);
    const updated: WorkflowInstance = {
      ...existing,
      status: input.status ?? existing.status,
      ended_at: input.endedAt !== undefined ? input.endedAt : existing.ended_at,
      context: input.context ?? existing.context,
    };
    this.instancesById.set(id, updated);
    return updated;
  }

  async createStepInstance(_accessToken: string, input: CreateStepInstanceInput): Promise<WorkflowStepInstance> {
    const step: WorkflowStepInstance = {
      id: nextId("workflow-step-instance"),
      tenant_id: TENANT_ID,
      workflow_instance_id: input.instanceId,
      node_id: input.nodeId,
      status: input.status,
      assigned_to: input.assignedTo,
      started_at: new Date(0).toISOString(),
      completed_at: null,
      output: {},
      owner_id: null,
      reviewer_id: null,
      due_at: null,
      priority: "normal",
      blocked_reason: null,
      blocked_at: null,
    };
    this.stepInstancesById.set(step.id, step);
    return step;
  }

  async getStepInstance(_accessToken: string, id: string): Promise<WorkflowStepInstance | null> {
    return this.stepInstancesById.get(id) ?? null;
  }

  async listStepInstances(_accessToken: string, instanceId: string): Promise<WorkflowStepInstance[]> {
    return [...this.stepInstancesById.values()].filter((s) => s.workflow_instance_id === instanceId);
  }

  async updateStepInstance(_accessToken: string, id: string, input: UpdateStepInstanceInput): Promise<WorkflowStepInstance> {
    const existing = this.stepInstancesById.get(id);
    if (!existing) throw new Error(`updateStepInstance: ${id} not found`);
    const updated: WorkflowStepInstance = {
      ...existing,
      status: input.status ?? existing.status,
      assigned_to: input.assignedTo !== undefined ? input.assignedTo : existing.assigned_to,
      completed_at: input.completedAt !== undefined ? input.completedAt : existing.completed_at,
      output: input.output ?? existing.output,
      owner_id: input.ownerId !== undefined ? input.ownerId : existing.owner_id,
      reviewer_id: input.reviewerId !== undefined ? input.reviewerId : existing.reviewer_id,
      due_at: input.dueAt !== undefined ? input.dueAt : existing.due_at,
      priority: input.priority ?? existing.priority,
      blocked_reason: input.blockedReason !== undefined ? input.blockedReason : existing.blocked_reason,
      blocked_at: input.blockedAt !== undefined ? input.blockedAt : existing.blocked_at,
    };
    this.stepInstancesById.set(id, updated);
    return updated;
  }

  async addTaskComment(_accessToken: string, input: CreateTaskCommentInput): Promise<TaskComment> {
    const comment: TaskComment = {
      id: nextId("task-comment"),
      tenant_id: TENANT_ID,
      workflow_step_instance_id: input.workflowStepInstanceId,
      author_id: input.authorId,
      body: input.body,
      created_at: new Date(0).toISOString(),
    };
    this.taskComments.push(comment);
    return comment;
  }

  async listTaskComments(_accessToken: string, workflowStepInstanceId: string): Promise<TaskComment[]> {
    return this.taskComments.filter((c) => c.workflow_step_instance_id === workflowStepInstanceId);
  }

  async attachEvidence(_accessToken: string, fileObjectId: string, workflowStepInstanceId: string): Promise<void> {
    this.evidenceLinks.set(fileObjectId, workflowStepInstanceId);
  }

  async insertEvent(_accessToken: string, input: InsertEventInput): Promise<WorkflowEvent> {
    const event: WorkflowEvent = {
      id: nextId("workflow-event"),
      tenant_id: TENANT_ID,
      workflow_instance_id: input.instanceId,
      step_instance_id: input.stepInstanceId,
      event_type: input.eventType,
      payload: input.payload,
      created_at: new Date(0).toISOString(),
    };
    this.events.push(event);
    return event;
  }

  async listEvents(_accessToken: string, instanceId: string): Promise<WorkflowEvent[]> {
    return this.events.filter((e) => e.workflow_instance_id === instanceId);
  }

  async listRunningInstancesForVersion(_accessToken: string, versionId: string): Promise<WorkflowInstance[]> {
    return [...this.instancesById.values()].filter((i) => i.workflow_version_id === versionId && i.status === "running");
  }

  async migrateInstanceVersion(_accessToken: string, instanceId: string, toVersionId: string): Promise<WorkflowInstance> {
    const existing = this.instancesById.get(instanceId);
    if (!existing) throw new Error(`migrateInstanceVersion: ${instanceId} not found`);
    const updated: WorkflowInstance = { ...existing, workflow_version_id: toVersionId };
    this.instancesById.set(instanceId, updated);
    return updated;
  }

  async createMigration(_accessToken: string, input: CreateMigrationInput): Promise<WorkflowMigration> {
    const migration: WorkflowMigration = {
      id: nextId("workflow-migration"),
      tenant_id: TENANT_ID,
      workflow_definition_id: input.definitionId,
      from_version_id: input.fromVersionId,
      to_version_id: input.toVersionId,
      status: "draft",
      impact_summary: null,
      approved_by: null,
      approved_at: null,
      executed_by: null,
      executed_at: null,
      created_by: input.createdBy,
      created_at: new Date(0).toISOString(),
    };
    this.migrationsById.set(migration.id, migration);
    return migration;
  }

  async getMigration(_accessToken: string, id: string): Promise<WorkflowMigration | null> {
    return this.migrationsById.get(id) ?? null;
  }

  async updateMigration(_accessToken: string, id: string, input: UpdateMigrationInput): Promise<WorkflowMigration> {
    const existing = this.migrationsById.get(id);
    if (!existing) throw new Error(`updateMigration: ${id} not found`);
    const updated: WorkflowMigration = {
      ...existing,
      status: input.status ?? existing.status,
      impact_summary: input.impactSummary !== undefined ? input.impactSummary : existing.impact_summary,
      approved_by: input.approvedBy !== undefined ? input.approvedBy : existing.approved_by,
      approved_at: input.approvedAt !== undefined ? input.approvedAt : existing.approved_at,
      executed_by: input.executedBy !== undefined ? input.executedBy : existing.executed_by,
      executed_at: input.executedAt !== undefined ? input.executedAt : existing.executed_at,
    };
    this.migrationsById.set(id, updated);
    return updated;
  }

  async insertMigrationInstanceResult(
    _accessToken: string,
    input: InsertMigrationInstanceResultInput,
  ): Promise<WorkflowMigrationInstanceResult> {
    const row: WorkflowMigrationInstanceResult = {
      id: nextId("migration-result"),
      tenant_id: TENANT_ID,
      migration_id: input.migrationId,
      workflow_instance_id: input.workflowInstanceId,
      old_step_instance_id: input.oldStepInstanceId,
      new_step_instance_id: input.newStepInstanceId,
      outcome: input.outcome,
      detail: input.detail,
      created_at: new Date(0).toISOString(),
    };
    this.migrationResults.push(row);
    return row;
  }

  async listMigrationInstanceResults(_accessToken: string, migrationId: string): Promise<WorkflowMigrationInstanceResult[]> {
    return this.migrationResults.filter((r) => r.migration_id === migrationId);
  }

  private resolveTaskQueue(filters: TaskQueueFilters): TaskQueueEntry[] {
    let steps = [...this.stepInstancesById.values()];
    if (filters.assignedTo !== undefined) steps = steps.filter((s) => s.assigned_to === filters.assignedTo);
    if (filters.statuses && filters.statuses.length > 0) steps = steps.filter((s) => filters.statuses!.includes(s.status));
    if (filters.dueBefore !== undefined) steps = steps.filter((s) => s.due_at !== null && s.due_at < filters.dueBefore!);
    if (filters.dueAfter !== undefined) steps = steps.filter((s) => s.due_at !== null && s.due_at >= filters.dueAfter!);
    if (filters.blockedOnly) steps = steps.filter((s) => s.blocked_reason !== null);
    if (filters.completedAfter !== undefined)
      steps = steps.filter((s) => s.completed_at !== null && s.completed_at >= filters.completedAfter!);
    if (filters.completedBefore !== undefined)
      steps = steps.filter((s) => s.completed_at !== null && s.completed_at <= filters.completedBefore!);

    const entries: TaskQueueEntry[] = [];
    for (const step of steps) {
      const node = this.nodesById.get(step.node_id);
      if (!node) continue;
      const instance = this.instancesById.get(step.workflow_instance_id);
      entries.push({
        ...step,
        nodeType: node.node_type,
        nodeKey: node.node_key,
        workflowDefinitionId: instance?.workflow_definition_id ?? "",
      });
    }

    if (filters.nodeTypes && filters.nodeTypes.length > 0) {
      const allowed = new Set(filters.nodeTypes);
      return entries.filter((e) => allowed.has(e.nodeType));
    }
    return entries;
  }

  async listMyWorkQueue(accessToken: string): Promise<TaskQueueEntry[]> {
    const userId = this.sessions.get(accessToken);
    if (!userId) throw new Error("no caller context for this access token");
    return this.resolveTaskQueue({ assignedTo: userId, statuses: ["waiting", "active"] });
  }

  async listTaskQueue(_accessToken: string, filters: TaskQueueFilters): Promise<TaskQueueEntry[]> {
    return this.resolveTaskQueue(filters);
  }

  async resolveCallerUserId(accessToken: string): Promise<string | null> {
    return this.sessions.get(accessToken) ?? null;
  }

  async getUserTenantId(userId: string): Promise<string | null> {
    return this.userTenants.get(userId) ?? null;
  }

  async insertApprovalDecision(_accessToken: string, input: InsertApprovalDecisionInput): Promise<ApprovalDecisionRecord> {
    const decision: ApprovalDecisionRecord = {
      id: nextId("approval-decision"),
      tenant_id: TENANT_ID,
      workflow_step_instance_id: input.workflowStepInstanceId,
      sequence_order: input.sequenceOrder,
      approver_id: input.approverId,
      decision: input.decision,
      reason: input.reason,
      decided_by: input.decidedBy,
      decided_at: new Date(0).toISOString(),
    };
    this.approvalDecisions.push(decision);
    return decision;
  }

  async listApprovalDecisions(_accessToken: string, workflowStepInstanceId: string): Promise<ApprovalDecisionRecord[]> {
    return this.approvalDecisions.filter((d) => d.workflow_step_instance_id === workflowStepInstanceId);
  }

  async getApprovalDecision(_accessToken: string, id: string): Promise<ApprovalDecisionRecord | null> {
    return this.approvalDecisions.find((d) => d.id === id) ?? null;
  }

  async insertApprovalRevocation(_accessToken: string, input: InsertApprovalRevocationInput): Promise<ApprovalRevocation> {
    const revocation: ApprovalRevocation = {
      id: nextId("approval-revocation"),
      tenant_id: TENANT_ID,
      approval_decision_id: input.approvalDecisionId,
      revoked_by: input.revokedBy,
      reason: input.reason,
      created_at: new Date(0).toISOString(),
    };
    this.approvalRevocations.push(revocation);
    return revocation;
  }

  async listApprovalRevocations(_accessToken: string, approvalDecisionId: string): Promise<ApprovalRevocation[]> {
    return this.approvalRevocations.filter((r) => r.approval_decision_id === approvalDecisionId);
  }

  async createSlaDefinition(_accessToken: string, input: CreateSlaDefinitionInput): Promise<SlaDefinition> {
    const definition: SlaDefinition = {
      id: nextId("sla-definition"),
      tenant_id: TENANT_ID,
      key: input.key,
      name: input.name,
      warning_threshold_seconds: input.warningThresholdSeconds,
      breach_threshold_seconds: input.breachThresholdSeconds,
      created_by: input.createdBy,
      created_at: new Date(0).toISOString(),
    };
    this.slaDefinitionsById.set(definition.id, definition);
    return definition;
  }

  async listSlaDefinitions(_accessToken: string): Promise<SlaDefinition[]> {
    return [...this.slaDefinitionsById.values()];
  }

  async getSlaDefinitionByKey(_accessToken: string, key: string): Promise<SlaDefinition | null> {
    return [...this.slaDefinitionsById.values()].find((d) => d.key === key) ?? null;
  }

  async createEscalationRung(_accessToken: string, input: CreateEscalationRungInput): Promise<EscalationRung> {
    const rung: EscalationRung = {
      id: nextId("escalation-rung"),
      tenant_id: TENANT_ID,
      sla_definition_id: input.slaDefinitionId,
      rung_order: input.rungOrder,
      delay_after_breach_seconds: input.delayAfterBreachSeconds,
      action_type: input.actionType,
      action_role_id: input.actionRoleId ?? null,
      created_at: new Date(0).toISOString(),
    };
    this.escalationRungsById.set(rung.id, rung);
    return rung;
  }

  async listEscalationRungs(_accessToken: string, slaDefinitionId: string): Promise<EscalationRung[]> {
    return [...this.escalationRungsById.values()]
      .filter((r) => r.sla_definition_id === slaDefinitionId)
      .sort((a, b) => a.rung_order - b.rung_order);
  }
}
