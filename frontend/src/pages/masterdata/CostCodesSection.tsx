import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { apiFetch, ApiError } from "../../lib/api";
import { PermissionGate } from "../../components/PermissionGate";

type CostCodeCategory = "labour" | "material" | "plant" | "subcontract" | "overhead";

const CATEGORIES: CostCodeCategory[] = ["labour", "material", "plant", "subcontract", "overhead"];

interface CostCode {
  id: string;
  parent_id: string | null;
  code: string;
  description: string | null;
  category: CostCodeCategory;
  is_active: boolean;
}

interface FormState {
  parent_id: string;
  code: string;
  description: string;
  category: CostCodeCategory;
}

const EMPTY_FORM: FormState = { parent_id: "", code: "", description: "", category: "material" };

function buildTree(items: CostCode[]): Array<{ item: CostCode; depth: number }> {
  const byParent = new Map<string | null, CostCode[]>();
  for (const item of items) {
    const key = item.parent_id;
    byParent.set(key, [...(byParent.get(key) ?? []), item]);
  }
  const rows: Array<{ item: CostCode; depth: number }> = [];
  function walk(parentId: string | null, depth: number) {
    for (const item of byParent.get(parentId) ?? []) {
      rows.push({ item, depth });
      walk(item.id, depth + 1);
    }
  }
  walk(null, 0);
  return rows;
}

export function CostCodesSection() {
  const { session } = useAuth();
  const [items, setItems] = useState<CostCode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const [newForm, setNewForm] = useState<FormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    apiFetch<{ costCodes: CostCode[] }>("/master-data/cost-codes", session.access_token)
      .then((data) => setItems(data.costCodes))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }, [session]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!session || !newForm.code.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const { costCode } = await apiFetch<{ costCode: CostCode }>("/master-data/cost-codes", session.access_token, {
        method: "POST",
        body: JSON.stringify({
          parent_id: newForm.parent_id || null,
          code: newForm.code.trim(),
          description: newForm.description.trim() || null,
          category: newForm.category,
        }),
      });
      setItems((prev) => [...(prev ?? []), costCode]);
      setNewForm({ ...EMPTY_FORM, parent_id: newForm.parent_id });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create cost code");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(item: CostCode) {
    setEditingId(item.id);
    setEditForm({
      parent_id: item.parent_id ?? "",
      code: item.code,
      description: item.description ?? "",
      category: item.category,
    });
    setError(null);
  }

  async function handleSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!session || !editingId) return;
    setSaving(true);
    setError(null);
    try {
      const { costCode } = await apiFetch<{ costCode: CostCode }>(
        `/master-data/cost-codes/${editingId}`,
        session.access_token,
        {
          method: "PATCH",
          body: JSON.stringify({
            parent_id: editForm.parent_id || null,
            code: editForm.code.trim(),
            description: editForm.description.trim() || null,
            category: editForm.category,
          }),
        },
      );
      setItems((prev) => prev?.map((i) => (i.id === costCode.id ? costCode : i)) ?? prev);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(item: CostCode) {
    if (!session) return;
    setError(null);
    try {
      const { costCode } = await apiFetch<{ costCode: CostCode }>(
        `/master-data/cost-codes/${item.id}/archive`,
        session.access_token,
        { method: "POST" },
      );
      setItems((prev) => prev?.map((i) => (i.id === costCode.id ? costCode : i)) ?? prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not archive this cost code");
    }
  }

  async function handleRestore(item: CostCode) {
    if (!session) return;
    setError(null);
    try {
      const { costCode } = await apiFetch<{ costCode: CostCode }>(
        `/master-data/cost-codes/${item.id}`,
        session.access_token,
        { method: "PATCH", body: JSON.stringify({ is_active: true }) },
      );
      setItems((prev) => prev?.map((i) => (i.id === costCode.id ? costCode : i)) ?? prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not restore this cost code");
    }
  }

  const allItems = items ?? [];
  const visibleRows = buildTree(allItems).filter((row) => showArchived || row.item.is_active);

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="font-brand text-base font-semibold text-zinc-900">Cost Codes</h2>
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Show archived
          </label>
        </div>
        <div className="p-6">
          {items === null && <p className="text-sm text-zinc-400">Loading…</p>}
          {items !== null && visibleRows.length === 0 && <p className="text-sm text-zinc-400">No cost codes yet.</p>}
          {visibleRows.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  <th className="py-2">Code</th>
                  <th className="py-2">Description</th>
                  <th className="py-2">Category</th>
                  <th className="py-2">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(({ item, depth }) => (
                  <tr key={item.id} className="border-t border-zinc-100">
                    {editingId === item.id ? (
                      <td colSpan={5} className="py-3">
                        <form onSubmit={handleSaveEdit} className="flex flex-wrap items-end gap-2">
                          <input
                            value={editForm.code}
                            onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                            className="w-28 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                          />
                          <input
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            placeholder="Description"
                            className="flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                          />
                          <select
                            value={editForm.category}
                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value as CostCodeCategory })}
                            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                          >
                            {CATEGORIES.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                          <select
                            value={editForm.parent_id}
                            onChange={(e) => setEditForm({ ...editForm, parent_id: e.target.value })}
                            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                          >
                            <option value="">No parent (top level)</option>
                            {allItems
                              .filter((candidate) => candidate.id !== item.id)
                              .map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                  {candidate.code}
                                </option>
                              ))}
                          </select>
                          <button
                            type="submit"
                            disabled={saving}
                            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
                          >
                            Cancel
                          </button>
                        </form>
                      </td>
                    ) : (
                      <>
                        <td className="py-3 font-medium text-zinc-800" style={{ paddingLeft: `${depth * 20}px` }}>
                          {depth > 0 && <span className="mr-1 text-zinc-300">↳</span>}
                          {item.code}
                        </td>
                        <td className="py-3 text-zinc-600">{item.description ?? "—"}</td>
                        <td className="py-3 text-zinc-600 capitalize">{item.category}</td>
                        <td className="py-3">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              item.is_active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                            }`}
                          >
                            {item.is_active ? "Active" : "Archived"}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <PermissionGate permission="master-data.manage">
                            <div className="flex justify-end gap-3">
                              <button
                                type="button"
                                onClick={() => setNewForm({ ...EMPTY_FORM, parent_id: item.id })}
                                className="text-zinc-600 underline-offset-2 hover:text-brand-dim hover:underline"
                              >
                                Add child
                              </button>
                              <button
                                type="button"
                                onClick={() => startEdit(item)}
                                className="text-zinc-600 underline-offset-2 hover:text-brand-dim hover:underline"
                              >
                                Edit
                              </button>
                              {item.is_active ? (
                                <button
                                  type="button"
                                  onClick={() => handleArchive(item)}
                                  className="text-zinc-600 underline-offset-2 hover:text-red-600 hover:underline"
                                >
                                  Archive
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleRestore(item)}
                                  className="text-zinc-600 underline-offset-2 hover:text-brand-dim hover:underline"
                                >
                                  Restore
                                </button>
                              )}
                            </div>
                          </PermissionGate>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <PermissionGate permission="master-data.manage">
        <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-6 py-4">
            <h2 className="font-brand text-base font-semibold text-zinc-900">
              {newForm.parent_id ? "Add child cost code" : "Add cost code"}
            </h2>
          </div>
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 p-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Parent</label>
              <select
                value={newForm.parent_id}
                onChange={(e) => setNewForm({ ...newForm, parent_id: e.target.value })}
                className="mt-1.5 block w-40 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value="">No parent (top level)</option>
                {allItems.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Code</label>
              <input
                value={newForm.code}
                onChange={(e) => setNewForm({ ...newForm, code: e.target.value })}
                className="mt-1.5 block w-32 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Description</label>
              <input
                value={newForm.description}
                onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
                placeholder="Optional"
                className="mt-1.5 block w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Category</label>
              <select
                value={newForm.category}
                onChange={(e) => setNewForm({ ...newForm, category: e.target.value as CostCodeCategory })}
                className="mt-1.5 block w-36 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={creating || !newForm.code.trim()}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim disabled:opacity-50"
            >
              {creating ? "Adding…" : "Add"}
            </button>
            {newForm.parent_id && (
              <button
                type="button"
                onClick={() => setNewForm(EMPTY_FORM)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                Clear parent
              </button>
            )}
          </form>
        </div>
      </PermissionGate>
    </div>
  );
}
