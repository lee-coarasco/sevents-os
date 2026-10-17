import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { apiFetch, ApiError } from "../../lib/api";
import { PermissionGate } from "../../components/PermissionGate";

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
  is_base_currency: boolean;
  exchange_rate_to_base: number;
  effective_date: string | null;
  is_active: boolean;
}

interface FormState {
  code: string;
  name: string;
  symbol: string;
  is_base_currency: boolean;
  exchange_rate_to_base: string;
  effective_date: string;
}

const EMPTY_FORM: FormState = {
  code: "",
  name: "",
  symbol: "",
  is_base_currency: false,
  exchange_rate_to_base: "1",
  effective_date: "",
};

function toForm(item: Currency): FormState {
  return {
    code: item.code,
    name: item.name,
    symbol: item.symbol ?? "",
    is_base_currency: item.is_base_currency,
    exchange_rate_to_base: String(item.exchange_rate_to_base),
    effective_date: item.effective_date ?? "",
  };
}

export function CurrenciesSection() {
  const { session } = useAuth();
  const [items, setItems] = useState<Currency[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const [newForm, setNewForm] = useState<FormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    apiFetch<{ currencies: Currency[] }>("/master-data/currencies", session.access_token)
      .then((data) => setItems(data.currencies))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }, [session]);

  function buildBody(form: FormState) {
    return {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      symbol: form.symbol.trim() || null,
      is_base_currency: form.is_base_currency,
      exchange_rate_to_base: Number(form.exchange_rate_to_base) || 1,
      effective_date: form.effective_date || null,
    };
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!session || !newForm.code.trim() || !newForm.name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const { currency } = await apiFetch<{ currency: Currency }>("/master-data/currencies", session.access_token, {
        method: "POST",
        body: JSON.stringify(buildBody(newForm)),
      });
      setItems((prev) => {
        const next = currency.is_base_currency ? (prev ?? []).map((i) => ({ ...i, is_base_currency: false })) : prev ?? [];
        return [...next, currency];
      });
      setNewForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create currency");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(item: Currency) {
    setEditingId(item.id);
    setEditForm(toForm(item));
    setError(null);
  }

  async function handleSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!session || !editingId) return;
    setSaving(true);
    setError(null);
    try {
      const { currency } = await apiFetch<{ currency: Currency }>(
        `/master-data/currencies/${editingId}`,
        session.access_token,
        { method: "PATCH", body: JSON.stringify(buildBody(editForm)) },
      );
      setItems(
        (prev) =>
          prev?.map((i) =>
            i.id === currency.id ? currency : currency.is_base_currency ? { ...i, is_base_currency: false } : i,
          ) ?? prev,
      );
      setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(item: Currency) {
    if (!session) return;
    setError(null);
    try {
      const { currency } = await apiFetch<{ currency: Currency }>(
        `/master-data/currencies/${item.id}/archive`,
        session.access_token,
        { method: "POST" },
      );
      setItems((prev) => prev?.map((i) => (i.id === currency.id ? currency : i)) ?? prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not archive this currency");
    }
  }

  async function handleRestore(item: Currency) {
    if (!session) return;
    setError(null);
    try {
      const { currency } = await apiFetch<{ currency: Currency }>(
        `/master-data/currencies/${item.id}`,
        session.access_token,
        { method: "PATCH", body: JSON.stringify({ is_active: true }) },
      );
      setItems((prev) => prev?.map((i) => (i.id === currency.id ? currency : i)) ?? prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not restore this currency");
    }
  }

  const visible = (items ?? []).filter((i) => showArchived || i.is_active);

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="font-brand text-base font-semibold text-zinc-900">Currencies</h2>
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Show archived
          </label>
        </div>
        <div className="p-6">
          {items === null && <p className="text-sm text-zinc-400">Loading…</p>}
          {items !== null && visible.length === 0 && <p className="text-sm text-zinc-400">No currencies yet.</p>}
          {visible.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  <th className="py-2">Code</th>
                  <th className="py-2">Name</th>
                  <th className="py-2">Rate to base</th>
                  <th className="py-2">Base?</th>
                  <th className="py-2">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id} className="border-t border-zinc-100">
                    {editingId === item.id ? (
                      <td colSpan={6} className="py-3">
                        <form onSubmit={handleSaveEdit} className="flex flex-wrap items-end gap-2">
                          <input
                            value={editForm.code}
                            onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                            className="w-20 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                          />
                          <input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                          />
                          <input
                            value={editForm.symbol}
                            onChange={(e) => setEditForm({ ...editForm, symbol: e.target.value })}
                            placeholder="Symbol"
                            className="w-16 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                          />
                          <input
                            value={editForm.exchange_rate_to_base}
                            onChange={(e) => setEditForm({ ...editForm, exchange_rate_to_base: e.target.value })}
                            placeholder="Rate"
                            className="w-24 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                          />
                          <label className="flex items-center gap-1.5 text-xs text-zinc-600">
                            <input
                              type="checkbox"
                              checked={editForm.is_base_currency}
                              onChange={(e) => setEditForm({ ...editForm, is_base_currency: e.target.checked })}
                            />
                            Base currency
                          </label>
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
                        <td className="py-3 font-medium text-zinc-800">
                          {item.code}
                          {item.symbol ? ` (${item.symbol})` : ""}
                        </td>
                        <td className="py-3 text-zinc-600">{item.name}</td>
                        <td className="py-3 text-zinc-600">{item.exchange_rate_to_base}</td>
                        <td className="py-3">
                          {item.is_base_currency && (
                            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-dim">
                              Base
                            </span>
                          )}
                        </td>
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
            <h2 className="font-brand text-base font-semibold text-zinc-900">Add currency</h2>
          </div>
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 p-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Code</label>
              <input
                value={newForm.code}
                onChange={(e) => setNewForm({ ...newForm, code: e.target.value })}
                placeholder="AED"
                className="mt-1.5 block w-20 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Name</label>
              <input
                value={newForm.name}
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                placeholder="UAE Dirham"
                className="mt-1.5 block w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Symbol</label>
              <input
                value={newForm.symbol}
                onChange={(e) => setNewForm({ ...newForm, symbol: e.target.value })}
                placeholder="د.إ"
                className="mt-1.5 block w-20 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Rate to base</label>
              <input
                value={newForm.exchange_rate_to_base}
                onChange={(e) => setNewForm({ ...newForm, exchange_rate_to_base: e.target.value })}
                className="mt-1.5 block w-24 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <label className="flex items-center gap-2 pb-2.5 text-sm text-zinc-600">
              <input
                type="checkbox"
                checked={newForm.is_base_currency}
                onChange={(e) => setNewForm({ ...newForm, is_base_currency: e.target.checked })}
              />
              Set as base currency
            </label>
            <button
              type="submit"
              disabled={creating || !newForm.code.trim() || !newForm.name.trim()}
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
