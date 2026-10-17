import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { apiFetch, ApiError } from "../../lib/api";
import { PermissionGate } from "../../components/PermissionGate";

interface Uom {
  id: string;
  code: string;
  description: string | null;
  is_active: boolean;
}

export function UomSection() {
  const { session } = useAuth();
  const [items, setItems] = useState<Uom[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const [newCode, setNewCode] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    apiFetch<{ uom: Uom[] }>("/master-data/uom", session.access_token)
      .then((data) => setItems(data.uom))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }, [session]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!session || !newCode.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const { uom } = await apiFetch<{ uom: Uom }>("/master-data/uom", session.access_token, {
        method: "POST",
        body: JSON.stringify({ code: newCode.trim(), description: newDescription.trim() || null }),
      });
      setItems((prev) => [...(prev ?? []), uom]);
      setNewCode("");
      setNewDescription("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create unit of measure");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(item: Uom) {
    setEditingId(item.id);
    setEditCode(item.code);
    setEditDescription(item.description ?? "");
    setError(null);
  }

  async function handleSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!session || !editingId) return;
    setSaving(true);
    setError(null);
    try {
      const { uom } = await apiFetch<{ uom: Uom }>(`/master-data/uom/${editingId}`, session.access_token, {
        method: "PATCH",
        body: JSON.stringify({ code: editCode.trim(), description: editDescription.trim() || null }),
      });
      setItems((prev) => prev?.map((i) => (i.id === uom.id ? uom : i)) ?? prev);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(item: Uom) {
    if (!session) return;
    setError(null);
    try {
      const { uom } = await apiFetch<{ uom: Uom }>(`/master-data/uom/${item.id}/archive`, session.access_token, {
        method: "POST",
      });
      setItems((prev) => prev?.map((i) => (i.id === uom.id ? uom : i)) ?? prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not archive this unit of measure");
    }
  }

  async function handleRestore(item: Uom) {
    if (!session) return;
    setError(null);
    try {
      const { uom } = await apiFetch<{ uom: Uom }>(`/master-data/uom/${item.id}`, session.access_token, {
        method: "PATCH",
        body: JSON.stringify({ is_active: true }),
      });
      setItems((prev) => prev?.map((i) => (i.id === uom.id ? uom : i)) ?? prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not restore this unit of measure");
    }
  }

  const visible = (items ?? []).filter((i) => showArchived || i.is_active);

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="font-brand text-base font-semibold text-zinc-900">Units of Measure</h2>
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Show archived
          </label>
        </div>
        <div className="p-6">
          {items === null && <p className="text-sm text-zinc-400">Loading…</p>}
          {items !== null && visible.length === 0 && <p className="text-sm text-zinc-400">No units of measure yet.</p>}
          {visible.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  <th className="py-2">Code</th>
                  <th className="py-2">Description</th>
                  <th className="py-2">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id} className="border-t border-zinc-100">
                    {editingId === item.id ? (
                      <td colSpan={4} className="py-3">
                        <form onSubmit={handleSaveEdit} className="flex flex-wrap items-end gap-2">
                          <input
                            value={editCode}
                            onChange={(e) => setEditCode(e.target.value)}
                            className="w-28 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                          />
                          <input
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            placeholder="Description"
                            className="flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
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
                        <td className="py-3 font-medium text-zinc-800">{item.code}</td>
                        <td className="py-3 text-zinc-600">{item.description ?? "—"}</td>
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
            <h2 className="font-brand text-base font-semibold text-zinc-900">Add unit of measure</h2>
          </div>
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 p-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Code</label>
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="e.g. m², kg, nr"
                className="mt-1.5 block w-32 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Description</label>
              <input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional"
                className="mt-1.5 block w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <button
              type="submit"
              disabled={creating || !newCode.trim()}
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
