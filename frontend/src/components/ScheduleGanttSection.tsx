import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../lib/api";
import { PermissionGate } from "./PermissionGate";

export interface GanttActivity {
  id: string;
  wbs_node_id: string | null;
  wbs_code: string | null;
  wbs_name: string | null;
  name: string;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  baseline_start: string | null;
  baseline_end: string | null;
  percent_complete: number;
  dependencies: string[];
  is_critical: boolean;
  total_float_days: number;
  duration_days: number;
  status: "not_started" | "in_progress" | "completed" | "delayed";
}

export interface GanttScheduleResponse {
  project_id: string;
  baseline_version: number | null;
  activities: GanttActivity[];
  critical_path: string[];
  total_activities: number;
  completed_activities: number;
  overall_progress: number;
}

export interface LookaheadPlan {
  id: string;
  project_id: string;
  title: string;
  period_start: string;
  period_end: string;
  timeframe_weeks: number;
  created_at: string;
}

export interface LookaheadActivity {
  id: string;
  lookahead_plan_id: string;
  schedule_activity_id: string | null;
  custom_activity_name: string | null;
  planned_action: string;
  target_date: string;
  status: "planned" | "in_progress" | "completed" | "delayed";
  assigned_to: string | null;
  notes: string | null;
}

export const DELAY_REASONS = [
  "client",
  "design",
  "procurement",
  "subcontractor",
  "weather",
  "permits",
  "other",
] as const;

export type DelayReasonCategory = (typeof DELAY_REASONS)[number];

export interface ScheduleDelayRecord {
  id: string;
  project_id: string;
  schedule_activity_id: string;
  delay_days: number;
  reason_category: DelayReasonCategory;
  description: string;
  mitigation_plan: string | null;
  recorded_at: string;
}

export interface ScheduleVarianceSummary {
  project_id: string;
  total_activities: number;
  delayed_activities_count: number;
  total_delay_days: number;
  critical_delayed_count: number;
  delays_by_category: Record<DelayReasonCategory, number>;
  total_float_consumed_days: number;
}

type TabType = "gantt" | "lookahead" | "delays";

const inputClass =
  "rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

const reasonLabels: Record<DelayReasonCategory, string> = {
  client: "Client / Employer",
  design: "Engineering & Design",
  procurement: "Procurement / Materials",
  subcontractor: "Subcontractor",
  weather: "Adverse Weather",
  permits: "Permits & Approvals",
  other: "Other / Unforeseen",
};

const reasonColors: Record<DelayReasonCategory, string> = {
  client: "bg-blue-50 text-blue-700 border-blue-200",
  design: "bg-purple-50 text-purple-700 border-purple-200",
  procurement: "bg-amber-50 text-amber-700 border-amber-200",
  subcontractor: "bg-orange-50 text-orange-700 border-orange-200",
  weather: "bg-cyan-50 text-cyan-700 border-cyan-200",
  permits: "bg-indigo-50 text-indigo-700 border-indigo-200",
  other: "bg-zinc-50 text-zinc-700 border-zinc-200",
};

const statusColors = {
  not_started: "bg-zinc-100 text-zinc-600",
  in_progress: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
  delayed: "bg-rose-50 text-rose-700",
  planned: "bg-zinc-100 text-zinc-600",
};

interface ScheduleGanttSectionProps {
  projectId: string;
  token: string;
  onActivityUpdated?: () => void;
}

export function ScheduleGanttSection({ projectId, token, onActivityUpdated }: ScheduleGanttSectionProps) {
  const [activeTab, setActiveTab] = useState<TabType>("gantt");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Gantt State
  const [gantt, setGantt] = useState<GanttScheduleResponse | null>(null);
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [showBaseline, setShowBaseline] = useState(true);

  // Lookahead State
  const [lookaheadPlans, setLookaheadPlans] = useState<LookaheadPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [lookaheadActivities, setLookaheadActivities] = useState<LookaheadActivity[]>([]);
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [newPlanTitle, setNewPlanTitle] = useState("");
  const [newPlanStart, setNewPlanStart] = useState("");
  const [newPlanEnd, setNewPlanEnd] = useState("");
  const [newPlanWeeks, setNewPlanWeeks] = useState(2);
  const [showAddActionModal, setShowAddActionModal] = useState(false);
  const [newActionScheduleActId, setNewActionScheduleActId] = useState("");
  const [newActionCustomName, setNewActionCustomName] = useState("");
  const [newActionText, setNewActionText] = useState("");
  const [newActionDate, setNewActionDate] = useState("");
  const [newActionNotes, setNewActionNotes] = useState("");

  // Delay & Variance State
  const [variance, setVariance] = useState<ScheduleVarianceSummary | null>(null);
  const [delays, setDelays] = useState<ScheduleDelayRecord[]>([]);
  const [showLogDelayModal, setShowLogDelayModal] = useState(false);
  const [delayActivityId, setDelayActivityId] = useState("");
  const [delayDays, setDelayDays] = useState(1);
  const [delayReason, setDelayReason] = useState<DelayReasonCategory>("subcontractor");
  const [delayDescription, setDelayDescription] = useState("");
  const [delayMitigation, setDelayMitigation] = useState("");

  // Progress Update Modal
  const [progressModalActivity, setProgressModalActivity] = useState<GanttActivity | null>(null);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressNote, setProgressNote] = useState("");
  const [savingProgress, setSavingProgress] = useState(false);

  function loadGantt() {
    return apiFetch<{ schedule: GanttScheduleResponse }>(`/projects/${projectId}/schedule/gantt`, token)
      .then((res) => setGantt(res?.schedule ?? null));
  }

  function loadVariance() {
    return Promise.all([
      apiFetch<{ variance: ScheduleVarianceSummary }>(`/projects/${projectId}/schedule/variance`, token),
      apiFetch<{ delayRecords: ScheduleDelayRecord[] }>(`/projects/${projectId}/delays`, token),
    ]).then(([vRes, dRes]) => {
      setVariance(vRes?.variance ?? null);
      setDelays(dRes?.delayRecords ?? []);
    });
  }

  function loadLookaheadPlans() {
    return apiFetch<{ lookaheadPlans: LookaheadPlan[] }>(`/projects/${projectId}/lookahead-plans`, token)
      .then((res) => {
        const plans = res?.lookaheadPlans ?? [];
        setLookaheadPlans(plans);
        if (plans.length > 0 && !selectedPlanId) {
          setSelectedPlanId(plans[0].id);
        }
      });
  }

  function loadPlanDetails(planId: string) {
    return apiFetch<{ lookaheadPlan: LookaheadPlan; activities: LookaheadActivity[] }>(`/lookahead-plans/${planId}`, token)
      .then((res) => {
        setLookaheadActivities(res?.activities ?? []);
      });
  }

  function refreshAll() {
    setLoading(true);
    setError(null);
    Promise.all([loadGantt(), loadVariance(), loadLookaheadPlans()])
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load schedule data"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refreshAll();
  }, [projectId, token]);

  useEffect(() => {
    if (selectedPlanId) {
      loadPlanDetails(selectedPlanId).catch(() => {});
    }
  }, [selectedPlanId, token]);

  // Handle Progress Modal submit
  async function handleSaveProgress(e: FormEvent) {
    e.preventDefault();
    if (!progressModalActivity) return;
    setSavingProgress(true);
    try {
      await apiFetch(`/schedule-activities/${progressModalActivity.id}/progress`, token, {
        method: "POST",
        body: JSON.stringify({
          percentComplete: progressPercent,
          note: progressNote.trim() || undefined,
        }),
      });
      setProgressModalActivity(null);
      setProgressNote("");
      await loadGantt();
      await loadVariance();
      onActivityUpdated?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update progress");
    } finally {
      setSavingProgress(false);
    }
  }

  // Handle Create Lookahead Plan submit
  async function handleCreateLookaheadPlan(e: FormEvent) {
    e.preventDefault();
    if (!newPlanTitle.trim() || !newPlanStart || !newPlanEnd) return;
    try {
      const res = await apiFetch<{ lookaheadPlan: LookaheadPlan }>(`/projects/${projectId}/lookahead-plans`, token, {
        method: "POST",
        body: JSON.stringify({
          title: newPlanTitle.trim(),
          periodStart: newPlanStart,
          periodEnd: newPlanEnd,
          timeframeWeeks: Number(newPlanWeeks),
        }),
      });
      setShowCreatePlanModal(false);
      setNewPlanTitle("");
      setNewPlanStart("");
      setNewPlanEnd("");
      await loadLookaheadPlans();
      setSelectedPlanId(res.lookaheadPlan.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create lookahead plan");
    }
  }

  // Handle Add Lookahead Action submit
  async function handleAddLookaheadAction(e: FormEvent) {
    e.preventDefault();
    if (!selectedPlanId || !newActionText.trim() || !newActionDate) return;
    try {
      await apiFetch(`/lookahead-plans/${selectedPlanId}/activities`, token, {
        method: "POST",
        body: JSON.stringify({
          scheduleActivityId: newActionScheduleActId || null,
          customActivityName: newActionCustomName.trim() || null,
          plannedAction: newActionText.trim(),
          targetDate: newActionDate,
          notes: newActionNotes.trim() || null,
        }),
      });
      setShowAddActionModal(false);
      setNewActionText("");
      setNewActionDate("");
      setNewActionCustomName("");
      setNewActionScheduleActId("");
      setNewActionNotes("");
      await loadPlanDetails(selectedPlanId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add lookahead action");
    }
  }

  // Handle Update Lookahead Action status
  async function handleUpdateActionStatus(actionId: string, status: LookaheadActivity["status"]) {
    try {
      await apiFetch(`/lookahead-activities/${actionId}`, token, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (selectedPlanId) {
        await loadPlanDetails(selectedPlanId);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update action status");
    }
  }

  // Handle Log Delay submit
  async function handleLogDelay(e: FormEvent) {
    e.preventDefault();
    if (!delayActivityId || delayDays <= 0 || !delayDescription.trim()) return;
    try {
      await apiFetch(`/projects/${projectId}/delays`, token, {
        method: "POST",
        body: JSON.stringify({
          scheduleActivityId: delayActivityId,
          delayDays: Number(delayDays),
          reasonCategory: delayReason,
          description: delayDescription.trim(),
          mitigationPlan: delayMitigation.trim() || null,
        }),
      });
      setShowLogDelayModal(false);
      setDelayDescription("");
      setDelayMitigation("");
      setDelayDays(1);
      await loadVariance();
      await loadGantt();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to log delay");
    }
  }

  // Compute timeline boundaries for Gantt chart
  const activities = gantt?.activities ?? [];
  const filteredActivities = activities.filter((a) => (showCriticalOnly ? a.is_critical : true));

  let minDate = new Date();
  let maxDate = new Date();
  if (activities.length > 0) {
    const dates = activities.flatMap((a) => [
      a.planned_start ? new Date(a.planned_start).getTime() : NaN,
      a.planned_end ? new Date(a.planned_end).getTime() : NaN,
      a.baseline_start ? new Date(a.baseline_start).getTime() : NaN,
      a.baseline_end ? new Date(a.baseline_end).getTime() : NaN,
    ]).filter((t) => !isNaN(t));

    if (dates.length > 0) {
      minDate = new Date(Math.min(...dates));
      maxDate = new Date(Math.max(...dates));
    }
  }
  const totalDurationDays = Math.max(1, Math.round((maxDate.getTime() - minDate.getTime()) / 86400000));

  function getBarStyles(startStr: string | null, endStr: string | null) {
    if (!startStr || !endStr) return { left: "0%", width: "0%", display: "none" };
    const s = new Date(startStr).getTime();
    const e = new Date(endStr).getTime();
    if (isNaN(s) || isNaN(e) || e < s) return { left: "0%", width: "0%", display: "none" };

    const leftPercent = Math.max(0, Math.min(100, ((s - minDate.getTime()) / (totalDurationDays * 86400000)) * 100));
    const widthPercent = Math.max(1.5, Math.min(100 - leftPercent, ((e - s) / (totalDurationDays * 86400000)) * 100));

    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
    };
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Schedule KPIs */}
      <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-brand" />
              <h2 className="font-brand text-lg font-bold text-zinc-900">
                Schedule, Progress & Resource Planning
              </h2>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              CPM Critical Path Method · 2 & 4-Week Lookahead Plans · Delay Mitigation & Variance Tracking
            </p>
          </div>

          <div className="flex items-center gap-2">
            <PermissionGate permission="project.progress.record">
              <button
                onClick={() => {
                  if (activities.length > 0) {
                    setProgressModalActivity(activities[0]);
                    setProgressPercent(activities[0].percent_complete);
                  }
                }}
                className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
              >
                Quick Progress Update
              </button>
            </PermissionGate>
            <PermissionGate permission="tenancy.project.manage">
              <button
                onClick={() => setShowLogDelayModal(true)}
                className="rounded-lg bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                + Log Delay Record
              </button>
            </PermissionGate>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div className="rounded-xl bg-stone-50 p-3.5">
            <p className="text-xs font-medium text-zinc-500">Overall Progress</p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-xl font-bold text-zinc-900">{gantt?.overall_progress ?? 0}%</span>
              <span className="text-[11px] text-zinc-400">
                ({gantt?.completed_activities ?? 0}/{gantt?.total_activities ?? 0})
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
              <div
                className="h-full bg-brand transition-all"
                style={{ width: `${gantt?.overall_progress ?? 0}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl bg-stone-50 p-3.5">
            <p className="text-xs font-medium text-zinc-500">Critical Path Items</p>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-rose-600">
                {gantt?.critical_path.length ?? 0}
              </span>
              <span className="text-xs text-rose-500 font-medium">0 days float</span>
            </div>
            <p className="mt-2 text-[11px] text-zinc-400">Zero slack on end-date</p>
          </div>

          <div className="rounded-xl bg-stone-50 p-3.5">
            <p className="text-xs font-medium text-zinc-500">Approved Baseline</p>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-zinc-900">
                {gantt?.baseline_version ? `v${gantt.baseline_version}` : "None"}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-zinc-400">
              {gantt?.baseline_version ? "Active baseline frozen" : "No baseline set"}
            </p>
          </div>

          <div className="rounded-xl bg-stone-50 p-3.5">
            <p className="text-xs font-medium text-zinc-500">Logged Delays</p>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-amber-600">
                {variance?.total_delay_days ?? 0}
              </span>
              <span className="text-xs text-amber-700 font-medium">days</span>
            </div>
            <p className="mt-2 text-[11px] text-zinc-400">
              Across {variance?.delayed_activities_count ?? 0} activities
            </p>
          </div>

          <div className="rounded-xl bg-stone-50 p-3.5">
            <p className="text-xs font-medium text-zinc-500">Critical Path Delays</p>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-rose-700">
                {variance?.critical_delayed_count ?? 0}
              </span>
              <span className="text-xs text-zinc-400">activities</span>
            </div>
            <p className="mt-2 text-[11px] text-zinc-400">Directly impacts completion</p>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="mt-6 flex border-b border-zinc-100">
          <button
            onClick={() => setActiveTab("gantt")}
            className={`border-b-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider transition ${
              activeTab === "gantt"
                ? "border-brand text-zinc-900"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
            }`}
          >
            Interactive Gantt Schedule
          </button>
          <button
            onClick={() => setActiveTab("lookahead")}
            className={`border-b-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider transition ${
              activeTab === "lookahead"
                ? "border-brand text-zinc-900"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
            }`}
          >
            Lookahead Plans ({(lookaheadPlans ?? []).length})
          </button>
          <button
            onClick={() => setActiveTab("delays")}
            className={`border-b-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider transition ${
              activeTab === "delays"
                ? "border-brand text-zinc-900"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
            }`}
          >
            Delay Register & Variance ({(delays ?? []).length})
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 rounded-xl bg-stone-50 px-4 py-2.5 text-xs text-zinc-500">
          <span className="h-2 w-2 animate-ping rounded-full bg-brand" />
          <span>Synchronizing schedule, critical path & delay variance…</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {/* TAB 1: GANTT SCHEDULE */}
      {activeTab === "gantt" && (
        <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCriticalOnly}
                  onChange={(e) => setShowCriticalOnly(e.target.checked)}
                  className="rounded border-zinc-300 text-brand focus:ring-brand"
                />
                Critical Path Only ({gantt?.critical_path.length ?? 0})
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBaseline}
                  onChange={(e) => setShowBaseline(e.target.checked)}
                  className="rounded border-zinc-300 text-brand focus:ring-brand"
                />
                Show Baseline Overlay
              </label>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-zinc-600">
                <span className="h-2 w-3 rounded bg-brand" /> Planned
              </span>
              <span className="flex items-center gap-1.5 text-zinc-600">
                <span className="h-2 w-3 rounded bg-zinc-300" /> Baseline (Frozen)
              </span>
              <span className="flex items-center gap-1.5 text-rose-600 font-medium">
                <span className="h-2 w-3 rounded bg-rose-500" /> Critical Path (Float = 0)
              </span>
            </div>
          </div>

          {/* Timeline Grid */}
          <div className="overflow-x-auto p-6">
            {filteredActivities.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-400">
                No schedule activities found matching the selected filters.
              </p>
            ) : (
              <div className="min-w-[800px] space-y-4">
                {/* Timeline Header Header */}
                <div className="flex items-center border-b border-zinc-200 pb-2 text-[11px] font-semibold uppercase text-zinc-400">
                  <div className="w-[280px]">Activity & WBS</div>
                  <div className="w-[120px]">Dates</div>
                  <div className="w-[100px] text-center">Float</div>
                  <div className="flex-1 text-center">
                    Timeline ({minDate.toLocaleDateString()} — {maxDate.toLocaleDateString()})
                  </div>
                  <div className="w-[80px] text-right">Actions</div>
                </div>

                {/* Rows */}
                {filteredActivities.map((act) => {
                  const barStyle = getBarStyles(act.planned_start, act.planned_end);
                  const baseStyle = getBarStyles(act.baseline_start, act.baseline_end);

                  return (
                    <div
                      key={act.id}
                      className={`group flex items-center rounded-xl p-2 transition hover:bg-stone-50 ${
                        act.is_critical ? "bg-rose-50/20" : ""
                      }`}
                    >
                      {/* Name & WBS */}
                      <div className="w-[280px] pr-2">
                        <div className="flex items-center gap-1.5">
                          {act.is_critical && (
                            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-700">
                              CP
                            </span>
                          )}
                          <p className="truncate text-xs font-semibold text-zinc-800">
                            {act.name}
                          </p>
                        </div>
                        <p className="truncate text-[10px] text-zinc-400">
                          {act.wbs_code ? `${act.wbs_code} · ` : ""}
                          {act.wbs_name ?? "Unassigned WBS"}
                        </p>
                      </div>

                      {/* Dates */}
                      <div className="w-[120px] text-[11px] text-zinc-600">
                        <p>{act.planned_start ? new Date(act.planned_start).toLocaleDateString() : "—"}</p>
                        <p className="text-zinc-400">
                          → {act.planned_end ? new Date(act.planned_end).toLocaleDateString() : "—"}
                        </p>
                      </div>

                      {/* Float */}
                      <div className="w-[100px] text-center">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            act.is_critical
                              ? "bg-rose-100 text-rose-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {act.total_float_days}d float
                        </span>
                      </div>

                      {/* Timeline Gantt Bar Track */}
                      <div className="relative flex-1 h-8 rounded-lg bg-zinc-100/70 overflow-hidden mx-2">
                        {/* Baseline Shadow Bar */}
                        {showBaseline && act.baseline_start && (
                          <div
                            title={`Baseline: ${act.baseline_start} to ${act.baseline_end}`}
                            className="absolute top-1 h-2 rounded bg-zinc-300/80 z-0"
                            style={baseStyle}
                          />
                        )}

                        {/* Planned / Progress Bar */}
                        <div
                          title={`${act.name}: ${act.percent_complete}% complete (${act.planned_start} to ${act.planned_end})`}
                          className={`absolute bottom-1 h-4 rounded shadow-sm z-10 transition-all ${
                            act.is_critical ? "bg-rose-500" : "bg-brand"
                          }`}
                          style={barStyle}
                        >
                          {/* Progress fill */}
                          <div
                            className="h-full rounded bg-zinc-900/20"
                            style={{ width: `${act.percent_complete}%` }}
                          />
                        </div>
                      </div>

                      {/* Quick Action */}
                      <div className="w-[80px] text-right">
                        <PermissionGate permission="project.progress.record">
                          <button
                            onClick={() => {
                              setProgressModalActivity(act);
                              setProgressPercent(act.percent_complete);
                            }}
                            className="rounded border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:border-brand hover:text-zinc-900"
                          >
                            {act.percent_complete}%
                          </button>
                        </PermissionGate>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LOOKAHEAD PLANS */}
      {activeTab === "lookahead" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Plan Selector Sidebar */}
          <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm lg:col-span-1">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Lookahead Plans
              </h3>
              <PermissionGate permission="tenancy.project.manage">
                <button
                  onClick={() => setShowCreatePlanModal(true)}
                  className="rounded bg-brand px-2 py-1 text-xs font-semibold text-zinc-900 hover:bg-brand-dim"
                >
                  + New
                </button>
              </PermissionGate>
            </div>

            <div className="mt-3 space-y-2">
              {lookaheadPlans.length === 0 ? (
                <p className="text-xs text-zinc-400 py-3">No lookahead plans created yet.</p>
              ) : (
                lookaheadPlans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`w-full text-left rounded-xl p-3 text-xs transition ${
                      selectedPlanId === plan.id
                        ? "bg-brand-soft border border-brand/30 font-semibold text-zinc-900 shadow-sm"
                        : "border border-transparent bg-stone-50 text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{plan.title}</p>
                      <span className="rounded bg-zinc-200/60 px-1.5 py-0.5 text-[10px] text-zinc-600">
                        {plan.timeframe_weeks}W
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {new Date(plan.period_start).toLocaleDateString()} — {new Date(plan.period_end).toLocaleDateString()}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Plan Detail & Action Items */}
          <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm lg:col-span-3">
            {selectedPlanId ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4">
                  <div>
                    <h3 className="font-brand text-base font-bold text-zinc-900">
                      {lookaheadPlans.find((p) => p.id === selectedPlanId)?.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Execution horizon: {lookaheadPlans.find((p) => p.id === selectedPlanId)?.period_start} to{" "}
                      {lookaheadPlans.find((p) => p.id === selectedPlanId)?.period_end}
                    </p>
                  </div>

                  <PermissionGate permission="tenancy.project.manage">
                    <button
                      onClick={() => setShowAddActionModal(true)}
                      className="rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800"
                    >
                      + Add Lookahead Action
                    </button>
                  </PermissionGate>
                </div>

                {/* Activities Table */}
                <div className="mt-5 overflow-hidden rounded-xl border border-zinc-100">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-100 bg-stone-50 font-semibold text-zinc-500 uppercase">
                        <th className="px-4 py-3">Planned Action</th>
                        <th className="px-4 py-3">Target Date</th>
                        <th className="px-4 py-3">Schedule Link</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {lookaheadActivities.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-zinc-400">
                            No action items in this lookahead plan yet. Click "+ Add Lookahead Action" to plan works.
                          </td>
                        </tr>
                      ) : (
                        lookaheadActivities.map((act) => {
                          const linkedAct = activities.find((a) => a.id === act.schedule_activity_id);
                          return (
                            <tr key={act.id} className="hover:bg-stone-50/60">
                              <td className="px-4 py-3 font-medium text-zinc-900">
                                {act.planned_action}
                              </td>
                              <td className="px-4 py-3 text-zinc-600">
                                {new Date(act.target_date).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 text-zinc-500">
                                {linkedAct ? (
                                  <span className="font-medium text-zinc-700">{linkedAct.name}</span>
                                ) : (
                                  act.custom_activity_name ?? "—"
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <PermissionGate
                                  permission="tenancy.project.manage"
                                  fallback={
                                    <span
                                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                        statusColors[act.status]
                                      }`}
                                    >
                                      {act.status}
                                    </span>
                                  }
                                >
                                  <select
                                    value={act.status}
                                    onChange={(e) =>
                                      handleUpdateActionStatus(
                                        act.id,
                                        e.target.value as LookaheadActivity["status"],
                                      )
                                    }
                                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold outline-none border-0 ${
                                      statusColors[act.status]
                                    }`}
                                  >
                                    <option value="planned">planned</option>
                                    <option value="in_progress">in_progress</option>
                                    <option value="completed">completed</option>
                                    <option value="delayed">delayed</option>
                                  </select>
                                </PermissionGate>
                              </td>
                              <td className="px-4 py-3 text-zinc-400 italic">
                                {act.notes ?? "—"}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-zinc-400">
                Select a lookahead plan on the left or create a new one.
              </p>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DELAYS & VARIANCE */}
      {activeTab === "delays" && (
        <div className="space-y-6">
          {/* Delay Category Breakdown Cards */}
          <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
            <h3 className="font-brand text-sm font-bold text-zinc-900">
              Delay Reason Categorization (Variance Drivers)
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              Breakdown of total impact days by standard contractual delay classification.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {DELAY_REASONS.map((cat) => {
                const days = variance?.delays_by_category[cat] ?? 0;
                return (
                  <div
                    key={cat}
                    className={`rounded-xl border p-3 text-center ${reasonColors[cat]}`}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider">{reasonLabels[cat]}</p>
                    <p className="mt-1 text-xl font-bold">{days}d</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delay Records Table */}
          <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h3 className="font-brand text-base font-bold text-zinc-900">
                  Delay Log & Mitigation Register
                </h3>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Documented impacts, root cause explanations, and corrective action plans.
                </p>
              </div>

              <PermissionGate permission="tenancy.project.manage">
                <button
                  onClick={() => setShowLogDelayModal(true)}
                  className="rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-zinc-900 transition hover:bg-brand-dim"
                >
                  + Log New Delay
                </button>
              </PermissionGate>
            </div>

            <div className="mt-5 overflow-hidden rounded-xl border border-zinc-100">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 bg-stone-50 font-semibold text-zinc-500 uppercase">
                    <th className="px-4 py-3">Schedule Activity</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Delay Days</th>
                    <th className="px-4 py-3">Root Cause Description</th>
                    <th className="px-4 py-3">Mitigation / Recovery Plan</th>
                    <th className="px-4 py-3">Recorded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {delays.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-400">
                        No delay records logged for this project.
                      </td>
                    </tr>
                  ) : (
                    delays.map((d) => {
                      const act = activities.find((a) => a.id === d.schedule_activity_id);
                      return (
                        <tr key={d.id} className="hover:bg-stone-50/60">
                          <td className="px-4 py-3 font-semibold text-zinc-900">
                            {act?.name ?? d.schedule_activity_id}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                reasonColors[d.reason_category]
                              }`}
                            >
                              {reasonLabels[d.reason_category]}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-rose-600">
                            +{d.delay_days} days
                          </td>
                          <td className="px-4 py-3 text-zinc-700 max-w-[280px]">
                            {d.description}
                          </td>
                          <td className="px-4 py-3 text-zinc-600 max-w-[280px]">
                            {d.mitigation_plan ?? <span className="italic text-zinc-400">Pending plan</span>}
                          </td>
                          <td className="px-4 py-3 text-zinc-400">
                            {new Date(d.recorded_at).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Quick Progress Update */}
      {progressModalActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveProgress}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4"
          >
            <h3 className="font-brand text-base font-bold text-zinc-900">
              Update Progress: {progressModalActivity.name}
            </h3>
            <p className="text-xs text-zinc-500">
              Record physical progress percentage and audit note for this schedule activity.
            </p>

            <div>
              <div className="flex justify-between text-xs font-semibold text-zinc-700 mb-1">
                <span>Progress Percentage</span>
                <span className="text-brand-dim font-bold">{progressPercent}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={progressPercent}
                onChange={(e) => setProgressPercent(Number(e.target.value))}
                className="w-full accent-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Progress / Site Observation Note
              </label>
              <textarea
                rows={3}
                value={progressNote}
                onChange={(e) => setProgressNote(e.target.value)}
                placeholder="e.g. Sub-grade compaction verified by consultant; ready for rebar inspection."
                className={`w-full ${inputClass}`}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProgressModalActivity(null)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProgress}
                className="rounded-lg bg-brand px-4 py-2 text-xs font-bold text-zinc-900 hover:bg-brand-dim disabled:opacity-50"
              >
                {savingProgress ? "Recording…" : "Save Progress Entry"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: Create Lookahead Plan */}
      {showCreatePlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateLookaheadPlan}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4"
          >
            <h3 className="font-brand text-base font-bold text-zinc-900">
              Create Lookahead Plan
            </h3>
            <p className="text-xs text-zinc-500">
              Define a short-term execution window (2-week or 4-week horizon) to plan granular site actions.
            </p>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Plan Title</label>
              <input
                type="text"
                value={newPlanTitle}
                onChange={(e) => setNewPlanTitle(e.target.value)}
                placeholder="e.g. Basement 1 Concreting Lookahead"
                className={`w-full ${inputClass}`}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Period Start</label>
                <input
                  type="date"
                  value={newPlanStart}
                  onChange={(e) => setNewPlanStart(e.target.value)}
                  className={`w-full ${inputClass}`}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Period End</label>
                <input
                  type="date"
                  value={newPlanEnd}
                  onChange={(e) => setNewPlanEnd(e.target.value)}
                  className={`w-full ${inputClass}`}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Timeframe Horizon</label>
              <select
                value={newPlanWeeks}
                onChange={(e) => setNewPlanWeeks(Number(e.target.value))}
                className={`w-full ${inputClass}`}
              >
                <option value={2}>2 Weeks (Granular operational)</option>
                <option value={4}>4 Weeks (Lookahead & procurement)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreatePlanModal(false)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-brand px-4 py-2 text-xs font-bold text-zinc-900 hover:bg-brand-dim"
              >
                Create Plan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: Add Lookahead Action */}
      {showAddActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <form
            onSubmit={handleAddLookaheadAction}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4"
          >
            <h3 className="font-brand text-base font-bold text-zinc-900">
              Add Lookahead Action Item
            </h3>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Planned Action</label>
              <input
                type="text"
                value={newActionText}
                onChange={(e) => setNewActionText(e.target.value)}
                placeholder="e.g. Inspect formwork and tie reinforcement bars"
                className={`w-full ${inputClass}`}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Target Date</label>
              <input
                type="date"
                value={newActionDate}
                onChange={(e) => setNewActionDate(e.target.value)}
                className={`w-full ${inputClass}`}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Link to Schedule Activity (Optional)</label>
              <select
                value={newActionScheduleActId}
                onChange={(e) => setNewActionScheduleActId(e.target.value)}
                className={`w-full ${inputClass}`}
              >
                <option value="">None / Custom task</option>
                {activities.map((act) => (
                  <option key={act.id} value={act.id}>
                    {act.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Notes</label>
              <input
                type="text"
                value={newActionNotes}
                onChange={(e) => setNewActionNotes(e.target.value)}
                placeholder="Constraints, pre-requisites, safety checks"
                className={`w-full ${inputClass}`}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddActionModal(false)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-brand px-4 py-2 text-xs font-bold text-zinc-900 hover:bg-brand-dim"
              >
                Add Action
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4: Log Schedule Delay */}
      {showLogDelayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <form
            onSubmit={handleLogDelay}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4"
          >
            <h3 className="font-brand text-base font-bold text-zinc-900">
              Log Schedule Delay & Mitigation Plan
            </h3>
            <p className="text-xs text-zinc-500">
              Document schedule delays, assign contractual responsibility categories, and specify corrective actions.
            </p>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Impacted Schedule Activity</label>
              <select
                value={delayActivityId}
                onChange={(e) => setDelayActivityId(e.target.value)}
                className={`w-full ${inputClass}`}
                required
              >
                <option value="">Select an activity…</option>
                {activities.map((act) => (
                  <option key={act.id} value={act.id}>
                    {act.name} {act.is_critical ? "★ (Critical Path)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Delay Duration (Days)</label>
                <input
                  type="number"
                  min="1"
                  value={delayDays}
                  onChange={(e) => setDelayDays(Number(e.target.value))}
                  className={`w-full ${inputClass}`}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Reason Category</label>
                <select
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value as DelayReasonCategory)}
                  className={`w-full ${inputClass}`}
                >
                  {DELAY_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {reasonLabels[r]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Delay Description & Cause
              </label>
              <textarea
                rows={3}
                value={delayDescription}
                onChange={(e) => setDelayDescription(e.target.value)}
                placeholder="Explain the circumstance causing the delay (e.g. Concrete supplier batch plant breakdown on pouring day)"
                className={`w-full ${inputClass}`}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Mitigation & Acceleration Plan
              </label>
              <textarea
                rows={2}
                value={delayMitigation}
                onChange={(e) => setDelayMitigation(e.target.value)}
                placeholder="Proposed corrective measures to recover the schedule (e.g. Authorize night shift pouring and extra pump crew)"
                className={`w-full ${inputClass}`}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLogDelayModal(false)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700"
              >
                Log Delay Record
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
