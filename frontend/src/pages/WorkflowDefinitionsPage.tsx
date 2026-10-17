import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { PermissionGate } from "../components/PermissionGate";
import { StatusBadge } from "../components/StatusBadge";

export type DefinitionStatus = "draft" | "under_review" | "approved" | "published" | "retired";

export interface WorkflowDefinition {
  id: string;
  key: string;
  name: string;
  description: string | null;
  capability_key: string | null;
  status: DefinitionStatus;
  current_version: number | null;
  created_by: string | null;
  updated_by: string | null;
}

const inputClass =
  "rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

export function WorkflowDefinitionsPage() {
  const { session } = useAuth();
  const [definitions, setDefinitions] = useState<WorkflowDefinition[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<DefinitionStatus | "">("");
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    if (!session) return;
    const query = statusFilter ? `?status=${statusFilter}` : "";
    apiFetch<{ definitions: WorkflowDefinition[] }>(`/workflow/definitions${query}`, session.access_token)
      .then((data) => setDefinitions(data.definitions))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }

  useEffect(load, [session, statusFilter]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!session || !key.trim() || !name.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch("/workflow/definitions", session.access_token, {
        method: "POST",
        body: JSON.stringify({ key: key.trim(), name: name.trim(), description: description.trim() || null }),
      });
      setShowForm(false);
      setKey("");
      setName("");
      setDescription("");
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not create the definition");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-brand text-2xl font-bold text-zinc-900">Configuration Studio</h1>
          <p className="mt-1 text-sm text-zinc-400">Workflow definitions that drive task, approval and escalation behaviour</p>
        </div>
        <PermissionGate permission="workflow.definition.manage">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim"
          >
            New Definition
          </button>
        </PermissionGate>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
          {formError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Key (e.g. material_request)" className={inputClass} />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={inputClass} />
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className={inputClass} />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !key.trim() || !name.trim()}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-zinc-100 px-6 py-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as DefinitionStatus | "")} className={inputClass}>
            <option value="">All</option>
            {(["draft", "under_review", "approved", "published", "retired"] as DefinitionStatus[]).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="p-6">
          {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {!error && definitions === null && <p className="text-sm text-zinc-400">Loading…</p>}
          {definitions?.length === 0 && <p className="text-sm text-zinc-400">No workflow definitions yet.</p>}
          {definitions && definitions.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Key</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Published version</th>
                </tr>
              </thead>
              <tbody>
                {definitions.map((def) => (
                  <tr key={def.id} className="border-b border-zinc-50 last:border-0 hover:bg-stone-50">
                    <td className="px-2 py-3">
                      <Link to={`/config-studio/${def.id}`} className="font-medium text-zinc-800 hover:text-brand-dim">
                        {def.name}
                      </Link>
                    </td>
                    <td className="px-2 py-3 font-mono text-xs text-zinc-500">{def.key}</td>
                    <td className="px-2 py-3">
                      <StatusBadge status={def.status} />
                    </td>
                    <td className="px-2 py-3 text-zinc-600">{def.current_version ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
