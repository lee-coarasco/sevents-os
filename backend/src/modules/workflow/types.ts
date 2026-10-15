/** BRD §5.4.3's finite set of supported workflow step types. A node's node_type must be one of these. */
export const NODE_TYPES = [
  "create_task",
  "assign_role_user",
  "collect_form_data",
  "request_upload_evidence",
  "evaluate_condition",
  "call_service",
  "request_approval",
  "send_notification",
  "wait_event_time",
  "create_linked_followup",
  "escalate",
  "complete",
  "cancel",
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

/** Same five-value shape as work_item_definitions.status (ticket 0058). */
export const DEFINITION_STATUSES = ["draft", "under_review", "approved", "published", "retired"] as const;

export type DefinitionStatus = (typeof DEFINITION_STATUSES)[number];

/** A version's own lifecycle: draft while being authored, published once live, retired if explicitly deprecated. */
export const VERSION_STATUSES = ["draft", "published", "retired"] as const;

export type VersionStatus = (typeof VERSION_STATUSES)[number];

export const APPROVAL_DECISIONS = ["approved", "rejected"] as const;

export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export const CHANGE_TYPES = ["create", "edit", "submit", "approve", "reject", "publish", "rollback"] as const;

export type ChangeType = (typeof CHANGE_TYPES)[number];

export interface WorkflowDefinition {
  id: string;
  tenant_id: string;
  key: string;
  name: string;
  description: string | null;
  capability_key: string | null;
  status: DefinitionStatus;
  /** Version number of the currently published version new instances would pin to; null until first publish. */
  current_version: number | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface WorkflowVersion {
  id: string;
  tenant_id: string;
  workflow_definition_id: string;
  version: number;
  status: VersionStatus;
  effective_from: string | null;
  effective_to: string | null;
  rollback_of_version: number | null;
  published_by: string | null;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ConditionExpression {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
  value: unknown;
}

export interface WorkflowNode {
  id: string;
  tenant_id: string;
  workflow_version_id: string;
  node_key: string;
  node_type: NodeType;
  config: Record<string, unknown>;
}

export interface WorkflowTransition {
  id: string;
  tenant_id: string;
  workflow_version_id: string;
  from_node_id: string;
  to_node_id: string;
  condition_id: string | null;
  order_index: number;
}

export interface WorkflowCondition {
  id: string;
  tenant_id: string;
  workflow_version_id: string;
  expression: ConditionExpression;
  description: string | null;
}

export interface WorkflowVersionGraph {
  nodes: WorkflowNode[];
  transitions: WorkflowTransition[];
  conditions: WorkflowCondition[];
}

export interface ConfigurationChange {
  id: string;
  tenant_id: string;
  entity_type: "workflow_definition";
  entity_id: string;
  workflow_version_id: string | null;
  change_type: ChangeType;
  diff: Record<string, unknown>;
  reason: string | null;
  changed_by: string | null;
  created_at: string;
}

export interface ConfigurationApproval {
  id: string;
  tenant_id: string;
  workflow_version_id: string;
  approver_id: string | null;
  decision: ApprovalDecision;
  comment: string | null;
  decided_at: string;
}

export interface PublishedConfiguration {
  id: string;
  tenant_id: string;
  workflow_definition_id: string;
  workflow_version_id: string;
  effective_from: string;
  published_by: string | null;
  published_at: string;
}

export interface ConfigurationRollbackEvent {
  id: string;
  tenant_id: string;
  workflow_definition_id: string;
  from_version: number | null;
  to_version: number;
  rolled_back_by: string | null;
  reason: string | null;
  created_at: string;
}

export interface DefinitionFilters {
  status?: DefinitionStatus;
  key?: string;
}

export const VALIDATION_RESULTS = ["pass", "fail"] as const;
export type ValidationResult = (typeof VALIDATION_RESULTS)[number];

export const VALIDATION_FINDING_CODES = [
  "UNREACHABLE_NODE",
  "NO_TERMINAL_NODE",
  "CIRCULAR_NO_EXIT",
  "DANGLING_ROLE_REFERENCE",
  "DANGLING_CONDITION_REFERENCE",
  "AMBIGUOUS_START",
] as const;
export type ValidationFindingCode = (typeof VALIDATION_FINDING_CODES)[number];

export interface ValidationFinding {
  code: ValidationFindingCode;
  severity: "error" | "warning";
  message: string;
  nodeId?: string;
}

export interface ConfigurationValidationRun {
  id: string;
  tenant_id: string;
  workflow_version_id: string;
  run_by: string | null;
  result: ValidationResult;
  findings: ValidationFinding[];
  started_at: string;
  finished_at: string;
}

export interface SimulationTestCase {
  label: string;
  input: Record<string, unknown>;
}

export interface SimulationPathResult {
  label: string;
  path: string[];
  blockedAtNodeKey: string | null;
}

export interface SimulationResultPayload {
  paths: SimulationPathResult[];
  unreachedNodeKeys: string[];
}

export interface ConfigurationSimulationRun {
  id: string;
  tenant_id: string;
  workflow_version_id: string;
  run_by: string | null;
  test_cases: SimulationTestCase[];
  result: SimulationResultPayload;
  started_at: string;
  finished_at: string;
}

/** Ticket 0062 (M06c): runtime/instance engine. */

export const INSTANCE_STATUSES = ["running", "paused", "completed", "cancelled"] as const;
export type InstanceStatus = (typeof INSTANCE_STATUSES)[number];

export const STEP_INSTANCE_STATUSES = ["pending", "active", "waiting", "completed", "skipped", "failed"] as const;
export type StepInstanceStatus = (typeof STEP_INSTANCE_STATUSES)[number];

/** Node types that hand off to a human/queue rather than resolving synchronously inside the executor. */
export const HUMAN_HANDOFF_NODE_TYPES = ["create_task", "assign_role_user", "request_approval"] as const;
export type HumanHandoffNodeType = (typeof HUMAN_HANDOFF_NODE_TYPES)[number];

export const WORKFLOW_EVENT_TYPES = [
  "started",
  "step_activated",
  "step_completed",
  "step_skipped",
  "step_failed",
  "paused",
  "resumed",
  "cancelled",
  "completed",
  "escalated",
  "timer_fired",
  "notification_sent",
  "service_called",
  "gate_blocked",
  "gate_exception",
  "migrated",
  "task_blocked",
  "task_unblocked",
  "comment_added",
  "evidence_attached",
  "task_reassigned",
  "task_delegated",
  "approval_decision_recorded",
  "approval_chain_resolved",
  "approval_revoked",
] as const;
export type WorkflowEventType = (typeof WORKFLOW_EVENT_TYPES)[number];

/** Ticket 0070 (M07a): a generic four-value UI priority, not a BRD-specified business rule. */
export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface WorkflowInstance {
  id: string;
  tenant_id: string;
  workflow_definition_id: string;
  /** Pinned at creation (BRD §6.3); never updated afterwards even if a newer version publishes later. */
  workflow_version_id: string;
  status: InstanceStatus;
  started_by: string | null;
  started_at: string;
  ended_at: string | null;
  context: Record<string, unknown>;
}

export interface WorkflowStepInstance {
  id: string;
  tenant_id: string;
  workflow_instance_id: string;
  node_id: string;
  status: StepInstanceStatus;
  /**
   * Who/what this step is waiting on. A user id for assign_role_user,
   * a role id for create_task/request_approval, null once no human
   * hand-off is pending (e.g. a resolved evaluate_condition step).
   * M07 (Tasks/My Work) will poll
   * `workflow_step_instances where status = 'waiting' and node_type in
   * ('create_task', 'assign_role_user', 'request_approval')` (joined
   * against workflow_nodes for node_type) to build its work queues; M08
   * (Approvals) will act on the `request_approval` subset the same way.
   * This table is the seam — no parallel task/approval table exists here.
   */
  assigned_to: string | null;
  started_at: string;
  completed_at: string | null;
  output: Record<string, unknown>;
  /** Ticket 0070 (M07a, BRD FR-TASK-002): who the task is ultimately accountable to — distinct from assigned_to, which may change on reassignment. */
  owner_id: string | null;
  /** Distinct from assigned_to; used by request_approval steps where the approver is the reviewer. */
  reviewer_id: string | null;
  due_at: string | null;
  priority: TaskPriority;
  /** Non-null only while the step is explicitly marked blocked (FR-TASK-004: a reason is mandatory). */
  blocked_reason: string | null;
  blocked_at: string | null;
}

export interface TaskComment {
  id: string;
  tenant_id: string;
  workflow_step_instance_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

/** Ticket 0071 (M07b): the seven BRD queue views are different filter combinations over this one shape — no new table. */
export interface TaskQueueFilters {
  assignedTo?: string;
  statuses?: StepInstanceStatus[];
  dueBefore?: string;
  dueAfter?: string;
  blockedOnly?: boolean;
  nodeTypes?: NodeType[];
  completedAfter?: string;
  completedBefore?: string;
}

/** A WorkflowStepInstance enriched with the node_type/node_key (joined from workflow_nodes) and workflow_definition_id (joined from workflow_instances) the BRD queue views need but the step instance row itself doesn't carry. */
export interface TaskQueueEntry extends WorkflowStepInstance {
  nodeType: NodeType;
  nodeKey: string;
  workflowDefinitionId: string;
}

export interface WorkflowEvent {
  id: string;
  tenant_id: string;
  workflow_instance_id: string;
  step_instance_id: string | null;
  event_type: WorkflowEventType;
  payload: Record<string, unknown>;
  created_at: string;
}

/** Caller-supplied exception to the FR-WI-010 complete-node gate: who authorized skipping an outstanding evidence/approval step, and why. */
export interface GateException {
  authorizedBy: string;
  reason: string;
}

/** Ticket 0063 (M06d): explicit, audited migration of running instances from one published version to another. */

export const MIGRATION_STATUSES = ["draft", "previewed", "approved", "executed", "cancelled"] as const;
export type MigrationStatus = (typeof MIGRATION_STATUSES)[number];

export const MIGRATION_INSTANCE_OUTCOMES = ["migrated", "skipped", "failed"] as const;
export type MigrationInstanceOutcome = (typeof MIGRATION_INSTANCE_OUTCOMES)[number];

/** One running instance's currently-open steps and whether each maps 1:1 by node_key into the target version. */
export interface MigrationImpactEntry {
  workflowInstanceId: string;
  openStepInstanceIds: string[];
  /** True only when every open step instance's node_key has a counterpart in the target version AND there is at least one open step. */
  autoMappable: boolean;
  /** Old node_id -> new node_id, for the subset of open steps that do map. */
  nodeIdMap: Record<string, string>;
  /** node_keys (or node ids if the key can't be resolved) with no counterpart in the target version. */
  unmappedNodeKeys: string[];
}

export interface MigrationImpactSummary {
  fromVersionId: string;
  toVersionId: string;
  totalRunningInstances: number;
  autoMappableCount: number;
  manualMappingCount: number;
  entries: MigrationImpactEntry[];
}

export interface WorkflowMigration {
  id: string;
  tenant_id: string;
  workflow_definition_id: string;
  from_version_id: string;
  to_version_id: string;
  status: MigrationStatus;
  impact_summary: MigrationImpactSummary | null;
  approved_by: string | null;
  approved_at: string | null;
  executed_by: string | null;
  executed_at: string | null;
  created_by: string | null;
  created_at: string;
}

/** Ticket 0066 (M08): BRD FR-APP-001's two supported chain shapes for a request_approval node. */
export const APPROVAL_CHAIN_MODES = ["sequential", "parallel"] as const;
export type ApprovalChainMode = (typeof APPROVAL_CHAIN_MODES)[number];

export const APPROVAL_CHAIN_DECISIONS = ["approved", "rejected", "returned_for_correction"] as const;
export type ApprovalChainDecision = (typeof APPROVAL_CHAIN_DECISIONS)[number];

/**
 * Ticket 0066 (M08): a request_approval node's `config` (the generic
 * jsonb column on workflow_nodes, ticket 0060) normalized into a
 * multi-approver chain. approverUserIds is an explicit list of user
 * ids — unlike the single-approver legacy shape (`config.roleId`/
 * `config.userId`, ticket 0062's resolveAssignee), there is no "any
 * user holding role X" resolution mechanism in this codebase yet, so
 * a chain's approvers must be named explicitly. requiredApprovals only
 * applies to `parallel` mode and defaults to approverUserIds.length
 * (unanimous) when omitted.
 */
export interface ApprovalChainConfig {
  mode: ApprovalChainMode;
  approverUserIds: string[];
  requiredApprovals?: number;
  /** Opt-in per node — ticket 0056's checkSegregationOfDuties is "generic, unexercised" until a caller turns it on explicitly; this is that caller, and it must never default to true. */
  enforceSegregationOfDuties?: boolean;
  /** Optional authority-limit gate: checks the tenant's approval_limits for this role/department against context[amountField]/context[currencyField]. Omitted entirely (not a default) when a node has no value-band policy to check. */
  approvalLimit?: {
    roleId?: string;
    departmentId?: string;
    amountField: string;
    currencyField: string;
  };
}

/** One approver's decision within a request_approval step's chain (table approval_decisions). */
export interface ApprovalDecisionRecord {
  id: string;
  tenant_id: string;
  workflow_step_instance_id: string;
  sequence_order: number | null;
  approver_id: string;
  decision: ApprovalChainDecision;
  reason: string | null;
  decided_by: string;
  decided_at: string;
}

/** FR-APP-006's compensating-process record (table approval_revocations) — the original ApprovalDecisionRecord is never edited or deleted. */
export interface ApprovalRevocation {
  id: string;
  tenant_id: string;
  approval_decision_id: string;
  revoked_by: string;
  reason: string;
  created_at: string;
}

/** FR-APP-002: everything an approver needs to see before deciding. riskFlags is always [] — no risk-scoring engine exists yet (TBD—Business Owner Decision), never fabricated. */
export interface ApprovalDetail {
  stepInstance: WorkflowStepInstance;
  chainConfig: ApprovalChainConfig | null;
  decisions: ApprovalDecisionRecord[];
  revocations: ApprovalRevocation[];
  requestContext: Record<string, unknown>;
  comments: TaskComment[];
  evidenceFileObjectIds: string[];
  auditHistory: WorkflowEvent[];
  authorityCheck: { configured: boolean; withinLimit: boolean | null };
  riskFlags: never[];
}

export interface WorkflowMigrationInstanceResult {
  id: string;
  tenant_id: string;
  migration_id: string;
  workflow_instance_id: string;
  old_step_instance_id: string | null;
  new_step_instance_id: string | null;
  outcome: MigrationInstanceOutcome;
  detail: string | null;
  created_at: string;
}
