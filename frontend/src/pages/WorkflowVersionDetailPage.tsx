import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import type { WorkflowVersion } from "./WorkflowDefinitionDetailPage";

/** Stub for now — the full steps/graph editor, validation panel and publish flow are later tickets (0142, 0143). */
export function WorkflowVersionDetailPage() {
  const { definitionId, versionId } = useParams<{ definitionId: string; versionId: string }>();
  const { session } = useAuth();

  const [versions, setVersions] = useState<WorkflowVersion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !definitionId) return;
    apiFetch<{ versions: WorkflowVersion[] }>(`/workflow/definitions/${definitionId}/versions`, session.access_token)
      .then((data) => setVersions(data.versions))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }, [session, definitionId]);

  const version = versions?.find((v) => v.id === versionId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/config-studio/${definitionId}`} className="text-sm text-zinc-400 hover:text-zinc-600">
          ← Back to definition
        </Link>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!version && !error && <p className="text-sm text-zinc-400">Loading…</p>}

      {version && (
        <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <h1 className="font-brand text-2xl font-bold text-zinc-900">Version {version.version}</h1>
            <StatusBadge status={version.status} />
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Created</dt>
              <dd className="mt-1 text-sm text-zinc-800">{new Date(version.created_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Published at</dt>
              <dd className="mt-1 text-sm text-zinc-800">{version.published_at ? new Date(version.published_at).toLocaleString() : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Rollback of</dt>
              <dd className="mt-1 text-sm text-zinc-800">{version.rollback_of_version ?? "—"}</dd>
            </div>
          </dl>
          <p className="mt-6 text-sm text-zinc-400">
            The steps editor and validation/publish panel are built in follow-on tickets 0142 and 0143.
          </p>
        </div>
      )}
    </div>
  );
}
