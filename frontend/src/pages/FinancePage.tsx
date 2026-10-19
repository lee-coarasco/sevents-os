import { useEffect, useState, FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import { PermissionGate } from "../components/PermissionGate";

export type CostCodeCategory = "materials" | "labour" | "subcontractor" | "equipment" | "overhead";

export interface CostCode {
  id: string;
  code: string;
  name: string;
  category: CostCodeCategory;
  description: string | null;
  is_active: boolean;
}

export type BudgetStatus = "draft" | "submitted" | "approved" | "locked_baseline";

export interface ProjectBudget {
  id: string;
  project_id: string;
  version_number: number;
  status: BudgetStatus;
  total_original_budget: number;
  total_revised_budget: number;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface ProjectBudgetLine {
  id: string;
  budget_id: string;
  cost_code_id: string;
  original_amount: number;
  revised_amount: number;
  committed_amount: number;
  actual_amount: number;
  accrued_amount: number;
  estimate_to_complete: number;
  cost_code?: CostCode;
  estimate_at_completion?: number;
  variance?: number;
}

export type BudgetRevisionStatus = "draft" | "approved" | "rejected";

export interface BudgetRevision {
  id: string;
  project_id: string;
  revision_number: string;
  from_cost_code_id: string | null;
  to_cost_code_id: string;
  amount: number;
  reason: string;
  status: BudgetRevisionStatus;
  requested_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export type ExpenseClaimStatus = "draft" | "submitted" | "approved" | "paid" | "rejected";

export interface ExpenseClaim {
  id: string;
  project_id: string;
  cost_code_id: string;
  claim_number: string;
  claimant_name: string;
  claim_date: string;
  amount: number;
  currency: string;
  description: string;
  receipt_reference: string | null;
  status: ExpenseClaimStatus;
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export type FinancialPeriodStatus = "open" | "closing_in_progress" | "closed";

export interface FinancialPeriod {
  id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  status: FinancialPeriodStatus;
  closed_by: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface ProjectOption {
  id: string;
  name: string;
  code: string;
  status: string;
}

export function FinancePage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    searchParams.get("projectId") || ""
  );

  const [activeTab, setActiveTab] = useState<"budget" | "revisions" | "expenses" | "periods">("budget");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cost Codes
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);

  // Budget
  const [budgets, setBudgets] = useState<ProjectBudget[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>("");
  const [budgetLines, setBudgetLines] = useState<ProjectBudgetLine[]>([]);
  const [budgetSummary, setBudgetSummary] = useState({
    totalOriginal: 0,
    totalRevised: 0,
    totalCommitted: 0,
    totalActual: 0,
    totalAccrued: 0,
    totalEstimateAtCompletion: 0,
    totalVariance: 0,
  });

  // Revisions
  const [revisions, setRevisions] = useState<BudgetRevision[]>([]);

  // Expenses
  const [expenses, setExpenses] = useState<ExpenseClaim[]>([]);

  // Periods
  const [periods, setPeriods] = useState<FinancialPeriod[]>([]);

  // Modals
  const [showNewLineModal, setShowNewLineModal] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showNewBudgetModal, setShowNewBudgetModal] = useState(false);

  // Category filter for budget lines
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Load projects
  useEffect(() => {
    if (!session?.access_token) return;
    async function fetchProjects() {
      try {
        const res = await apiFetch<{ projects: ProjectOption[] }>("/projects", session?.access_token || "");
        const list = res.projects || [];
        setProjects(list);
        if (!selectedProjectId && list.length > 0 && list[0]) {
          setSelectedProjectId(list[0].id);
          setSearchParams((prev) => {
            prev.set("projectId", list[0]?.id || "");
            return prev;
          });
        }
      } catch (err: any) {
        setError(err.message || "Failed to load projects");
      }
    }
    fetchProjects();
  }, [session?.access_token]);

  // Load finance data
  useEffect(() => {
    if (!session?.access_token) return;
    refreshData();
  }, [selectedProjectId, session?.access_token]);

  async function refreshData() {
    if (!session?.access_token) return;
    try {
      setLoading(true);
      setError(null);

      // Fetch master cost codes & financial periods
      const [ccRes, periodsRes] = await Promise.all([
        apiFetch<any>("/finance/cost-codes", session.access_token),
        apiFetch<any>("/finance/periods", session.access_token),
      ]);
      setCostCodes(ccRes.costCodes || []);
      setPeriods(periodsRes.periods || []);

      if (selectedProjectId) {
        // Fetch project-specific data
        const [budgetsRes, revsRes, expRes] = await Promise.all([
          apiFetch<any>(`/finance/projects/${selectedProjectId}/budgets`, session.access_token),
          apiFetch<any>(`/finance/projects/${selectedProjectId}/revisions`, session.access_token),
          apiFetch<any>(`/finance/expense-claims?projectId=${selectedProjectId}`, session.access_token),
        ]);

        const bList: ProjectBudget[] = budgetsRes.budgets || [];
        setBudgets(bList);
        setRevisions(revsRes.revisions || []);
        setExpenses(expRes.claims || []);

        if (bList.length > 0) {
          const currentBudgetId = selectedBudgetId && bList.some((b) => b.id === selectedBudgetId)
            ? selectedBudgetId
            : bList[0]?.id || "";
          setSelectedBudgetId(currentBudgetId);
          await loadBudgetDetail(currentBudgetId);
        } else {
          setSelectedBudgetId("");
          setBudgetLines([]);
          setBudgetSummary({
            totalOriginal: 0,
            totalRevised: 0,
            totalCommitted: 0,
            totalActual: 0,
            totalAccrued: 0,
            totalEstimateAtCompletion: 0,
            totalVariance: 0,
          });
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load finance records");
    } finally {
      setLoading(false);
    }
  }

  async function loadBudgetDetail(budgetId: string) {
    if (!session?.access_token || !budgetId) return;
    try {
      const res = await apiFetch<any>(`/finance/budgets/${budgetId}`, session.access_token);
      setBudgetLines(res.lines || []);
      if (res.summary) {
        setBudgetSummary(res.summary);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load budget detail");
    }
  }

  const handleProjectSelect = (pid: string) => {
    setSelectedProjectId(pid);
    setSearchParams((prev) => {
      prev.set("projectId", pid);
      return prev;
    });
  };

  const filteredLines = categoryFilter === "all"
    ? budgetLines
    : budgetLines.filter((l) => l.cost_code?.category === categoryFilter);

  const activeBudget = budgets.find((b) => b.id === selectedBudgetId);

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Finance, Budgets &amp; Cost Control</h1>
          <p className="text-sm text-zinc-500">
            Project Budgets, Cost Breakdown Structure (CBS), Variance &amp; EAC, Expense Claims &amp; Financial Periods.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="project-select" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Project:
          </label>
          <select
            id="project-select"
            value={selectedProjectId}
            onChange={(e) => handleProjectSelect(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm focus:border-brand focus:outline-none"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} - {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-semibold text-red-600 hover:text-red-800">
            ✕
          </button>
        </div>
      )}

      {/* KPI Summary Cards (Shown on budget tab) */}
      {activeTab === "budget" && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Revised Budget</span>
            <p className="mt-1 text-xl font-bold text-zinc-900">
              ${budgetSummary.totalRevised.toLocaleString()}
            </p>
            <span className="text-[11px] text-zinc-500">Orig: ${budgetSummary.totalOriginal.toLocaleString()}</span>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Committed</span>
            <p className="mt-1 text-xl font-bold text-indigo-700">
              ${budgetSummary.totalCommitted.toLocaleString()}
            </p>
            <span className="text-[11px] text-zinc-500">PO &amp; Subcontract</span>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Actual Cost</span>
            <p className="mt-1 text-xl font-bold text-zinc-900">
              ${budgetSummary.totalActual.toLocaleString()}
            </p>
            <span className="text-[11px] text-zinc-500">Incurred to date</span>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Estimate at Complete</span>
            <p className="mt-1 text-xl font-bold text-blue-700">
              ${budgetSummary.totalEstimateAtCompletion.toLocaleString()}
            </p>
            <span className="text-[11px] text-zinc-500">EAC = Actual + ETC</span>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Projected Variance</span>
            <p
              className={`mt-1 text-xl font-bold ${
                budgetSummary.totalVariance >= 0 ? "text-emerald-700" : "text-rose-600"
              }`}
            >
              {budgetSummary.totalVariance >= 0 ? "+" : ""}
              ${budgetSummary.totalVariance.toLocaleString()}
            </p>
            <span className="text-[11px] text-zinc-500">
              {budgetSummary.totalVariance >= 0 ? "Under Budget" : "Cost Overrun"}
            </span>
          </div>
        </div>
      )}

      {loading && <div className="text-xs text-zinc-400 animate-pulse">Loading finance records...</div>}

      {/* Tab Navigation */}
      <div className="flex border-b border-zinc-200">
        <button
          onClick={() => setActiveTab("budget")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "budget"
              ? "border-brand text-zinc-900 font-semibold"
              : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
          }`}
        >
          <span>Budget &amp; Cost Variance</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 font-normal">
            {budgetLines.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("revisions")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "revisions"
              ? "border-brand text-zinc-900 font-semibold"
              : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
          }`}
        >
          <span>Budget Revisions &amp; Transfers</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 font-normal">
            {revisions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("expenses")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "expenses"
              ? "border-brand text-zinc-900 font-semibold"
              : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
          }`}
        >
          <span>Expense Claims &amp; Petty Cash</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 font-normal">
            {expenses.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("periods")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "periods"
              ? "border-brand text-zinc-900 font-semibold"
              : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
          }`}
        >
          <span>Financial Periods &amp; Controls</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 font-normal">
            {periods.length}
          </span>
        </button>
      </div>

      {/* TAB 1: Budget & Cost Breakdown Structure (CBS) */}
      {activeTab === "budget" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              {budgets.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase text-zinc-500">Version:</span>
                  <select
                    value={selectedBudgetId}
                    onChange={(e) => {
                      setSelectedBudgetId(e.target.value);
                      loadBudgetDetail(e.target.value);
                    }}
                    className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700"
                  >
                    {budgets.map((b) => (
                      <option key={b.id} value={b.id}>
                        v{b.version_number} - {b.status.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase text-zinc-500">Category:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700"
                >
                  <option value="all">All Categories</option>
                  <option value="materials">Materials</option>
                  <option value="labour">Labour</option>
                  <option value="subcontractor">Subcontractor</option>
                  <option value="equipment">Equipment</option>
                  <option value="overhead">Overhead</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <PermissionGate permission="finance.budget.manage">
                {budgets.length === 0 ? (
                  <button
                    onClick={() => setShowNewBudgetModal(true)}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 transition shadow-sm"
                  >
                    + Setup Project Budget
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setShowNewLineModal(true)}
                      className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 transition shadow-sm"
                    >
                      + Add Budget Line
                    </button>
                    {activeBudget?.status === "draft" && (
                      <button
                        onClick={async () => {
                          if (!session?.access_token || !activeBudget) return;
                          await apiFetch(`/finance/budgets/${activeBudget.id}/submit`, session.access_token, {
                            method: "POST",
                          });
                          refreshData();
                        }}
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        Submit Budget
                      </button>
                    )}
                  </>
                )}
              </PermissionGate>

              <PermissionGate permission="finance.budget.approve">
                {activeBudget && activeBudget.status === "submitted" && (
                  <button
                    onClick={async () => {
                      if (!session?.access_token || !activeBudget) return;
                      await apiFetch(`/finance/budgets/${activeBudget.id}/approve`, session.access_token, {
                        method: "POST",
                        body: JSON.stringify({
                          approvedBy: session.user.email || "CFO",
                          lockBaseline: true,
                        }),
                      });
                      refreshData();
                    }}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 shadow-sm"
                  >
                    Approve &amp; Lock Baseline
                  </button>
                )}
              </PermissionGate>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm text-zinc-700">
              <thead className="border-b border-zinc-200 bg-zinc-50/50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Cost Code</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Orig Budget</th>
                  <th className="px-4 py-3 text-right">Revised Budget</th>
                  <th className="px-4 py-3 text-right">Committed</th>
                  <th className="px-4 py-3 text-right">Actuals</th>
                  <th className="px-4 py-3 text-right">ETC</th>
                  <th className="px-4 py-3 text-right">EAC</th>
                  <th className="px-4 py-3 text-right">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {filteredLines.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-zinc-400">
                      No budget lines found for this project.
                    </td>
                  </tr>
                ) : (
                  filteredLines.map((line) => {
                    const eac = line.estimate_at_completion || 0;
                    const variance = line.variance || 0;
                    return (
                      <tr key={line.id} className="hover:bg-zinc-50/50">
                        <td className="px-4 py-3 font-semibold text-zinc-900">
                          {line.cost_code ? line.cost_code.code : line.cost_code_id}
                        </td>
                        <td className="px-4 py-3 text-zinc-900">
                          {line.cost_code ? line.cost_code.name : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800 uppercase">
                            {line.cost_code ? line.cost_code.category : "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-zinc-600">
                          ${Number(line.original_amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                          ${Number(line.revised_amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-indigo-700 font-medium">
                          ${Number(line.committed_amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-900 font-medium">
                          ${Number(line.actual_amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-600">
                          ${Number(line.estimate_to_complete).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-blue-800">
                          ${Number(eac).toLocaleString()}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-bold ${
                            variance >= 0 ? "text-emerald-700" : "text-rose-600"
                          }`}
                        >
                          {variance >= 0 ? "+" : ""}
                          ${Number(variance).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Budget Revisions & Transfers */}
      {activeTab === "revisions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              Formal reallocation requests between project cost codes or contingency release.
            </p>
            <PermissionGate permission="finance.forecast.manage">
              <button
                onClick={() => setShowRevisionModal(true)}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 transition shadow-sm"
              >
                + Request Budget Transfer
              </button>
            </PermissionGate>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm text-zinc-700">
              <thead className="border-b border-zinc-200 bg-zinc-50/50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Revision #</th>
                  <th className="px-4 py-3">From Code</th>
                  <th className="px-4 py-3">To Code</th>
                  <th className="px-4 py-3 text-right">Transfer Amount</th>
                  <th className="px-4 py-3">Reason / Justification</th>
                  <th className="px-4 py-3">Requested By</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {revisions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-zinc-400">
                      No budget revisions or transfer requests recorded.
                    </td>
                  </tr>
                ) : (
                  revisions.map((rev) => {
                    const fromCc = costCodes.find((c) => c.id === rev.from_cost_code_id);
                    const toCc = costCodes.find((c) => c.id === rev.to_cost_code_id);
                    return (
                      <tr key={rev.id} className="hover:bg-zinc-50/50">
                        <td className="px-4 py-3 font-semibold text-zinc-900">{rev.revision_number}</td>
                        <td className="px-4 py-3 text-zinc-600">
                          {fromCc ? `${fromCc.code} - ${fromCc.name}` : "Contingency / New"}
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-900">
                          {toCc ? `${toCc.code} - ${toCc.name}` : rev.to_cost_code_id}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-zinc-900">
                          ${Number(rev.amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-600 max-w-xs truncate" title={rev.reason}>
                          {rev.reason}
                        </td>
                        <td className="px-4 py-3 text-zinc-700">{rev.requested_by}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              rev.status === "approved"
                                ? "bg-emerald-100 text-emerald-800"
                                : rev.status === "rejected"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {rev.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <PermissionGate permission="finance.forecast.manage">
                            {rev.status === "draft" && (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={async () => {
                                    if (!session?.access_token) return;
                                    await apiFetch(`/finance/revisions/${rev.id}/authorize`, session.access_token, {
                                      method: "POST",
                                      body: JSON.stringify({
                                        status: "approved",
                                        approvedBy: session.user.email || "Finance Director",
                                      }),
                                    });
                                    refreshData();
                                  }}
                                  className="text-xs font-semibold text-emerald-700 hover:underline"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!session?.access_token) return;
                                    await apiFetch(`/finance/revisions/${rev.id}/authorize`, session.access_token, {
                                      method: "POST",
                                      body: JSON.stringify({
                                        status: "rejected",
                                        approvedBy: session.user.email || "Finance Director",
                                      }),
                                    });
                                    refreshData();
                                  }}
                                  className="text-xs font-semibold text-rose-600 hover:underline"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </PermissionGate>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Expense Claims & Petty Cash */}
      {activeTab === "expenses" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              Staff travel, site incidentals, and petty cash expense disbursements with cost code allocation.
            </p>
            <PermissionGate permission="finance.expense.manage">
              <button
                onClick={() => setShowExpenseModal(true)}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 transition shadow-sm"
              >
                + Submit Expense Claim
              </button>
            </PermissionGate>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm text-zinc-700">
              <thead className="border-b border-zinc-200 bg-zinc-50/50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Claim #</th>
                  <th className="px-4 py-3">Claimant</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Cost Code</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Receipt / Ref</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-zinc-400">
                      No expense claims submitted.
                    </td>
                  </tr>
                ) : (
                  expenses.map((claim) => {
                    const matchedCc = costCodes.find((c) => c.id === claim.cost_code_id);
                    return (
                      <tr key={claim.id} className="hover:bg-zinc-50/50">
                        <td className="px-4 py-3 font-semibold text-zinc-900">{claim.claim_number}</td>
                        <td className="px-4 py-3 font-medium text-zinc-900">{claim.claimant_name}</td>
                        <td className="px-4 py-3 text-xs text-zinc-600">
                          {new Date(claim.claim_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-700">
                          {matchedCc ? `${matchedCc.code} - ${matchedCc.name}` : claim.cost_code_id}
                        </td>
                        <td className="px-4 py-3 font-bold text-zinc-900">
                          {claim.currency} {Number(claim.amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-600 max-w-xs truncate" title={claim.description}>
                          {claim.description}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-zinc-500">
                          {claim.receipt_reference || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              claim.status === "paid"
                                ? "bg-emerald-100 text-emerald-800"
                                : claim.status === "approved"
                                ? "bg-blue-100 text-blue-800"
                                : claim.status === "rejected"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {claim.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <PermissionGate permission="finance.expense.approve">
                            {claim.status === "draft" && (
                              <button
                                onClick={async () => {
                                  if (!session?.access_token) return;
                                  await apiFetch(`/finance/expense-claims/${claim.id}/authorize`, session.access_token, {
                                    method: "POST",
                                    body: JSON.stringify({
                                      status: "approved",
                                      approvedBy: session.user.email || "Finance Manager",
                                    }),
                                  });
                                  refreshData();
                                }}
                                className="text-xs font-semibold text-blue-700 hover:underline mr-2"
                              >
                                Approve
                              </button>
                            )}
                            {claim.status === "approved" && (
                              <button
                                onClick={async () => {
                                  if (!session?.access_token) return;
                                  await apiFetch(`/finance/expense-claims/${claim.id}/authorize`, session.access_token, {
                                    method: "POST",
                                    body: JSON.stringify({ status: "paid" }),
                                  });
                                  refreshData();
                                }}
                                className="text-xs font-semibold text-emerald-700 hover:underline"
                              >
                                Mark Paid
                              </button>
                            )}
                          </PermissionGate>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Financial Periods & Controls */}
      {activeTab === "periods" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-zinc-900">Financial Accounting Periods</h3>
              <p className="text-xs text-zinc-500">
                Period locks enforce financial governance and prevent backdating expenses or transactions into closed periods.
              </p>
            </div>
            <PermissionGate permission="finance.period.manage">
              <button
                onClick={() => setShowPeriodModal(true)}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 transition"
              >
                + Open New Period
              </button>
            </PermissionGate>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm text-zinc-700">
              <thead className="border-b border-zinc-200 bg-zinc-50/50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Period Name</th>
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3">End Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Closed By / Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {periods.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-400">
                      No financial periods registered.
                    </td>
                  </tr>
                ) : (
                  periods.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-semibold text-zinc-900">{p.period_name}</td>
                      <td className="px-4 py-3 text-xs text-zinc-600">{p.start_date}</td>
                      <td className="px-4 py-3 text-xs text-zinc-600">{p.end_date}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            p.status === "open"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-zinc-100 text-zinc-700"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {p.closed_by ? `${p.closed_by} (${new Date(p.closed_at || "").toLocaleDateString()})` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PermissionGate permission="finance.period.manage">
                          {p.status === "open" && (
                            <button
                              onClick={async () => {
                                if (!session?.access_token) return;
                                await apiFetch(`/finance/periods/${p.id}/close`, session.access_token, {
                                  method: "POST",
                                  body: JSON.stringify({ closedBy: session.user.email || "Financial Controller" }),
                                });
                                refreshData();
                              }}
                              className="text-xs font-semibold text-rose-600 hover:underline"
                            >
                              Close Accounting Period
                            </button>
                          )}
                        </PermissionGate>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Create / Setup Budget */}
      {showNewBudgetModal && (
        <CreateBudgetModal
          projectId={selectedProjectId}
          onClose={() => setShowNewBudgetModal(false)}
          onSuccess={() => {
            setShowNewBudgetModal(false);
            refreshData();
          }}
        />
      )}

      {/* MODAL 2: Add / Upsert Budget Line */}
      {showNewLineModal && activeBudget && (
        <UpsertBudgetLineModal
          budgetId={activeBudget.id}
          costCodes={costCodes}
          onClose={() => setShowNewLineModal(false)}
          onSuccess={() => {
            setShowNewLineModal(false);
            refreshData();
          }}
        />
      )}

      {/* MODAL 3: Request Budget Revision */}
      {showRevisionModal && (
        <CreateRevisionModal
          projectId={selectedProjectId}
          costCodes={costCodes}
          onClose={() => setShowRevisionModal(false)}
          onSuccess={() => {
            setShowRevisionModal(false);
            refreshData();
          }}
        />
      )}

      {/* MODAL 4: Submit Expense Claim */}
      {showExpenseModal && (
        <CreateExpenseModal
          projectId={selectedProjectId}
          costCodes={costCodes}
          onClose={() => setShowExpenseModal(false)}
          onSuccess={() => {
            setShowExpenseModal(false);
            refreshData();
          }}
        />
      )}

      {/* MODAL 5: Create Financial Period */}
      {showPeriodModal && (
        <CreatePeriodModal
          onClose={() => setShowPeriodModal(false)}
          onSuccess={() => {
            setShowPeriodModal(false);
            refreshData();
          }}
        />
      )}
    </div>
  );
}

// =========================================================================
// SUBCOMPONENTS / MODALS
// =========================================================================

function CreateBudgetModal({
  projectId,
  onClose,
  onSuccess,
}: {
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(
        `/finance/projects/${projectId}/budgets`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({ notes }),
        }
      );
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to setup budget");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-bold text-zinc-900">Setup Project Budget</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">✕</button>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Budget Notes / Reference</label>
            <textarea
              rows={3}
              placeholder="e.g. Baseline contract budget as per tender BOQ"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Baseline Budget"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UpsertBudgetLineModal({
  budgetId,
  costCodes,
  onClose,
  onSuccess,
}: {
  budgetId: string;
  costCodes: CostCode[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [costCodeId, setCostCodeId] = useState(costCodes[0]?.id || "");
  const [originalAmount, setOriginalAmount] = useState<number>(0);
  const [revisedAmount, setRevisedAmount] = useState<number>(0);
  const [committedAmount, setCommittedAmount] = useState<number>(0);
  const [actualAmount, setActualAmount] = useState<number>(0);
  const [estimateToComplete, setEstimateToComplete] = useState<number>(0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(
        `/finance/budgets/${budgetId}/lines`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            costCodeId,
            originalAmount: Number(originalAmount),
            revisedAmount: Number(revisedAmount || originalAmount),
            committedAmount: Number(committedAmount),
            actualAmount: Number(actualAmount),
            estimateToComplete: Number(estimateToComplete),
          }),
        }
      );
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to save budget line");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-bold text-zinc-900">Add or Update Budget Line</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">✕</button>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Cost Code</label>
            <select
              value={costCodeId}
              onChange={(e) => setCostCodeId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              required
            >
              {costCodes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.name} ({c.category})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Original Budget ($)</label>
              <input
                type="number"
                min={0}
                required
                value={originalAmount}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setOriginalAmount(val);
                  if (!revisedAmount) setRevisedAmount(val);
                }}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Revised Budget ($)</label>
              <input
                type="number"
                min={0}
                value={revisedAmount}
                onChange={(e) => setRevisedAmount(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Committed ($)</label>
              <input
                type="number"
                min={0}
                value={committedAmount}
                onChange={(e) => setCommittedAmount(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Actual Cost ($)</label>
              <input
                type="number"
                min={0}
                value={actualAmount}
                onChange={(e) => setActualAmount(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">ETC ($)</label>
              <input
                type="number"
                min={0}
                value={estimateToComplete}
                onChange={(e) => setEstimateToComplete(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Budget Line"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateRevisionModal({
  projectId,
  costCodes,
  onClose,
  onSuccess,
}: {
  projectId: string;
  costCodes: CostCode[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fromCostCodeId, setFromCostCodeId] = useState("");
  const [toCostCodeId, setToCostCodeId] = useState(costCodes[0]?.id || "");
  const [amount, setAmount] = useState<number>(10000);
  const [reason, setReason] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(
        `/finance/projects/${projectId}/revisions`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            fromCostCodeId: fromCostCodeId || undefined,
            toCostCodeId,
            amount: Number(amount),
            reason,
            requestedBy: session.user.email || "Project Manager",
          }),
        }
      );
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to create budget revision");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-bold text-zinc-900">Request Budget Transfer / Revision</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">✕</button>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">From Code (Source)</label>
              <select
                value={fromCostCodeId}
                onChange={(e) => setFromCostCodeId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              >
                <option value="">Contingency / General Reserve</option>
                {costCodes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">To Code (Destination)</label>
              <select
                value={toCostCodeId}
                onChange={(e) => setToCostCodeId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
                required
              >
                {costCodes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Transfer Amount ($)</label>
            <input
              type="number"
              min={1}
              required
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Reason / Scope Justification</label>
            <textarea
              rows={3}
              required
              placeholder="e.g. Scope increase in piling diameter per structural redesign"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit Transfer Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateExpenseModal({
  projectId,
  costCodes,
  onClose,
  onSuccess,
}: {
  projectId: string;
  costCodes: CostCode[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [claimantName, setClaimantName] = useState(session?.user?.email || "");
  const [claimDate, setClaimDate] = useState(new Date().toISOString().slice(0, 10));
  const [costCodeId, setCostCodeId] = useState(costCodes[0]?.id || "");
  const [amount, setAmount] = useState<number>(500);
  const [currency, setCurrency] = useState("AED");
  const [description, setDescription] = useState("");
  const [receiptReference, setReceiptReference] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(
        "/finance/expense-claims",
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            projectId,
            costCodeId,
            claimantName,
            claimDate: new Date(claimDate).toISOString(),
            amount: Number(amount),
            currency,
            description,
            receiptReference: receiptReference || undefined,
          }),
        }
      );
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to submit expense claim");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-bold text-zinc-900">Submit Expense Claim</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">✕</button>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Claimant Name</label>
              <input
                type="text"
                required
                value={claimantName}
                onChange={(e) => setClaimantName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Claim Date</label>
              <input
                type="date"
                required
                value={claimDate}
                onChange={(e) => setClaimDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold uppercase text-zinc-500">Cost Code</label>
              <select
                value={costCodeId}
                onChange={(e) => setCostCodeId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
                required
              >
                {costCodes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              >
                <option value="AED">AED</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="SAR">SAR</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Amount</label>
              <input
                type="number"
                min={1}
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Receipt / Bill #</label>
              <input
                type="text"
                placeholder="e.g. INV-99124"
                value={receiptReference}
                onChange={(e) => setReceiptReference(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Expense Description</label>
            <textarea
              rows={2}
              required
              placeholder="e.g. Emergency pump rental fuel and fittings"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit Expense Claim"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreatePeriodModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [periodName, setPeriodName] = useState(new Date().toISOString().slice(0, 7));
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 8) + "01");
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 8) + "28");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(
        "/finance/periods",
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            periodName,
            startDate,
            endDate,
          }),
        }
      );
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to create financial period");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-bold text-zinc-900">Open New Financial Period</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">✕</button>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Period Name (YYYY-MM)</label>
            <input
              type="text"
              required
              value={periodName}
              onChange={(e) => setPeriodName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">End Date</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "Opening..." : "Open Accounting Period"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
