import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { UserPicker } from "../components/UserPicker";
import { PermissionGate } from "../components/PermissionGate";

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

interface Company {
  id: string;
  legal_name: string;
}

interface Client {
  id: string;
  name: string;
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
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [clientName, setClientName] = useState("");
  const [location, setLocation] = useState("");
  const [contractReference, setContractReference] = useState("");
  const [contractValue, setContractValue] = useState("");
  const [contractCurrency, setContractCurrency] = useState("USD");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetCurrency, setBudgetCurrency] = useState("USD");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [projectManagerId, setProjectManagerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function load() {
    if (!session) return;
    apiFetch<{ projects: Project[] }>("/projects", session.access_token)
      .then((data) => setProjects(data.projects))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }

  useEffect(load, [session]);

  useEffect(() => {
    if (!session) return;
    apiFetch<{ companies: Company[] }>("/tenancy/companies", session.access_token)
      .then((data) => setCompanies(data.companies))
      .catch(() => setCompanies([]));
    apiFetch<{ clients: Client[] }>("/crm/clients", session.access_token)
      .then((data) => setClients(data.clients ?? []))
      .catch(() => setClients([]));
  }, [session]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!session || !companyId || !name.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch("/projects", session.access_token, {
        method: "POST",
        body: JSON.stringify({
          companyId,
          name: name.trim(),
          code: code.trim() || undefined,
          clientName: clientName.trim() || undefined,
          location: location.trim() || undefined,
          contractReference: contractReference.trim() || undefined,
          contractValue: contractValue.trim() ? Number(contractValue) : undefined,
          contractCurrency: contractValue.trim() ? (contractCurrency.trim() || undefined) : undefined,
          budgetAmount: budgetAmount.trim() ? Number(budgetAmount) : undefined,
          budgetCurrency: budgetAmount.trim() ? (budgetCurrency.trim() || undefined) : undefined,
          baselineStartDate: startDate || undefined,
          baselineEndDate: endDate || undefined,
          projectManagerId: projectManagerId || undefined,
        }),
      });
      setName("");
      setCode("");
      setClientName("");
      setLocation("");
      setContractReference("");
      setContractValue("");
      setBudgetAmount("");
      setStartDate("");
      setEndDate("");
      setProjectManagerId("");
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not create the project");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-brand text-2xl font-bold text-zinc-900">Projects</h1>
          <p className="mt-1 text-sm text-zinc-400">Project register</p>
        </div>
        <PermissionGate permission="tenancy.project.manage">
          <button
            onClick={() => setShowForm((prev) => !prev)}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim"
          >
            {showForm ? "Cancel" : "New project"}
          </button>
        </PermissionGate>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
          {formError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select
              aria-label="Company"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="">Select company…</option>
              {companies?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.legal_name}
                </option>
              ))}
            </select>
            <select
              aria-label="Client"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="">Select client (optional)…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              className="rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Project code"
              className="rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location (e.g. Dubai, UAE)"
              className="rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <input
              value={contractReference}
              onChange={(e) => setContractReference(e.target.value)}
              placeholder="Contract ref (e.g. CNT-2026-001)"
              className="rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <div className="flex gap-1.5">
              <input
                type="number"
                step="any"
                value={contractValue}
                onChange={(e) => setContractValue(e.target.value)}
                placeholder="Contract value"
                className="flex-1 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <select
                aria-label="Contract currency"
                value={contractCurrency}
                onChange={(e) => setContractCurrency(e.target.value)}
                className="w-24 rounded-lg border border-zinc-200 px-2 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value="USD">USD</option>
                <option value="AED">AED</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="INR">INR</option>
                <option value="SAR">SAR</option>
                <option value="QAR">QAR</option>
              </select>
            </div>
            <div className="flex gap-1.5">
              <input
                type="number"
                step="any"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                placeholder="Budget amount"
                className="flex-1 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <select
                aria-label="Budget currency"
                value={budgetCurrency}
                onChange={(e) => setBudgetCurrency(e.target.value)}
                className="w-24 rounded-lg border border-zinc-200 px-2 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value="USD">USD</option>
                <option value="AED">AED</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="INR">INR</option>
                <option value="SAR">SAR</option>
                <option value="QAR">QAR</option>
              </select>
            </div>
            <UserPicker value={projectManagerId} onChange={setProjectManagerId} placeholder="Project manager…" />
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              Start date
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              End date
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving || !companyId || !name.trim()}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create project"}
          </button>
        </form>
      )}

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
