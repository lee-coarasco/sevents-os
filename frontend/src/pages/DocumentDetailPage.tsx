import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { usePermissions } from "../hooks/usePermissions";
import { UserPicker } from "../components/UserPicker";
import { useUsers } from "../hooks/useUsers";
import { PermissionGate } from "../components/PermissionGate";
import { StatusBadge } from "../components/StatusBadge";
import { FileAttachment, AttachmentLink, type AttachmentResult } from "../components/FileAttachment";

interface DocumentRecord {
  id: string;
  document_type: string;
  document_number: string | null;
  title: string;
  project_id: string | null;
  discipline: string | null;
  access_class: string | null;
  tags: string[];
  current_revision_id: string | null;
}

type RevisionStatus = "draft" | "under_review" | "approved" | "superseded" | "rejected";

interface Revision {
  id: string;
  revision_code: string;
  status: RevisionStatus;
  storage_reference: string | null;
  reviewer_id: string | null;
  approver_id: string | null;
  superseded_by_revision_id: string | null;
  workflow_instance_id: string | null;
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
}

interface WorkflowDefinitionOption {
  id: string;
  name: string;
}

const inputClass =
  "rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const { has, loading: permissionsLoading } = usePermissions();
  const { users } = useUsers();

  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [definitions, setDefinitions] = useState<WorkflowDefinitionOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage = has("documents.register.manage");

  const [showForm, setShowForm] = useState(false);
  const [revisionCode, setRevisionCode] = useState("");
  const [revisionAttachment, setRevisionAttachment] = useState<AttachmentResult | null>(null);
  const [reviewerId, setReviewerId] = useState("");

  const [definitionByRevision, setDefinitionByRevision] = useState<Record<string, string>>({});

  function loadRevisions() {
    if (!session || !id) return;
    apiFetch<{ revisions: Revision[] }>(
      `/documents/${id}/revisions?includeSuperseded=${showArchived}`,
      session.access_token,
    )
      .then((data) => setRevisions(data.revisions))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }

  useEffect(() => {
    if (!session || !id) return;
    apiFetch<{ document: DocumentRecord }>(`/documents/${id}`, session.access_token)
      .then((data) => setDocument(data.document))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
    apiFetch<{ definitions: WorkflowDefinitionOption[] }>("/workflow/definitions/published", session.access_token)
      .then((data) => setDefinitions(data.definitions))
      .catch(() => setDefinitions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, id]);

  useEffect(loadRevisions, [session, id, showArchived]);

  async function handleAddRevision(event: FormEvent) {
    event.preventDefault();
    if (!session || !id || !revisionCode.trim()) return;
    setActionError(null);
    try {
      await apiFetch(`/documents/${id}/revisions`, session.access_token, {
        method: "POST",
        body: JSON.stringify({
          revisionCode: revisionCode.trim(),
          storageReference: revisionAttachment?.path ?? undefined,
          reviewerId: reviewerId || undefined,
        }),
      });
      setShowForm(false);
      setRevisionCode("");
      setRevisionAttachment(null);
      setReviewerId("");
      loadRevisions();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not add the revision");
    }
  }

  async function handleSubmitForRelease(revisionId: string) {
    if (!session) return;
    const definitionId = definitionByRevision[revisionId];
    if (!definitionId) return;
    setActionError(null);
    try {
      await apiFetch(`/documents/revisions/${revisionId}/submit-for-release`, session.access_token, {
        method: "POST",
        body: JSON.stringify({ definitionId }),
      });
      loadRevisions();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not submit the revision for release");
    }
  }

  async function handleResolveApproval(revisionId: string) {
    if (!session) return;
    setActionError(null);
    try {
      await apiFetch(`/documents/revisions/${revisionId}/resolve-approval`, session.access_token, { method: "POST" });
      loadRevisions();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not check the approval status");
    }
  }

  async function handleSupersede(revisionId: string) {
    if (!session) return;
    setActionError(null);
    try {
      await apiFetch(`/documents/revisions/${revisionId}`, session.access_token, {
        method: "PATCH",
        body: JSON.stringify({ status: "superseded" }),
      });
      loadRevisions();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not supersede the revision");
    }
  }

  const reviewerLabel = (userId: string | null) => users?.find((u) => u.id === userId)?.display_name ?? userId ?? "—";

  return (
    <div className="space-y-6">
      <div>
        <Link to="/documents" className="text-sm text-zinc-400 hover:text-zinc-600">
          ← Back to document register
        </Link>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {actionError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}
      {!document && !error && <p className="text-sm text-zinc-400">Loading…</p>}

      {document && (
        <>
          <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
            <h1 className="font-brand text-2xl font-bold text-zinc-900">{document.title}</h1>
            <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Type</dt>
                <dd className="mt-1 text-sm text-zinc-800">{document.document_type}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Document number</dt>
                <dd className="mt-1 text-sm text-zinc-800">{document.document_number ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Discipline</dt>
                <dd className="mt-1 text-sm text-zinc-800">{document.discipline ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Access class</dt>
                <dd className="mt-1 text-sm text-zinc-800">{document.access_class ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Project</dt>
                <dd className="mt-1 text-sm text-zinc-800">
                  {document.project_id ? (
                    <Link to={`/projects/${document.project_id}`} className="hover:text-brand-dim">
                      View project →
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <h2 className="font-brand text-base font-semibold text-zinc-900">Revisions</h2>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-zinc-500">
                  <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                  Show superseded/rejected
                </label>
                {!permissionsLoading && canManage && (
                  <button onClick={() => setShowForm(true)} className="text-sm text-zinc-400 hover:text-brand-dim">
                    Add revision
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-4 p-6">
              {showForm && (
                <form
                  onSubmit={handleAddRevision}
                  className="grid grid-cols-1 gap-2 rounded-xl bg-stone-50 p-4 sm:grid-cols-3"
                >
                  <input
                    value={revisionCode}
                    onChange={(e) => setRevisionCode(e.target.value)}
                    placeholder="Revision code (e.g. A, B, P1)"
                    className={inputClass}
                  />
                  <div className="flex flex-col gap-1">
                    <FileAttachment
                      onUploaded={setRevisionAttachment}
                      accept="application/pdf,image/*,.dwg,.dwf,.dxf"
                      label="Attach file"
                    />
                    {revisionAttachment && <AttachmentLink attachment={revisionAttachment} />}
                  </div>
                  <UserPicker value={reviewerId} onChange={setReviewerId} placeholder="Reviewer…" />
                  <div className="col-span-full flex gap-2">
                    <button
                      type="submit"
                      disabled={!revisionCode.trim()}
                      className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setRevisionAttachment(null);
                      }}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {revisions?.length === 0 && <p className="text-sm text-zinc-400">No revisions yet.</p>}
              {revisions && revisions.length > 0 && (
                <div className="space-y-3">
                  {revisions.map((rev) => (
                    <div key={rev.id} className="rounded-xl border border-zinc-100 bg-stone-50 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-zinc-800">
                            Revision {rev.revision_code}
                            {document.current_revision_id === rev.id && (
                              <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-dim">
                                Current
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-400">
                            Reviewer: {reviewerLabel(rev.reviewer_id)} · Created{" "}
                            {new Date(rev.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <StatusBadge status={rev.status} />
                      </div>

                      {rev.status === "under_review" && (
                        <PermissionGate permission="documents.register.manage">
                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3">
                            {rev.workflow_instance_id ? (
                              <button
                                onClick={() => handleResolveApproval(rev.id)}
                                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-white"
                              >
                                Check approval status
                              </button>
                            ) : (
                              <>
                                <select
                                  value={definitionByRevision[rev.id] ?? ""}
                                  onChange={(e) =>
                                    setDefinitionByRevision((prev) => ({ ...prev, [rev.id]: e.target.value }))
                                  }
                                  className={`max-w-xs ${inputClass}`}
                                >
                                  <option value="">Select approval workflow…</option>
                                  {definitions?.map((d) => (
                                    <option key={d.id} value={d.id}>
                                      {d.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleSubmitForRelease(rev.id)}
                                  disabled={!definitionByRevision[rev.id]}
                                  className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50"
                                >
                                  Submit for IFC release
                                </button>
                              </>
                            )}
                          </div>
                        </PermissionGate>
                      )}

                      {rev.status === "approved" &&
                        document.current_revision_id !== rev.id &&
                        !rev.superseded_by_revision_id && (
                          <PermissionGate permission="documents.register.manage">
                            <div className="mt-3 border-t border-zinc-200 pt-3">
                              <button
                                onClick={() => handleSupersede(rev.id)}
                                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-white"
                              >
                                Supersede
                              </button>
                            </div>
                          </PermissionGate>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
