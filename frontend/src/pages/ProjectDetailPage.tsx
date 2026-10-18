import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { UserPicker } from "../components/UserPicker";
import { PermissionGate } from "../components/PermissionGate";
import { EngineeringSection } from "../components/EngineeringSection";
import { ScheduleGanttSection } from "../components/ScheduleGanttSection";

type ProjectStatus = "active" | "on_hold" | "closed";
type MilestoneStatus = "pending" | "achieved" | "missed";

interface Project {
  id: string;
  name: string;
  code: string | null;
  status: ProjectStatus;
  client_name: string | null;
  location: string | null;
  contract_reference: string | null;
  contract_value: number | null;
  contract_currency: string | null;
  project_manager_id: string | null;
  baseline_start_date: string | null;
  baseline_end_date: string | null;
  budget_amount: number | null;
  budget_currency: string | null;
}

interface WBSNode {
  id: string;
  parent_wbs_node_id: string | null;
  code: string;
  name: string;
  sequence: number;
}

interface Milestone {
  id: string;
  name: string;
  target_date: string;
  actual_date: string | null;
  status: MilestoneStatus;
}

interface ScheduleActivity {
  id: string;
  wbs_node_id: string | null;
  name: string;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  percent_complete: number;
}

const statusColors: Record<ProjectStatus, string> = {
  active: "bg-emerald-50 text-emerald-700",
  on_hold: "bg-amber-50 text-amber-700",
  closed: "bg-zinc-100 text-zinc-500",
};

const statusLabels: Record<ProjectStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  closed: "Closed",
};

const milestoneColors: Record<MilestoneStatus, string> = {
  pending: "bg-blue-50 text-blue-700",
  achieved: "bg-emerald-50 text-emerald-700",
  missed: "bg-red-50 text-red-700",
};

const milestoneLabels: Record<MilestoneStatus, string> = {
  pending: "Pending",
  achieved: "Achieved",
  missed: "Missed",
};

const inputClass =
  "rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

function formatAmount(amount: number | null, currency: string | null): string {
  if (amount === null) return "—";
  return currency ? `${amount.toLocaleString()} ${currency}` : amount.toLocaleString();
}

function WBSTree({
  nodes,
  parentId,
  onEdit,
}: {
  nodes: WBSNode[];
  parentId: string | null;
  onEdit: (node: WBSNode) => void;
}) {
  const children = nodes.filter((n) => n.parent_wbs_node_id === parentId).sort((a, b) => a.sequence - b.sequence);
  if (children.length === 0) return null;
  return (
    <ul className="space-y-1">
      {children.map((node) => (
        <li key={node.id}>
          <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-sm hover:bg-stone-50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-400">{node.code}</span>
              <span className="text-zinc-800">{node.name}</span>
            </div>
            <button onClick={() => onEdit(node)} className="text-xs text-zinc-400 hover:text-brand-dim">
              Edit
            </button>
          </div>
          <div className="ml-4 border-l border-zinc-100 pl-3">
            <WBSTree nodes={nodes} parentId={node.id} onEdit={onEdit} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [wbsNodes, setWbsNodes] = useState<WBSNode[] | null>(null);
  const [milestones, setMilestones] = useState<Milestone[] | null>(null);
  const [activities, setActivities] = useState<ScheduleActivity[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Project edit
  const [editingProject, setEditingProject] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editStatus, setEditStatus] = useState<ProjectStatus>("active");
  const [editClientName, setEditClientName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editManagerId, setEditManagerId] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  const [projectFormError, setProjectFormError] = useState<string | null>(null);

  // WBS node form
  const [showWbsForm, setShowWbsForm] = useState(false);
  const [wbsEditingId, setWbsEditingId] = useState<string | null>(null);
  const [wbsCode, setWbsCode] = useState("");
  const [wbsName, setWbsName] = useState("");
  const [wbsParentId, setWbsParentId] = useState("");
  const [wbsFormError, setWbsFormError] = useState<string | null>(null);

  // Milestone form
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [milestoneEditingId, setMilestoneEditingId] = useState<string | null>(null);
  const [milestoneName, setMilestoneName] = useState("");
  const [milestoneTargetDate, setMilestoneTargetDate] = useState("");
  const [milestoneActualDate, setMilestoneActualDate] = useState("");
  const [milestoneStatus, setMilestoneStatus] = useState<MilestoneStatus>("pending");
  const [milestoneFormError, setMilestoneFormError] = useState<string | null>(null);

  // Activity form
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [activityEditingId, setActivityEditingId] = useState<string | null>(null);
  const [activityName, setActivityName] = useState("");
  const [activityStart, setActivityStart] = useState("");
  const [activityEnd, setActivityEnd] = useState("");
  const [activityPercent, setActivityPercent] = useState("0");
  const [activityFormError, setActivityFormError] = useState<string | null>(null);

  function load() {
    if (!session || !id) return;
    Promise.all([
      apiFetch<{ project: Project }>(`/projects/${id}`, session.access_token),
      apiFetch<{ wbsNodes: WBSNode[] }>(`/projects/${id}/wbs-nodes`, session.access_token),
      apiFetch<{ milestones: Milestone[] }>(`/projects/${id}/milestones`, session.access_token),
      apiFetch<{ scheduleActivities: ScheduleActivity[] }>(`/projects/${id}/schedule-activities`, session.access_token),
    ])
      .then(([projectData, wbsData, milestoneData, activityData]) => {
        setProject(projectData.project);
        setWbsNodes(wbsData.wbsNodes);
        setMilestones(milestoneData.milestones);
        setActivities(activityData.scheduleActivities);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }

  useEffect(load, [session, id]);

  function startEditProject() {
    if (!project) return;
    setEditName(project.name);
    setEditCode(project.code ?? "");
    setEditStatus(project.status);
    setEditClientName(project.client_name ?? "");
    setEditLocation(project.location ?? "");
    setEditStart(project.baseline_start_date ?? "");
    setEditEnd(project.baseline_end_date ?? "");
    setEditManagerId(project.project_manager_id ?? "");
    setProjectFormError(null);
    setEditingProject(true);
  }

  async function handleSaveProject(event: FormEvent) {
    event.preventDefault();
    if (!session || !id || !editName.trim()) return;
    setSavingProject(true);
    setProjectFormError(null);
    try {
      await apiFetch(`/projects/${id}`, session.access_token, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName.trim(),
          code: editCode.trim() || null,
          status: editStatus,
          clientName: editClientName.trim() || null,
          location: editLocation.trim() || null,
          baselineStartDate: editStart || null,
          baselineEndDate: editEnd || null,
          projectManagerId: editManagerId || null,
        }),
      });
      setEditingProject(false);
      load();
    } catch (err) {
      setProjectFormError(err instanceof ApiError ? err.message : "Could not save the project");
    } finally {
      setSavingProject(false);
    }
  }

  function startWbsCreate() {
    setWbsEditingId(null);
    setWbsCode("");
    setWbsName("");
    setWbsParentId("");
    setWbsFormError(null);
    setShowWbsForm(true);
  }

  function startWbsEdit(node: WBSNode) {
    setWbsEditingId(node.id);
    setWbsCode(node.code);
    setWbsName(node.name);
    setWbsParentId(node.parent_wbs_node_id ?? "");
    setWbsFormError(null);
    setShowWbsForm(true);
  }

  async function handleSaveWbs(event: FormEvent) {
    event.preventDefault();
    if (!session || !id || !wbsName.trim()) return;
    setWbsFormError(null);
    try {
      if (wbsEditingId) {
        await apiFetch(`/wbs-nodes/${wbsEditingId}`, session.access_token, {
          method: "PATCH",
          body: JSON.stringify({ name: wbsName.trim(), parentWbsNodeId: wbsParentId || null }),
        });
      } else {
        if (!wbsCode.trim()) {
          setWbsFormError("Code is required for a new WBS node.");
          return;
        }
        await apiFetch(`/projects/${id}/wbs-nodes`, session.access_token, {
          method: "POST",
          body: JSON.stringify({ code: wbsCode.trim(), name: wbsName.trim(), parentWbsNodeId: wbsParentId || undefined }),
        });
      }
      setShowWbsForm(false);
      load();
    } catch (err) {
      setWbsFormError(err instanceof ApiError ? err.message : "Could not save the WBS node");
    }
  }

  function startMilestoneCreate() {
    setMilestoneEditingId(null);
    setMilestoneName("");
    setMilestoneTargetDate("");
    setMilestoneActualDate("");
    setMilestoneStatus("pending");
    setMilestoneFormError(null);
    setShowMilestoneForm(true);
  }

  function startMilestoneEdit(milestone: Milestone) {
    setMilestoneEditingId(milestone.id);
    setMilestoneName(milestone.name);
    setMilestoneTargetDate(milestone.target_date);
    setMilestoneActualDate(milestone.actual_date ?? "");
    setMilestoneStatus(milestone.status);
    setMilestoneFormError(null);
    setShowMilestoneForm(true);
  }

  async function handleSaveMilestone(event: FormEvent) {
    event.preventDefault();
    if (!session || !id || !milestoneName.trim()) return;
    setMilestoneFormError(null);
    try {
      if (milestoneEditingId) {
        await apiFetch(`/milestones/${milestoneEditingId}`, session.access_token, {
          method: "PATCH",
          body: JSON.stringify({
            name: milestoneName.trim(),
            targetDate: milestoneTargetDate,
            actualDate: milestoneActualDate || null,
            status: milestoneStatus,
          }),
        });
      } else {
        if (!milestoneTargetDate) {
          setMilestoneFormError("Target date is required for a new milestone.");
          return;
        }
        await apiFetch(`/projects/${id}/milestones`, session.access_token, {
          method: "POST",
          body: JSON.stringify({ name: milestoneName.trim(), targetDate: milestoneTargetDate }),
        });
      }
      setShowMilestoneForm(false);
      load();
    } catch (err) {
      setMilestoneFormError(err instanceof ApiError ? err.message : "Could not save the milestone");
    }
  }

  function startActivityCreate() {
    setActivityEditingId(null);
    setActivityName("");
    setActivityStart("");
    setActivityEnd("");
    setActivityPercent("0");
    setActivityFormError(null);
    setShowActivityForm(true);
  }

  function startActivityEdit(activity: ScheduleActivity) {
    setActivityEditingId(activity.id);
    setActivityName(activity.name);
    setActivityStart(activity.planned_start ?? "");
    setActivityEnd(activity.planned_end ?? "");
    setActivityPercent(String(activity.percent_complete));
    setActivityFormError(null);
    setShowActivityForm(true);
  }

  async function handleSaveActivity(event: FormEvent) {
    event.preventDefault();
    if (!session || !id || !activityName.trim()) return;
    setActivityFormError(null);
    try {
      if (activityEditingId) {
        await apiFetch(`/schedule-activities/${activityEditingId}`, session.access_token, {
          method: "PATCH",
          body: JSON.stringify({
            name: activityName.trim(),
            plannedStart: activityStart || null,
            plannedEnd: activityEnd || null,
            percentComplete: Number(activityPercent) || 0,
          }),
        });
      } else {
        await apiFetch(`/projects/${id}/schedule-activities`, session.access_token, {
          method: "POST",
          body: JSON.stringify({
            name: activityName.trim(),
            plannedStart: activityStart || undefined,
            plannedEnd: activityEnd || undefined,
          }),
        });
      }
      setShowActivityForm(false);
      load();
    } catch (err) {
      setActivityFormError(err instanceof ApiError ? err.message : "Could not save the activity");
    }
  }

  const sortedMilestones = (milestones ?? []).slice().sort((a, b) => a.target_date.localeCompare(b.target_date));

  return (
    <div className="space-y-6">
      <div>
        <Link to="/projects" className="text-sm text-zinc-400 hover:text-zinc-600">
          ← Back to projects
        </Link>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!project && !error && <p className="text-sm text-zinc-400">Loading…</p>}

      {project && (
        <>
          <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-brand text-2xl font-bold text-zinc-900">{project.name}</h1>
                {project.code && <p className="mt-1 text-sm text-zinc-400">{project.code}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[project.status]}`}>
                  {statusLabels[project.status]}
                </span>
                <PermissionGate permission="tenancy.project.manage">
                  {!editingProject && (
                    <button onClick={startEditProject} className="text-sm text-zinc-400 hover:text-brand-dim">
                      Edit project
                    </button>
                  )}
                </PermissionGate>
              </div>
            </div>

            {!editingProject ? (
              <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Client</dt>
                  <dd className="mt-1 text-sm text-zinc-800">{project.client_name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Location</dt>
                  <dd className="mt-1 text-sm text-zinc-800">{project.location ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Contract ref</dt>
                  <dd className="mt-1 text-sm text-zinc-800">{project.contract_reference ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Contract value</dt>
                  <dd className="mt-1 text-sm text-zinc-800">{formatAmount(project.contract_value, project.contract_currency)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Budget</dt>
                  <dd className="mt-1 text-sm text-zinc-800">{formatAmount(project.budget_amount, project.budget_currency)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Baseline dates</dt>
                  <dd className="mt-1 text-sm text-zinc-800">
                    {project.baseline_start_date ? new Date(project.baseline_start_date).toLocaleDateString() : "—"}
                    {" → "}
                    {project.baseline_end_date ? new Date(project.baseline_end_date).toLocaleDateString() : "—"}
                  </dd>
                </div>
              </dl>
            ) : (
              <form onSubmit={handleSaveProject} className="mt-6 space-y-3">
                {projectFormError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{projectFormError}</div>}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Project name" className={inputClass} />
                  <input value={editCode} onChange={(e) => setEditCode(e.target.value)} placeholder="Project code" className={inputClass} />
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as ProjectStatus)} className={inputClass}>
                    {(["active", "on_hold", "closed"] as ProjectStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {statusLabels[s]}
                      </option>
                    ))}
                  </select>
                  <input value={editClientName} onChange={(e) => setEditClientName(e.target.value)} placeholder="Client name" className={inputClass} />
                  <input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} placeholder="Location" className={inputClass} />
                  <UserPicker value={editManagerId} onChange={setEditManagerId} placeholder="Project manager…" />
                  <label className="flex flex-col gap-1 text-xs text-zinc-400">
                    Start date
                    <input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-zinc-400">
                    End date
                    <input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className={inputClass} />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={savingProject || !editName.trim()}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim disabled:opacity-50"
                  >
                    {savingProject ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingProject(false)}
                    className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
                <h2 className="font-brand text-base font-semibold text-zinc-900">Work breakdown structure</h2>
                <PermissionGate permission="tenancy.project.manage">
                  <button onClick={startWbsCreate} className="text-sm text-zinc-400 hover:text-brand-dim">
                    Add node
                  </button>
                </PermissionGate>
              </div>
              <div className="space-y-4 p-6">
                {showWbsForm && (
                  <form onSubmit={handleSaveWbs} className="space-y-2 rounded-xl bg-stone-50 p-4">
                    {wbsFormError && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{wbsFormError}</div>}
                    {!wbsEditingId && (
                      <input value={wbsCode} onChange={(e) => setWbsCode(e.target.value)} placeholder="Code" className={`w-full ${inputClass}`} />
                    )}
                    <input value={wbsName} onChange={(e) => setWbsName(e.target.value)} placeholder="Name" className={`w-full ${inputClass}`} />
                    <select value={wbsParentId} onChange={(e) => setWbsParentId(e.target.value)} className={`w-full ${inputClass}`}>
                      <option value="">No parent (top level)</option>
                      {(wbsNodes ?? [])
                        .filter((n) => n.id !== wbsEditingId)
                        .map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.code} {n.name}
                          </option>
                        ))}
                    </select>
                    <div className="flex gap-2">
                      <button type="submit" className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-brand-dim">
                        {wbsEditingId ? "Save" : "Add"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowWbsForm(false)}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
                {wbsNodes?.length === 0 && <p className="text-sm text-zinc-400">No WBS nodes yet.</p>}
                {wbsNodes && wbsNodes.length > 0 && <WBSTree nodes={wbsNodes} parentId={null} onEdit={startWbsEdit} />}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
                <h2 className="font-brand text-base font-semibold text-zinc-900">Milestones</h2>
                <PermissionGate permission="tenancy.project.manage">
                  <button onClick={startMilestoneCreate} className="text-sm text-zinc-400 hover:text-brand-dim">
                    Add milestone
                  </button>
                </PermissionGate>
              </div>
              <div className="space-y-4 p-6">
                {showMilestoneForm && (
                  <form onSubmit={handleSaveMilestone} className="space-y-2 rounded-xl bg-stone-50 p-4">
                    {milestoneFormError && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{milestoneFormError}</div>}
                    <input value={milestoneName} onChange={(e) => setMilestoneName(e.target.value)} placeholder="Milestone name" className={`w-full ${inputClass}`} />
                    <label className="flex flex-col gap-1 text-xs text-zinc-400">
                      Target date
                      <input type="date" value={milestoneTargetDate} onChange={(e) => setMilestoneTargetDate(e.target.value)} className={inputClass} />
                    </label>
                    {milestoneEditingId && (
                      <>
                        <label className="flex flex-col gap-1 text-xs text-zinc-400">
                          Actual date
                          <input type="date" value={milestoneActualDate} onChange={(e) => setMilestoneActualDate(e.target.value)} className={inputClass} />
                        </label>
                        <select value={milestoneStatus} onChange={(e) => setMilestoneStatus(e.target.value as MilestoneStatus)} className={`w-full ${inputClass}`}>
                          {(["pending", "achieved", "missed"] as MilestoneStatus[]).map((s) => (
                            <option key={s} value={s}>
                              {milestoneLabels[s]}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                    <div className="flex gap-2">
                      <button type="submit" className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-brand-dim">
                        {milestoneEditingId ? "Save" : "Add"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMilestoneForm(false)}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
                {sortedMilestones.length === 0 && <p className="text-sm text-zinc-400">No milestones yet.</p>}
                {sortedMilestones.length > 0 && (
                  <ol className="space-y-3">
                    {sortedMilestones.map((milestone) => (
                      <li key={milestone.id} className="flex items-center justify-between rounded-lg bg-stone-50 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-zinc-800">{milestone.name}</p>
                          <p className="mt-0.5 text-xs text-zinc-400">
                            target {new Date(milestone.target_date).toLocaleDateString()}
                            {milestone.actual_date && ` · actual ${new Date(milestone.actual_date).toLocaleDateString()}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${milestoneColors[milestone.status]}`}>
                            {milestoneLabels[milestone.status]}
                          </span>
                          <PermissionGate permission="tenancy.project.manage">
                            <button onClick={() => startMilestoneEdit(milestone)} className="text-xs text-zinc-400 hover:text-brand-dim">
                              Edit
                            </button>
                          </PermissionGate>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </div>

          {session && <EngineeringSection projectId={id as string} token={session.access_token} />}
          {session && (
            <ScheduleGanttSection
              projectId={id as string}
              token={session.access_token}
              onActivityUpdated={load}
            />
          )}

          <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <h2 className="font-brand text-base font-semibold text-zinc-900">Schedule activities</h2>
              <PermissionGate permission="tenancy.project.manage">
                <button onClick={startActivityCreate} className="text-sm text-zinc-400 hover:text-brand-dim">
                  Add activity
                </button>
              </PermissionGate>
            </div>
            <div className="space-y-4 p-6">
              {showActivityForm && (
                <form onSubmit={handleSaveActivity} className="grid grid-cols-1 gap-2 rounded-xl bg-stone-50 p-4 sm:grid-cols-4">
                  {activityFormError && <div className="col-span-full rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{activityFormError}</div>}
                  <input value={activityName} onChange={(e) => setActivityName(e.target.value)} placeholder="Activity name" className={inputClass} />
                  <input type="date" value={activityStart} onChange={(e) => setActivityStart(e.target.value)} className={inputClass} />
                  <input type="date" value={activityEnd} onChange={(e) => setActivityEnd(e.target.value)} className={inputClass} />
                  {activityEditingId && (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={activityPercent}
                      onChange={(e) => setActivityPercent(e.target.value)}
                      placeholder="% complete"
                      className={inputClass}
                    />
                  )}
                  <div className="col-span-full flex gap-2">
                    <button type="submit" className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-brand-dim">
                      {activityEditingId ? "Save" : "Add"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowActivityForm(false)}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              {activities?.length === 0 && <p className="text-sm text-zinc-400">No schedule activities yet.</p>}
              {activities && activities.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-zinc-100">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                        <th className="px-4 py-2">Activity</th>
                        <th className="px-4 py-2">Planned</th>
                        <th className="px-4 py-2">% complete</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {activities.map((activity) => (
                        <tr key={activity.id} className="border-b border-zinc-50 last:border-0">
                          <td className="px-4 py-2 text-zinc-800">{activity.name}</td>
                          <td className="px-4 py-2 text-zinc-600">
                            {activity.planned_start ? new Date(activity.planned_start).toLocaleDateString() : "—"}
                            {" → "}
                            {activity.planned_end ? new Date(activity.planned_end).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-2 text-zinc-600">{activity.percent_complete}%</td>
                          <td className="px-4 py-2 text-right">
                            <PermissionGate permission="tenancy.project.manage">
                              <button onClick={() => startActivityEdit(activity)} className="text-xs text-zinc-400 hover:text-brand-dim">
                                Edit
                              </button>
                            </PermissionGate>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
