export type DesignBriefStatus = "draft" | "issued" | "superseded";

export interface DesignBrief {
  id: string;
  tenant_id: string;
  project_id: string;
  title: string;
  discipline: string | null;
  scope_description: string | null;
  status: DesignBriefStatus;
  reference_document_ids: string[];
  issued_by: string | null;
  issued_at: string | null;
  created_by: string | null;
  created_at: string;
}

export type RfiStatus = "open" | "responded" | "closed" | "cancelled";

export interface Rfi {
  id: string;
  tenant_id: string;
  project_id: string;
  rfi_number: string;
  raised_by: string | null;
  addressed_to_user_id: string | null;
  addressed_to_contact_id: string | null;
  subject: string;
  description: string | null;
  date_raised: string;
  date_required: string | null;
  date_responded: string | null;
  response: string | null;
  status: RfiStatus;
  reference_document_ids: string[];
  created_at: string;
}

export interface IFCRegisterRow {
  document_id: string;
  document_number: string | null;
  title: string;
  discipline: string | null;
  revision_id: string | null;
  revision_code: string | null;
  revision_status: string | null;
  approved_at: string | null;
  submitted: boolean;
}

export interface AsBuiltRecord {
  id: string;
  tenant_id: string;
  project_id: string;
  document_id: string;
  original_revision_id: string | null;
  as_built_revision_id: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  notes: string | null;
  created_at: string;
}
