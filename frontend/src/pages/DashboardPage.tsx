import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

interface DashboardSummary {
  companies: number;
  projects: number;
  activeEmployees: number;
  publishedWorkflows: number;
  documents: number;
  openTasks: number;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-2 font-brand text-3xl font-bold text-zinc-900">
        {value === null || value === undefined ? "—" : value}
      </p>
      <p className="mt-1 text-xs text-zinc-400">{sub}</p>
    </div>
  );
}

export function DashboardPage() {
  const { session } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    apiFetch<{ summary: DashboardSummary }>("/dashboard/summary", session.access_token)
      .then((data) => setSummary(data.summary))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }, [session]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-brand text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-400">Platform overview</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label="Companies"
          value={summary?.companies ?? "—"}
          sub="registered tenants"
        />
        <StatCard
          label="Projects"
          value={summary?.projects ?? "—"}
          sub="across all branches"
        />
        <StatCard
          label="Active employees"
          value={summary?.activeEmployees ?? "—"}
          sub="workforce headcount"
        />
        <StatCard
          label="Published workflows"
          value={summary?.publishedWorkflows ?? "—"}
          sub="live automation flows"
        />
        <StatCard
          label="Documents"
          value={summary?.documents ?? "—"}
          sub="in document register"
        />
        <StatCard
          label="Open tasks"
          value={summary?.openTasks ?? "—"}
          sub="running workflow instances"
        />
      </div>

      <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h2 className="font-brand text-base font-semibold text-zinc-900">Quick navigation</h2>
        </div>
        <div className="grid grid-cols-2 gap-px bg-zinc-100 sm:grid-cols-3 lg:grid-cols-4">
          {[
            { label: "Work-item catalogue", href: "/catalogue" },
            { label: "Workflow definitions", href: "/workflow" },
            { label: "Employees", href: "/workforce" },
            { label: "Projects", href: "/projects" },
            { label: "Documents", href: "/documents" },
            { label: "Master data", href: "/master-data" },
            { label: "CRM", href: "/crm" },
            { label: "Authority", href: "/authority" },
          ].map(({ label, href }) => (
            <a
              key={href}
              href={href}
              className="flex items-center bg-white px-5 py-4 text-sm font-medium text-zinc-700 hover:bg-brand-soft hover:text-zinc-900"
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
