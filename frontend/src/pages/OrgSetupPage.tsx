import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { usePermissions } from "../hooks/usePermissions";

interface Company {
  id: string;
  legal_name: string;
}

interface Branch {
  id: string;
  company_id: string;
  name: string;
  operating_region: string | null;
}

interface Project {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
  status: string;
  client_name: string | null;
  location: string | null;
}

export function OrgSetupPage() {
  const { session } = useAuth();
  const { has, loading: permissionsLoading } = usePermissions();

  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Branches created this session, keyed by company: GET /tenancy/branches does not exist yet
  // (see ticket 0087 Progress / the follow-on backend ticket it filed), so this is not a real list.
  const [sessionBranches, setSessionBranches] = useState<Record<string, Branch[]>>({});

  const [newCompanyName, setNewCompanyName] = useState("");
  const [creatingCompany, setCreatingCompany] = useState(false);

  const [newBranchName, setNewBranchName] = useState("");
  const [creatingBranch, setCreatingBranch] = useState(false);

  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectCode, setNewProjectCode] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

  useEffect(() => {
    if (!session) return;
    apiFetch<{ companies: Company[] }>("/tenancy/companies", session.access_token)
      .then((data) => setCompanies(data.companies))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
    apiFetch<{ projects: Project[] }>("/projects", session.access_token)
      .then((data) => setProjects(data.projects))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }, [session]);

  async function handleCreateCompany(event: FormEvent) {
    event.preventDefault();
    if (!session || !newCompanyName.trim()) return;
    setCreatingCompany(true);
    setError(null);
    try {
      const { company } = await apiFetch<{ company: Company }>("/tenancy/companies", session.access_token, {
        method: "POST",
        body: JSON.stringify({ legalName: newCompanyName.trim() }),
      });
      setCompanies((prev) => [...(prev ?? []), company]);
      setNewCompanyName("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create company");
    } finally {
      setCreatingCompany(false);
    }
  }

  async function handleCreateBranch(event: FormEvent) {
    event.preventDefault();
    if (!session || !selectedCompanyId || !newBranchName.trim()) return;
    setCreatingBranch(true);
    setError(null);
    try {
      const { branch } = await apiFetch<{ branch: Branch }>("/tenancy/branches", session.access_token, {
        method: "POST",
        body: JSON.stringify({ companyId: selectedCompanyId, name: newBranchName.trim() }),
      });
      setSessionBranches((prev) => ({
        ...prev,
        [selectedCompanyId]: [...(prev[selectedCompanyId] ?? []), branch],
      }));
      setNewBranchName("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create branch");
    } finally {
      setCreatingBranch(false);
    }
  }

  async function handleCreateProject(event: FormEvent) {
    event.preventDefault();
    if (!session || !selectedCompanyId || !newProjectName.trim()) return;
    setCreatingProject(true);
    setError(null);
    try {
      const { project } = await apiFetch<{ project: Project }>("/projects", session.access_token, {
        method: "POST",
        body: JSON.stringify({
          companyId: selectedCompanyId,
          name: newProjectName.trim(),
          code: newProjectCode.trim() || undefined,
        }),
      });
      setProjects((prev) => [...(prev ?? []), project]);
      setNewProjectName("");
      setNewProjectCode("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create project");
    } finally {
      setCreatingProject(false);
    }
  }

  const selectedCompany = companies?.find((c) => c.id === selectedCompanyId) ?? null;
  const branchesForSelected = selectedCompanyId ? sessionBranches[selectedCompanyId] ?? [] : [];
  const projectsForSelected = selectedCompanyId
    ? (projects ?? []).filter((p) => p.company_id === selectedCompanyId)
    : [];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">Company / Branch / Project setup</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-3 text-sm font-medium text-slate-500">Companies</h3>
        {companies === null && <p className="text-sm text-slate-500">Loading…</p>}
        {companies?.length === 0 && <p className="text-sm text-slate-500">No companies yet.</p>}
        {companies && companies.length > 0 && (
          <ul className="mb-4 space-y-2">
            {companies.map((company) => (
              <li key={company.id}>
                <button
                  onClick={() => setSelectedCompanyId(company.id)}
                  className={`w-full rounded border px-3 py-2 text-left text-sm ${
                    company.id === selectedCompanyId
                      ? "border-slate-900 bg-slate-100"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {company.legal_name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!permissionsLoading && has("tenancy.company.manage") && (
          <form onSubmit={handleCreateCompany} className="flex gap-2">
            <input
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              placeholder="Legal name"
              className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={creatingCompany || !newCompanyName.trim()}
              className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {creatingCompany ? "Creating…" : "Add company"}
            </button>
          </form>
        )}
        {!permissionsLoading && !has("tenancy.company.manage") && (
          <p className="text-xs text-slate-400">You don't have permission to create companies.</p>
        )}
      </section>

      {selectedCompany && (
        <>
          <section className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-3 text-sm font-medium text-slate-500">
              Branches — {selectedCompany.legal_name}
            </h3>
            <p className="mb-3 text-xs text-slate-400">
              Showing branches created this session only — there is no branch list endpoint yet
              (filed as a follow-on backend ticket).
            </p>
            {branchesForSelected.length === 0 && (
              <p className="mb-3 text-sm text-slate-500">No branches created this session.</p>
            )}
            {branchesForSelected.length > 0 && (
              <ul className="mb-4 space-y-2">
                {branchesForSelected.map((branch) => (
                  <li key={branch.id} className="rounded border border-slate-200 px-3 py-2 text-sm">
                    {branch.name}
                    {branch.operating_region ? ` — ${branch.operating_region}` : ""}
                  </li>
                ))}
              </ul>
            )}
            {!permissionsLoading && has("tenancy.branch.manage") && (
              <form onSubmit={handleCreateBranch} className="flex gap-2">
                <input
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="Branch name"
                  className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={creatingBranch || !newBranchName.trim()}
                  className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {creatingBranch ? "Creating…" : "Add branch"}
                </button>
              </form>
            )}
            {!permissionsLoading && !has("tenancy.branch.manage") && (
              <p className="text-xs text-slate-400">You don't have permission to create branches.</p>
            )}
          </section>

          <section className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-3 text-sm font-medium text-slate-500">
              Projects — {selectedCompany.legal_name}
            </h3>
            {projects === null && <p className="text-sm text-slate-500">Loading…</p>}
            {projects && projectsForSelected.length === 0 && (
              <p className="mb-3 text-sm text-slate-500">No projects yet.</p>
            )}
            {projectsForSelected.length > 0 && (
              <ul className="mb-4 space-y-2">
                {projectsForSelected.map((project) => (
                  <li key={project.id} className="rounded border border-slate-200 px-3 py-2 text-sm">
                    {project.name}
                    {project.code ? ` (${project.code})` : ""} — {project.status}
                  </li>
                ))}
              </ul>
            )}
            {!permissionsLoading && has("tenancy.project.manage") && (
              <form onSubmit={handleCreateProject} className="flex gap-2">
                <input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Project name"
                  className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={newProjectCode}
                  onChange={(e) => setNewProjectCode(e.target.value)}
                  placeholder="Code (optional)"
                  className="w-32 rounded border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={creatingProject || !newProjectName.trim()}
                  className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {creatingProject ? "Creating…" : "Add project"}
                </button>
              </form>
            )}
            {!permissionsLoading && !has("tenancy.project.manage") && (
              <p className="text-xs text-slate-400">You don't have permission to create projects.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
