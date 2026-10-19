import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  agentService,
  type AgentDefinition,
  type AgentExecution,
  type AgentExecutionStep,
  type AgentRunAuditLog,
  type AgentIncidentReview,
  type CostAnalyticsSummary,
} from "../services/agentService";

export function AiAgentRunsPage() {
  const { session } = useAuth();
  const token = session?.access_token || "";

  // Active Tab
  const [activeTab, setActiveTab] = useState<"runs" | "hitl" | "trace" | "costs" | "incidents">("runs");

  // Core Data
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [executions, setExecutions] = useState<AgentExecution[]>([]);
  const [costAnalytics, setCostAnalytics] = useState<CostAnalyticsSummary | null>(null);
  const [incidents, setIncidents] = useState<AgentIncidentReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterAgentId, setFilterAgentId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  // Selected Execution for Trace / Inspection
  const [selectedExecution, setSelectedExecution] = useState<AgentExecution | null>(null);
  const [executionAuditLogs, setExecutionAuditLogs] = useState<AgentRunAuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // HITL Review Editing State (Parameter tweaking before approval)
  const [hitlModifiedInputs, setHitlModifiedInputs] = useState<Record<string, string>>({});
  const [hitlNotes, setHitlNotes] = useState<Record<string, string>>({});
  const [hitlRejectReason, setHitlRejectReason] = useState<Record<string, string>>({});
  const [hitlActionLoading, setHitlActionLoading] = useState<string | null>(null);

  // Kill Switch Action
  const [killSwitchReason, setKillSwitchReason] = useState("");
  const [targetKillSwitchAgent, setTargetKillSwitchAgent] = useState<AgentDefinition | null>(null);
  const [killSwitchLoading, setKillSwitchLoading] = useState(false);

  // Incident Resolution Modal
  const [resolvingIncident, setResolvingIncident] = useState<AgentIncidentReview | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolvingLoading, setResolvingLoading] = useState(false);

  // Load all data
  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [agentsData, execsData, costsData, incidentsData] = await Promise.all([
        agentService.listAgents(token).catch(() => []),
        agentService.listExecutions(token, {
          agentId: filterAgentId || undefined,
          status: filterStatus || undefined,
          limit: 100,
        }).catch(() => []),
        agentService.getCostAnalytics(token).catch(() => null),
        agentService.listIncidents(token).catch(() => []),
      ]);

      setAgents(agentsData);
      setExecutions(execsData);
      setCostAnalytics(costsData);
      setIncidents(incidentsData);

      if (execsData.length > 0 && !selectedExecution) {
        setSelectedExecution(execsData[0]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load agent runs data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token, filterAgentId, filterStatus]);

  // Load audit logs when selectedExecution changes
  useEffect(() => {
    if (!token || !selectedExecution) return;
    setLoadingAudit(true);
    agentService
      .getExecutionAudit(token, selectedExecution.id)
      .then((logs) => setExecutionAuditLogs(logs))
      .catch(() => setExecutionAuditLogs([]))
      .finally(() => setLoadingAudit(false));
  }, [token, selectedExecution?.id]);

  // Handle Approve with tweaked parameters
  const handleApprove = async (exec: AgentExecution) => {
    if (!token) return;
    setHitlActionLoading(exec.id);
    try {
      let modifiedInput: Record<string, unknown> | undefined;
      const rawEdited = hitlModifiedInputs[exec.id];
      if (rawEdited && rawEdited.trim()) {
        try {
          modifiedInput = JSON.parse(rawEdited);
        } catch {
          alert("Invalid JSON in modified input parameters. Please fix syntax before approving.");
          setHitlActionLoading(null);
          return;
        }
      }

      await agentService.approveAction(
        token,
        exec.id,
        true,
        undefined,
        modifiedInput,
        hitlNotes[exec.id]
      );
      await loadData();
    } catch (err: any) {
      alert("Approval error: " + err.message);
    } finally {
      setHitlActionLoading(null);
    }
  };

  // Handle Reject
  const handleReject = async (exec: AgentExecution) => {
    if (!token) return;
    const reason = hitlRejectReason[exec.id] || "Rejected by supervisor";
    setHitlActionLoading(exec.id);
    try {
      await agentService.approveAction(token, exec.id, false, reason);
      await loadData();
    } catch (err: any) {
      alert("Rejection error: " + err.message);
    } finally {
      setHitlActionLoading(null);
    }
  };

  // Handle Retry
  const handleRetry = async (execId: string) => {
    if (!token) return;
    setLoading(true);
    try {
      await agentService.retryExecution(token, execId);
      await loadData();
    } catch (err: any) {
      alert("Retry failed: " + err.message);
      setLoading(false);
    }
  };

  // Handle Cancel
  const handleCancel = async (execId: string) => {
    if (!token) return;
    const reason = prompt("Enter cancellation reason:", "Operator requested abort");
    if (!reason) return;
    setLoading(true);
    try {
      await agentService.cancelExecution(token, execId, reason);
      await loadData();
    } catch (err: any) {
      alert("Cancellation failed: " + err.message);
      setLoading(false);
    }
  };

  // Handle Emergency Kill Switch Toggle
  const handleToggleKillSwitch = async (agent: AgentDefinition, shouldPause: boolean) => {
    if (!token) return;
    setKillSwitchLoading(true);
    try {
      await agentService.toggleKillSwitch(
        token,
        agent.id,
        shouldPause,
        killSwitchReason || "Emergency administrative hold"
      );
      setTargetKillSwitchAgent(null);
      setKillSwitchReason("");
      await loadData();
    } catch (err: any) {
      alert("Kill switch toggle failed: " + err.message);
    } finally {
      setKillSwitchLoading(false);
    }
  };

  // Handle Incident Resolution
  const handleResolveIncident = async () => {
    if (!token || !resolvingIncident) return;
    setResolvingLoading(true);
    try {
      await agentService.resolveIncident(token, resolvingIncident.id, resolutionNotes || "Reviewed and cleared by safety auditor");
      setResolvingIncident(null);
      setResolutionNotes("");
      await loadData();
    } catch (err: any) {
      alert("Incident resolution failed: " + err.message);
    } finally {
      setResolvingLoading(false);
    }
  };

  // Derived counts
  const pendingHitlRuns = executions.filter((e) => e.status === "paused_waiting_approval");
  const activeRunsCount = executions.filter((e) => e.status === "running" || e.status === "queued").length;
  const unresolvedIncidentsCount = incidents.filter((i) => !i.is_resolved).length;

  return (
    <div className="min-h-screen bg-zinc-50 pb-16">
      {/* Top Header */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                  Module M30
                </span>
                <span className="text-xs font-medium text-zinc-500">
                  BRD §8.10 Governance & Audit
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">
                Agent Runs, Human Review & Audit
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Live run queue monitoring, Human-In-The-Loop review, step timeline, token spend tracking, and safety incidents.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/ai/agents"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
              >
                <span>🤖</span> Agent Studio (M29)
              </Link>
              <Link
                to="/ai/knowledge"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
              >
                <span>📚</span> Knowledge Search (M28)
              </Link>
              <button
                disabled={loading}
                onClick={loadData}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                <span>🔄</span> {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-xs">
              <div className="text-xs font-medium text-zinc-500">Total Runs ({activeRunsCount} active)</div>
              <div className="mt-1 text-xl font-bold text-zinc-900">{executions.length}</div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 shadow-xs">
              <div className="text-xs font-medium text-amber-700">Awaiting Human Review</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold text-amber-900">{pendingHitlRuns.length}</span>
                {pendingHitlRuns.length > 0 && (
                  <span className="animate-pulse text-xs font-semibold text-amber-600">Action Required</span>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-xs">
              <div className="text-xs font-medium text-zinc-500">Total Spend (USD)</div>
              <div className="mt-1 text-xl font-bold text-zinc-900">
                ${costAnalytics?.totalCostUsd?.toFixed(4) ?? "0.0000"}
              </div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 shadow-xs">
              <div className="text-xs font-medium text-rose-700">Flagged Incidents</div>
              <div className="mt-1 text-xl font-bold text-rose-900">{unresolvedIncidentsCount}</div>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="mt-6 border-b border-zinc-200">
            <nav className="-mb-px flex space-x-6 overflow-x-auto">
              <button
                onClick={() => setActiveTab("runs")}
                className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium ${
                  activeTab === "runs"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
                }`}
              >
                📊 Run Queue ({executions.length})
              </button>
              <button
                onClick={() => setActiveTab("hitl")}
                className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 pb-3 text-sm font-medium ${
                  activeTab === "hitl"
                    ? "border-amber-600 text-amber-700"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
                }`}
              >
                🛡️ Human Review Center
                {pendingHitlRuns.length > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    {pendingHitlRuns.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("trace")}
                className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium ${
                  activeTab === "trace"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
                }`}
              >
                🔍 Step Timeline & Trace
              </button>
              <button
                onClick={() => setActiveTab("costs")}
                className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium ${
                  activeTab === "costs"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
                }`}
              >
                💰 Spend & Kill Switches
              </button>
              <button
                onClick={() => setActiveTab("incidents")}
                className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 pb-3 text-sm font-medium ${
                  activeTab === "incidents"
                    ? "border-rose-600 text-rose-700"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
                }`}
              >
                ⚠️ Security & Incident Review
                {unresolvedIncidentsCount > 0 && (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
                    {unresolvedIncidentsCount}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 1: RUN QUEUE & ACTIVE MONITOR                              */}
        {/* ============================================================== */}
        {activeTab === "runs" && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500">Filter by Agent</label>
                  <select
                    value={filterAgentId}
                    onChange={(e) => setFilterAgentId(e.target.value)}
                    className="mt-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 outline-none focus:border-indigo-500"
                  >
                    <option value="">All Agents</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500">Filter by Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="mt-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 outline-none focus:border-indigo-500"
                  >
                    <option value="">All Statuses</option>
                    <option value="running">Running</option>
                    <option value="paused_waiting_approval">Paused (HITL)</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                    <option value="rejected">Rejected</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div className="text-xs text-zinc-500">
                Showing {executions.length} recorded executions
              </div>
            </div>

            {/* Run Queue Table */}
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Execution ID</th>
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Prompt</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Steps</th>
                    <th className="px-4 py-3">Latency / Cost</th>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {executions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-zinc-500">
                        No agent runs found matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    executions.map((exec) => {
                      const agentDef = agents.find((a) => a.id === exec.agent_id);
                      return (
                        <tr key={exec.id} className="hover:bg-zinc-50/80">
                          <td className="px-4 py-3 font-mono text-xs font-medium text-zinc-700">
                            {exec.id.substring(0, 12)}...
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-zinc-900">
                              {exec.agent?.name || agentDef?.name || "Agent"}
                            </div>
                            <div className="text-xs text-zinc-400 font-mono">
                              {exec.agent?.model || agentDef?.model || "gpt-4o-mini"}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-600 max-w-xs truncate">
                            {exec.input_prompt}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={exec.status} />
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-600">
                            {exec.steps_count ?? exec.plan_steps?.length ?? 1} steps
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <div className="text-zinc-900 font-medium">
                              {exec.latency_ms ? `${exec.latency_ms}ms` : "-"}
                            </div>
                            <div className="text-zinc-500 font-mono text-[11px]">
                              ${(exec.cost_usd ?? 0).toFixed(4)} ({exec.total_tokens ?? 0} tokens)
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">
                            {new Date(exec.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </td>
                          <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setSelectedExecution(exec);
                                setActiveTab("trace");
                              }}
                              className="rounded border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                            >
                              Trace
                            </button>
                            {(exec.status === "failed" || exec.status === "cancelled" || exec.status === "rejected") && (
                              <button
                                onClick={() => handleRetry(exec.id)}
                                className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                              >
                                Retry
                              </button>
                            )}
                            {(exec.status === "running" || exec.status === "paused_waiting_approval") && (
                              <button
                                onClick={() => handleCancel(exec.id)}
                                className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
                              >
                                Abort
                              </button>
                            )}
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

        {/* ============================================================== */}
        {/* TAB 2: HUMAN REVIEW CENTER (HITL MUTATION GATEWAY)             */}
        {/* ============================================================== */}
        {activeTab === "hitl" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <h2 className="text-sm font-semibold text-amber-900">
                🛡️ Human-In-The-Loop Governance Gate (BRD §8.10 FR-AG-004 & FR-AG-010)
              </h2>
              <p className="mt-1 text-xs text-amber-800">
                State-modifying actions (RFIs, POs, Subcontractor NCRs, schedule milestones) are strictly held in quarantine.
                Reviewers may modify tool arguments in place before releasing the mutation to project records.
              </p>
            </div>

            {pendingHitlRuns.length === 0 ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
                <span className="text-3xl">✅</span>
                <h3 className="mt-2 text-base font-semibold text-zinc-900">All Clear: No Runs Pending Approval</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Every mutation action has been reviewed or all active agents are operating within autonomous bounds.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {pendingHitlRuns.map((exec) => {
                  const pending = exec.pending_action;
                  const agentDef = agents.find((a) => a.id === exec.agent_id);
                  const isEditing = hitlModifiedInputs[exec.id] !== undefined;

                  return (
                    <div
                      key={exec.id}
                      className="rounded-xl border border-amber-300 bg-white p-6 shadow-sm ring-1 ring-amber-300/50"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-zinc-100 pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                              PENDING MUTATION APPROVAL
                            </span>
                            <span className="text-xs text-zinc-500 font-mono">
                              Run ID: {exec.id}
                            </span>
                          </div>
                          <h3 className="mt-1 text-base font-semibold text-zinc-900">
                            {agentDef?.name || "Agent"} requests to execute:{" "}
                            <span className="text-indigo-600">{pending?.toolName || pending?.toolKey}</span>
                          </h3>
                        </div>
                        <div className="text-xs text-zinc-400">
                          Paused at: {new Date(exec.updated_at).toLocaleString()}
                        </div>
                      </div>

                      {/* Rationale & User Prompt */}
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-lg bg-zinc-50 p-3 border border-zinc-200">
                          <div className="text-xs font-semibold text-zinc-500">User Prompt:</div>
                          <div className="mt-1 text-xs text-zinc-800 italic">"{exec.input_prompt}"</div>
                        </div>
                        <div className="rounded-lg bg-indigo-50/50 p-3 border border-indigo-100">
                          <div className="text-xs font-semibold text-indigo-700">Agent Rationale:</div>
                          <div className="mt-1 text-xs text-indigo-900">{pending?.rationale}</div>
                        </div>
                      </div>

                      {/* Parameter Inspector & Tweaker */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-zinc-700">
                            Tool Input Parameters (Live Tweaking Supported):
                          </label>
                          {!isEditing ? (
                            <button
                              onClick={() => {
                                setHitlModifiedInputs({
                                  ...hitlModifiedInputs,
                                  [exec.id]: JSON.stringify(pending?.input || {}, null, 2),
                                });
                              }}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                            >
                              ✏️ Edit Parameters Before Approving
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                const copy = { ...hitlModifiedInputs };
                                delete copy[exec.id];
                                setHitlModifiedInputs(copy);
                              }}
                              className="text-xs font-medium text-zinc-500 hover:text-zinc-700"
                            >
                              Reset to Agent Original
                            </button>
                          )}
                        </div>

                        {isEditing ? (
                          <textarea
                            rows={6}
                            value={hitlModifiedInputs[exec.id]}
                            onChange={(e) =>
                              setHitlModifiedInputs({
                                ...hitlModifiedInputs,
                                [exec.id]: e.target.value,
                              })
                            }
                            className="mt-1 w-full rounded-lg border border-indigo-300 bg-indigo-50/20 p-3 font-mono text-xs text-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                        ) : (
                          <pre className="mt-1 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-900 p-3 font-mono text-xs text-emerald-400">
                            {JSON.stringify(pending?.input, null, 2)}
                          </pre>
                        )}
                      </div>

                      {/* Supervisor Notes & Rejection Input */}
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-zinc-600">
                            Approval Notes / Revision Context (Optional):
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Approved per structural memo rev 2..."
                            value={hitlNotes[exec.id] || ""}
                            onChange={(e) =>
                              setHitlNotes({ ...hitlNotes, [exec.id]: e.target.value })
                            }
                            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-800 focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-600">
                            Rejection Reason (If rejecting action):
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Work item already resolved in drawing S-104"
                            value={hitlRejectReason[exec.id] || ""}
                            onChange={(e) =>
                              setHitlRejectReason({ ...hitlRejectReason, [exec.id]: e.target.value })
                            }
                            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-800 focus:border-rose-500"
                          />
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-5 flex items-center justify-end gap-3 border-t border-zinc-100 pt-4">
                        <button
                          disabled={hitlActionLoading === exec.id}
                          onClick={() => handleReject(exec)}
                          className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                        >
                          ❌ Reject Action
                        </button>
                        <button
                          disabled={hitlActionLoading === exec.id}
                          onClick={() => handleApprove(exec)}
                          className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {hitlActionLoading === exec.id
                            ? "Executing Mutation..."
                            : isEditing
                            ? "✅ Approve & Execute with Modified Inputs"
                            : "✅ Approve & Execute Mutation"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: STEP TIMELINE & TRACE INSPECTOR                         */}
        {/* ============================================================== */}
        {activeTab === "trace" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left list: Run Selector */}
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
              <h2 className="text-sm font-semibold text-zinc-900 mb-3">Select Run to Inspect</h2>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {executions.map((exec) => (
                  <div
                    key={exec.id}
                    onClick={() => setSelectedExecution(exec)}
                    className={`cursor-pointer rounded-lg p-3 border text-xs transition ${
                      selectedExecution?.id === exec.id
                        ? "border-indigo-500 bg-indigo-50/40"
                        : "border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-800">
                        {exec.agent?.name || "Agent"}
                      </span>
                      <StatusBadge status={exec.status} />
                    </div>
                    <div className="mt-1 text-zinc-500 truncate">{exec.input_prompt}</div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400">
                      <span>{new Date(exec.created_at).toLocaleTimeString()}</span>
                      <span>${(exec.cost_usd ?? 0).toFixed(4)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right 2 columns: Trace Details */}
            <div className="lg:col-span-2 space-y-6">
              {selectedExecution ? (
                <>
                  {/* Run Metadata Card */}
                  <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-zinc-900">
                            {selectedExecution.agent?.name || "Agent Execution"}
                          </h2>
                          <StatusBadge status={selectedExecution.status} />
                        </div>
                        <div className="mt-1 font-mono text-xs text-zinc-500">
                          ID: {selectedExecution.id} | Model: {selectedExecution.agent?.model || "gpt-4o-mini"}
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        <div className="font-semibold text-zinc-900">
                          ${(selectedExecution.cost_usd ?? 0).toFixed(4)} USD
                        </div>
                        <div className="text-zinc-500">
                          {selectedExecution.total_tokens ?? 0} tokens ({selectedExecution.latency_ms ?? 0}ms)
                        </div>
                      </div>
                    </div>

                    {/* Step Timeline */}
                    <div className="mt-5">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4">
                        Step-by-Step Plan & Execution Timeline
                      </h3>
                      <div className="space-y-4">
                        {(selectedExecution.plan_steps && selectedExecution.plan_steps.length > 0) ? (
                          selectedExecution.plan_steps.map((step: AgentExecutionStep) => (
                            <div
                              key={step.stepNumber}
                              className="relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-0 before:w-0.5 before:bg-zinc-200"
                            >
                              <div className="absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 border-indigo-600 bg-white" />
                              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-zinc-700">
                                      STEP {step.stepNumber}
                                    </span>
                                    <span className="text-xs font-bold uppercase text-zinc-700">
                                      {step.type}
                                    </span>
                                    {step.toolName && (
                                      <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                                        {step.toolName}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-zinc-500">Confidence: {(step.confidence * 100).toFixed(0)}%</span>
                                    <span className="text-zinc-400">{step.latencyMs}ms</span>
                                  </div>
                                </div>

                                {step.thought && (
                                  <p className="mt-2 text-xs text-zinc-700">{step.thought}</p>
                                )}

                                {step.toolInput && (
                                  <div className="mt-2">
                                    <div className="text-[11px] font-semibold text-zinc-500">Tool Input:</div>
                                    <pre className="mt-0.5 max-h-32 overflow-x-auto rounded bg-zinc-900 p-2 font-mono text-[11px] text-zinc-200">
                                      {JSON.stringify(step.toolInput, null, 2)}
                                    </pre>
                                  </div>
                                )}

                                {step.toolOutput && (
                                  <div className="mt-2">
                                    <div className="text-[11px] font-semibold text-zinc-500">Tool Output:</div>
                                    <pre className="mt-0.5 max-h-32 overflow-x-auto rounded bg-zinc-900 p-2 font-mono text-[11px] text-emerald-400">
                                      {JSON.stringify(step.toolOutput, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-zinc-500 italic">
                            Legacy execution format. Detailed step logs not recorded for this run.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Final Output Summary */}
                    {selectedExecution.output_summary && (
                      <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                        <div className="text-xs font-semibold text-emerald-900">Synthesized Business Output:</div>
                        <div className="mt-1 text-xs text-emerald-950 whitespace-pre-wrap">
                          {selectedExecution.output_summary}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Immutable Audit Log Records for Execution */}
                  <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                      Append-Only Run Audit Trail (FR-AUD-001)
                    </h3>
                    {loadingAudit ? (
                      <div className="text-xs text-zinc-500">Loading audit trail...</div>
                    ) : executionAuditLogs.length === 0 ? (
                      <div className="text-xs text-zinc-500 italic">No audit records found for this execution.</div>
                    ) : (
                      <div className="space-y-2">
                        {executionAuditLogs.map((log) => (
                          <div
                            key={log.id}
                            className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 p-2.5 text-xs"
                          >
                            <div>
                              <span className="font-semibold text-zinc-800">{log.event_type}</span>
                              <span className="ml-2 font-mono text-[11px] text-zinc-500">
                                actor: {log.actor_type}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-400">
                              {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center text-zinc-500">
                  Select an execution from the left list to view step timeline.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: SPEND & KILL SWITCHES                                   */}
        {/* ============================================================== */}
        {activeTab === "costs" && (
          <div className="space-y-6">
            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
                <div className="text-xs font-medium text-zinc-500">Total Tokens Consumed</div>
                <div className="mt-2 text-2xl font-bold text-zinc-900">
                  {costAnalytics?.totalTokens?.toLocaleString() ?? 0}
                </div>
                <div className="mt-1 text-xs text-zinc-400">Across all AI agents</div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
                <div className="text-xs font-medium text-zinc-500">Total Cloud Spend</div>
                <div className="mt-2 text-2xl font-bold text-emerald-600">
                  ${costAnalytics?.totalCostUsd?.toFixed(4) ?? "0.0000"} USD
                </div>
                <div className="mt-1 text-xs text-zinc-400">Priced at provider API list rates</div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
                <div className="text-xs font-medium text-zinc-500">Total Executions</div>
                <div className="mt-2 text-2xl font-bold text-zinc-900">
                  {costAnalytics?.totalRuns ?? 0}
                </div>
                <div className="mt-1 text-xs text-zinc-400">Avg ${( (costAnalytics?.totalCostUsd ?? 0) / Math.max(1, costAnalytics?.totalRuns ?? 1) ).toFixed(4)} / run</div>
              </div>
            </div>

            {/* Emergency Kill Switches Panel */}
            <div className="rounded-xl border border-rose-200 bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-rose-900 flex items-center gap-2">
                    <span>🛑</span> Emergency Agent Kill Switches (BRD §8.10 FR-AG-006)
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    Immediately pause or quarantine any autonomous agent globally or for the tenant. Active and pending runs are halted immediately.
                  </p>
                </div>
              </div>

              <div className="mt-4 divide-y divide-zinc-100">
                {agents.map((agent) => (
                  <div key={agent.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-zinc-900">{agent.name}</span>
                        {agent.is_paused ? (
                          <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">
                            QUARANTINED / PAUSED
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400 font-mono mt-0.5">
                        {agent.key} | Budget: ${(agent.spend_budget_usd ?? 5.0).toFixed(2)} | Max Steps: {agent.max_steps ?? 10}
                      </div>
                      {agent.pause_reason && (
                        <div className="text-xs text-rose-700 italic mt-1">
                          Reason: {agent.pause_reason}
                        </div>
                      )}
                    </div>

                    <div>
                      {agent.is_paused ? (
                        <button
                          onClick={() => handleToggleKillSwitch(agent, false)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                        >
                          Deactivate Kill Switch (Resume)
                        </button>
                      ) : (
                        <button
                          onClick={() => setTargetKillSwitchAgent(agent)}
                          className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                        >
                          Activate Kill Switch (Pause)
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cost by Agent & Model Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
                <h3 className="text-sm font-semibold text-zinc-900 mb-3">Spend by Agent Profile</h3>
                <div className="space-y-3">
                  {costAnalytics?.costByAgent?.map((item) => (
                    <div key={item.agentId} className="flex items-center justify-between text-xs border-b border-zinc-50 pb-2">
                      <div>
                        <div className="font-medium text-zinc-800">{item.agentName}</div>
                        <div className="text-zinc-400">{item.runCount} runs</div>
                      </div>
                      <div className="text-right font-mono font-semibold text-zinc-900">
                        ${item.costUsd.toFixed(4)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
                <h3 className="text-sm font-semibold text-zinc-900 mb-3">Spend by Model Family</h3>
                <div className="space-y-3">
                  {costAnalytics?.costByModel?.map((item) => (
                    <div key={item.model} className="flex items-center justify-between text-xs border-b border-zinc-50 pb-2">
                      <div>
                        <div className="font-medium text-zinc-800">{item.model}</div>
                        <div className="text-zinc-400">{item.tokenCount.toLocaleString()} tokens</div>
                      </div>
                      <div className="text-right font-mono font-semibold text-zinc-900">
                        ${item.costUsd.toFixed(4)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: SECURITY & INCIDENT REVIEW                             */}
        {/* ============================================================== */}
        {activeTab === "incidents" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
              <h2 className="text-sm font-semibold text-rose-900">
                🚨 AI Security, Prompt Injection & Guardrail Incidents (FR-AG-008 & FR-AG-009)
              </h2>
              <p className="mt-1 text-xs text-rose-800">
                Adversarial jailbreaks, prompt injection signatures, budget breaches, and unauthorized mutation attempts are automatically flagged for security compliance audit.
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Incident Type</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Execution ID</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {incidents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-500">
                        No security incidents or guardrail breaches recorded.
                      </td>
                    </tr>
                  ) : (
                    incidents.map((inc) => (
                      <tr key={inc.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <SeverityBadge severity={inc.severity} />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-800">
                          {inc.incident_type}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-700 max-w-sm truncate">
                          {inc.description}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                          {inc.execution_id.substring(0, 8)}...
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {inc.is_resolved ? (
                            <span className="rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                              Resolved
                            </span>
                          ) : (
                            <span className="rounded bg-rose-100 px-2 py-0.5 font-bold text-rose-800">
                              Open Action
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                          {new Date(inc.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!inc.is_resolved ? (
                            <button
                              onClick={() => setResolvingIncident(inc)}
                              className="rounded bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                            >
                              Triage & Clear
                            </button>
                          ) : (
                            <span className="text-xs text-zinc-400">Cleared</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Kill Switch Reason Modal */}
      {targetKillSwitchAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-zinc-900">
              Confirm Agent Quarantine / Kill Switch
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              You are activating the emergency kill switch for agent:{" "}
              <strong>{targetKillSwitchAgent.name}</strong>. This halts all current and future runs.
            </p>
            <div className="mt-4">
              <label className="block text-xs font-semibold text-zinc-700">Reason for Quarantine:</label>
              <textarea
                rows={3}
                placeholder="e.g. Automated notification loop detected on site schedule..."
                value={killSwitchReason}
                onChange={(e) => setKillSwitchReason(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 p-2.5 text-xs text-zinc-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setTargetKillSwitchAgent(null)}
                className="rounded-lg border border-zinc-300 px-4 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                disabled={killSwitchLoading}
                onClick={() => handleToggleKillSwitch(targetKillSwitchAgent, true)}
                className="rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {killSwitchLoading ? "Quarantining..." : "Confirm & Halt Agent"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incident Resolution Modal */}
      {resolvingIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-zinc-900">
              Triage AI Incident: {resolvingIncident.incident_type}
            </h3>
            <p className="mt-1 text-xs text-zinc-500">{resolvingIncident.description}</p>
            {resolvingIncident.raw_content && (
              <div className="mt-3">
                <div className="text-xs font-semibold text-zinc-700">Captured Prompt / Payload:</div>
                <pre className="mt-1 overflow-x-auto rounded bg-zinc-900 p-2.5 font-mono text-xs text-rose-400">
                  {resolvingIncident.raw_content}
                </pre>
              </div>
            )}
            <div className="mt-4">
              <label className="block text-xs font-semibold text-zinc-700">
                Resolution & Audit Notes:
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Reviewed prompt signature. Block confirmed, user notified, zero state changes executed."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 p-2.5 text-xs text-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setResolvingIncident(null)}
                className="rounded-lg border border-zinc-300 px-4 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Close
              </button>
              <button
                disabled={resolvingLoading}
                onClick={handleResolveIncident}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {resolvingLoading ? "Resolving..." : "Mark as Resolved"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          Completed
        </span>
      );
    case "paused_waiting_approval":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 animate-pulse">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
          Awaiting Approval
        </span>
      );
    case "running":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-ping" />
          Running
        </span>
      );
    case "rejected":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-800">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
          Rejected
        </span>
      );
    case "cancelled":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-800">
          Cancelled
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-800">
          Failed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-800">
          {status}
        </span>
      );
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  switch (severity) {
    case "critical":
      return <span className="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase">Critical</span>;
    case "high":
      return <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 uppercase">High</span>;
    case "medium":
      return <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 uppercase">Medium</span>;
    default:
      return <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-800 uppercase">Low</span>;
  }
}
