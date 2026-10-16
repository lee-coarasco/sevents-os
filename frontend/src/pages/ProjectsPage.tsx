import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";

type ProjectStatus = "active" | "on_hold" | "closed";

interface Project {
  id: string;
  name: string;
  code: string | null;
  status: ProjectStatus;
  client_name: string | null;
  location: string | null;
  contract_value: number | null;
  contract_currency: string | null;
}

const statusColors: Record<ProjectStatus, string> = {
  active: "bg-emerald-50 text-emerald-700",
  on_hold: "bg-amber-50 text-amber-700",
  closed: "bg-zinc-100 text-zinc-500",
};

const statusLabels: Record<ProjectStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  closed: "Closed",
};

function formatAmount(amount: number | null, currency: string | null): string {
  if (amount === null) return "—";
  return currency ? `${amount.toLocaleString()} ${currency}` : amount.toLocaleString();
}

export function ProjectsPage() {
  const { session } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    apiFetch<{ projects: Project[] }>("/projects", session.access_token)
      .then((data) => setProjects(data.projects))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }, [session]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-brand text-2xl font-bold text-zinc-900">Projects</h1>
        <p className="mt-1 text-sm text-zinc-400">Project register</p>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {projects === null && !error && <p className="text-sm text-zinc-400">Loading…</p>}
      {projects?.length === 0 && <p className="text-sm text-zinc-400">No projects yet.</p>}

      {projects && projects.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                <th className="px-6 py-3">Project</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Location</th>
                <th className="px-6 py-3">Contract value</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-b border-zinc-50 last:border-0 hover:bg-stone-50">
                  <td className="px-6 py-4">
                    <Link to={`/projects/${project.id}`} className="font-medium text-zinc-800 hover:text-brand-dim">
                      {project.name}
                    </Link>
                    {project.code && <span className="ml-2 text-xs text-zinc-400">{project.code}</span>}
                  </td>
                  <td className="px-6 py-4 text-zinc-600">{project.client_name ?? "—"}</td>
                  <td className="px-6 py-4 text-zinc-600">{project.location ?? "—"}</td>
                  <td className="px-6 py-4 text-zinc-600">{formatAmount(project.contract_value, project.contract_currency)}</td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[project.status]}`}>
                      {statusLabels[project.status]}
                    </span>
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
