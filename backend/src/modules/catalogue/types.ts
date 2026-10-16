export const DISPOSITIONS = [
  "Configure workflow",
  "Configure approval/decision",
  "Track obligation/document",
  "Periodic review/monitor",
  "Reference/policy only",
  "Clarify/de-duplicate",
  "Defer",
] as const;

export type Disposition = (typeof DISPOSITIONS)[number];

export const WORK_ITEM_STATUSES = [
  "draft",
  "under_review",
  "approved",
  "published",
  "retired",
] as const;

export type WorkItemStatus = (typeof WORK_ITEM_STATUSES)[number];

/** One row of the xlsx "Source Catalogue" sheet (see docs/catalogue/README.md). */
export interface RawCatalogueRow {
  "S.No.": number;
  Department: string;
  "Work Item Name": string;
  "Who is Responsible": string;
  Description?: string | null;
  Trigger?: string | null;
  Action?: string | null;
  "Output/Evidence"?: string | null;
  "Control/Handoff"?: string | null;
  "Continuity/Escalation"?: string | null;
  Timing?: string | null;
}

/** One row of docs/catalogue/disposition-workbook.csv. */
export interface DispositionRow {
  s_no: string | number;
  department: string;
  who_is_responsible: string;
  canonical_role_id: string;
  disposition: string;
  ticket_id: string;
  review_needed?: string;
}

export interface SourceCatalogueImport {
  id: string;
  tenant_id: string | null;
  source_file_name: string;
  source_file_checksum: string;
  row_count: number;
  imported_by: string | null;
  imported_at: string;
}

export interface SourceWorkItem {
  id: string;
  tenant_id: string | null;
  import_id: string;
  source_serial: number;
  department: string;
  work_item_name: string;
  who_is_responsible: string;
  description: string | null;
  trigger_text: string | null;
  action_text: string | null;
  output_evidence: string | null;
  control_handoff: string | null;
  continuity_escalation: string | null;
  timing: string | null;
  governance_understanding: string | null;
  governance_sop_inputs: string | null;
}

export interface WorkItemDefinition {
  id: string;
  tenant_id: string | null;
  source_work_item_id: string;
  canonical_role_id: string | null;
  department_cluster: string | null;
  disposition: Disposition;
  status: WorkItemStatus;
  priority: string | null;
  risk_tier: string | null;
  phase_target: string | null;
  validation_state: string;
  configuration_status: string;
  capability_key: string | null;
  workflow_template_id: string | null;
  ticket_ref: string | null;
  current_version: number;
  created_by: string | null;
  updated_by: string | null;
}

export interface WorkItemDefinitionVersion {
  id: string;
  tenant_id: string | null;
  work_item_definition_id: string;
  version: number;
  snapshot: Record<string, unknown>;
  change_note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface WorkItemDetail {
  definition: WorkItemDefinition;
  source: SourceWorkItem;
  versions: WorkItemDefinitionVersion[];
}

/**
 * `listWorkItems`' row shape: a `WorkItemDefinition` plus the handful of
 * joined `source_work_items` fields a browse list needs to be readable
 * (the definition row alone has no name/description — those live on the
 * source row). Ticket 0125.
 */
export interface WorkItemSummary extends WorkItemDefinition {
  work_item_name: string;
  description: string | null;
  who_is_responsible: string;
  source_department: string;
}

export interface WorkItemFilters {
  department?: string;
  canonicalRoleId?: string;
  disposition?: Disposition;
  status?: WorkItemStatus;
  riskTier?: string;
  missingData?: boolean;
  search?: string;
  sourceSerial?: number;
}
