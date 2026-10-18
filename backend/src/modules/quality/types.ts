export type TradeDiscipline = "civil" | "mep" | "structural" | "finishes" | "piling" | "facade";
export type ITPStatus = "draft" | "approved" | "archived";
export type PointType = "hold_point" | "witness_point" | "surveillance" | "review";
export type WIRStatus = "draft" | "submitted" | "in_progress" | "approved" | "conditionally_approved" | "rejected";
export type ChecklistResult = "pending" | "pass" | "fail" | "na";
export type NCRSeverity = "minor" | "major" | "critical";
export type NCRStatus = "open" | "under_review" | "containment_applied" | "capa_submitted" | "verified_closed" | "voided";
export type RootCauseCategory = "workmanship" | "material_defect" | "design_clash" | "method_deviation" | "environmental";

export interface QualityInspectionPlan {
  id: string;
  tenant_id: string;
  project_id: string;
  plan_number: string;
  title: string;
  trade_discipline: TradeDiscipline;
  version: string;
  status: ITPStatus;
  applicable_specifications: string | null;
  created_at: string;
  updated_at: string;
  items?: ITPInspectionItem[];
}

export interface ITPInspectionItem {
  id: string;
  tenant_id: string;
  plan_id: string;
  item_sequence: number;
  activity_name: string;
  acceptance_criteria: string;
  point_type: PointType;
  reference_standard: string | null;
  verifying_document: string | null;
  created_at: string;
}

export interface WorkInspectionRequest {
  id: string;
  tenant_id: string;
  project_id: string;
  plan_id: string | null;
  plan_title?: string;
  wir_number: string;
  title: string;
  trade_discipline: TradeDiscipline;
  location_or_grid: string;
  inspection_date: string;
  status: WIRStatus;
  contractor_representative: string | null;
  inspector_name: string | null;
  inspector_remarks: string | null;
  signed_off_at: string | null;
  created_at: string;
  updated_at: string;
  checklist?: WIRChecklistItem[];
}

export interface WIRChecklistItem {
  id: string;
  tenant_id: string;
  wir_id: string;
  item_sequence: number;
  checkpoint_description: string;
  result: ChecklistResult;
  comments: string | null;
  created_at: string;
  updated_at: string;
}

export interface NonConformanceReport {
  id: string;
  tenant_id: string;
  project_id: string;
  wir_id: string | null;
  wir_number?: string;
  ncr_number: string;
  title: string;
  trade_discipline: TradeDiscipline;
  location_or_grid: string;
  severity: NCRSeverity;
  status: NCRStatus;
  issue_description: string;
  root_cause_category: RootCauseCategory;
  issued_by: string;
  issued_to: string;
  target_closure_date: string | null;
  containment_action: string | null;
  corrective_action_plan: string | null;
  preventive_action_plan: string | null;
  closed_by: string | null;
  closed_at: string | null;
  closure_remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateITPInput {
  project_id: string;
  plan_number: string;
  title: string;
  trade_discipline: TradeDiscipline;
  version?: string;
  applicable_specifications?: string;
  items?: Array<{
    item_sequence?: number;
    activity_name: string;
    acceptance_criteria: string;
    point_type: PointType;
    reference_standard?: string;
    verifying_document?: string;
  }>;
}

export interface CreateWIRInput {
  project_id: string;
  plan_id?: string;
  wir_number: string;
  title: string;
  trade_discipline: TradeDiscipline;
  location_or_grid: string;
  inspection_date?: string;
  contractor_representative?: string;
  checklist?: Array<{
    item_sequence?: number;
    checkpoint_description: string;
    result?: ChecklistResult;
    comments?: string;
  }>;
}

export interface SignOffWIRInput {
  status: "approved" | "conditionally_approved" | "rejected";
  inspector_name: string;
  inspector_remarks?: string;
  checklist_updates?: Array<{
    id: string;
    result: ChecklistResult;
    comments?: string;
  }>;
  auto_create_ncr?: boolean;
}

export interface CreateNCRInput {
  project_id: string;
  wir_id?: string;
  ncr_number: string;
  title: string;
  trade_discipline: TradeDiscipline;
  location_or_grid: string;
  severity: NCRSeverity;
  issue_description: string;
  root_cause_category: RootCauseCategory;
  issued_by: string;
  issued_to: string;
  target_closure_date?: string;
  containment_action?: string;
}

export interface UpdateNCRCAPAInput {
  containment_action?: string;
  corrective_action_plan: string;
  preventive_action_plan: string;
}

export interface CloseNCRInput {
  closed_by: string;
  closure_remarks: string;
}
