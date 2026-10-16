import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { apiFetch, ApiError } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

interface Company {
  id: string;
  legal_name: string;
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
    <div className="min-h-screen bg-slate-50 p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">SEVENTS</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">{session?.user.email}</span>
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700"
          >
            Sign out
          </button>
        </div>
      </header>
      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-3 text-sm font-medium text-slate-500">Companies</h2>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!error && companies === null && <p className="text-sm text-slate-500">Loading…</p>}
        {!error && companies?.length === 0 && <p className="text-sm text-slate-500">No companies yet.</p>}
        {companies && companies.length > 0 && (
          <ul className="space-y-2">
            {companies.map((company) => (
              <li key={company.id} className="rounded border border-slate-200 px-3 py-2 text-sm">
                {company.legal_name}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
