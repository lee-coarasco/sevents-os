import { useEffect, useState, FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import { PermissionGate } from "../components/PermissionGate";

export interface ProjectOption {
  id: string;
  name: string;
  code: string;
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

export interface DashboardReport {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  config: Record<string, unknown>;
  is_preset: boolean;
  created_at: string;
}

export interface ReportDataResult {
  entity: string;
  total_count: number;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, unknown>>;
  summary?: Record<string, number | string>;
}

type TabKey = "executive" | "financial" | "operations" | "reports";

export function DashboardPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get("tab") as TabKey) || "executive";

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projectsList, setProjectsList] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analytics states
  const [executive, setExecutive] = useState<ExecutiveAnalytics | null>(null);
  const [financial, setFinancial] = useState<FinancialAnalytics | null>(null);
  const [operations, setOperations] = useState<OperationsAnalytics | null>(null);

  // Reports states
  const [reports, setReports] = useState<DashboardReport[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string>("projects");
  const [generatedReport, setGeneratedReport] = useState<ReportDataResult | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [showSaveReportModal, setShowSaveReportModal] = useState(false);
  const [newReportName, setNewReportName] = useState("");
  const [newReportDesc, setNewReportDesc] = useState("");
  const [newReportCategory, setNewReportCategory] = useState("custom");

  // Load project options for the filter dropdown
  useEffect(() => {
    if (!session?.access_token) return;
    apiFetch<{ projects: ProjectOption[] }>("/projects", session.access_token)
      .then((res) => setProjectsList(res.projects || []))
      .catch(() => {});
  }, [session?.access_token]);

  // Load active tab data
  const loadTabData = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);

    const query = selectedProjectId ? `?projectId=${encodeURIComponent(selectedProjectId)}` : "";

    try {
      if (currentTab === "executive") {
        const res = await apiFetch<{ analytics: ExecutiveAnalytics }>(
          `/dashboard/analytics/executive${query}`,
          session.access_token
        );
        setExecutive(res.analytics);
      } else if (currentTab === "financial") {
        const res = await apiFetch<{ analytics: FinancialAnalytics }>(
          `/dashboard/analytics/financial${query}`,
          session.access_token
        );
        setFinancial(res.analytics);
      } else if (currentTab === "operations") {
        const res = await apiFetch<{ analytics: OperationsAnalytics }>(
          `/dashboard/analytics/operations${query}`,
          session.access_token
        );
        setOperations(res.analytics);
      } else if (currentTab === "reports") {
        const res = await apiFetch<{ reports: DashboardReport[] }>(
          "/dashboard/reports",
          session.access_token
        );
        setReports(res.reports || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTabData();
  }, [session?.access_token, currentTab, selectedProjectId]);

  const handleTabChange = (tab: TabKey) => {
    setSearchParams({ tab });
  };

  // Generate Report
  const handleGenerateReport = async (entity: string = selectedEntity) => {
    if (!session?.access_token) return;
    setReportLoading(true);
    try {
      const res = await apiFetch<{ result: ReportDataResult }>(
        "/dashboard/reports/generate",
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({ entity, filters: { limit: 50 } }),
        }
      );
      setGeneratedReport(res.result);
    } catch (err: any) {
      setError(err.message || "Failed to generate report data");
    } finally {
      setReportLoading(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!generatedReport || generatedReport.rows.length === 0) return;

    const headers = generatedReport.columns.map((col) => `"${col.label.replace(/"/g, '""')}"`).join(",");
    const rows = generatedReport.rows.map((row) =>
      generatedReport.columns
        .map((col) => {
          const val = row[col.key];
          if (val === null || val === undefined) return '""';
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(",")
    );

    const csvContent = [headers, ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sevents_report_${generatedReport.entity}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Save Custom Report
  const handleSaveReport = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !newReportName.trim()) return;

    try {
      await apiFetch<{ report: DashboardReport }>("/dashboard/reports", session.access_token, {
        method: "POST",
        body: JSON.stringify({
          name: newReportName.trim(),
          description: newReportDesc.trim() || null,
          category: newReportCategory,
          config: { entity: selectedEntity },
        }),
      });
      setShowSaveReportModal(false);
      setNewReportName("");
      setNewReportDesc("");
      loadTabData();
    } catch (err: any) {
      setError(err.message || "Failed to save custom report");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 font-display">
            Executive Analytics &amp; KPI Cockpit
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Real-time multi-dimensional portfolio intelligence, cross-module financial variance, and custom reporting.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-3">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 outline-none focus:border-amber-500 bg-white"
          >
            <option value="">All Projects (Corporate Portfolio)</option>
            {projectsList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code ? `${p.code} - ${p.name}` : p.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => loadTabData()}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-zinc-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => handleTabChange("executive")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              currentTab === "executive"
                ? "border-amber-500 text-amber-600 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
            }`}
          >
            Executive Command Center
          </button>
          <button
            onClick={() => handleTabChange("financial")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              currentTab === "financial"
                ? "border-amber-500 text-amber-600 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
            }`}
          >
            Financial &amp; Commercial
          </button>
          <button
            onClick={() => handleTabChange("operations")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              currentTab === "operations"
                ? "border-amber-500 text-amber-600 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
            }`}
          >
            Operations, Fleet &amp; QHSE
          </button>
          <button
            onClick={() => handleTabChange("reports")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              currentTab === "reports"
                ? "border-amber-500 text-amber-600 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
            }`}
          >
            Custom Reports &amp; Export
          </button>
        </nav>
      </div>

      {/* Error alert */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Loading state indicator */}
      {loading && (
        <div className="py-8 text-center text-xs text-zinc-400 font-medium">
          Loading live operational metrics...
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: EXECUTIVE COMMAND CENTER */}
      {/* ========================================================================= */}
      {!loading && currentTab === "executive" && executive && (
        <div className="space-y-6">
          {/* Key Metric Tiles */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Portfolio Contract Sum
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 font-display">
                AED {executive.total_contract_value.toLocaleString("en-US")}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Across {executive.total_projects} total projects ({executive.active_projects} active)
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Average Physical Progress
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-amber-600 font-display">
                {executive.average_progress_pct}%
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${Math.min(100, executive.average_progress_pct)}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Project Delivery Health
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-600 font-display">
                  {executive.on_track_projects}
                </span>
                <span className="text-xs text-zinc-400">on track</span>
                <span className="text-2xl font-bold text-amber-600 font-display ml-2">
                  {executive.at_risk_projects}
                </span>
                <span className="text-xs text-zinc-400">at risk</span>
                <span className="text-2xl font-bold text-red-600 font-display ml-2">
                  {executive.delayed_projects}
                </span>
                <span className="text-xs text-zinc-400">delayed</span>
              </div>
              <div className="mt-2 text-xs text-zinc-500">Real-time schedule variance</div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Executive Action Items
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-indigo-600 font-display">
                {executive.pending_approvals_count}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Approvals pending decision • {executive.critical_risks_count} critical escalations
              </div>
            </div>
          </div>

          {/* Active Projects Status Table */}
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-900 font-display">Active Projects &amp; Delivery Progress</h2>
              <Link to="/projects" className="text-xs font-semibold text-amber-600 hover:text-amber-800">
                View all projects &rarr;
              </Link>
            </div>
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase font-semibold text-zinc-500">
                <tr>
                  <th className="px-6 py-3">Project</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Progress</th>
                  <th className="px-6 py-3">Contract Sum</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                {executive.recent_projects.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-zinc-400">
                      No projects found.
                    </td>
                  </tr>
                ) : (
                  executive.recent_projects.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-50/50">
                      <td className="px-6 py-4 font-medium text-zinc-900">
                        <div>{p.name}</div>
                        <div className="text-xs font-mono text-zinc-400">{p.code}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                            p.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : p.status === "at_risk"
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-red-100 text-red-800 border border-red-300"
                          }`}
                        >
                          {p.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 w-48">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded-full bg-zinc-100 overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${Math.min(100, p.progress_pct)}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-zinc-700">{p.progress_pct}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-zinc-900 text-xs">
                        AED {Number(p.contract_amount || 0).toLocaleString("en-US")}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/projects/${p.id}`}
                          className="text-xs font-semibold text-amber-600 hover:text-amber-800"
                        >
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Strategic Navigation Grid */}
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-6">
            <h2 className="text-sm font-bold text-zinc-900 font-display mb-4">Operations Command Center Access</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-medium">
              <Link to="/tasks" className="p-3 rounded-lg border border-zinc-100 hover:border-amber-300 hover:bg-amber-50/30 flex items-center justify-between">
                <span>Task Queues</span>
                <span className="text-zinc-400">&rarr;</span>
              </Link>
              <Link to="/approvals" className="p-3 rounded-lg border border-zinc-100 hover:border-amber-300 hover:bg-amber-50/30 flex items-center justify-between">
                <span>Approvals Inbox</span>
                <span className="text-zinc-400">&rarr;</span>
              </Link>
              <Link to="/site" className="p-3 rounded-lg border border-zinc-100 hover:border-amber-300 hover:bg-amber-50/30 flex items-center justify-between">
                <span>Site Operations &amp; DPR</span>
                <span className="text-zinc-400">&rarr;</span>
              </Link>
              <Link to="/procurement" className="p-3 rounded-lg border border-zinc-100 hover:border-amber-300 hover:bg-amber-50/30 flex items-center justify-between">
                <span>Procurement &amp; POs</span>
                <span className="text-zinc-400">&rarr;</span>
              </Link>
              <Link to="/quality" className="p-3 rounded-lg border border-zinc-100 hover:border-amber-300 hover:bg-amber-50/30 flex items-center justify-between">
                <span>Quality &amp; NCRs</span>
                <span className="text-zinc-400">&rarr;</span>
              </Link>
              <Link to="/safety" className="p-3 rounded-lg border border-zinc-100 hover:border-amber-300 hover:bg-amber-50/30 flex items-center justify-between">
                <span>Safety &amp; HSE</span>
                <span className="text-zinc-400">&rarr;</span>
              </Link>
              <Link to="/contracts" className="p-3 rounded-lg border border-zinc-100 hover:border-amber-300 hover:bg-amber-50/30 flex items-center justify-between">
                <span>Contracts &amp; Claims</span>
                <span className="text-zinc-400">&rarr;</span>
              </Link>
              <Link to="/legal" className="p-3 rounded-lg border border-zinc-100 hover:border-amber-300 hover:bg-amber-50/30 flex items-center justify-between">
                <span>Legal &amp; Licences</span>
                <span className="text-zinc-400">&rarr;</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: FINANCIAL & COMMERCIAL */}
      {/* ========================================================================= */}
      {!loading && currentTab === "financial" && financial && (
        <div className="space-y-6">
          {/* Financial Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Baseline Budget</div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 font-display">
                AED {financial.total_budget.toLocaleString("en-US")}
              </div>
              <div className="mt-1 text-xs text-zinc-500">Approved project cost baseline</div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Committed &amp; Certified Spend</div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-indigo-600 font-display">
                AED {(financial.committed_costs + financial.subcontractor_claims_certified + financial.actual_expenses).toLocaleString("en-US")}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                POs: AED {financial.committed_costs.toLocaleString("en-US")} • Subcontractors: AED {financial.subcontractor_claims_certified.toLocaleString("en-US")}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Certified Invoiced</div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-emerald-600 font-display">
                AED {financial.total_invoiced.toLocaleString("en-US")}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Cash collected: AED {financial.cash_collected.toLocaleString("en-US")}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Budget Cost Variance</div>
              <div
                className={`mt-2 text-3xl font-bold tracking-tight font-display ${
                  financial.cost_variance >= 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                AED {financial.cost_variance.toLocaleString("en-US")}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {financial.cost_variance >= 0 ? "Under budget cushion" : "Budget overrun warning"}
              </div>
            </div>
          </div>

          {/* Variance Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cashflow & Collections */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-bold text-zinc-900 font-display mb-4">Cashflow &amp; Billing Velocity</h2>
              <div className="space-y-4 text-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-zinc-600">Total Invoiced</span>
                    <span className="font-semibold text-zinc-900">AED {financial.total_invoiced.toLocaleString("en-US")}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full w-full" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-zinc-600">Cash Collected</span>
                    <span className="font-semibold text-emerald-600">AED {financial.cash_collected.toLocaleString("en-US")}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{
                        width: `${financial.total_invoiced > 0 ? Math.min(100, Math.round((financial.cash_collected / financial.total_invoiced) * 100)) : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-zinc-600">Outstanding Receivables</span>
                    <span className="font-semibold text-amber-600">
                      AED {Math.max(0, financial.total_invoiced - financial.cash_collected).toLocaleString("en-US")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Retention & Variations */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-bold text-zinc-900 font-display mb-4">Commercial Variations &amp; Retention</h2>
              <div className="space-y-4 text-xs">
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="text-zinc-600">Approved Variations Quantum</span>
                  <span className="font-semibold text-emerald-600">AED {financial.approved_variation_amount.toLocaleString("en-US")}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="text-zinc-600">Pending Variations Under Review</span>
                  <span className="font-semibold text-amber-600">AED {financial.pending_variation_amount.toLocaleString("en-US")}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="text-zinc-600">Contract Retention Withheld</span>
                  <span className="font-semibold text-zinc-900">AED {financial.retention_withheld.toLocaleString("en-US")}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="text-zinc-600">Retention Released</span>
                  <span className="font-semibold text-indigo-600">AED {financial.retention_released.toLocaleString("en-US")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: OPERATIONS, FLEET & QHSE */}
      {/* ========================================================================= */}
      {!loading && currentTab === "operations" && operations && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Site Manpower Mobilization</div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 font-display">
                {operations.manpower_efficiency_pct}%
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Mobilized: {operations.manpower_mobilized} / Demanded: {operations.manpower_demanded}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Equipment Fleet Utilization</div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-amber-600 font-display">
                {operations.equipment_utilization_pct}%
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Active in field: {operations.active_equipment_assets} of {operations.total_equipment_assets} assets
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Quality NCR Closure Rate</div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-emerald-600 font-display">
                {operations.quality_ncr_closure_rate_pct}%
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Open: {operations.open_quality_ncrs} • Resolved: {operations.closed_quality_ncrs}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">HSE Safe Man-Hours</div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-indigo-600 font-display">
                {operations.safe_man_hours.toLocaleString("en-US")}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Active PTWs: {operations.active_ptws_count} • Open Incidents: {operations.open_safety_incidents}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quality Summary */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-bold text-zinc-900 font-display">Quality &amp; Defect Management</h2>
                <Link to="/quality" className="text-xs font-semibold text-amber-600 hover:text-amber-800">
                  Open Register &rarr;
                </Link>
              </div>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="text-zinc-600">Open Non-Conformance Reports (NCRs)</span>
                  <span className="font-semibold text-red-600">{operations.open_quality_ncrs}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="text-zinc-600">Successfully Rectified &amp; Closed NCRs</span>
                  <span className="font-semibold text-emerald-600">{operations.closed_quality_ncrs}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="text-zinc-600">Inspection Overall Pass Rate</span>
                  <span className="font-semibold text-zinc-900">{operations.quality_ncr_closure_rate_pct}%</span>
                </div>
              </div>
            </div>

            {/* HSE Summary */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-bold text-zinc-900 font-display">Health, Safety &amp; Environment (HSE)</h2>
                <Link to="/safety" className="text-xs font-semibold text-amber-600 hover:text-amber-800">
                  Open HSE Hub &rarr;
                </Link>
              </div>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="text-zinc-600">Permits to Work (PTW) Live on Site</span>
                  <span className="font-semibold text-emerald-600">{operations.active_ptws_count} active</span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="text-zinc-600">Reported Unsafe Hazards Pending Action</span>
                  <span className="font-semibold text-amber-600">{operations.open_hazards_count} hazards</span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="text-zinc-600">Safety Incidents Under Investigation</span>
                  <span className="font-semibold text-red-600">{operations.open_safety_incidents} incidents</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CUSTOM REPORTS & EXPORT */}
      {/* ========================================================================= */}
      {!loading && currentTab === "reports" && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Select Entity:
              </label>
              <select
                value={selectedEntity}
                onChange={(e) => {
                  setSelectedEntity(e.target.value);
                  handleGenerateReport(e.target.value);
                }}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 outline-none focus:border-amber-500 bg-white"
              >
                <option value="projects">Projects Portfolio</option>
                <option value="purchase_orders">Purchase Orders &amp; Commitments</option>
                <option value="quality_ncrs">Quality Non-Conformance Reports (NCR)</option>
              </select>

              <button
                onClick={() => handleGenerateReport()}
                disabled={reportLoading}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
              >
                {reportLoading ? "Querying..." : "Generate Live Report"}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <PermissionGate permission="dashboard.reports.export">
                <button
                  onClick={handleExportCSV}
                  disabled={!generatedReport || generatedReport.rows.length === 0}
                  className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
                >
                  Export to CSV
                </button>
              </PermissionGate>

              <PermissionGate permission="dashboard.reports.manage">
                <button
                  onClick={() => setShowSaveReportModal(true)}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 shadow-sm hover:bg-amber-400"
                >
                  + Save Custom Report
                </button>
              </PermissionGate>
            </div>
          </div>

          {/* Generated Table View */}
          {generatedReport && (
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-zinc-900 font-display capitalize">
                    {generatedReport.entity.replace("_", " ")} Report
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {generatedReport.total_count} records retrieved
                  </p>
                </div>

                {/* Summary badges */}
                {generatedReport.summary && (
                  <div className="flex items-center gap-3 text-xs">
                    {Object.entries(generatedReport.summary).map(([k, v]) => (
                      <div key={k} className="bg-zinc-50 px-2.5 py-1 rounded-md border border-zinc-200">
                        <span className="text-zinc-500">{k}:</span>{" "}
                        <span className="font-semibold text-zinc-900">
                          {typeof v === "number" ? v.toLocaleString("en-US") : v}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase font-semibold text-zinc-500">
                    <tr>
                      {generatedReport.columns.map((c) => (
                        <th key={c.key} className="px-6 py-3">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 text-zinc-700">
                    {generatedReport.rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={generatedReport.columns.length}
                          className="px-6 py-8 text-center text-zinc-400"
                        >
                          No records match this report criteria.
                        </td>
                      </tr>
                    ) : (
                      generatedReport.rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50/50">
                          {generatedReport.columns.map((col) => {
                            const val = row[col.key];
                            return (
                              <td key={col.key} className="px-6 py-3 text-xs">
                                {typeof val === "number"
                                  ? val.toLocaleString("en-US")
                                  : val !== null && val !== undefined
                                  ? String(val)
                                  : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Preset & Saved Reports Section */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-900 font-display mb-4">Saved &amp; Preset Report Definitions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {reports.map((r) => (
                <div key={r.id} className="p-4 rounded-lg border border-zinc-200 hover:border-amber-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                      {r.category}
                    </span>
                    {r.is_preset && (
                      <span className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full font-semibold">
                        System Preset
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-sm text-zinc-900 mt-2 font-display">{r.name}</h3>
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{r.description || "Custom report"}</p>
                  <button
                    onClick={() => {
                      const ent = (r.config?.entity as string) || "projects";
                      setSelectedEntity(ent);
                      handleGenerateReport(ent);
                    }}
                    className="mt-3 text-xs font-semibold text-amber-600 hover:text-amber-800"
                  >
                    Run Report &rarr;
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Save Custom Report */}
      {showSaveReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-zinc-100">
            <h2 className="text-lg font-bold text-zinc-900 font-display">Save Custom Report Configuration</h2>
            <p className="text-xs text-zinc-500 mt-1">Bookmark this dataset query for rapid dashboard execution.</p>

            <form onSubmit={handleSaveReport} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700">Report Name *</label>
                <input
                  type="text"
                  required
                  value={newReportName}
                  onChange={(e) => setNewReportName(e.target.value)}
                  placeholder="e.g. Weekly MEP Procurement Log"
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">Category *</label>
                <select
                  value={newReportCategory}
                  onChange={(e) => setNewReportCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                >
                  <option value="executive">Executive</option>
                  <option value="financial">Financial</option>
                  <option value="operational">Operational</option>
                  <option value="qhse">QHSE</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">Description</label>
                <textarea
                  rows={2}
                  value={newReportDesc}
                  onChange={(e) => setNewReportDesc(e.target.value)}
                  placeholder="Briefly describe what this report measures..."
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowSaveReportModal(false)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
                >
                  Save Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
