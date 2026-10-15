export interface Company {
  id: string;
  tenant_id: string;
  legal_entity_id: string | null;
  legal_name: string;
  preferred_language: string | null;
  reporting_currency: string | null;
  fiscal_year_start_month: number | null;
  enabled_modules: string[];
  statutory_id: string | null;
  vat_registration_number: string | null;
}

export interface Branch {
  id: string;
  tenant_id: string;
  company_id: string;
  name: string;
  operating_region: string | null;
}

export type ProjectStatus = "active" | "on_hold" | "closed";

export interface Project {
  id: string;
  tenant_id: string;
  company_id: string;
  name: string;
  code: string | null;
  status: ProjectStatus;
}

export interface FileObjectMeta {
  id: string;
  tenant_id: string;
  company_id: string;
  project_id: string | null;
  bucket: string;
  storage_path: string;
  content_type: string | null;
  size_bytes: number | null;
}
