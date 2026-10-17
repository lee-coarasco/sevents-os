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
  is_active: boolean;
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

/**
 * Ticket 0075 (M09c, FR-PROJ-004). A frozen copy, never a live view —
 * `snapshot` is whatever the projects module captured (WBS/milestone/
 * activity planned dates + budget) at the moment this baseline was
 * set, not a pointer to the live rows.
 */
export type ProjectBaselineStatus = "draft" | "pending_approval" | "approved" | "superseded";

export interface ProjectBaseline {
  id: string;
  tenant_id: string;
  project_id: string;
  version: number;
  snapshot: Record<string, unknown>;
  status: ProjectBaselineStatus;
  created_by: string | null;
  created_at: string;
}

export type ProjectBaselineChangeRequestStatus = "pending" | "approved" | "rejected" | "returned_for_correction";

/**
 * FR-PROJ-004: baseline changes require reason, impact analysis and
 * approval. `workflow_instance_id` is the only approval mechanism —
 * this table never resolves its own chain, it reads the outcome back
 * from the workflow_instances/request_approval seam (ticket 0066).
 */
export interface ProjectBaselineChangeRequest {
  id: string;
  tenant_id: string;
  project_id: string;
  current_baseline_id: string;
  proposed_snapshot: Record<string, unknown>;
  reason: string;
  impact_analysis: string;
  status: ProjectBaselineChangeRequestStatus;
  submitted_by: string | null;
  workflow_instance_id: string;
  resulting_baseline_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Ticket 0076 (M09d, FR-PROJ-005). One table for all six categories —
 * they share the same fields, BRD only asks that each be "tracked." A
 * `change_request` row here is a logged intent/record only; it never
 * triggers workflow/approval itself (ticket 0075 already owns
 * FR-PROJ-004's baseline-change approval path).
 */
export const REGISTER_ENTRY_KINDS = ["issue", "risk", "decision", "assumption", "dependency", "change_request"] as const;
export type RegisterEntryKind = (typeof REGISTER_ENTRY_KINDS)[number];

export type RegisterEntryStatus = "open" | "in_progress" | "resolved" | "closed";

export interface ProjectRegisterEntry {
  id: string;
  tenant_id: string;
  project_id: string;
  kind: RegisterEntryKind;
  title: string;
  description: string | null;
  status: RegisterEntryStatus;
  owner_id: string | null;
  due_date: string | null;
  raised_by: string | null;
  raised_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  /** Free-text, tenant-configurable (meaningful for `risk` rows only in practice) — never a computed/numeric score, per FR-PROJ-006. */
  likelihood: string | null;
  impact: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Ticket 0077 (M09e, FR-PROJ-006). Inserted fresh on every
 * `GET /projects/:projectId/health` call (append-only, same
 * "point-in-time fact" convention as ProgressEntry) — never a bare
 * numeric score. `factors` is exactly what fed `summary`; nothing
 * here is ever computed by an AI/ML service (that is M28's job,
 * later, and even then it must cite these same stored factors per
 * FR-AI-004).
 */
export interface ProjectHealthSnapshot {
  id: string;
  tenant_id: string;
  project_id: string;
  computed_at: string;
  factors: Record<string, unknown>;
  summary: string;
  computed_by: string | null;
}

/**
 * FR-PROJ-008. A small fixed list of item keys named by the BRD, not a
 * configurable checklist builder — M06 (Configuration Studio) is the
 * place for admin-configurable checklists, not this module.
 */
export const CLOSEOUT_ITEM_KEYS = ["handover_records", "final_account", "defects_dlp", "lessons_learned"] as const;
export type CloseoutItemKey = (typeof CLOSEOUT_ITEM_KEYS)[number];
export type CloseoutItemStatus = "pending" | "complete";

export interface ProjectCloseoutChecklistItem {
  id: string;
  tenant_id: string;
  project_id: string;
  item_key: CloseoutItemKey;
  status: CloseoutItemStatus;
  completed_by: string | null;
  completed_at: string | null;
}
