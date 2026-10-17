import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { PermissionGate } from "../components/PermissionGate";
import { StatusBadge } from "../components/StatusBadge";
import type { DefinitionStatus, WorkflowDefinition } from "./WorkflowDefinitionsPage";

export type VersionStatus = "draft" | "published" | "retired";

export interface WorkflowVersion {
  id: string;
  version: number;
  status: VersionStatus;
  effective_from: string | null;
  effective_to: string | null;
  rollback_of_version: number | null;
  published_by: string | null;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
}

export function WorkflowDefinitionDetailPage() {
  const { definitionId } = useParams<{ definitionId: string }>();
  const { session } = useAuth();

  const [definition, setDefinition] = useState<WorkflowDefinition | null>(null);
  const [versions, setVersions] = useState<WorkflowVersion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<number | null>(null);
  const [rollbackReason, setRollbackReason] = useState("");

  function load() {
    if (!session || !definitionId) return;
    Promise.all([
      apiFetch<{ definition: WorkflowDefinition }>(`/workflow/definitions/${definitionId}`, session.access_token),
      apiFetch<{ versions: WorkflowVersion[] }>(`/workflow/definitions/${definitionId}/versions`, session.access_token),
    ])
      .then(([defData, versionData]) => {
        setDefinition(defData.definition);
        setVersions(versionData.versions);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }

  useEffect(load, [session, definitionId]);

  const publishedVersion = (versions ?? []).find((v) => v.version === definition?.current_version) ?? null;
  const sortedVersions = (versions ?? []).slice().sort((a, b) => b.version - a.version);

  async function handleNewVersion() {
    if (!session || !definitionId) return;
    setBusy(true);
    setActionError(null);
    try {
      await apiFetch(`/workflow/definitions/${definitionId}/versions`, session.access_token, {
        method: "POST",
        body: JSON.stringify(publishedVersion ? { copyFromVersionId: publishedVersion.id } : {}),
      });
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not create a new version");
    } finally {
      setBusy(false);
    }
  }

  async function handleRollback() {
    if (!session || !definitionId || rollbackTarget === null) return;
    setBusy(true);
    setActionError(null);
    try {
      await apiFetch(`/workflow/definitions/${definitionId}/rollback`, session.access_token, {
        method: "POST",
        body: JSON.stringify({ toVersion: rollbackTarget, reason: rollbackReason.trim() || null }),
      });
      setRollbackTarget(null);
      setRollbackReason("");
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not roll back");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/config-studio" className="text-sm text-zinc-400 hover:text-zinc-600">
          ← Back to Configuration Studio
        </Link>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!definition && !error && <p className="text-sm text-zinc-400">Loading…</p>}

      {definition && (
        <>
          <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-brand text-2xl font-bold text-zinc-900">{definition.name}</h1>
                <p className="mt-1 font-mono text-xs text-zinc-400">{definition.key}</p>
                {definition.description && <p className="mt-2 text-sm text-zinc-600">{definition.description}</p>}
              </div>
              <StatusBadge status={definition.status as DefinitionStatus} />
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <h2 className="font-brand text-base font-semibold text-zinc-900">Versions</h2>
              <PermissionGate permission="workflow.definition.manage">
                <button
                  onClick={handleNewVersion}
                  disabled={busy}
                  className="rounded-lg bg-brand px-3.5 py-1.5 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim disabled:opacity-50"
                >
                  New Version
                </button>
              </PermissionGate>
            </div>
            <div className="space-y-4 p-6">
              {actionError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}

              {rollbackTarget !== null && (
                <div className="space-y-2 rounded-xl bg-stone-50 p-4">
                  <p className="text-sm text-zinc-700">
                    This will become the active version for all new instances. Rolling back to version {rollbackTarget}.
                  </p>
                  <input
                    value={rollbackReason}
                    onChange={(e) => setRollbackReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleRollback}
                      disabled={busy}
                      className="rounded-lg bg-brand px-3.5 py-1.5 text-sm font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50"
                    >
                      {busy ? "Rolling back…" : "Confirm rollback"}
                    </button>
                    <button
                      onClick={() => setRollbackTarget(null)}
                      className="rounded-lg border border-zinc-200 px-3.5 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {sortedVersions.length === 0 && <p className="text-sm text-zinc-400">No versions yet.</p>}
              {sortedVersions.length > 0 && (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      <th className="px-2 py-2">Version</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Published at</th>
                      <th className="px-2 py-2">Rollback of</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedVersions.map((v) => (
                      <tr key={v.id} className="border-b border-zinc-50 last:border-0">
                        <td className="px-2 py-3">
                          <Link to={`/config-studio/${definitionId}/versions/${v.id}`} className="font-medium text-zinc-800 hover:text-brand-dim">
                            v{v.version}
                          </Link>
                        </td>
                        <td className="px-2 py-3">
                          <StatusBadge status={v.status} />
                        </td>
                        <td className="px-2 py-3 text-zinc-600">{v.published_at ? new Date(v.published_at).toLocaleString() : "—"}</td>
                        <td className="px-2 py-3 text-zinc-600">{v.rollback_of_version ?? "—"}</td>
                        <td className="px-2 py-3 text-right">
                          {v.status === "published" && (
                            <PermissionGate permission="workflow.definition.publish">
                              <button
                                onClick={() => setRollbackTarget(v.version)}
                                className="text-xs text-zinc-400 hover:text-brand-dim"
                              >
                                Rollback to this version
                              </button>
                            </PermissionGate>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
