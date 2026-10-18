export interface DepartmentDefinition {
  id: string;
  tenant_id: string;
  company_id: string;
  parent_id: string | null;
  name: string;
}

export interface RoleDefinition {
  id: string;
  tenant_id: string | null;
  label: string;
  department_cluster: string | null;
  is_platform_role: boolean;
}

export interface PermissionDefinition {
  id: string;
  description: string;
}

export interface RoleAssignment {
  id: string;
  tenant_id: string;
  user_id: string;
  role_id: string;
  department_id: string | null;
  valid_from: string;
  valid_to: string | null;
}

export interface Delegation {
  id: string;
  tenant_id: string;
  role_assignment_id: string;
  delegate_user_id: string;
  valid_from: string;
  valid_to: string | null;
  reason: string | null;
}

/**
 * Ticket 0066 (M08): FR-APP-005 "thresholds are configurable and
 * versioned" — valid_from/valid_to turn an update into a new row that
 * supersedes the old one (which gets its valid_to closed), never an
 * in-place edit. History is never overwritten.
 */
export interface ApprovalLimit {
  id: string;
  tenant_id: string;
  role_id: string | null;
  department_id: string | null;
  currency: string;
  max_value: number;
  valid_from: string;
  valid_to: string | null;
}

/**
 * Generic, unexercised mechanism per ticket 0056: "a flag/rule on an
 * approval policy saying assignee != approver." No concrete
 * ApprovalPolicy entity or workflow exists yet (that's M06/M08) — this
 * is the shape a future policy object passes in once one does. Do not
 * default `enforced` to true anywhere; that would hard-code an answer
 * to the still-open PRD §5 item 4 segregation-of-duties decision.
 */
export interface SegregationOfDutiesPolicy {
  enforced: boolean;
}

/** Appended to ticket 0054's auth_audit_log event_type enum, same table, no second audit mechanism. */
export type AuthorityAuditEventType =
  | "department_created"
  | "role_assignment_created"
  | "delegation_created"
  | "approval_limit_created";
