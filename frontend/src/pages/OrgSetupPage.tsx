import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { PermissionGate } from "../components/PermissionGate";

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

const statusColors: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  planning: "bg-blue-50 text-blue-700",
  on_hold: "bg-amber-50 text-amber-700",
  closed: "bg-zinc-100 text-zinc-500",
};

export function OrgSetupPage() {
  const { session } = useAuth();
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [branches, setBranches] = useState<Branch[] | null>(null);

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

  useEffect(() => {
    if (!session || !selectedCompanyId) {
      setBranches(null);
      return;
    }
    apiFetch<{ branches: Branch[] }>(
      `/tenancy/branches?companyId=${selectedCompanyId}`,
      session.access_token,
    )
      .then((data) => setBranches(data.branches))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }, [session, selectedCompanyId]);

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
      setBranches((prev) => [...(prev ?? []), branch]);
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
  const projectsForSelected = selectedCompanyId
    ? (projects ?? []).filter((p) => p.company_id === selectedCompanyId)
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-brand text-2xl font-bold text-zinc-900">Company / Branch / Project</h1>
        <p className="mt-1 text-sm text-zinc-400">Set up your tenant hierarchy</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Companies */}
      <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h2 className="font-brand text-base font-semibold text-zinc-900">Companies</h2>
        </div>
        <div className="p-6">
          {companies === null && <p className="text-sm text-zinc-400">Loading…</p>}
          {companies?.length === 0 && <p className="mb-4 text-sm text-zinc-400">No companies yet.</p>}
          {companies && companies.length > 0 && (
            <div className="mb-4 space-y-2">
              {companies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => setSelectedCompanyId(company.id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                    company.id === selectedCompanyId
                      ? "border-brand bg-brand-soft text-zinc-900"
                      : "border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                  }`}
                >
                  <span>{company.legal_name}</span>
                  {company.id === selectedCompanyId && (
                    <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
          <PermissionGate
            permission="tenancy.company.manage"
            fallback={<p className="text-xs text-zinc-400">You don't have permission to create companies.</p>}
          >
            <form onSubmit={handleCreateCompany} className="flex gap-2">
              <input
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="Legal name"
                className="flex-1 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <button
                type="submit"
                disabled={creatingCompany || !newCompanyName.trim()}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim disabled:opacity-50"
              >
                {creatingCompany ? "Adding…" : "Add company"}
              </button>
            </form>
          </PermissionGate>
        </div>
      </div>

      {selectedCompany && (
        <>
          {/* Branches */}
          <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-6 py-4">
              <h2 className="font-brand text-base font-semibold text-zinc-900">
                Branches
              </h2>
              <p className="mt-0.5 text-xs text-zinc-400">{selectedCompany.legal_name}</p>
            </div>
            <div className="p-6">
              {branches === null && <p className="mb-3 text-sm text-zinc-400">Loading…</p>}
              {branches?.length === 0 && (
                <p className="mb-4 text-sm text-zinc-400">No branches yet.</p>
              )}
              {branches && branches.length > 0 && (
                <div className="mb-4 space-y-2">
                  {branches.map((branch) => (
                    <div key={branch.id} className="flex items-center justify-between rounded-xl border border-zinc-100 bg-stone-50 px-4 py-3 text-sm">
                      <span className="font-medium text-zinc-800">{branch.name}</span>
                      {branch.operating_region && (
                        <span className="text-xs text-zinc-400">{branch.operating_region}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <PermissionGate
                permission="tenancy.branch.manage"
                fallback={<p className="text-xs text-zinc-400">You don't have permission to create branches.</p>}
              >
                <form onSubmit={handleCreateBranch} className="flex gap-2">
                  <input
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    placeholder="Branch name"
                    className="flex-1 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  <button
                    type="submit"
                    disabled={creatingBranch || !newBranchName.trim()}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim disabled:opacity-50"
                  >
                    {creatingBranch ? "Adding…" : "Add branch"}
                  </button>
                </form>
              </PermissionGate>
            </div>
          </div>

          {/* Projects */}
          <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-6 py-4">
              <h2 className="font-brand text-base font-semibold text-zinc-900">Projects</h2>
              <p className="mt-0.5 text-xs text-zinc-400">{selectedCompany.legal_name}</p>
            </div>
            <div className="p-6">
              {projects === null && <p className="text-sm text-zinc-400">Loading…</p>}
              {projects && projectsForSelected.length === 0 && (
                <p className="mb-4 text-sm text-zinc-400">No projects yet.</p>
              )}
              {projectsForSelected.length > 0 && (
                <div className="mb-4 space-y-2">
                  {projectsForSelected.map((project) => (
                    <div key={project.id} className="flex items-center justify-between rounded-xl border border-zinc-100 bg-stone-50 px-4 py-3 text-sm">
                      <div>
                        <span className="font-medium text-zinc-800">{project.name}</span>
                        {project.code && (
                          <span className="ml-2 font-mono text-xs text-zinc-400">({project.code})</span>
                        )}
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[project.status] ?? "bg-zinc-100 text-zinc-600"}`}>
                        {project.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <PermissionGate
                permission="tenancy.project.manage"
                fallback={<p className="text-xs text-zinc-400">You don't have permission to create projects.</p>}
              >
                <form onSubmit={handleCreateProject} className="flex gap-2">
                  <input
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Project name"
                    className="flex-1 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  <input
                    value={newProjectCode}
                    onChange={(e) => setNewProjectCode(e.target.value)}
                    placeholder="Code (optional)"
                    className="w-32 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  <button
                    type="submit"
                    disabled={creatingProject || !newProjectName.trim()}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim disabled:opacity-50"
                  >
                    {creatingProject ? "Adding…" : "Add project"}
                  </button>
                </form>
              </PermissionGate>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
