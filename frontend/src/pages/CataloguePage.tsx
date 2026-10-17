import { useEffect, useRef, useState, type FormEvent } from "react";
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

interface WorkItemSummary {
  id: string;
  disposition: string;
  status: string;
  priority: string | null;
  risk_tier: string | null;
  phase_target: string | null;
  capability_key: string | null;
  workflow_template_id: string | null;
  current_version: number;
  work_item_name: string;
  description: string | null;
  who_is_responsible: string;
  source_department: string;
}

interface PublishedWorkflowDefinition {
  id: string;
  key: string;
  name: string;
  capability_key: string | null;
}

interface EditFormState {
  disposition: string;
  status: string;
  priority: string;
  risk_tier: string;
  phase_target: string;
  capability_key: string;
  workflow_template_id: string;
  changeNote: string;
}

function toEditForm(item: WorkItemSummary): EditFormState {
  return {
    disposition: item.disposition,
    status: item.status,
    priority: item.priority ?? "",
    risk_tier: item.risk_tier ?? "",
    phase_target: item.phase_target ?? "",
    capability_key: item.capability_key ?? "",
    workflow_template_id: item.workflow_template_id ?? "",
    changeNote: "",
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

  const [editingItem, setEditingItem] = useState<WorkItemSummary | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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

  // Reset to page 1 whenever filters change
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
            disposition: editForm.disposition,
            status: editForm.status,
            priority: editForm.priority.trim() || null,
            risk_tier: editForm.risk_tier.trim() || null,
            phase_target: editForm.phase_target.trim() || null,
            capability_key: editForm.capability_key.trim() || null,
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

  const slideOpen = editingItem !== null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-brand text-2xl font-bold text-zinc-900">Work-Item Catalogue</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Browse, search and reclassify the 1,308-row source catalogue that drives workflow configuration
        </p>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-end gap-3 border-b border-zinc-100 px-6 py-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item name or description…"
              className="mt-1.5 block w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="mt-1.5 block w-44 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="">All departments</option>
              {departments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Disposition</label>
            <select
              value={dispositionFilter}
              onChange={(e) => setDispositionFilter(e.target.value)}
              className="mt-1.5 block w-56 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="">All dispositions</option>
              {DISPOSITIONS.map((disposition) => (
                <option key={disposition} value={disposition}>
                  {disposition}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1.5 block w-40 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="">All statuses</option>
              {WORK_ITEM_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
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
                      <div className="font-medium text-zinc-800">{item.work_item_name}</div>
                      {item.description && <div className="mt-0.5 text-xs text-zinc-400">{item.description}</div>}
                    </td>
                    <td className="py-3 text-zinc-600">{item.source_department}</td>
                    <td className="py-3 text-zinc-600">{item.disposition}</td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          item.status === "retired"
                            ? "bg-zinc-100 text-zinc-500"
                            : item.status === "published"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-brand-soft text-brand-dim"
                        }`}
                      >
                        {item.status}
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

      {/* Slide-over edit panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-96 flex-col bg-white shadow-2xl transition-transform duration-300 ${
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
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Disposition</label>
                  <select
                    value={editForm.disposition}
                    onChange={(e) => setEditForm({ ...editForm, disposition: e.target.value })}
                    className="mt-1.5 block w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  >
                    {DISPOSITIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="mt-1.5 block w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  >
                    {WORK_ITEM_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Priority</label>
                  <input
                    value={editForm.priority}
                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                    className="mt-1.5 block w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Risk tier</label>
                  <input
                    value={editForm.risk_tier}
                    onChange={(e) => setEditForm({ ...editForm, risk_tier: e.target.value })}
                    className="mt-1.5 block w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Phase target</label>
                  <input
                    value={editForm.phase_target}
                    onChange={(e) => setEditForm({ ...editForm, phase_target: e.target.value })}
                    className="mt-1.5 block w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Capability key</label>
                  <input
                    value={editForm.capability_key}
                    onChange={(e) => setEditForm({ ...editForm, capability_key: e.target.value })}
                    className="mt-1.5 block w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Workflow template</label>
                  <select
                    value={editForm.workflow_template_id}
                    onChange={(e) => setEditForm({ ...editForm, workflow_template_id: e.target.value })}
                    className="mt-1.5 block w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  >
                    <option value="">No workflow linked</option>
                    {publishedWorkflows.map((wf) => (
                      <option key={wf.id} value={wf.id}>
                        {wf.name} ({wf.key})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Change note (optional)
                  </label>
                  <input
                    value={editForm.changeNote}
                    onChange={(e) => setEditForm({ ...editForm, changeNote: e.target.value })}
                    placeholder="Why is this changing?"
                    className="mt-1.5 block w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                </div>
              </div>

              {error && <div className="mx-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

              <div className="flex gap-3 border-t border-zinc-100 p-6">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {/* Backdrop */}
      {slideOpen && (
        <div
          className="fixed inset-0 z-40 bg-zinc-900/20"
          onClick={cancelEdit}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
