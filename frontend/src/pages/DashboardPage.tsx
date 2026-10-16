import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

interface Company {
  id: string;
  legal_name: string;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-2 font-brand text-3xl font-bold text-zinc-900">{value}</p>
      <p className="mt-1 text-xs text-zinc-400">{sub}</p>
    </div>
  );
}

export function DashboardPage() {
  const { session } = useAuth();
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    apiFetch<{ companies: Company[] }>("/tenancy/companies", session.access_token)
      .then((data) => setCompanies(data.companies))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }, [session]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-brand text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-400">Platform overview</p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Companies" value={companies?.length.toString() ?? "—"} sub="registered tenants" />
        <StatCard label="Projects" value="—" sub="across all branches" />
        <StatCard label="Users" value="—" sub="active this month" />
        <StatCard label="Phase" value="2" sub="Configuration studio" />
      </div>

      {/* Companies table */}
      <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="font-brand text-base font-semibold text-zinc-900">Companies</h2>
          {companies && (
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              {companies.length}
            </span>
          )}
        </div>

        <div className="px-6 py-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</div>
          )}
          {!error && companies === null && (
            <p className="text-sm text-zinc-400">Loading…</p>
          )}
          {!error && companies?.length === 0 && (
            <p className="text-sm text-zinc-400">No companies yet. Add one in Company / Branch / Project setup.</p>
          )}
          {companies && companies.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Legal name
                  </th>
                  <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    ID
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {companies.map((company) => (
                  <tr key={company.id} className="group">
                    <td className="py-3 font-medium text-zinc-900">{company.legal_name}</td>
                    <td className="py-3 text-right font-mono text-[11px] text-zinc-400">
                      {company.id.slice(0, 8)}…
                    </td>
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
