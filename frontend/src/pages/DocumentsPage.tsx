import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { usePermissions } from "../hooks/usePermissions";

interface DocumentRecord {
  id: string;
  document_type: string;
  document_number: string | null;
  title: string;
  project_id: string | null;
  discipline: string | null;
  access_class: string | null;
  current_revision_id: string | null;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
}

const inputClass =
  "rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

export function DocumentsPage() {
  const { session } = useAuth();
  const { has, loading: permissionsLoading } = usePermissions();

  const [documents, setDocuments] = useState<DocumentRecord[] | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState("");

  const canManage = has("documents.register.manage");

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [projectId, setProjectId] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [accessClass, setAccessClass] = useState("");

  function loadDocuments() {
    if (!session) return;
    const query = projectFilter ? `?projectId=${encodeURIComponent(projectFilter)}` : "";
    apiFetch<{ documents: DocumentRecord[] }>(`/documents${query}`, session.access_token)
      .then((data) => setDocuments(data.documents))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }

  useEffect(() => {
    if (!session) return;
    apiFetch<{ projects: Project[] }>("/projects", session.access_token)
      .then((data) => setProjects(data.projects))
      .catch(() => undefined);
  }, [session]);

  useEffect(loadDocuments, [session, projectFilter]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!session || !title.trim() || !documentType.trim()) return;
    setActionError(null);
    try {
      await apiFetch("/documents", session.access_token, {
        method: "POST",
        body: JSON.stringify({
          documentType: documentType.trim(),
          title: title.trim(),
          documentNumber: documentNumber.trim() || undefined,
          projectId: projectId || undefined,
          discipline: discipline.trim() || undefined,
          accessClass: accessClass.trim() || undefined,
        }),
      });
      setShowForm(false);
      setTitle("");
      setDocumentType("");
      setDocumentNumber("");
      setProjectId("");
      setDiscipline("");
      setAccessClass("");
      loadDocuments();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not create the document");
    }
  }

  const projectName = (id: string | null) => projects?.find((p) => p.id === id)?.name ?? "—";

  const filtered = (documents ?? []).filter((doc) => {
    if (typeFilter && doc.document_type !== typeFilter) return false;
    if (disciplineFilter && doc.discipline !== disciplineFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-brand text-2xl font-bold text-zinc-900">Document Register</h1>
          <p className="mt-1 text-sm text-zinc-400">Documents, drawings and records, with revision control</p>
        </div>
        {!permissionsLoading && canManage && (
          <button
            onClick={() => setShowForm(true)}
            className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim"
          >
            New document
          </button>
        )}
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {actionError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}

      <div className="flex flex-wrap gap-2">
        <input value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} placeholder="Filter by type" className={`max-w-xs ${inputClass}`} />
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className={`max-w-xs ${inputClass}`}>
          <option value="">All projects</option>
          {projects?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          value={disciplineFilter}
          onChange={(e) => setDisciplineFilter(e.target.value)}
          placeholder="Filter by discipline"
          className={`max-w-xs ${inputClass}`}
        />
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-2 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm sm:grid-cols-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={inputClass} />
          <input value={documentType} onChange={(e) => setDocumentType(e.target.value)} placeholder="Document type" className={inputClass} />
          <input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} placeholder="Document number" className={inputClass} />
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass}>
            <option value="">No project (corporate)</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input value={discipline} onChange={(e) => setDiscipline(e.target.value)} placeholder="Discipline" className={inputClass} />
          <input value={accessClass} onChange={(e) => setAccessClass(e.target.value)} placeholder="Access class" className={inputClass} />
          <div className="col-span-full flex gap-2">
            <button
              type="submit"
              disabled={!title.trim() || !documentType.trim()}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50"
            >
              Create document
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {filtered.length === 0 && documents !== null && <p className="text-sm text-zinc-400">No documents found.</p>}
      {filtered.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                <th className="px-6 py-3">Title</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Project</th>
                <th className="px-6 py-3">Discipline</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr key={doc.id} className="border-b border-zinc-50 last:border-0 hover:bg-stone-50">
                  <td className="px-6 py-4 font-medium text-zinc-800">
                    {doc.title}
                    {doc.document_number && <span className="ml-2 text-xs text-zinc-400">{doc.document_number}</span>}
                  </td>
                  <td className="px-6 py-4 text-zinc-600">{doc.document_type}</td>
                  <td className="px-6 py-4 text-zinc-600">{projectName(doc.project_id)}</td>
                  <td className="px-6 py-4 text-zinc-600">{doc.discipline ?? "—"}</td>
                  <td className="px-6 py-4 text-right">
                    <Link to={`/documents/${doc.id}`} className="text-xs text-zinc-400 hover:text-brand-dim">
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
