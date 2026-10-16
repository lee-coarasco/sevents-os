/**
 * M11b (ticket 0097): estimate versions & cost build-up. BRD §10.1 step
 * 6; FR-EST-001/002/003. New module ("estimating") rather than folding
 * into tendering — M11a's tendering module owns the tender document
 * register/clarification log (child rows of `tender_submissions`
 * itself); estimates are a distinct lifecycle (versioned, workflow-
 * approved, line-item cost build-up) that matches the BRD's own
 * "Tendering, Estimation & Commercials" module split, not a sub-
 * resource of tendering. See DECISIONS.md for the full rationale.
 */
export type EstimateStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "returned_for_correction"
  | "superseded";

/**
 * FR-EST-001: every named field (assumptions, inclusions, exclusions,
 * taxes, overheads, contingency, margin) is a real column, not a jsonb
 * catch-all — same discipline ticket 0090 used for FR-CRM-001.
 * `subtotal_amount`/`total_amount` are stored snapshots recomputed by
 * the service layer whenever lines change, same "frozen copy, not a
 * live view" discipline as ticket 0075's project_baselines.snapshot.
 */
export interface Estimate {
  id: string;
  tenant_id: string;
  tender_submission_id: string;
  version: number;
  status: EstimateStatus;
  assumptions: string | null;
  inclusions: string | null;
  exclusions: string | null;
  taxes: number;
  overheads: number;
  contingency: number;
  margin: number;
  subtotal_amount: number;
  total_amount: number;
  /**
   * FR-EST-003: set once this version is submitted for approval via
   * the `request_approval` workflow seam (ticket 0066); null while
   * still draft. Same role as
   * project_baseline_change_requests.workflow_instance_id, except it
   * lives directly on the estimate — an estimate version IS the thing
   * being approved here, there is no separate "change request" row.
   */
  workflow_instance_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const COST_CATEGORIES = ["labour", "material", "equipment", "subcontractor"] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];

export const ESTIMATE_LINE_SOURCES = ["manual", "ai_suggested"] as const;
export type EstimateLineSource = (typeof ESTIMATE_LINE_SOURCES)[number];

/**
 * FR-EST-002: `source`/`confidence` are reserved, AI-ready columns —
 * no AI extraction/suggestion feature exists yet (M28/M29 haven't
 * started). Every line this ticket's code ever writes has
 * source: "manual" and confidence: null.
 */
export interface EstimateLine {
  id: string;
  tenant_id: string;
  estimate_id: string;
  item: string;
  quantity: number;
  unit: string;
  rate: number;
  cost_category: CostCategory;
  line_total: number;
  source: EstimateLineSource;
  confidence: number | null;
  created_at: string;
  updated_at: string;
}
