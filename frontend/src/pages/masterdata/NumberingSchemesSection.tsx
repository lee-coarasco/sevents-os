import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { apiFetch, ApiError } from "../../lib/api";
import { PermissionGate } from "../../components/PermissionGate";

interface NumberingScheme {
  id: string;
  entity_type: string;
  prefix: string;
  suffix: string;
  next_sequence: number;
  padding: number;
  is_active: boolean;
}

interface FormState {
  entity_type: string;
  prefix: string;
  suffix: string;
  padding: string;
}

const EMPTY_FORM: FormState = { entity_type: "", prefix: "", suffix: "", padding: "4" };

export function NumberingSchemesSection() {
  const { session } = useAuth();
  const [items, setItems] = useState<NumberingScheme[] | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const [newForm, setNewForm] = useState<FormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    apiFetch<{ numberingSchemes: NumberingScheme[] }>("/master-data/numbering-schemes", session.access_token)
      .then((data) => setItems(data.numberingSchemes))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }, [session]);

  useEffect(() => {
    if (!session || !items) return;
    items.forEach((item) => {
      apiFetch<{ formatted: string }>(`/master-data/numbering-schemes/${item.id}/preview`, session.access_token)
        .then((data) => setPreviews((prev) => ({ ...prev, [item.id]: data.formatted })))
        .catch(() => undefined);
    });
  }, [session, items]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!session || !newForm.entity_type.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const { numberingScheme } = await apiFetch<{ numberingScheme: NumberingScheme }>(
        "/master-data/numbering-schemes",
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            entity_type: newForm.entity_type.trim(),
            prefix: newForm.prefix.trim() || null,
            suffix: newForm.suffix.trim() || null,
            padding: Number(newForm.padding) || 4,
          }),
        },
      );
      setItems((prev) => [...(prev ?? []), numberingScheme]);
      setNewForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create numbering scheme");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(item: NumberingScheme) {
    setEditingId(item.id);
    setEditForm({ entity_type: item.entity_type, prefix: item.prefix, suffix: item.suffix, padding: String(item.padding) });
    setError(null);
  }

  async function handleSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!session || !editingId) return;
    setSaving(true);
    setError(null);
    try {
      const { numberingScheme } = await apiFetch<{ numberingScheme: NumberingScheme }>(
        `/master-data/numbering-schemes/${editingId}`,
        session.access_token,
        {
          method: "PATCH",
          body: JSON.stringify({
            prefix: editForm.prefix.trim(),
            suffix: editForm.suffix.trim(),
            padding: Number(editForm.padding) || 4,
          }),
        },
      );
      setItems((prev) => prev?.map((i) => (i.id === numberingScheme.id ? numberingScheme : i)) ?? prev);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  async function setActive(item: NumberingScheme, is_active: boolean) {
    if (!session) return;
    setError(null);
    try {
      const { numberingScheme } = await apiFetch<{ numberingScheme: NumberingScheme }>(
        `/master-data/numbering-schemes/${item.id}`,
        session.access_token,
        { method: "PATCH", body: JSON.stringify({ is_active }) },
      );
      setItems((prev) => prev?.map((i) => (i.id === numberingScheme.id ? numberingScheme : i)) ?? prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : is_active ? "Could not restore this scheme" : "Could not archive this scheme");
    }
  }

  const visible = (items ?? []).filter((i) => showArchived || i.is_active);

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="font-brand text-base font-semibold text-zinc-900">Numbering Schemes</h2>
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Show archived
          </label>
        </div>
        <div className="p-6">
          {items === null && <p className="text-sm text-zinc-400">Loading…</p>}
          {items !== null && visible.length === 0 && <p className="text-sm text-zinc-400">No numbering schemes yet.</p>}
          {visible.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  <th className="py-2">Entity type</th>
                  <th className="py-2">Pattern</th>
                  <th className="py-2">Next number</th>
                  <th className="py-2">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id} className="border-t border-zinc-100">
                    {editingId === item.id ? (
                      <td colSpan={5} className="py-3">
                        <form onSubmit={handleSaveEdit} className="flex flex-wrap items-end gap-2">
                          <span className="rounded-lg bg-stone-50 px-3 py-1.5 text-sm text-zinc-500">
                            {editForm.entity_type}
                          </span>
                          <input
                            value={editForm.prefix}
                            onChange={(e) => setEditForm({ ...editForm, prefix: e.target.value })}
                            placeholder="Prefix"
                            className="w-24 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                          />
                          <input
                            value={editForm.suffix}
                            onChange={(e) => setEditForm({ ...editForm, suffix: e.target.value })}
                            placeholder="Suffix"
                            className="w-24 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                          />
                          <input
                            value={editForm.padding}
                            onChange={(e) => setEditForm({ ...editForm, padding: e.target.value })}
                            placeholder="Padding digits"
                            className="w-28 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                          />
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
                        <td className="py-3 font-medium text-zinc-800">{item.entity_type}</td>
                        <td className="py-3 text-zinc-600">
                          {item.prefix}
                          {"#".repeat(item.padding)}
                          {item.suffix}
                        </td>
                        <td className="py-3 text-zinc-600">{previews[item.id] ?? "…"}</td>
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
                                onClick={() => startEdit(item)}
                                className="text-zinc-600 underline-offset-2 hover:text-brand-dim hover:underline"
                              >
                                Edit
                              </button>
                              {item.is_active ? (
                                <button
                                  type="button"
                                  onClick={() => setActive(item, false)}
                                  className="text-zinc-600 underline-offset-2 hover:text-red-600 hover:underline"
                                >
                                  Archive
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setActive(item, true)}
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
            <h2 className="font-brand text-base font-semibold text-zinc-900">Add numbering scheme</h2>
          </div>
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 p-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Entity type</label>
              <input
                value={newForm.entity_type}
                onChange={(e) => setNewForm({ ...newForm, entity_type: e.target.value })}
                placeholder="e.g. project, document, po, invoice"
                className="mt-1.5 block w-48 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Prefix</label>
              <input
                value={newForm.prefix}
                onChange={(e) => setNewForm({ ...newForm, prefix: e.target.value })}
                placeholder="PO-"
                className="mt-1.5 block w-24 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Suffix</label>
              <input
                value={newForm.suffix}
                onChange={(e) => setNewForm({ ...newForm, suffix: e.target.value })}
                className="mt-1.5 block w-24 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Padding digits</label>
              <input
                value={newForm.padding}
                onChange={(e) => setNewForm({ ...newForm, padding: e.target.value })}
                className="mt-1.5 block w-28 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <button
              type="submit"
              disabled={creating || !newForm.entity_type.trim()}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim disabled:opacity-50"
            >
              {creating ? "Adding…" : "Add"}
            </button>
          </form>
        </div>
      </PermissionGate>
    </div>
  );
}
