import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { PermissionGate } from "../components/PermissionGate";

export type InstanceStatus = "running" | "paused" | "completed" | "cancelled" | "failed";

export interface WorkflowInstance {
  id: string;
  workflow_definition_id: string;
  workflow_version_id: string;
  status: InstanceStatus;
  started_by: string | null;
  started_at: string;
  ended_at: string | null;
  context: Record<string, unknown>;
}

export interface WorkflowStepInstance {
  id: string;
  workflow_instance_id: string;
  node_id: string;
  status: string;
  assigned_to: string | null;
  created_at?: string;
  started_at?: string;
  completed_at: string | null;
}

export interface WorkflowEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

interface WorkflowDefinition {
  id: string;
  key: string;
  name: string;
}

export function WorkflowInstancesPage() {
  const { session } = useAuth();

  const [instances, setInstances] = useState<WorkflowInstance[] | null>(null);
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [definitionFilter, setDefinitionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Inspect Modal State
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [inspectDetail, setInspectDetail] = useState<{
    instance: WorkflowInstance;
    stepInstances: WorkflowStepInstance[];
    events?: WorkflowEvent[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function loadData() {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const [instRes, defRes] = await Promise.all([
        apiFetch<{ instances: WorkflowInstance[] }>("/workflow/instances", session.access_token),
        apiFetch<{ definitions: WorkflowDefinition[] }>("/workflow/definitions", session.access_token).catch(() => ({ definitions: [] })),
      ]);
      setInstances(instRes.instances || []);
      setDefinitions(defRes.definitions || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load workflow execution history.");
    } finally {
      setLoading(false);
    }
  }

  async function openInspect(instanceId: string) {
    if (!session) return;
    setSelectedInstanceId(instanceId);
    setDetailLoading(true);
    setActionError(null);
    try {
      const res = await apiFetch<{
        instance: WorkflowInstance;
        stepInstances: WorkflowStepInstance[];
        events?: WorkflowEvent[];
      }>(`/workflow/instances/${instanceId}`, session.access_token);
      setInspectDetail(res);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not load instance details");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handlePause(instanceId: string) {
    if (!session) return;
    setActionBusy(true);
    try {
      await apiFetch(`/workflow/instances/${instanceId}/pause`, session.access_token, { method: "POST" });
      await loadData();
      if (selectedInstanceId === instanceId) openInspect(instanceId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to pause workflow");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleResume(instanceId: string) {
    if (!session) return;
    setActionBusy(true);
    try {
      await apiFetch(`/workflow/instances/${instanceId}/resume`, session.access_token, { method: "POST" });
      await loadData();
      if (selectedInstanceId === instanceId) openInspect(instanceId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to resume workflow");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleCancel(instanceId: string) {
    if (!session || !window.confirm("Are you sure you want to cancel this workflow instance?")) return;
    setActionBusy(true);
    try {
      await apiFetch(`/workflow/instances/${instanceId}/cancel`, session.access_token, {
        method: "POST",
        body: JSON.stringify({ reason: "Cancelled by administrator" }),
      });
      await loadData();
      if (selectedInstanceId === instanceId) openInspect(instanceId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to cancel workflow");
    } finally {
      setActionBusy(false);
    }
  }

  const defMap = new Map<string, WorkflowDefinition>();
  for (const d of definitions) {
    defMap.set(d.id, d);
  }

  const filteredInstances = (instances || []).filter((inst) => {
    if (statusFilter !== "all" && inst.status !== statusFilter) return false;
    if (definitionFilter !== "all" && inst.workflow_definition_id !== definitionFilter) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const def = defMap.get(inst.workflow_definition_id);
      const matchesId = inst.id.toLowerCase().includes(q);
      const matchesDef = def && (def.name.toLowerCase().includes(q) || def.key.toLowerCase().includes(q));
      if (!matchesId && !matchesDef) return false;
    }

    return true;
  });

  const totalCount = instances?.length || 0;
  const runningCount = instances?.filter((i) => i.status === "running").length || 0;
  const pausedCount = instances?.filter((i) => i.status === "paused").length || 0;
  const completedCount = instances?.filter((i) => i.status === "completed").length || 0;
  const cancelledCount = instances?.filter((i) => i.status === "cancelled" || i.status === "failed").length || 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-brand text-2xl font-bold tracking-tight text-zinc-900">
            Workflow Executions &amp; Runs
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Real-time workflow execution engine, active instances, step timelines, and audit event logs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/config-studio"
            className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            Workflow Definitions Studio →
          </Link>
          <Link
            to="/my-work"
            className="rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800"
          >
            My Work Queues →
          </Link>
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Total Started</div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight text-zinc-900 font-display">{totalCount}</div>
          <div className="text-[11px] text-zinc-400">All historical runs</div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Active / Running</div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight text-emerald-600 font-display">{runningCount}</div>
          <div className="text-[11px] text-zinc-400">In execution</div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Paused</div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight text-amber-600 font-display">{pausedCount}</div>
          <div className="text-[11px] text-zinc-400">Awaiting resume</div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">Completed</div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight text-indigo-600 font-display">{completedCount}</div>
          <div className="text-[11px] text-zinc-400">Finished cleanly</div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-600">Cancelled / Aborted</div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight text-rose-600 font-display">{cancelledCount}</div>
          <div className="text-[11px] text-zinc-400">Withdrawn or stopped</div>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200">{error}</div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {[
            { key: "all", label: "All Runs" },
            { key: "running", label: "Running" },
            { key: "paused", label: "Paused" },
            { key: "completed", label: "Completed" },
            { key: "cancelled", label: "Cancelled" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                statusFilter === tab.key
                  ? "bg-zinc-900 text-white shadow-sm"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {tab.label}
            </button>
          ))}

          {definitions.length > 0 && (
            <select
              value={definitionFilter}
              onChange={(e) => setDefinitionFilter(e.target.value)}
              className="ml-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 outline-none focus:border-amber-500"
            >
              <option value="all">All Workflow Definitions</option>
              {definitions.map((def) => (
                <option key={def.id} value={def.id}>
                  {def.name} ({def.key})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Search run ID or workflow…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Instances Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        {loading && (
          <div className="py-12 text-center text-xs text-zinc-400 font-medium">
            Loading workflow execution history…
          </div>
        )}

        {!loading && filteredInstances.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm font-semibold text-zinc-700">No workflow executions found.</p>
            <p className="mt-1 text-xs text-zinc-400">
              Workflows start when triggered by actions (e.g. PO Submissions, Estimate Approvals, Baseline Change Requests) or manually via API.
            </p>
          </div>
        )}

        {!loading && filteredInstances.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-100 bg-zinc-50 font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-6 py-3.5">Workflow Definition</th>
                  <th className="px-6 py-3.5">Instance ID</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Started At</th>
                  <th className="px-6 py-3.5">Ended At</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredInstances.map((inst) => {
                  const def = defMap.get(inst.workflow_definition_id);

                  return (
                    <tr key={inst.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-semibold text-zinc-900 block text-sm">
                          {def ? def.name : "Custom Workflow"}
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          Key: {def ? def.key : inst.workflow_definition_id.slice(0, 8)}
                        </span>
                      </td>

                      <td className="px-6 py-4 font-mono text-[11px] text-zinc-600">
                        {inst.id}
                      </td>

                      <td className="px-6 py-4">
                        <StatusBadge status={inst.status} />
                      </td>

                      <td className="px-6 py-4 text-zinc-600">
                        {new Date(inst.started_at).toLocaleString()}
                      </td>

                      <td className="px-6 py-4 text-zinc-500">
                        {inst.ended_at ? new Date(inst.ended_at).toLocaleString() : "— (Active)"}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            onClick={() => openInspect(inst.id)}
                            className="rounded-lg bg-zinc-900 hover:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                          >
                            Inspect Run →
                          </button>

                          <PermissionGate permission="workflow.instance.manage">
                            {inst.status === "running" && (
                              <button
                                onClick={() => handlePause(inst.id)}
                                disabled={actionBusy}
                                className="rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-800"
                              >
                                Pause
                              </button>
                            )}

                            {inst.status === "paused" && (
                              <button
                                onClick={() => handleResume(inst.id)}
                                disabled={actionBusy}
                                className="rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 text-xs font-semibold text-emerald-800"
                              >
                                Resume
                              </button>
                            )}

                            {["running", "paused"].includes(inst.status) && (
                              <button
                                onClick={() => handleCancel(inst.id)}
                                disabled={actionBusy}
                                className="rounded-lg border border-red-200 bg-white hover:bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600"
                              >
                                Cancel
                              </button>
                            )}
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail & History Modal */}
      {selectedInstanceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-zinc-900 font-display">
                  Workflow Run Inspection
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500 font-mono">
                  Instance: {selectedInstanceId}
                </p>
              </div>
              <button
                onClick={() => setSelectedInstanceId(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              >
                ✕
              </button>
            </div>

            {actionError && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                {actionError}
              </div>
            )}

            {detailLoading && (
              <div className="py-16 text-center text-xs text-zinc-400">Loading execution timeline…</div>
            )}

            {!detailLoading && inspectDetail && (
              <div className="flex-1 overflow-y-auto py-4 space-y-6">
                {/* Status & Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-50 p-3.5 rounded-xl border border-zinc-100 text-xs">
                  <div>
                    <span className="text-zinc-400 block text-[10px] uppercase font-semibold">Status</span>
                    <div className="mt-1">
                      <StatusBadge status={inspectDetail.instance.status} />
                    </div>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px] uppercase font-semibold">Started At</span>
                    <span className="font-semibold text-zinc-800 mt-1 block">
                      {new Date(inspectDetail.instance.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px] uppercase font-semibold">Ended At</span>
                    <span className="font-semibold text-zinc-800 mt-1 block">
                      {inspectDetail.instance.ended_at ? new Date(inspectDetail.instance.ended_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "In progress"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px] uppercase font-semibold">Context Keys</span>
                    <span className="font-mono text-zinc-600 mt-1 block">
                      {Object.keys(inspectDetail.instance.context || {}).length} variables
                    </span>
                  </div>
                </div>

                {/* Step Instances Timeline */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 mb-3">
                    Execution Steps Timeline ({inspectDetail.stepInstances.length})
                  </h3>
                  {inspectDetail.stepInstances.length === 0 ? (
                    <p className="text-xs text-zinc-400 italic">No step instances recorded.</p>
                  ) : (
                    <div className="space-y-2">
                      {inspectDetail.stepInstances.map((step, idx) => (
                        <div
                          key={step.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 bg-white shadow-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
                              {idx + 1}
                            </span>
                            <div>
                              <span className="font-semibold text-zinc-900 text-xs block">
                                Step Node ID: {step.node_id}
                              </span>
                              <span className="text-[11px] text-zinc-400 font-mono">
                                Step Instance: {step.id.slice(0, 8)}… • Created: {new Date(step.started_at || step.created_at || '').toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={step.status} />
                            {step.completed_at && (
                              <span className="text-[11px] text-zinc-400">
                                Completed: {new Date(step.completed_at).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Event Audit History */}
                {inspectDetail.events && inspectDetail.events.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 mb-3">
                      Engine Audit Event Log ({inspectDetail.events.length})
                    </h3>
                    <div className="space-y-1.5 font-mono text-xs">
                      {inspectDetail.events.map((evt) => (
                        <div
                          key={evt.id}
                          className="p-2.5 rounded-lg bg-zinc-900 text-zinc-300 text-[11px] flex justify-between items-center"
                        >
                          <div>
                            <span className="text-amber-400 font-semibold">{evt.event_type}</span>
                            <span className="text-zinc-500 ml-2">
                              {JSON.stringify(evt.payload)}
                            </span>
                          </div>
                          <span className="text-zinc-500 text-[10px] whitespace-nowrap ml-4">
                            {new Date(evt.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-zinc-100 pt-4 flex justify-between items-center">
              <Link
                to="/my-work"
                className="text-xs font-semibold text-amber-600 hover:text-amber-700"
              >
                Go to My Work Task Queues →
              </Link>
              <button
                type="button"
                onClick={() => setSelectedInstanceId(null)}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
