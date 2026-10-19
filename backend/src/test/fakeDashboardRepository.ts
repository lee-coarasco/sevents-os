import type {
  DashboardRepository,
} from "../modules/dashboard/repository.js";
import type {
  DashboardSummary,
  ExecutiveAnalytics,
  FinancialAnalytics,
  OperationsAnalytics,
  DashboardReport,
  CreateReportInput,
  ReportCategory,
  ReportDataResult,
} from "../modules/dashboard/types.js";

export function createFakeDashboardRepository(): DashboardRepository {
  let reports: DashboardReport[] = [
    {
      id: "rep-default-1",
      tenant_id: "tenant-default",
      name: "Portfolio Status & Financial Overview",
      description: "Executive high-level summary of all live projects and cashflow",
      category: "executive",
      config: { entity: "projects", metrics: ["progress_pct", "contract_amount"] },
      created_by: "user-1",
      is_preset: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "rep-default-2",
      tenant_id: "tenant-default",
      name: "Active PO Commitments",
      description: "Committed spend across approved purchase orders",
      category: "financial",
      config: { entity: "purchase_orders" },
      created_by: "user-1",
      is_preset: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  return {
    async getSummary(_tenantId: string): Promise<DashboardSummary> {
      return {
        companies: 1,
        projects: 4,
        activeEmployees: 25,
        publishedWorkflows: 8,
        documents: 42,
        openTasks: 12,
      };
    },

    async getExecutiveAnalytics(_tenantId: string, _projectId?: string): Promise<ExecutiveAnalytics> {
      return {
        total_projects: 4,
        active_projects: 3,
        on_track_projects: 2,
        at_risk_projects: 1,
        delayed_projects: 0,
        total_contract_value: 28500000,
        average_progress_pct: 64,
        pending_approvals_count: 5,
        critical_risks_count: 1,
        open_disputes_count: 1,
        recent_projects: [
          {
            id: "proj-1",
            name: "Downtown Commercial Tower Fitout",
            code: "PRJ-2026-001",
            status: "active",
            progress_pct: 68,
            contract_amount: 14500000,
          },
          {
            id: "proj-2",
            name: "Dubai Marina Hotel MEP Package",
            code: "PRJ-2026-002",
            status: "at_risk",
            progress_pct: 45,
            contract_amount: 14000000,
          },
        ],
      };
    },

    async getFinancialAnalytics(_tenantId: string, _projectId?: string): Promise<FinancialAnalytics> {
      return {
        total_budget: 25000000,
        committed_costs: 11200000,
        subcontractor_claims_certified: 6800000,
        actual_expenses: 1200000,
        total_invoiced: 16500000,
        cash_collected: 14200000,
        pending_variation_amount: 1850000,
        approved_variation_amount: 950000,
        retention_withheld: 1650000,
        retention_released: 450000,
        cost_variance: 5800000,
      };
    },

    async getOperationsAnalytics(_tenantId: string, _projectId?: string): Promise<OperationsAnalytics> {
      return {
        manpower_demanded: 180,
        manpower_mobilized: 165,
        manpower_efficiency_pct: 92,
        total_equipment_assets: 24,
        active_equipment_assets: 21,
        equipment_utilization_pct: 88,
        open_quality_ncrs: 4,
        closed_quality_ncrs: 28,
        quality_ncr_closure_rate_pct: 88,
        safe_man_hours: 124500,
        active_ptws_count: 9,
        open_safety_incidents: 1,
        open_hazards_count: 3,
      };
    },

    async listReports(_tenantId: string, category?: ReportCategory): Promise<DashboardReport[]> {
      if (category) {
        return reports.filter((r) => r.category === category);
      }
      return [...reports];
    },

    async createReport(tenantId: string, input: CreateReportInput): Promise<DashboardReport> {
      const newReport: DashboardReport = {
        id: `rep-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        tenant_id: tenantId,
        name: input.name,
        description: input.description || null,
        category: input.category,
        config: input.config || {},
        created_by: input.created_by || null,
        is_preset: input.is_preset ?? false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      reports.push(newReport);
      return newReport;
    },

    async deleteReport(_tenantId: string, id: string): Promise<boolean> {
      const initialLen = reports.length;
      reports = reports.filter((r) => r.id !== id);
      return reports.length < initialLen;
    },

    async generateReportData(
      _tenantId: string,
      entity: string,
      _filters?: Record<string, unknown>
    ): Promise<ReportDataResult> {
      if (entity === "projects") {
        return {
          entity: "projects",
          total_count: 2,
          columns: [
            { key: "code", label: "Project Code" },
            { key: "name", label: "Project Name" },
            { key: "status", label: "Status" },
            { key: "progress_pct", label: "Progress %" },
            { key: "contract_amount", label: "Contract Sum (AED)" },
          ],
          rows: [
            {
              code: "PRJ-2026-001",
              name: "Downtown Commercial Tower Fitout",
              status: "active",
              progress_pct: 68,
              contract_amount: 14500000,
            },
            {
              code: "PRJ-2026-002",
              name: "Dubai Marina Hotel MEP Package",
              status: "at_risk",
              progress_pct: 45,
              contract_amount: 14000000,
            },
          ],
          summary: {
            "Total Projects": 2,
            "Total Contract Value (AED)": 28500000,
          },
        };
      }

      return {
        entity,
        total_count: 1,
        columns: [
          { key: "id", label: "ID" },
          { key: "status", label: "Status" },
        ],
        rows: [{ id: "rec-1", status: "active" }],
        summary: { Total: 1 },
      };
    },
  };
}
