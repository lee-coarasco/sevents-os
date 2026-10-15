import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ApprovalChainDecision,
  ApprovalDecision,
  ApprovalDecisionRecord,
  ApprovalRevocation,
  ChangeType,
  ConditionExpression,
  ConfigurationApproval,
  ConfigurationChange,
  ConfigurationRollbackEvent,
  ConfigurationSimulationRun,
  ConfigurationValidationRun,
  DefinitionFilters,
  DefinitionStatus,
  InstanceStatus,
  MigrationImpactSummary,
  MigrationInstanceOutcome,
  MigrationStatus,
  NodeType,
  PublishedConfiguration,
  SimulationResultPayload,
  SimulationTestCase,
  StepInstanceStatus,
  TaskComment,
  TaskPriority,
  TaskQueueEntry,
  TaskQueueFilters,
  ValidationFinding,
  ValidationResult,
  VersionStatus,
  WorkflowCondition,
  WorkflowDefinition,
  WorkflowEvent,
  WorkflowEventType,
  WorkflowInstance,
  WorkflowMigration,
  WorkflowMigrationInstanceResult,
  WorkflowNode,
  WorkflowStepInstance,
  WorkflowTransition,
  WorkflowVersion,
  WorkflowVersionGraph,
} from "./types.js";

export interface CreateDefinitionInput {
  key: string;
  name: string;
  description: string | null;
  capabilityKey: string | null;
  createdBy: string | null;
}

export interface InsertVersionInput {
  definitionId: string;
  version: number;
  status: VersionStatus;
  rollbackOfVersion: number | null;
  createdBy: string | null;
}

export interface AddNodeInput {
  versionId: string;
  nodeKey: string;
  nodeType: NodeType;
  config: Record<string, unknown>;
}

export interface AddTransitionInput {
  versionId: string;
  fromNodeId: string;
  toNodeId: string;
  conditionId: string | null;
  orderIndex: number;
}

export interface AddConditionInput {
  versionId: string;
  expression: ConditionExpression;
  description: string | null;
}

export interface RecordApprovalInput {
  versionId: string;
  approverId: string | null;
  decision: ApprovalDecision;
  comment: string | null;
}

export interface InsertPublishedConfigurationInput {
  definitionId: string;
  versionId: string;
  effectiveFrom: string;
  publishedBy: string | null;
}

export interface InsertRollbackEventInput {
  definitionId: string;
  fromVersion: number | null;
  toVersion: number;
  rolledBackBy: string | null;
  reason: string | null;
}

export interface InsertConfigurationChangeInput {
  entityId: string;
  workflowVersionId: string | null;
  changeType: ChangeType;
  diff: Record<string, unknown>;
  reason: string | null;
  changedBy: string | null;
}

export interface InsertValidationRunInput {
  versionId: string;
  runBy: string | null;
  result: ValidationResult;
  findings: ValidationFinding[];
}

export interface InsertSimulationRunInput {
  versionId: string;
  runBy: string | null;
  testCases: SimulationTestCase[];
  result: SimulationResultPayload;
}

export interface CreateInstanceInput {
  definitionId: string;
  versionId: string;
  startedBy: string | null;
  context: Record<string, unknown>;
}

export interface UpdateInstanceInput {
  status?: InstanceStatus;
  endedAt?: string | null;
  context?: Record<string, unknown>;
}

export interface CreateStepInstanceInput {
  instanceId: string;
  nodeId: string;
  status: StepInstanceStatus;
  assignedTo: string | null;
}

export interface UpdateStepInstanceInput {
  status?: StepInstanceStatus;
  assignedTo?: string | null;
  completedAt?: string | null;
  output?: Record<string, unknown>;
  ownerId?: string | null;
  reviewerId?: string | null;
  dueAt?: string | null;
  priority?: TaskPriority;
  blockedReason?: string | null;
  blockedAt?: string | null;
}

export interface CreateTaskCommentInput {
  workflowStepInstanceId: string;
  authorId: string | null;
  body: string;
}

export interface InsertEventInput {
  instanceId: string;
  stepInstanceId: string | null;
  eventType: WorkflowEventType;
  payload: Record<string, unknown>;
}

export interface CreateMigrationInput {
  definitionId: string;
  fromVersionId: string;
  toVersionId: string;
  createdBy: string | null;
}

export interface UpdateMigrationInput {
  status?: MigrationStatus;
  impactSummary?: MigrationImpactSummary;
  approvedBy?: string | null;
  approvedAt?: string | null;
  executedBy?: string | null;
  executedAt?: string | null;
}

/** Ticket 0066 (M08). */
export interface InsertApprovalDecisionInput {
  workflowStepInstanceId: string;
  sequenceOrder: number | null;
  approverId: string;
  decision: ApprovalChainDecision;
  reason: string | null;
  decidedBy: string;
}

export interface InsertApprovalRevocationInput {
  approvalDecisionId: string;
  revokedBy: string;
  reason: string;
}

export interface InsertMigrationInstanceResultInput {
  migrationId: string;
  workflowInstanceId: string;
  oldStepInstanceId: string | null;
  newStepInstanceId: string | null;
  outcome: MigrationInstanceOutcome;
  detail: string | null;
}

/**
 * Same convention as modules/catalogue and modules/authority: every
 * method takes the caller's own access token and goes through the
 * user-scoped client, relying on RLS for tenant isolation. Unlike the
 * catalogue/role_definitions shared-catalogue tables, every table here
 * has a NOT NULL tenant_id (see DECISIONS.md, 2026-10-15 "M06 split...
 * workflow tables use NOT NULL tenant_id") so there is no service-role
 * carve-out — every call is a normal authenticated, tenant-scoped write.
 */
export interface WorkflowRepository {
  createDefinition(
    accessToken: string,
    input: CreateDefinitionInput,
  ): Promise<{ definition: WorkflowDefinition; version: WorkflowVersion }>;
  getDefinition(accessToken: string, id: string): Promise<WorkflowDefinition | null>;
  listDefinitions(accessToken: string, filters: DefinitionFilters): Promise<WorkflowDefinition[]>;
  updateDefinitionStatus(
    accessToken: string,
    id: string,
    status: DefinitionStatus,
    currentVersion: number | null,
    updatedBy: string | null,
  ): Promise<WorkflowDefinition>;

  insertVersion(accessToken: string, input: InsertVersionInput): Promise<WorkflowVersion>;
  getVersion(accessToken: string, id: string): Promise<WorkflowVersion | null>;
  listVersions(accessToken: string, definitionId: string): Promise<WorkflowVersion[]>;
  markVersionPublished(
    accessToken: string,
    id: string,
    publishedBy: string | null,
    effectiveFrom: string,
  ): Promise<WorkflowVersion>;

  addNode(accessToken: string, input: AddNodeInput): Promise<WorkflowNode>;
  addTransition(accessToken: string, input: AddTransitionInput): Promise<WorkflowTransition>;
  addCondition(accessToken: string, input: AddConditionInput): Promise<WorkflowCondition>;
  getVersionGraph(accessToken: string, versionId: string): Promise<WorkflowVersionGraph>;

  recordApproval(accessToken: string, input: RecordApprovalInput): Promise<ConfigurationApproval>;
  insertPublishedConfiguration(
    accessToken: string,
    input: InsertPublishedConfigurationInput,
  ): Promise<PublishedConfiguration>;
  insertRollbackEvent(accessToken: string, input: InsertRollbackEventInput): Promise<ConfigurationRollbackEvent>;
  insertConfigurationChange(accessToken: string, input: InsertConfigurationChangeInput): Promise<ConfigurationChange>;

  /** Known canonical role ids (M03's role_definitions) — used to catch a dangling assign_role_user reference. */
  listRoleIds(accessToken: string): Promise<string[]>;
  insertValidationRun(accessToken: string, input: InsertValidationRunInput): Promise<ConfigurationValidationRun>;
  getLatestValidationRun(accessToken: string, versionId: string): Promise<ConfigurationValidationRun | null>;
  insertSimulationRun(accessToken: string, input: InsertSimulationRunInput): Promise<ConfigurationSimulationRun>;

  /**
   * Instance/step-instance/event CRUD (ticket 0062, M06c). Note
   * updateInstance intentionally has no way to change
   * workflow_version_id — it is set once by createInstance and pinned
   * for the instance's whole lifecycle (BRD §6.3).
   */
  createInstance(accessToken: string, input: CreateInstanceInput): Promise<WorkflowInstance>;
  getInstance(accessToken: string, id: string): Promise<WorkflowInstance | null>;
  updateInstance(accessToken: string, id: string, input: UpdateInstanceInput): Promise<WorkflowInstance>;

  createStepInstance(accessToken: string, input: CreateStepInstanceInput): Promise<WorkflowStepInstance>;
  getStepInstance(accessToken: string, id: string): Promise<WorkflowStepInstance | null>;
  listStepInstances(accessToken: string, instanceId: string): Promise<WorkflowStepInstance[]>;
  updateStepInstance(accessToken: string, id: string, input: UpdateStepInstanceInput): Promise<WorkflowStepInstance>;

  /** Ticket 0070 (M07a): append-only, no update/delete — same construction as auth_audit_log. */
  addTaskComment(accessToken: string, input: CreateTaskCommentInput): Promise<TaskComment>;
  listTaskComments(accessToken: string, workflowStepInstanceId: string): Promise<TaskComment[]>;
  /** Reuses ticket 0055's file_objects — sets its workflow_step_instance_id FK, no second attachment table. */
  attachEvidence(accessToken: string, fileObjectId: string, workflowStepInstanceId: string): Promise<void>;

  /**
   * Ticket 0071 (M07b): self-service My Work — resolves the caller's
   * own id from the access token itself (same construction as
   * modules/workforce's getOwnEmployeeRecord), not a passed-in id, so
   * the route needs no permission beyond a valid session.
   */
  listMyWorkQueue(accessToken: string): Promise<TaskQueueEntry[]>;
  /** Ticket 0072 (M07c): resolves the caller's own id from the access token, same construction as listMyWorkQueue — lets the reassign/delegate routes allow a step's own assignee without the admin-wide permission. */
  resolveCallerUserId(accessToken: string): Promise<string | null>;
  /** Ticket 0072 (M07c): same "where does this user belong" lookup as modules/authority's getUserTenantId — a reassignment/delegation target must be in the same tenant as the step instance. */
  getUserTenantId(userId: string): Promise<string | null>;
  /**
   * The other six BRD queue views (Team Work/Due Soon/Overdue/Blocked/
   * Waiting Approval/Completed) — different filter combinations over
   * the same read path, gated on workflow.task.view_team. Joined
   * against workflow_nodes for node_type/node_key and
   * workflow_instances for workflow_definition_id (tenant isolation
   * itself needs no join — workflow_step_instances already carries its
   * own NOT NULL tenant_id).
   */
  listTaskQueue(accessToken: string, filters: TaskQueueFilters): Promise<TaskQueueEntry[]>;

  insertEvent(accessToken: string, input: InsertEventInput): Promise<WorkflowEvent>;
  listEvents(accessToken: string, instanceId: string): Promise<WorkflowEvent[]>;

  /** Running (not paused/completed/cancelled) instances currently pinned to this version — the migration preview's candidate set. */
  listRunningInstancesForVersion(accessToken: string, versionId: string): Promise<WorkflowInstance[]>;
  /**
   * The one place `workflow_version_id` is allowed to change after
   * creation — an explicit, audited migration (ticket 0063), never the
   * ordinary runtime path (see updateInstance/types.ts's pinning
   * comment).
   */
  migrateInstanceVersion(accessToken: string, instanceId: string, toVersionId: string): Promise<WorkflowInstance>;

  createMigration(accessToken: string, input: CreateMigrationInput): Promise<WorkflowMigration>;
  getMigration(accessToken: string, id: string): Promise<WorkflowMigration | null>;
  updateMigration(accessToken: string, id: string, input: UpdateMigrationInput): Promise<WorkflowMigration>;
  insertMigrationInstanceResult(
    accessToken: string,
    input: InsertMigrationInstanceResultInput,
  ): Promise<WorkflowMigrationInstanceResult>;
  listMigrationInstanceResults(accessToken: string, migrationId: string): Promise<WorkflowMigrationInstanceResult[]>;

  /** Ticket 0066 (M08): one row per approver decision within a request_approval step's chain — append-only, like workflow_events. */
  insertApprovalDecision(accessToken: string, input: InsertApprovalDecisionInput): Promise<ApprovalDecisionRecord>;
  listApprovalDecisions(accessToken: string, workflowStepInstanceId: string): Promise<ApprovalDecisionRecord[]>;
  getApprovalDecision(accessToken: string, id: string): Promise<ApprovalDecisionRecord | null>;
  /** FR-APP-006's compensating record — never an update/delete on approval_decisions itself. */
  insertApprovalRevocation(accessToken: string, input: InsertApprovalRevocationInput): Promise<ApprovalRevocation>;
  listApprovalRevocations(accessToken: string, approvalDecisionId: string): Promise<ApprovalRevocation[]>;
}

const OPEN_STEP_STATUSES: StepInstanceStatus[] = ["waiting", "active"];

/**
 * Shared by listMyWorkQueue and listTaskQueue: fetches step instances
 * matching the status/assignee/due/blocked/completed filters, then
 * joins against workflow_nodes (node_type/node_key) and
 * workflow_instances (workflow_definition_id) in application code —
 * same fan-out-then-merge style as getVersionGraph's parallel queries,
 * since Supabase's JS client has no first-class multi-table join here.
 * nodeTypes filtering happens last because node_type isn't a column on
 * workflow_step_instances itself.
 */
async function fetchTaskQueue(client: SupabaseClient, filters: TaskQueueFilters): Promise<TaskQueueEntry[]> {
  let query = client.from("workflow_step_instances").select("*");
  if (filters.assignedTo !== undefined) query = query.eq("assigned_to", filters.assignedTo);
  if (filters.statuses && filters.statuses.length > 0) query = query.in("status", filters.statuses);
  if (filters.dueBefore !== undefined) query = query.lt("due_at", filters.dueBefore);
  if (filters.dueAfter !== undefined) query = query.gte("due_at", filters.dueAfter);
  if (filters.blockedOnly) query = query.not("blocked_reason", "is", null);
  if (filters.completedAfter !== undefined) query = query.gte("completed_at", filters.completedAfter);
  if (filters.completedBefore !== undefined) query = query.lte("completed_at", filters.completedBefore);

  const { data: steps, error } = await query;
  if (error) throw new Error(`fetchTaskQueue: ${error.message}`);
  const stepRows = (steps as WorkflowStepInstance[]) ?? [];
  if (stepRows.length === 0) return [];

  const nodeIds = [...new Set(stepRows.map((s) => s.node_id))];
  const instanceIds = [...new Set(stepRows.map((s) => s.workflow_instance_id))];
  const [{ data: nodes, error: nodesError }, { data: instances, error: instancesError }] = await Promise.all([
    client.from("workflow_nodes").select("id, node_type, node_key").in("id", nodeIds),
    client.from("workflow_instances").select("id, workflow_definition_id").in("id", instanceIds),
  ]);
  if (nodesError) throw new Error(`fetchTaskQueue (nodes): ${nodesError.message}`);
  if (instancesError) throw new Error(`fetchTaskQueue (instances): ${instancesError.message}`);

  const nodeById = new Map(((nodes ?? []) as { id: string; node_type: NodeType; node_key: string }[]).map((n) => [n.id, n]));
  const definitionIdByInstanceId = new Map(
    ((instances ?? []) as { id: string; workflow_definition_id: string }[]).map((i) => [i.id, i.workflow_definition_id]),
  );

  const entries: TaskQueueEntry[] = [];
  for (const step of stepRows) {
    const node = nodeById.get(step.node_id);
    if (!node) continue;
    entries.push({
      ...step,
      nodeType: node.node_type,
      nodeKey: node.node_key,
      workflowDefinitionId: definitionIdByInstanceId.get(step.workflow_instance_id) ?? "",
    });
  }

  if (filters.nodeTypes && filters.nodeTypes.length > 0) {
    const allowed = new Set(filters.nodeTypes);
    return entries.filter((e) => allowed.has(e.nodeType));
  }
  return entries;
}

/**
 * Supabase-backed implementation. Not exercised against a live Supabase
 * project in this session (no reachable credentials in this sandbox,
 * same recurring gap as every Phase 1/2 ticket so far) — service.test.ts
 * / routes.test.ts cover the business logic through the interface above
 * via FakeWorkflowRepository instead.
 */
export function createSupabaseWorkflowRepository(
  serviceClient: SupabaseClient,
  userScopedClientFactory: (accessToken: string) => SupabaseClient,
): WorkflowRepository {
  return {
    async createDefinition(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data: definition, error: defError } = await client
        .from("workflow_definitions")
        .insert({
          key: input.key,
          name: input.name,
          description: input.description,
          capability_key: input.capabilityKey,
          status: "draft",
          current_version: null,
          created_by: input.createdBy,
          updated_by: input.createdBy,
        })
        .select("*")
        .single();
      if (defError || !definition) throw new Error(`createDefinition: ${defError?.message ?? "no row returned"}`);

      const { data: version, error: versionError } = await client
        .from("workflow_versions")
        .insert({
          workflow_definition_id: definition.id as string,
          version: 1,
          status: "draft",
          rollback_of_version: null,
          created_by: input.createdBy,
        })
        .select("*")
        .single();
      if (versionError || !version) throw new Error(`createDefinition (version): ${versionError?.message ?? "no row returned"}`);

      return { definition: definition as WorkflowDefinition, version: version as WorkflowVersion };
    },

    async getDefinition(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("workflow_definitions").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getDefinition: ${error.message}`);
      return (data as WorkflowDefinition | null) ?? null;
    },

    async listDefinitions(accessToken, filters) {
      const client = userScopedClientFactory(accessToken);
      let query = client.from("workflow_definitions").select("*");
      if (filters.status) query = query.eq("status", filters.status);
      if (filters.key) query = query.eq("key", filters.key);
      const { data, error } = await query;
      if (error) throw new Error(`listDefinitions: ${error.message}`);
      return (data as WorkflowDefinition[]) ?? [];
    },

    async updateDefinitionStatus(accessToken, id, status, currentVersion, updatedBy) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("workflow_definitions")
        .update({ status, current_version: currentVersion, updated_by: updatedBy })
        .eq("id", id)
        .select("*")
        .single();
      if (error || !data) throw new Error(`updateDefinitionStatus: ${error?.message ?? "no row returned"}`);
      return data as WorkflowDefinition;
    },

    async insertVersion(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("workflow_versions")
        .insert({
          workflow_definition_id: input.definitionId,
          version: input.version,
          status: input.status,
          rollback_of_version: input.rollbackOfVersion,
          created_by: input.createdBy,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`insertVersion: ${error?.message ?? "no row returned"}`);
      return data as WorkflowVersion;
    },

    async getVersion(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("workflow_versions").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getVersion: ${error.message}`);
      return (data as WorkflowVersion | null) ?? null;
    },

    async listVersions(accessToken, definitionId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("workflow_versions")
        .select("*")
        .eq("workflow_definition_id", definitionId)
        .order("version", { ascending: true });
      if (error) throw new Error(`listVersions: ${error.message}`);
      return (data as WorkflowVersion[]) ?? [];
    },

    async markVersionPublished(accessToken, id, publishedBy, effectiveFrom) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("workflow_versions")
        .update({ status: "published", published_by: publishedBy, published_at: effectiveFrom, effective_from: effectiveFrom })
        .eq("id", id)
        .select("*")
        .single();
      if (error || !data) throw new Error(`markVersionPublished: ${error?.message ?? "no row returned"}`);
      return data as WorkflowVersion;
    },

    async addNode(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("workflow_nodes")
        .insert({ workflow_version_id: input.versionId, node_key: input.nodeKey, node_type: input.nodeType, config: input.config })
        .select("*")
        .single();
      if (error || !data) throw new Error(`addNode: ${error?.message ?? "no row returned"}`);
      return data as WorkflowNode;
    },

    async addTransition(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("workflow_transitions")
        .insert({
          workflow_version_id: input.versionId,
          from_node_id: input.fromNodeId,
          to_node_id: input.toNodeId,
          condition_id: input.conditionId,
          order_index: input.orderIndex,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`addTransition: ${error?.message ?? "no row returned"}`);
      return data as WorkflowTransition;
    },

    async addCondition(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("workflow_conditions")
        .insert({ workflow_version_id: input.versionId, expression: input.expression, description: input.description })
        .select("*")
        .single();
      if (error || !data) throw new Error(`addCondition: ${error?.message ?? "no row returned"}`);
      return data as WorkflowCondition;
    },

    async getVersionGraph(accessToken, versionId) {
      const client = userScopedClientFactory(accessToken);
      const [{ data: nodes, error: nodesError }, { data: transitions, error: transitionsError }, { data: conditions, error: conditionsError }] =
        await Promise.all([
          client.from("workflow_nodes").select("*").eq("workflow_version_id", versionId),
          client.from("workflow_transitions").select("*").eq("workflow_version_id", versionId),
          client.from("workflow_conditions").select("*").eq("workflow_version_id", versionId),
        ]);
      if (nodesError) throw new Error(`getVersionGraph (nodes): ${nodesError.message}`);
      if (transitionsError) throw new Error(`getVersionGraph (transitions): ${transitionsError.message}`);
      if (conditionsError) throw new Error(`getVersionGraph (conditions): ${conditionsError.message}`);
      return {
        nodes: (nodes as WorkflowNode[]) ?? [],
        transitions: (transitions as WorkflowTransition[]) ?? [],
        conditions: (conditions as WorkflowCondition[]) ?? [],
      };
    },

    async recordApproval(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("configuration_approvals")
        .insert({
          workflow_version_id: input.versionId,
          approver_id: input.approverId,
          decision: input.decision,
          comment: input.comment,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`recordApproval: ${error?.message ?? "no row returned"}`);
      return data as ConfigurationApproval;
    },

    async insertPublishedConfiguration(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("published_configurations")
        .insert({
          workflow_definition_id: input.definitionId,
          workflow_version_id: input.versionId,
          effective_from: input.effectiveFrom,
          published_by: input.publishedBy,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`insertPublishedConfiguration: ${error?.message ?? "no row returned"}`);
      return data as PublishedConfiguration;
    },

    async insertRollbackEvent(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("configuration_rollback_events")
        .insert({
          workflow_definition_id: input.definitionId,
          from_version: input.fromVersion,
          to_version: input.toVersion,
          rolled_back_by: input.rolledBackBy,
          reason: input.reason,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`insertRollbackEvent: ${error?.message ?? "no row returned"}`);
      return data as ConfigurationRollbackEvent;
    },

    async insertConfigurationChange(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("configuration_changes")
        .insert({
          entity_type: "workflow_definition",
          entity_id: input.entityId,
          workflow_version_id: input.workflowVersionId,
          change_type: input.changeType,
          diff: input.diff,
          reason: input.reason,
          changed_by: input.changedBy,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`insertConfigurationChange: ${error?.message ?? "no row returned"}`);
      return data as ConfigurationChange;
    },

    async listRoleIds(accessToken) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("role_definitions").select("id");
      if (error) throw new Error(`listRoleIds: ${error.message}`);
      return (data ?? []).map((row) => row.id as string);
    },

    async insertValidationRun(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const now = new Date().toISOString();
      const { data, error } = await client
        .from("configuration_validation_runs")
        .insert({
          workflow_version_id: input.versionId,
          run_by: input.runBy,
          result: input.result,
          findings: input.findings,
          started_at: now,
          finished_at: now,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`insertValidationRun: ${error?.message ?? "no row returned"}`);
      return data as ConfigurationValidationRun;
    },

    async getLatestValidationRun(accessToken, versionId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("configuration_validation_runs")
        .select("*")
        .eq("workflow_version_id", versionId)
        .order("finished_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`getLatestValidationRun: ${error.message}`);
      return (data as ConfigurationValidationRun | null) ?? null;
    },

    async insertSimulationRun(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const now = new Date().toISOString();
      const { data, error } = await client
        .from("configuration_simulation_runs")
        .insert({
          workflow_version_id: input.versionId,
          run_by: input.runBy,
          test_cases: input.testCases,
          result: input.result,
          started_at: now,
          finished_at: now,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`insertSimulationRun: ${error?.message ?? "no row returned"}`);
      return data as ConfigurationSimulationRun;
    },

    async createInstance(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("workflow_instances")
        .insert({
          workflow_definition_id: input.definitionId,
          workflow_version_id: input.versionId,
          status: "running",
          started_by: input.startedBy,
          context: input.context,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createInstance: ${error?.message ?? "no row returned"}`);
      return data as WorkflowInstance;
    },

    async getInstance(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("workflow_instances").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getInstance: ${error.message}`);
      return (data as WorkflowInstance | null) ?? null;
    },

    async updateInstance(accessToken, id, input) {
      const client = userScopedClientFactory(accessToken);
      const update: Record<string, unknown> = {};
      if (input.status !== undefined) update.status = input.status;
      if (input.endedAt !== undefined) update.ended_at = input.endedAt;
      if (input.context !== undefined) update.context = input.context;
      const { data, error } = await client.from("workflow_instances").update(update).eq("id", id).select("*").single();
      if (error || !data) throw new Error(`updateInstance: ${error?.message ?? "no row returned"}`);
      return data as WorkflowInstance;
    },

    async createStepInstance(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("workflow_step_instances")
        .insert({
          workflow_instance_id: input.instanceId,
          node_id: input.nodeId,
          status: input.status,
          assigned_to: input.assignedTo,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createStepInstance: ${error?.message ?? "no row returned"}`);
      return data as WorkflowStepInstance;
    },

    async getStepInstance(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("workflow_step_instances").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getStepInstance: ${error.message}`);
      return (data as WorkflowStepInstance | null) ?? null;
    },

    async listStepInstances(accessToken, instanceId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("workflow_step_instances")
        .select("*")
        .eq("workflow_instance_id", instanceId)
        .order("started_at", { ascending: true });
      if (error) throw new Error(`listStepInstances: ${error.message}`);
      return (data as WorkflowStepInstance[]) ?? [];
    },

    async updateStepInstance(accessToken, id, input) {
      const client = userScopedClientFactory(accessToken);
      const update: Record<string, unknown> = {};
      if (input.status !== undefined) update.status = input.status;
      if (input.assignedTo !== undefined) update.assigned_to = input.assignedTo;
      if (input.completedAt !== undefined) update.completed_at = input.completedAt;
      if (input.output !== undefined) update.output = input.output;
      if (input.ownerId !== undefined) update.owner_id = input.ownerId;
      if (input.reviewerId !== undefined) update.reviewer_id = input.reviewerId;
      if (input.dueAt !== undefined) update.due_at = input.dueAt;
      if (input.priority !== undefined) update.priority = input.priority;
      if (input.blockedReason !== undefined) update.blocked_reason = input.blockedReason;
      if (input.blockedAt !== undefined) update.blocked_at = input.blockedAt;
      const { data, error } = await client.from("workflow_step_instances").update(update).eq("id", id).select("*").single();
      if (error || !data) throw new Error(`updateStepInstance: ${error?.message ?? "no row returned"}`);
      return data as WorkflowStepInstance;
    },

    async addTaskComment(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("task_comments")
        .insert({
          workflow_step_instance_id: input.workflowStepInstanceId,
          author_id: input.authorId,
          body: input.body,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`addTaskComment: ${error?.message ?? "no row returned"}`);
      return data as TaskComment;
    },

    async listTaskComments(accessToken, workflowStepInstanceId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("task_comments")
        .select("*")
        .eq("workflow_step_instance_id", workflowStepInstanceId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(`listTaskComments: ${error.message}`);
      return (data as TaskComment[]) ?? [];
    },

    async attachEvidence(accessToken, fileObjectId, workflowStepInstanceId) {
      const client = userScopedClientFactory(accessToken);
      const { error } = await client
        .from("file_objects")
        .update({ workflow_step_instance_id: workflowStepInstanceId })
        .eq("id", fileObjectId);
      if (error) throw new Error(`attachEvidence: ${error.message}`);
    },

    async listMyWorkQueue(accessToken) {
      const client = userScopedClientFactory(accessToken);
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || !authData?.user) throw new Error(`listMyWorkQueue: ${authError?.message ?? "no authenticated user"}`);
      return fetchTaskQueue(client, { assignedTo: authData.user.id, statuses: OPEN_STEP_STATUSES });
    },

    async listTaskQueue(accessToken, filters) {
      const client = userScopedClientFactory(accessToken);
      return fetchTaskQueue(client, filters);
    },

    async resolveCallerUserId(accessToken) {
      const client = userScopedClientFactory(accessToken);
      const { data: authData, error } = await client.auth.getUser();
      if (error || !authData?.user) return null;
      return authData.user.id;
    },

    async getUserTenantId(userId) {
      const { data, error } = await serviceClient.from("app_users").select("tenant_id").eq("id", userId).maybeSingle();
      if (error) throw new Error(`getUserTenantId: ${error.message}`);
      return (data?.tenant_id as string | undefined) ?? null;
    },

    async insertEvent(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("workflow_events")
        .insert({
          workflow_instance_id: input.instanceId,
          step_instance_id: input.stepInstanceId,
          event_type: input.eventType,
          payload: input.payload,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`insertEvent: ${error?.message ?? "no row returned"}`);
      return data as WorkflowEvent;
    },

    async listEvents(accessToken, instanceId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("workflow_events")
        .select("*")
        .eq("workflow_instance_id", instanceId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(`listEvents: ${error.message}`);
      return (data as WorkflowEvent[]) ?? [];
    },

    async listRunningInstancesForVersion(accessToken, versionId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("workflow_instances")
        .select("*")
        .eq("workflow_version_id", versionId)
        .eq("status", "running");
      if (error) throw new Error(`listRunningInstancesForVersion: ${error.message}`);
      return (data as WorkflowInstance[]) ?? [];
    },

    async migrateInstanceVersion(accessToken, instanceId, toVersionId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("workflow_instances")
        .update({ workflow_version_id: toVersionId })
        .eq("id", instanceId)
        .select("*")
        .single();
      if (error || !data) throw new Error(`migrateInstanceVersion: ${error?.message ?? "no row returned"}`);
      return data as WorkflowInstance;
    },

    async createMigration(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("workflow_migrations")
        .insert({
          workflow_definition_id: input.definitionId,
          from_version_id: input.fromVersionId,
          to_version_id: input.toVersionId,
          status: "draft",
          impact_summary: {},
          created_by: input.createdBy,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createMigration: ${error?.message ?? "no row returned"}`);
      return data as WorkflowMigration;
    },

    async getMigration(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("workflow_migrations").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getMigration: ${error.message}`);
      return (data as WorkflowMigration | null) ?? null;
    },

    async updateMigration(accessToken, id, input) {
      const client = userScopedClientFactory(accessToken);
      const update: Record<string, unknown> = {};
      if (input.status !== undefined) update.status = input.status;
      if (input.impactSummary !== undefined) update.impact_summary = input.impactSummary;
      if (input.approvedBy !== undefined) update.approved_by = input.approvedBy;
      if (input.approvedAt !== undefined) update.approved_at = input.approvedAt;
      if (input.executedBy !== undefined) update.executed_by = input.executedBy;
      if (input.executedAt !== undefined) update.executed_at = input.executedAt;
      const { data, error } = await client.from("workflow_migrations").update(update).eq("id", id).select("*").single();
      if (error || !data) throw new Error(`updateMigration: ${error?.message ?? "no row returned"}`);
      return data as WorkflowMigration;
    },

    async insertMigrationInstanceResult(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("workflow_migration_instance_results")
        .insert({
          migration_id: input.migrationId,
          workflow_instance_id: input.workflowInstanceId,
          old_step_instance_id: input.oldStepInstanceId,
          new_step_instance_id: input.newStepInstanceId,
          outcome: input.outcome,
          detail: input.detail,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`insertMigrationInstanceResult: ${error?.message ?? "no row returned"}`);
      return data as WorkflowMigrationInstanceResult;
    },

    async listMigrationInstanceResults(accessToken, migrationId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("workflow_migration_instance_results")
        .select("*")
        .eq("migration_id", migrationId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(`listMigrationInstanceResults: ${error.message}`);
      return (data as WorkflowMigrationInstanceResult[]) ?? [];
    },

    async insertApprovalDecision(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("approval_decisions")
        .insert({
          workflow_step_instance_id: input.workflowStepInstanceId,
          sequence_order: input.sequenceOrder,
          approver_id: input.approverId,
          decision: input.decision,
          reason: input.reason,
          decided_by: input.decidedBy,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`insertApprovalDecision: ${error?.message ?? "no row returned"}`);
      return data as ApprovalDecisionRecord;
    },

    async listApprovalDecisions(accessToken, workflowStepInstanceId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("approval_decisions")
        .select("*")
        .eq("workflow_step_instance_id", workflowStepInstanceId)
        .order("decided_at", { ascending: true });
      if (error) throw new Error(`listApprovalDecisions: ${error.message}`);
      return (data as ApprovalDecisionRecord[]) ?? [];
    },

    async getApprovalDecision(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("approval_decisions").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getApprovalDecision: ${error.message}`);
      return (data as ApprovalDecisionRecord | null) ?? null;
    },

    async insertApprovalRevocation(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("approval_revocations")
        .insert({
          approval_decision_id: input.approvalDecisionId,
          revoked_by: input.revokedBy,
          reason: input.reason,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`insertApprovalRevocation: ${error?.message ?? "no row returned"}`);
      return data as ApprovalRevocation;
    },

    async listApprovalRevocations(accessToken, approvalDecisionId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("approval_revocations")
        .select("*")
        .eq("approval_decision_id", approvalDecisionId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(`listApprovalRevocations: ${error.message}`);
      return (data as ApprovalRevocation[]) ?? [];
    },
  };
}
