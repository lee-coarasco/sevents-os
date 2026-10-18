import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { Pagination } from "../components/Pagination";
import { PermissionGate } from "../components/PermissionGate";

const DISPOSITIONS = [
  "Configure workflow",
  "Configure approval/decision",
  "Track obligation/document",
  "Periodic review/monitor",
  "Reference/policy only",
  "Clarify/de-duplicate",
  "Defer",
] as const;

const WORK_ITEM_STATUSES = ["draft", "under_review", "approved", "published", "retired"] as const;

const PRIORITIES = ["High", "Medium", "Low"] as const;
const RISK_TIERS = ["Critical", "High", "Medium", "Low"] as const;
const PHASE_TARGETS = [
  "Phase 1 – Day 1",
  "Phase 2 – Q1",
  "Phase 3 – Q2",
  "Phase 4 – Q3",
  "Defer",
] as const;
const CONFIG_STATUSES = ["unconfigured", "in_progress", "configured"] as const;

interface WorkItemSummary {
  id: string;
  disposition: string;
  status: string;
  priority: string | null;
  risk_tier: string | null;
  phase_target: string | null;
  capability_key: string | null;
  workflow_template_id: string | null;
  configuration_status: string;
  source_type?: string;
  current_version: number;
  work_item_name: string;
  description: string | null;
  who_is_responsible: string;
  source_department: string;
  canonical_role_id: string | null;
}

interface PublishedWorkflowDefinition {
  id: string;
  key: string;
  name: string;
  capability_key: string | null;
}

interface EditFormState {
  // source fields
  work_item_name: string;
  who_is_responsible: string;
  description: string;
  trigger_text: string;
  action_text: string;
  output_evidence: string;
  timing: string;
  // definition fields
  disposition: string;
  status: string;
  priority: string;
  risk_tier: string;
  phase_target: string;
  capability_key: string;
  configuration_status: string;
  workflow_template_id: string;
  changeNote: string;
}

interface CreateFormState {
  work_item_name: string;
  department: string;
  who_is_responsible: string;
  description: string;
  disposition: string;
  priority: string;
  risk_tier: string;
  phase_target: string;
  canonical_role_id: string;
  trigger_text: string;
  action_text: string;
  output_evidence: string;
}

function toEditForm(item: WorkItemSummary): EditFormState {
  return {
    work_item_name: item.work_item_name,
    who_is_responsible: item.who_is_responsible,
    description: item.description ?? "",
    trigger_text: "",
    action_text: "",
    output_evidence: "",
    timing: "",
    disposition: item.disposition,
    status: item.status,
    priority: item.priority ?? "",
    risk_tier: item.risk_tier ?? "",
    phase_target: item.phase_target ?? "",
    capability_key: item.capability_key ?? "",
    configuration_status: item.configuration_status ?? "unconfigured",
    workflow_template_id: item.workflow_template_id ?? "",
    changeNote: "",
  };
}

function emptyCreate(): CreateFormState {
  return {
    work_item_name: "",
    department: "",
    who_is_responsible: "",
    description: "",
    disposition: "Configure workflow",
    priority: "",
    risk_tier: "",
    phase_target: "",
    canonical_role_id: "",
    trigger_text: "",
    action_text: "",
    output_evidence: "",
  };
}

const PAGE_SIZE = 50;

export function CataloguePage() {
  const { session } = useAuth();

  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [dispositionFilter, setDispositionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const [items, setItems] = useState<WorkItemSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<string[]>([]);
  const [publishedWorkflows, setPublishedWorkflows] = useState<PublishedWorkflowDefinition[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Edit slide-over
  const [editingItem, setEditingItem] = useState<WorkItemSummary | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(emptyCreate());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    apiFetch<{ definitions: PublishedWorkflowDefinition[] }>("/workflow/definitions/published", session.access_token)
      .then((data) => setPublishedWorkflows(data.definitions))
      .catch(() => setPublishedWorkflows([]));
  }, [session]);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    const handle = setTimeout(() => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (departmentFilter) params.set("department", departmentFilter);
      if (dispositionFilter) params.set("disposition", dispositionFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (!showArchived && !statusFilter) params.set("excludeRetired", "true");
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      apiFetch<{ items: WorkItemSummary[]; total: number; page: number; pageSize: number }>(
        `/catalogue/work-items?${params.toString()}`,
        session.access_token,
      )
        .then((data) => {
          setItems(data.items);
          setTotal(data.total);
          setLoading(false);
          setDepartments((prev) => {
            const seen = new Set(prev);
            const next = [...prev];
            for (const item of data.items) {
              if (!seen.has(item.source_department)) {
                seen.add(item.source_department);
                next.push(item.source_department);
              }
            }
            return next.sort();
          });
        })
        .catch((err) => {
          setError(err instanceof ApiError ? err.message : "Could not reach the API");
          setLoading(false);
        });
    }, 300);
    return () => clearTimeout(handle);
  }, [session, search, departmentFilter, dispositionFilter, statusFilter, showArchived, page]);

  useEffect(() => {
    setPage(1);
  }, [search, departmentFilter, dispositionFilter, statusFilter, showArchived]);

  function startEdit(item: WorkItemSummary) {
    setEditingItem(item);
    setEditForm(toEditForm(item));
    setError(null);
  }

  function cancelEdit() {
    setEditingItem(null);
    setEditForm(null);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!session || !editingItem || !editForm) return;
    setSaving(true);
    setError(null);
    try {
      const { workItem } = await apiFetch<{ workItem: WorkItemSummary }>(
        `/catalogue/work-items/${editingItem.id}`,
        session.access_token,
        {
          method: "PATCH",
          body: JSON.stringify({
            // source fields
            work_item_name: editForm.work_item_name.trim() || undefined,
            who_is_responsible: editForm.who_is_responsible.trim() || undefined,
            description: editForm.description.trim() || null,
            trigger_text: editForm.trigger_text.trim() || null,
            action_text: editForm.action_text.trim() || null,
            output_evidence: editForm.output_evidence.trim() || null,
            timing: editForm.timing.trim() || null,
            // definition fields
            disposition: editForm.disposition,
            status: editForm.status,
            priority: editForm.priority || null,
            risk_tier: editForm.risk_tier || null,
            phase_target: editForm.phase_target || null,
            capability_key: editForm.capability_key.trim() || null,
            configuration_status: editForm.configuration_status,
            workflow_template_id: editForm.workflow_template_id || null,
            changeNote: editForm.changeNote.trim() || null,
          }),
        },
      );
      setItems((prev) => prev.map((i) => (i.id === workItem.id ? { ...i, ...workItem } : i)));
      cancelEdit();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this item");
    } finally {
      setSaving(false);
    }
  }

  async function handleRetire(item: WorkItemSummary) {
    if (!session) return;
    setError(null);
    try {
      const { workItem } = await apiFetch<{ workItem: WorkItemSummary }>(
        `/catalogue/work-items/${item.id}`,
        session.access_token,
        { method: "PATCH", body: JSON.stringify({ status: "retired" }) },
      );
      setItems((prev) => prev.map((i) => (i.id === workItem.id ? { ...i, ...workItem } : i)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not retire this item");
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    setCreating(true);
    setCreateError(null);
    try {
      await apiFetch<{ workItem: WorkItemSummary }>(
        "/catalogue/work-items",
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            work_item_name: createForm.work_item_name.trim(),
            department: createForm.department.trim(),
            who_is_responsible: createForm.who_is_responsible.trim(),
            description: createForm.description.trim() || null,
            disposition: createForm.disposition,
            priority: createForm.priority || null,
            risk_tier: createForm.risk_tier || null,
            phase_target: createForm.phase_target || null,
            canonical_role_id: createForm.canonical_role_id.trim() || null,
            trigger_text: createForm.trigger_text.trim() || null,
            action_text: createForm.action_text.trim() || null,
            output_evidence: createForm.output_evidence.trim() || null,
          }),
        },
      );
      setShowCreate(false);
      setCreateForm(emptyCreate());
      // Reload by bumping the page state to trigger the effect
      setPage(1);
      setSearch((s) => s);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Could not create work item");
    } finally {
      setCreating(false);
    }
  }

  const slideOpen = editingItem !== null;

  const inputCls = "mt-1.5 block w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";
  const labelCls = "block text-xs font-semibold uppercase tracking-wide text-zinc-400";

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-brand text-2xl font-bold text-zinc-900">Work-Item Catalogue</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Browse, classify and configure the work items that drive your workflows
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/catalogue/guide"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 hover:bg-zinc-50"
          >
            ? Guide
          </Link>
          <PermissionGate permission="catalogue.workitem.manage">
            <button
              type="button"
              onClick={() => { setShowCreate(true); setCreateError(null); setCreateForm(emptyCreate()); }}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-brand-dim"
            >
              + New Work Item
            </button>
          </PermissionGate>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-end gap-3 border-b border-zinc-100 px-6 py-4">
          <div className="flex-1">
            <label className={labelCls}>Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item name or description…"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Department</label>
            <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="mt-1.5 block w-44 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20">
              <option value="">All departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Disposition</label>
            <select value={dispositionFilter} onChange={(e) => setDispositionFilter(e.target.value)} className="mt-1.5 block w-56 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20">
              <option value="">All dispositions</option>
              {DISPOSITIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="mt-1.5 block w-40 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20">
              <option value="">All statuses</option>
              {WORK_ITEM_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-zinc-600">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Show retired
          </label>
        </div>

        <div className="p-6">
          {loading && <p className="text-sm text-zinc-400">Loading…</p>}
          {!loading && items.length === 0 && (
            <p className="text-sm text-zinc-400">No catalogue items match this filter.</p>
          )}

          {!loading && items.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  <th className="py-2">Item</th>
                  <th className="py-2">Department</th>
                  <th className="py-2">Disposition</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Config</th>
                  <th className="py-2">Risk</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-t border-zinc-100 align-top ${editingItem?.id === item.id ? "bg-brand-soft" : ""}`}
                  >
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-zinc-800">{item.work_item_name}</span>
                        {item.source_type === "manual" && (
                          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-amber-700">Manual</span>
                        )}
                        {item.workflow_template_id && (
                          <Link
                            to={`/config-studio/definitions/${item.workflow_template_id}`}
                            className="text-xs text-zinc-400 hover:text-brand-dim"
                            onClick={(e) => e.stopPropagation()}
                          >
                            → Workflow
                          </Link>
                        )}
                      </div>
                      {item.description && <div className="mt-0.5 text-xs text-zinc-400 line-clamp-1">{item.description}</div>}
                    </td>
                    <td className="py-3 text-zinc-600">{item.source_department}</td>
                    <td className="py-3 text-zinc-600">{item.disposition}</td>
                    <td className="py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        item.status === "retired" ? "bg-zinc-100 text-zinc-500"
                        : item.status === "published" ? "bg-emerald-50 text-emerald-700"
                        : "bg-brand-soft text-amber-700"
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.configuration_status === "configured" ? "bg-emerald-50 text-emerald-700"
                        : item.configuration_status === "in_progress" ? "bg-amber-50 text-amber-700"
                        : "bg-zinc-100 text-zinc-500"
                      }`}>
                        {item.configuration_status ?? "unconfigured"}
                      </span>
                    </td>
                    <td className="py-3 text-zinc-600">{item.risk_tier ?? "—"}</td>
                    <td className="py-3 text-right">
                      <PermissionGate permission="catalogue.workitem.manage">
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="text-zinc-600 underline-offset-2 hover:text-brand-dim hover:underline"
                          >
                            Edit
                          </button>
                          {item.status !== "retired" && (
                            <button
                              type="button"
                              onClick={() => handleRetire(item)}
                              className="text-zinc-600 underline-offset-2 hover:text-red-600 hover:underline"
                            >
                              Retire
                            </button>
                          )}
                        </div>
                      </PermissionGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>

      {/* Edit slide-over */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-[480px] flex-col bg-white shadow-2xl transition-transform duration-300 ${
          slideOpen ? "translate-x-0" : "translate-x-full"
        }`}
        ref={panelRef}
      >
        {editingItem && editForm && (
          <>
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <div>
                <h2 className="font-brand text-base font-semibold text-zinc-900">Edit catalogue item</h2>
                <p className="mt-0.5 text-xs text-zinc-400 line-clamp-1">{editingItem.work_item_name}</p>
              </div>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-1 flex-col overflow-y-auto">
              <div className="flex-1 space-y-4 p-6">
                {/* Source information */}
                <div className="rounded-xl bg-zinc-50 p-4 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Source information</p>
                  <div>
                    <label className={labelCls}>Work item name</label>
                    <input value={editForm.work_item_name} onChange={(e) => setEditForm({ ...editForm, work_item_name: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Who is responsible</label>
                    <input value={editForm.who_is_responsible} onChange={(e) => setEditForm({ ...editForm, who_is_responsible: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Description</label>
                    <textarea rows={2} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className={inputCls + " resize-none"} />
                  </div>
                  <div>
                    <label className={labelCls}>Trigger (when does this happen?)</label>
                    <textarea rows={2} value={editForm.trigger_text} onChange={(e) => setEditForm({ ...editForm, trigger_text: e.target.value })} className={inputCls + " resize-none"} placeholder="e.g. On receipt of purchase order" />
                  </div>
                  <div>
                    <label className={labelCls}>Action (what must be done?)</label>
                    <textarea rows={2} value={editForm.action_text} onChange={(e) => setEditForm({ ...editForm, action_text: e.target.value })} className={inputCls + " resize-none"} placeholder="e.g. Review documents and approve" />
                  </div>
                  <div>
                    <label className={labelCls}>Output / Evidence</label>
                    <textarea rows={2} value={editForm.output_evidence} onChange={(e) => setEditForm({ ...editForm, output_evidence: e.target.value })} className={inputCls + " resize-none"} placeholder="e.g. Signed approval form" />
                  </div>
                  <div>
                    <label className={labelCls}>Timing</label>
                    <input value={editForm.timing} onChange={(e) => setEditForm({ ...editForm, timing: e.target.value })} placeholder="e.g. Within 2 business days" className={inputCls} />
                  </div>
                </div>

                {/* Definition fields */}
                <div>
                  <label className={labelCls}>Disposition</label>
                  <select value={editForm.disposition} onChange={(e) => setEditForm({ ...editForm, disposition: e.target.value })} className={inputCls}>
                    {DISPOSITIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className={inputCls}>
                    {WORK_ITEM_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Priority</label>
                  <select value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })} className={inputCls}>
                    <option value="">Not set</option>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Risk tier</label>
                  <select value={editForm.risk_tier} onChange={(e) => setEditForm({ ...editForm, risk_tier: e.target.value })} className={inputCls}>
                    <option value="">Not set</option>
                    {RISK_TIERS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Phase target</label>
                  <select value={editForm.phase_target} onChange={(e) => setEditForm({ ...editForm, phase_target: e.target.value })} className={inputCls}>
                    <option value="">Not set</option>
                    {PHASE_TARGETS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Configuration status</label>
                  <select value={editForm.configuration_status} onChange={(e) => setEditForm({ ...editForm, configuration_status: e.target.value })} className={inputCls}>
                    {CONFIG_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Capability key</label>
                  <input value={editForm.capability_key} onChange={(e) => setEditForm({ ...editForm, capability_key: e.target.value })} placeholder="e.g. procurement.purchase_order" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Workflow template</label>
                  <select value={editForm.workflow_template_id} onChange={(e) => setEditForm({ ...editForm, workflow_template_id: e.target.value })} className={inputCls}>
                    <option value="">No workflow linked</option>
                    {publishedWorkflows.map((wf) => (
                      <option key={wf.id} value={wf.id}>{wf.name} ({wf.key})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Change note (optional)</label>
                  <input value={editForm.changeNote} onChange={(e) => setEditForm({ ...editForm, changeNote: e.target.value })} placeholder="Why is this changing?" className={inputCls} />
                </div>
              </div>

              {error && <div className="mx-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

              <div className="flex gap-3 border-t border-zinc-100 p-6">
                <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim disabled:opacity-50">
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button type="button" onClick={cancelEdit} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50">
                  Cancel
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <h2 className="font-brand text-base font-semibold text-zinc-900">New Work Item</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600" aria-label="Close">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="max-h-[70vh] overflow-y-auto">
              <div className="space-y-4 p-6">
                <div>
                  <label className={labelCls}>Work item name <span className="text-red-500">*</span></label>
                  <input required value={createForm.work_item_name} onChange={(e) => setCreateForm({ ...createForm, work_item_name: e.target.value })} placeholder="e.g. Review and approve purchase request" className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Department</label>
                    <input value={createForm.department} onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })} placeholder="e.g. Procurement" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Who is responsible</label>
                    <input value={createForm.who_is_responsible} onChange={(e) => setCreateForm({ ...createForm, who_is_responsible: e.target.value })} placeholder="e.g. Procurement Manager" className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Description</label>
                  <textarea rows={2} value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} className={inputCls + " resize-none"} />
                </div>
                <div>
                  <label className={labelCls}>Disposition <span className="text-red-500">*</span></label>
                  <select required value={createForm.disposition} onChange={(e) => setCreateForm({ ...createForm, disposition: e.target.value })} className={inputCls}>
                    {DISPOSITIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Priority</label>
                    <select value={createForm.priority} onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })} className={inputCls}>
                      <option value="">Not set</option>
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Risk tier</label>
                    <select value={createForm.risk_tier} onChange={(e) => setCreateForm({ ...createForm, risk_tier: e.target.value })} className={inputCls}>
                      <option value="">Not set</option>
                      {RISK_TIERS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Phase target</label>
                    <select value={createForm.phase_target} onChange={(e) => setCreateForm({ ...createForm, phase_target: e.target.value })} className={inputCls}>
                      <option value="">Not set</option>
                      {PHASE_TARGETS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Trigger (when does this happen?)</label>
                  <input value={createForm.trigger_text} onChange={(e) => setCreateForm({ ...createForm, trigger_text: e.target.value })} placeholder="e.g. On receipt of purchase request" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Action (what must be done?)</label>
                  <input value={createForm.action_text} onChange={(e) => setCreateForm({ ...createForm, action_text: e.target.value })} placeholder="e.g. Review against budget and approve" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Output / Evidence</label>
                  <input value={createForm.output_evidence} onChange={(e) => setCreateForm({ ...createForm, output_evidence: e.target.value })} placeholder="e.g. Approved purchase order" className={inputCls} />
                </div>
              </div>

              {createError && <div className="mx-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{createError}</div>}

              <div className="flex gap-3 border-t border-zinc-100 p-6">
                <button type="submit" disabled={creating} className="flex-1 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim disabled:opacity-50">
                  {creating ? "Creating…" : "Create work item"}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Backdrop for slide-over */}
      {slideOpen && (
        <div className="fixed inset-0 z-40 bg-zinc-900/20" onClick={cancelEdit} aria-hidden="true" />
      )}
    </div>
  );
}
