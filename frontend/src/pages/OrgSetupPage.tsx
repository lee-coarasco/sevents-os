import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { PermissionGate } from "../components/PermissionGate";

interface Company {
  id: string;
  legal_name: string;
  statutory_id?: string | null;
  vat_registration_number?: string | null;
  reporting_currency?: string | null;
  fiscal_year_start_month?: number | null;
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

function getFiscalMonthName(month: number | null | undefined): string {
  switch (month) {
    case 1:
      return "01-January (Jan - Dec)";
    case 4:
      return "01-April (Apr - Mar)";
    case 7:
      return "01-July (Jul - Jun)";
    case 10:
      return "01-October (Oct - Sep)";
    default:
      return month ? `Month ${month}` : "01-April (Apr - Mar)";
  }
}

export function OrgSetupPage() {
  const { session } = useAuth();
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [branches, setBranches] = useState<Branch[] | null>(null);

  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyStatutoryId, setNewCompanyStatutoryId] = useState("");
  const [newCompanyVat, setNewCompanyVat] = useState("");
  const [newCompanyCurrency, setNewCompanyCurrency] = useState("INR");
  const [newCompanyFiscalMonth, setNewCompanyFiscalMonth] = useState("4");
  const [showAdvancedCompany, setShowAdvancedCompany] = useState(false);
  const [creatingCompany, setCreatingCompany] = useState(false);

  // Edit company state
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editCompanyStatutoryId, setEditCompanyStatutoryId] = useState("");
  const [editCompanyVat, setEditCompanyVat] = useState("");
  const [editCompanyCurrency, setEditCompanyCurrency] = useState("INR");
  const [editCompanyFiscalMonth, setEditCompanyFiscalMonth] = useState("4");
  const [savingCompany, setSavingCompany] = useState(false);

  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchRegion, setNewBranchRegion] = useState("");
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
        body: JSON.stringify({
          legalName: newCompanyName.trim(),
          statutory_id: newCompanyStatutoryId.trim() || undefined,
          vat_registration_number: newCompanyVat.trim() || undefined,
          reporting_currency: newCompanyCurrency.trim() || "INR",
          fiscal_year_start_month: parseInt(newCompanyFiscalMonth, 10) || 4,
        }),
      });
      setCompanies((prev) => [...(prev ?? []), company]);
      setNewCompanyName("");
      setNewCompanyStatutoryId("");
      setNewCompanyVat("");
      setShowAdvancedCompany(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create company");
    } finally {
      setCreatingCompany(false);
    }
  }

  function handleStartEditCompany(company: Company) {
    setEditingCompany(company);
    setEditCompanyName(company.legal_name || "");
    setEditCompanyStatutoryId(company.statutory_id || "");
    setEditCompanyVat(company.vat_registration_number || "");
    setEditCompanyCurrency(company.reporting_currency || "INR");
    setEditCompanyFiscalMonth(String(company.fiscal_year_start_month ?? 4));
  }

  function handleCancelEditCompany() {
    setEditingCompany(null);
  }

  async function handleUpdateCompany(event: FormEvent) {
    event.preventDefault();
    if (!session || !editingCompany || !editCompanyName.trim()) return;
    setSavingCompany(true);
    setError(null);
    try {
      const { company } = await apiFetch<{ company: Company }>(
        `/tenancy/companies/${editingCompany.id}`,
        session.access_token,
        {
          method: "PATCH",
          body: JSON.stringify({
            legalName: editCompanyName.trim(),
            statutory_id: editCompanyStatutoryId.trim() || null,
            vat_registration_number: editCompanyVat.trim() || null,
            reporting_currency: editCompanyCurrency.trim() || "INR",
            fiscal_year_start_month: parseInt(editCompanyFiscalMonth, 10) || 4,
          }),
        },
      );
      setCompanies((prev) =>
        (prev ?? []).map((c) => (c.id === company.id ? company : c)),
      );
      setEditingCompany(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update company");
    } finally {
      setSavingCompany(false);
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
        body: JSON.stringify({
          companyId: selectedCompanyId,
          name: newBranchName.trim(),
          operatingRegion: newBranchRegion.trim() || undefined,
        }),
      });
      setBranches((prev) => [...(prev ?? []), branch]);
      setNewBranchName("");
      setNewBranchRegion("");
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
                <div
                  key={company.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition ${
                    company.id === selectedCompanyId
                      ? "border-brand bg-brand-soft text-zinc-900"
                      : "border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedCompanyId(company.id)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold block">{company.legal_name}</span>
                      {company.id === selectedCompanyId && (
                        <span className="rounded-full bg-amber-500/15 text-amber-800 text-[10px] font-bold px-2 py-0.5">
                          Selected
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-zinc-500">
                      {company.reporting_currency && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.2 border border-zinc-200 font-mono">
                          {company.reporting_currency}
                        </span>
                      )}
                      {company.statutory_id ? (
                        <span className="font-mono text-zinc-600">Reg: {company.statutory_id}</span>
                      ) : (
                        <span className="italic text-zinc-400">No CIN registered</span>
                      )}
                      {company.vat_registration_number && (
                        <span className="font-mono text-zinc-400">VAT: {company.vat_registration_number}</span>
                      )}
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <PermissionGate permission="tenancy.company.manage">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEditCompany(company);
                        }}
                        className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 transition"
                      >
                        Edit
                      </button>
                    </PermissionGate>
                    {company.id === selectedCompanyId && (
                      <svg className="h-4 w-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <PermissionGate
            permission="tenancy.company.manage"
            fallback={<p className="text-xs text-zinc-400">You don't have permission to create companies.</p>}
          >
            <form onSubmit={handleCreateCompany} className="space-y-3 rounded-xl border border-zinc-200 bg-stone-50/50 p-4">
              <div className="flex gap-2">
                <input
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="Legal Entity Name (e.g. Apex Horizon Infrastructure Pvt. Ltd.)"
                  className="flex-1 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <button
                  type="button"
                  onClick={() => setShowAdvancedCompany(!showAdvancedCompany)}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  {showAdvancedCompany ? "Simple View ▲" : "+ Enterprise Details ▼"}
                </button>
                <button
                  type="submit"
                  disabled={creatingCompany || !newCompanyName.trim()}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim disabled:opacity-50 shrink-0"
                >
                  {creatingCompany ? "Adding…" : "Add company"}
                </button>
              </div>

              {showAdvancedCompany && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-zinc-200">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Trade / Registration No. (CIN)
                    </label>
                    <input
                      type="text"
                      value={newCompanyStatutoryId}
                      onChange={(e) => setNewCompanyStatutoryId(e.target.value)}
                      placeholder="e.g. CIN-U45200MH2021PTC368921"
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-mono outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      VAT / Tax ID
                    </label>
                    <input
                      type="text"
                      value={newCompanyVat}
                      onChange={(e) => setNewCompanyVat(e.target.value)}
                      placeholder="e.g. 27AABCU9603R1ZX"
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-mono outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Default Currency
                    </label>
                    <select
                      value={newCompanyCurrency}
                      onChange={(e) => setNewCompanyCurrency(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-brand"
                    >
                      <option value="INR">INR (₹) - Indian Rupee</option>
                      <option value="USD">USD ($) - US Dollar</option>
                      <option value="EUR">EUR (€) - Euro</option>
                      <option value="AED">AED (د.إ) - UAE Dirham</option>
                      <option value="SAR">SAR (﷼) - Saudi Riyal</option>
                      <option value="GBP">GBP (£) - British Pound</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Fiscal Year Start
                    </label>
                    <select
                      value={newCompanyFiscalMonth}
                      onChange={(e) => setNewCompanyFiscalMonth(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-brand"
                    >
                      <option value="4">April (01-April)</option>
                      <option value="1">January (01-January)</option>
                      <option value="7">July (01-July)</option>
                      <option value="10">October (01-October)</option>
                    </select>
                  </div>
                </div>
              )}
            </form>
          </PermissionGate>
        </div>
      </div>

      {selectedCompany && (
        <>
          {/* Selected Company Master Data */}
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-zinc-100 bg-stone-50/70 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Company Master Data</span>
                <h2 className="font-brand text-lg font-bold text-zinc-900">{selectedCompany.legal_name}</h2>
              </div>
              <PermissionGate permission="tenancy.company.manage">
                <button
                  type="button"
                  onClick={() => handleStartEditCompany(selectedCompany)}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 hover:border-zinc-300 transition shadow-xs"
                >
                  <svg className="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Company Details
                </button>
              </PermissionGate>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="rounded-xl border border-zinc-100 bg-stone-50/50 p-3">
                <span className="text-zinc-400 font-medium block">Trade / Registration No. (CIN)</span>
                <span className="mt-1 font-mono font-semibold text-zinc-900 text-sm block">
                  {selectedCompany.statutory_id || <span className="font-sans text-xs italic text-zinc-400">Not configured</span>}
                </span>
              </div>
              <div className="rounded-xl border border-zinc-100 bg-stone-50/50 p-3">
                <span className="text-zinc-400 font-medium block">VAT / Tax ID</span>
                <span className="mt-1 font-mono font-semibold text-zinc-900 text-sm block">
                  {selectedCompany.vat_registration_number || <span className="font-sans text-xs italic text-zinc-400">Not configured</span>}
                </span>
              </div>
              <div className="rounded-xl border border-zinc-100 bg-stone-50/50 p-3">
                <span className="text-zinc-400 font-medium block">Default Currency</span>
                <span className="mt-1 font-mono font-semibold text-zinc-900 text-sm block">
                  {selectedCompany.reporting_currency || "INR"}
                </span>
              </div>
              <div className="rounded-xl border border-zinc-100 bg-stone-50/50 p-3">
                <span className="text-zinc-400 font-medium block">Financial Year Start</span>
                <span className="mt-1 font-semibold text-zinc-900 text-sm block">
                  {getFiscalMonthName(selectedCompany.fiscal_year_start_month)}
                </span>
              </div>
            </div>
          </div>

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
                <form onSubmit={handleCreateBranch} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    placeholder="Branch name"
                    className="sm:col-span-1 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  <input
                    value={newBranchRegion}
                    onChange={(e) => setNewBranchRegion(e.target.value)}
                    placeholder="Region / Code / Address (e.g. BR-MUM-HQ - BKC)"
                    className="sm:col-span-1 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
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

      {/* Edit Company Modal */}
      {editingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-xl overflow-hidden">
            <div className="border-b border-zinc-100 bg-stone-50/80 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-brand font-bold text-zinc-900">Edit Company Details</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Update statutory and fiscal settings for this legal entity</p>
              </div>
              <button
                type="button"
                onClick={handleCancelEditCompany}
                className="text-zinc-400 hover:text-zinc-600 text-lg leading-none p-1"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateCompany} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Legal Entity Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editCompanyName}
                  onChange={(e) => setEditCompanyName(e.target.value)}
                  placeholder="e.g. Apex Horizon Infrastructure Pvt. Ltd."
                  className="w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Trade Identifier / Registration (CIN)
                  </label>
                  <input
                    type="text"
                    value={editCompanyStatutoryId}
                    onChange={(e) => setEditCompanyStatutoryId(e.target.value)}
                    placeholder="e.g. CIN-U45200MH2021PTC368921"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs font-mono outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    VAT / Tax Registration No.
                  </label>
                  <input
                    type="text"
                    value={editCompanyVat}
                    onChange={(e) => setEditCompanyVat(e.target.value)}
                    placeholder="e.g. 27AABCU9603R1ZX"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs font-mono outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Default Reporting Currency
                  </label>
                  <select
                    value={editCompanyCurrency}
                    onChange={(e) => setEditCompanyCurrency(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-brand"
                  >
                    <option value="INR">INR (₹) - Indian Rupee</option>
                    <option value="USD">USD ($) - US Dollar</option>
                    <option value="EUR">EUR (€) - Euro</option>
                    <option value="AED">AED (د.إ) - UAE Dirham</option>
                    <option value="SAR">SAR (﷼) - Saudi Riyal</option>
                    <option value="GBP">GBP (£) - British Pound</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Financial Year Start
                  </label>
                  <select
                    value={editCompanyFiscalMonth}
                    onChange={(e) => setEditCompanyFiscalMonth(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-brand"
                  >
                    <option value="4">01-April (Apr - Mar)</option>
                    <option value="1">01-January (Jan - Dec)</option>
                    <option value="7">01-July (Jul - Jun)</option>
                    <option value="10">01-October (Oct - Sep)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancelEditCompany}
                  className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCompany || !editCompanyName.trim()}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50 transition"
                >
                  {savingCompany ? "Saving changes…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
