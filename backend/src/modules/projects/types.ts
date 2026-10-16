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
