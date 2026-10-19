export interface DashboardSummary {
  companies: number;
  projects: number;
  activeEmployees: number;
  publishedWorkflows: number;
  documents: number;
  openTasks: number;
}

export interface ExecutiveAnalytics {
  total_projects: number;
  active_projects: number;
  on_track_projects: number;
  at_risk_projects: number;
  delayed_projects: number;
  total_contract_value: number;
  average_progress_pct: number;
  pending_approvals_count: number;
  critical_risks_count: number;
  open_disputes_count: number;
  recent_projects: Array<{
    id: string;
    name: string;
    code: string;
    status: string;
    progress_pct: number;
    contract_amount: number;
  }>;
}

export interface FinancialAnalytics {
  total_budget: number;
  committed_costs: number;
  subcontractor_claims_certified: number;
  actual_expenses: number;
  total_invoiced: number;
  cash_collected: number;
  pending_variation_amount: number;
  approved_variation_amount: number;
  retention_withheld: number;
  retention_released: number;
  cost_variance: number;
}

export interface OperationsAnalytics {
  manpower_demanded: number;
  manpower_mobilized: number;
  manpower_efficiency_pct: number;
  total_equipment_assets: number;
  active_equipment_assets: number;
  equipment_utilization_pct: number;
  open_quality_ncrs: number;
  closed_quality_ncrs: number;
  quality_ncr_closure_rate_pct: number;
  safe_man_hours: number;
  active_ptws_count: number;
  open_safety_incidents: number;
  open_hazards_count: number;
}

export type ReportCategory = "executive" | "financial" | "operational" | "qhse" | "custom";

export interface DashboardReport {
  id: string;
  tenant_id: string;
  name: string;
  description?: string | null;
  category: ReportCategory;
  config: Record<string, unknown>;
  created_by?: string | null;
  is_preset: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateReportInput {
  name: string;
  description?: string | null;
  category: ReportCategory;
  config: Record<string, unknown>;
  created_by?: string | null;
  is_preset?: boolean;
}

export interface ReportDataResult {
  entity: string;
  total_count: number;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, unknown>>;
  summary?: Record<string, number | string>;
}
