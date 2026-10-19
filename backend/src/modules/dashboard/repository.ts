import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DashboardSummary,
  ExecutiveAnalytics,
  FinancialAnalytics,
  OperationsAnalytics,
  DashboardReport,
  CreateReportInput,
  ReportCategory,
  ReportDataResult,
} from "./types.js";

export interface DashboardRepository {
  getSummary(tenantId: string): Promise<DashboardSummary>;
  getExecutiveAnalytics(tenantId: string, projectId?: string): Promise<ExecutiveAnalytics>;
  getFinancialAnalytics(tenantId: string, projectId?: string): Promise<FinancialAnalytics>;
  getOperationsAnalytics(tenantId: string, projectId?: string): Promise<OperationsAnalytics>;
  listReports(tenantId: string, category?: ReportCategory): Promise<DashboardReport[]>;
  createReport(tenantId: string, input: CreateReportInput): Promise<DashboardReport>;
  deleteReport(tenantId: string, id: string): Promise<boolean>;
  generateReportData(
    tenantId: string,
    entity: string,
    filters?: Record<string, unknown>
  ): Promise<ReportDataResult>;
}

export function createSupabaseDashboardRepository(
  getUserScopedClient: (token: string) => SupabaseClient
) {
  return (token: string): DashboardRepository => {
    const client = getUserScopedClient(token);

    return {
      async getSummary(_tenantId: string): Promise<DashboardSummary> {
        const [
          { count: companiesCount },
          { count: projectsCount },
          { count: employeesCount },
          { count: workflowsCount },
          { count: documentsCount },
          { count: openTasksCount },
        ] = await Promise.all([
          client.from("companies").select("*", { count: "exact", head: true }),
          client.from("projects").select("*", { count: "exact", head: true }),
          client.from("employees").select("*", { count: "exact", head: true }).eq("status", "active"),
          client.from("workflow_definitions").select("*", { count: "exact", head: true }).eq("status", "published"),
          client.from("documents").select("*", { count: "exact", head: true }),
          client.from("workflow_instances").select("*", { count: "exact", head: true }).eq("status", "running"),
        ]);

        return {
          companies: companiesCount ?? 0,
          projects: projectsCount ?? 0,
          activeEmployees: employeesCount ?? 0,
          publishedWorkflows: workflowsCount ?? 0,
          documents: documentsCount ?? 0,
          openTasks: openTasksCount ?? 0,
        };
      },

      async getExecutiveAnalytics(tenantId: string, projectId?: string): Promise<ExecutiveAnalytics> {
        let projectsQuery = client.from("projects").select("id, name, code, status, baseline_end_date, contract_value, budget_amount");
        if (projectId) {
          projectsQuery = projectsQuery.eq("id", projectId);
        }

        const { data: projectsData, error: projErr } = await projectsQuery;
        if (projErr) throw new Error(projErr.message);

        const projects = projectsData || [];
        const total_projects = projects.length;
        const active_projects = projects.filter((p: any) => p.status === "active").length;
        const delayed_projects = projects.filter((p: any) => p.status === "delayed").length;
        const at_risk_projects = projects.filter((p: any) => p.status === "at_risk").length;
        const on_track_projects = active_projects - delayed_projects - at_risk_projects;

        const total_contract_value = projects.reduce(
          (sum: number, p: any) => sum + Number(p.contract_value || p.budget_amount || 0),
          0
        );

        const average_progress_pct = 0;

        const { count: pendingApprovals } = await client
          .from("approval_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");

        const { count: criticalGrievances } = await client
          .from("client_complaints")
          .select("*", { count: "exact", head: true })
          .eq("severity", "critical")
          .in("status", ["received", "investigating"]);

        const { count: openDisputes } = await client
          .from("legal_matters")
          .select("*", { count: "exact", head: true })
          .in("status", ["open", "pleadings", "hearing"]);

        return {
          total_projects,
          active_projects,
          on_track_projects: on_track_projects > 0 ? on_track_projects : 0,
          at_risk_projects,
          delayed_projects,
          total_contract_value,
          average_progress_pct,
          pending_approvals_count: pendingApprovals ?? 0,
          critical_risks_count: criticalGrievances ?? 0,
          open_disputes_count: openDisputes ?? 0,
          recent_projects: projects.slice(0, 5).map((p: any) => ({
            id: p.id,
            name: p.name,
            code: p.code || "PRJ",
            status: p.status,
            progress_pct: 0,
            contract_amount: Number(p.contract_value || p.budget_amount || 0),
          })),
        };
      },

      async getFinancialAnalytics(tenantId: string, projectId?: string): Promise<FinancialAnalytics> {
        let budgetQ = client.from("budgets").select("total_budget");
        let poQ = client.from("purchase_orders").select("total_amount, status");
        let claimsQ = client.from("subcontractor_claims").select("certified_amount, status");
        let expQ = client.from("expense_claims").select("total_amount, status");
        let invQ = client.from("invoices").select("total_amount, status");
        let recQ = client.from("receipts").select("amount");
        let varQ = client.from("variation_requests").select("amount, status");
        let retQ = client.from("retention_releases").select("release_amount, status");

        if (projectId) {
          budgetQ = budgetQ.eq("project_id", projectId);
          poQ = poQ.eq("project_id", projectId);
          claimsQ = claimsQ.eq("project_id", projectId);
          expQ = expQ.eq("project_id", projectId);
          invQ = invQ.eq("project_id", projectId);
          varQ = varQ.eq("project_id", projectId);
        }

        const [
          { data: budgets },
          { data: pos },
          { data: claims },
          { data: expenses },
          { data: invoices },
          { data: receipts },
          { data: variations },
          { data: retReleases },
        ] = await Promise.all([
          budgetQ,
          poQ,
          claimsQ,
          expQ,
          invQ,
          recQ,
          varQ,
          retQ,
        ]);

        const total_budget = (budgets || []).reduce(
          (sum: number, b: any) => sum + Number(b.total_budget || 0),
          0
        );

        const committed_costs = (pos || [])
          .filter((po: any) => po.status === "approved" || po.status === "issued")
          .reduce((sum: number, po: any) => sum + Number(po.total_amount || 0), 0);

        const subcontractor_claims_certified = (claims || [])
          .filter((c: any) => c.status === "certified" || c.status === "paid")
          .reduce((sum: number, c: any) => sum + Number(c.certified_amount || 0), 0);

        const actual_expenses = (expenses || [])
          .filter((e: any) => e.status === "approved" || e.status === "paid")
          .reduce((sum: number, e: any) => sum + Number(e.total_amount || 0), 0);

        const total_invoiced = (invoices || [])
          .filter((inv: any) => inv.status !== "draft" && inv.status !== "void")
          .reduce((sum: number, inv: any) => sum + Number(inv.total_amount || 0), 0);

        const cash_collected = (receipts || []).reduce(
          (sum: number, r: any) => sum + Number(r.amount || 0),
          0
        );

        const pending_variation_amount = (variations || [])
          .filter((v: any) => v.status === "submitted" || v.status === "under_review")
          .reduce((sum: number, v: any) => sum + Number(v.amount || 0), 0);

        const approved_variation_amount = (variations || [])
          .filter((v: any) => v.status === "approved")
          .reduce((sum: number, v: any) => sum + Number(v.amount || 0), 0);

        const retention_withheld = Math.round(total_invoiced * 0.1); // Standard 10% construction retention
        const retention_released = (retReleases || [])
          .filter((r: any) => r.status === "approved" || r.status === "released")
          .reduce((sum: number, r: any) => sum + Number(r.release_amount || 0), 0);

        const cost_variance = total_budget - (committed_costs + subcontractor_claims_certified + actual_expenses);

        return {
          total_budget,
          committed_costs,
          subcontractor_claims_certified,
          actual_expenses,
          total_invoiced,
          cash_collected,
          pending_variation_amount,
          approved_variation_amount,
          retention_withheld,
          retention_released,
          cost_variance,
        };
      },

      async getOperationsAnalytics(tenantId: string, projectId?: string): Promise<OperationsAnalytics> {
        let reqQ = client.from("manpower_requests").select("quantity_required, status");
        let equipQ = client.from("equipment_assets").select("status");
        let ncrQ = client.from("quality_ncrs").select("status");
        let ptwQ = client.from("safety_permits_to_work").select("status");
        let incQ = client.from("safety_incidents").select("status");
        let hazQ = client.from("safety_hazard_observations").select("status");
        let dprQ = client.from("site_daily_reports").select("total_manpower_count, safe_hours_worked");

        if (projectId) {
          reqQ = reqQ.eq("project_id", projectId);
          equipQ = equipQ.eq("assigned_project_id", projectId);
          ncrQ = ncrQ.eq("project_id", projectId);
          ptwQ = ptwQ.eq("project_id", projectId);
          incQ = incQ.eq("project_id", projectId);
          hazQ = hazQ.eq("project_id", projectId);
          dprQ = dprQ.eq("project_id", projectId);
        }

        const [
          { data: requisitions },
          { data: equipment },
          { data: ncrs },
          { data: ptws },
          { data: incidents },
          { data: hazards },
          { data: dprs },
        ] = await Promise.all([
          reqQ,
          equipQ,
          ncrQ,
          ptwQ,
          incQ,
          hazQ,
          dprQ,
        ]);

        const manpower_demanded = (requisitions || []).reduce(
          (sum: number, r: any) => sum + Number(r.quantity_required || 0),
          0
        );

        const manpower_mobilized = (dprs || []).reduce(
          (sum: number, d: any) => sum + Number(d.total_manpower_count || 0),
          0
        );

        const manpower_efficiency_pct = manpower_demanded > 0
          ? Math.min(100, Math.round((manpower_mobilized / manpower_demanded) * 100))
          : 100;

        const total_equipment_assets = (equipment || []).length;
        const active_equipment_assets = (equipment || []).filter(
          (e: any) => e.status === "active" || e.status === "in_use"
        ).length;
        const equipment_utilization_pct = total_equipment_assets > 0
          ? Math.round((active_equipment_assets / total_equipment_assets) * 100)
          : 0;

        const open_quality_ncrs = (ncrs || []).filter(
          (n: any) => n.status === "open" || n.status === "pending_rectification"
        ).length;
        const closed_quality_ncrs = (ncrs || []).filter(
          (n: any) => n.status === "closed" || n.status === "resolved"
        ).length;
        const total_ncrs = open_quality_ncrs + closed_quality_ncrs;
        const quality_ncr_closure_rate_pct = total_ncrs > 0
          ? Math.round((closed_quality_ncrs / total_ncrs) * 100)
          : 100;

        const safe_man_hours = (dprs || []).reduce(
          (sum: number, d: any) => sum + Number(d.safe_hours_worked || 0),
          0
        );

        const active_ptws_count = (ptws || []).filter(
          (p: any) => p.status === "issued" || p.status === "active"
        ).length;

        const open_safety_incidents = (incidents || []).filter(
          (i: any) => i.status === "open" || i.status === "investigating"
        ).length;

        const open_hazards_count = (hazards || []).filter(
          (h: any) => h.status === "reported" || h.status === "action_pending"
        ).length;

        return {
          manpower_demanded,
          manpower_mobilized,
          manpower_efficiency_pct,
          total_equipment_assets,
          active_equipment_assets,
          equipment_utilization_pct,
          open_quality_ncrs,
          closed_quality_ncrs,
          quality_ncr_closure_rate_pct,
          safe_man_hours,
          active_ptws_count,
          open_safety_incidents,
          open_hazards_count,
        };
      },

      async listReports(_tenantId: string, category?: ReportCategory): Promise<DashboardReport[]> {
        let query = client.from("dashboard_reports").select("*").order("created_at", { ascending: false });
        if (category) {
          query = query.eq("category", category);
        }
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return (data || []) as DashboardReport[];
      },

      async createReport(_tenantId: string, input: CreateReportInput): Promise<DashboardReport> {
        const { data, error } = await client
          .from("dashboard_reports")
          .insert({
            name: input.name,
            description: input.description || null,
            category: input.category,
            config: input.config || {},
            created_by: input.created_by || null,
            is_preset: input.is_preset ?? false,
          })
          .select("*")
          .single();

        if (error) throw new Error(error.message);
        return data as DashboardReport;
      },

      async deleteReport(_tenantId: string, id: string): Promise<boolean> {
        const { error } = await client.from("dashboard_reports").delete().eq("id", id);
        if (error) throw new Error(error.message);
        return true;
      },

      async generateReportData(
        _tenantId: string,
        entity: string,
        filters?: Record<string, unknown>
      ): Promise<ReportDataResult> {
        const limit = Number(filters?.limit || 50);

        if (entity === "projects") {
          const { data, error } = await client
            .from("projects")
            .select("id, name, code, status, contract_value, created_at")
            .limit(limit);

          if (error) throw new Error(error.message);
          const rows = data || [];
          const totalVal = rows.reduce((s: number, r: any) => s + Number(r.contract_value || 0), 0);

          return {
            entity: "projects",
            total_count: rows.length,
            columns: [
              { key: "code", label: "Project Code" },
              { key: "name", label: "Project Name" },
              { key: "status", label: "Status" },
              { key: "contract_value", label: "Contract Sum (AED)" },
              { key: "created_at", label: "Date Created" },
            ],
            rows,
            summary: {
              "Total Projects": rows.length,
              "Total Contract Value (AED)": totalVal,
            },
          };
        }

        if (entity === "purchase_orders") {
          const { data, error } = await client
            .from("purchase_orders")
            .select("id, po_number, vendor_name, total_amount, currency, status, created_at")
            .limit(limit);

          if (error) throw new Error(error.message);
          const rows = data || [];
          const totalSpend = rows.reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);

          return {
            entity: "purchase_orders",
            total_count: rows.length,
            columns: [
              { key: "po_number", label: "PO Number" },
              { key: "vendor_name", label: "Vendor Name" },
              { key: "status", label: "Status" },
              { key: "total_amount", label: "Total Amount" },
              { key: "currency", label: "Currency" },
              { key: "created_at", label: "Order Date" },
            ],
            rows,
            summary: {
              "Total Orders": rows.length,
              "Total Committed Spend": totalSpend,
            },
          };
        }

        if (entity === "quality_ncrs") {
          const { data, error } = await client
            .from("quality_ncrs")
            .select("id, ncr_number, title, severity, status, contractor, due_date, created_at")
            .limit(limit);

          if (error) throw new Error(error.message);
          const rows = data || [];
          return {
            entity: "quality_ncrs",
            total_count: rows.length,
            columns: [
              { key: "ncr_number", label: "NCR Number" },
              { key: "title", label: "Defect Title" },
              { key: "severity", label: "Severity" },
              { key: "status", label: "Status" },
              { key: "contractor", label: "Responsible Entity" },
              { key: "due_date", label: "Rectification Due" },
            ],
            rows,
            summary: {
              "Total NCRs": rows.length,
              "Open NCRs": rows.filter((r: any) => r.status === "open").length,
            },
          };
        }

        // Generic fallback query
        return {
          entity,
          total_count: 0,
          columns: [{ key: "id", label: "ID" }],
          rows: [],
          summary: {},
        };
      },
    };
  };
}
