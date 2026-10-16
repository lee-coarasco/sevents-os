export type ProjectStatus = "active" | "on_hold" | "closed";

/**
 * Ticket 0055 (M02) created this table as a stub (id/tenant_id/
 * company_id/name/code/status only). Ticket 0073 (M09a) extended it in
 * place with the FR-PROJ-002 setup fields below — this is the same
 * `projects` table, not a parallel one.
 */
export interface Project {
  id: string;
  tenant_id: string;
  company_id: string;
  name: string;
  code: string | null;
  status: ProjectStatus;
  client_name: string | null;
  location: string | null;
  project_type_id: string | null;
  contract_reference: string | null;
  contract_value: number | null;
  contract_currency: string | null;
  project_manager_id: string | null;
  baseline_start_date: string | null;
  baseline_end_date: string | null;
  budget_amount: number | null;
  budget_currency: string | null;
}

export interface ProjectType {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
}

/**
 * Ticket 0074 (M09b, FR-PROJ-003): structural breakdown only, no cost
 * fields — `cost_code_id` is a documented seam for M21 (Finance) to
 * populate once a real CostCode entity exists; it has no FK target yet.
 */
export interface WBSNode {
  id: string;
  tenant_id: string;
  project_id: string;
  parent_wbs_node_id: string | null;
  code: string;
  name: string;
  sequence: number;
  cost_code_id: string | null;
}

export type MilestoneStatus = "pending" | "achieved" | "missed";

export interface Milestone {
  id: string;
  tenant_id: string;
  project_id: string;
  wbs_node_id: string | null;
  name: string;
  target_date: string;
  actual_date: string | null;
  status: MilestoneStatus;
}

export interface ScheduleActivity {
  id: string;
  tenant_id: string;
  project_id: string;
  wbs_node_id: string | null;
  name: string;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  percent_complete: number;
}

/**
 * FR-PROJ-003 asks for "dependencies," not a scheduling engine — these
 * four are the minimum vocabulary needed to express a dependency edge,
 * not a speculative PM-software enum. No float/critical-path
 * computation is derived from this table (that is M18, later).
 */
export type DependencyType = "finish_to_start" | "start_to_start" | "finish_to_finish" | "start_to_finish";

export interface ScheduleActivityDependency {
  tenant_id: string;
  activity_id: string;
  depends_on_activity_id: string;
  dependency_type: DependencyType;
}

/**
 * Append-only: a progress entry is a point-in-time fact, same
 * convention as `workflow_events` — corrections are a new entry, never
 * an update/delete of a past one.
 */
export interface ProgressEntry {
  id: string;
  tenant_id: string;
  schedule_activity_id: string;
  recorded_by: string | null;
  recorded_at: string;
  percent_complete: number;
  note: string | null;
}
