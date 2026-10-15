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
