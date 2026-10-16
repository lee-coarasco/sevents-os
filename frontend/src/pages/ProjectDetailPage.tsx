import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";

type ProjectStatus = "active" | "on_hold" | "closed";
type MilestoneStatus = "pending" | "achieved" | "missed";

interface Project {
  id: string;
  name: string;
  code: string | null;
  status: ProjectStatus;
  client_name: string | null;
  location: string | null;
  contract_reference: string | null;
  contract_value: number | null;
  contract_currency: string | null;
  baseline_start_date: string | null;
  baseline_end_date: string | null;
  budget_amount: number | null;
  budget_currency: string | null;
}

interface WBSNode {
  id: string;
  parent_wbs_node_id: string | null;
  code: string;
  name: string;
  sequence: number;
}

interface Milestone {
  id: string;
  name: string;
  target_date: string;
  actual_date: string | null;
  status: MilestoneStatus;
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

const milestoneColors: Record<MilestoneStatus, string> = {
  pending: "bg-blue-50 text-blue-700",
  achieved: "bg-emerald-50 text-emerald-700",
  missed: "bg-red-50 text-red-700",
};

const milestoneLabels: Record<MilestoneStatus, string> = {
  pending: "Pending",
  achieved: "Achieved",
  missed: "Missed",
};

function formatAmount(amount: number | null, currency: string | null): string {
  if (amount === null) return "—";
  return currency ? `${amount.toLocaleString()} ${currency}` : amount.toLocaleString();
}

function WBSTree({ nodes, parentId }: { nodes: WBSNode[]; parentId: string | null }) {
  const children = nodes.filter((n) => n.parent_wbs_node_id === parentId).sort((a, b) => a.sequence - b.sequence);
  if (children.length === 0) return null;
  return (
    <ul className="space-y-1">
      {children.map((node) => (
        <li key={node.id}>
          <div className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-stone-50">
            <span className="text-xs font-medium text-zinc-400">{node.code}</span>
            <span className="text-zinc-800">{node.name}</span>
          </div>
          <div className="ml-4 border-l border-zinc-100 pl-3">
            <WBSTree nodes={nodes} parentId={node.id} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [wbsNodes, setWbsNodes] = useState<WBSNode[] | null>(null);
  const [milestones, setMilestones] = useState<Milestone[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !id) return;
    Promise.all([
      apiFetch<{ project: Project }>(`/projects/${id}`, session.access_token),
      apiFetch<{ wbsNodes: WBSNode[] }>(`/projects/${id}/wbs-nodes`, session.access_token),
      apiFetch<{ milestones: Milestone[] }>(`/projects/${id}/milestones`, session.access_token),
    ])
      .then(([projectData, wbsData, milestoneData]) => {
        setProject(projectData.project);
        setWbsNodes(wbsData.wbsNodes);
        setMilestones(milestoneData.milestones);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }, [session, id]);

  const sortedMilestones = (milestones ?? []).slice().sort((a, b) => a.target_date.localeCompare(b.target_date));

  return (
    <div className="space-y-6">
      <div>
        <Link to="/projects" className="text-sm text-zinc-400 hover:text-zinc-600">
          ← Back to projects
        </Link>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!project && !error && <p className="text-sm text-zinc-400">Loading…</p>}

      {project && (
        <>
          <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-brand text-2xl font-bold text-zinc-900">{project.name}</h1>
                {project.code && <p className="mt-1 text-sm text-zinc-400">{project.code}</p>}
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[project.status]}`}>
                {statusLabels[project.status]}
              </span>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Client</dt>
                <dd className="mt-1 text-sm text-zinc-800">{project.client_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Location</dt>
                <dd className="mt-1 text-sm text-zinc-800">{project.location ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Contract ref</dt>
                <dd className="mt-1 text-sm text-zinc-800">{project.contract_reference ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Contract value</dt>
                <dd className="mt-1 text-sm text-zinc-800">{formatAmount(project.contract_value, project.contract_currency)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Budget</dt>
                <dd className="mt-1 text-sm text-zinc-800">{formatAmount(project.budget_amount, project.budget_currency)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Baseline dates</dt>
                <dd className="mt-1 text-sm text-zinc-800">
                  {project.baseline_start_date ? new Date(project.baseline_start_date).toLocaleDateString() : "—"}
                  {" → "}
                  {project.baseline_end_date ? new Date(project.baseline_end_date).toLocaleDateString() : "—"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-6 py-4">
                <h2 className="font-brand text-base font-semibold text-zinc-900">Work breakdown structure</h2>
              </div>
              <div className="p-6">
                {wbsNodes?.length === 0 && <p className="text-sm text-zinc-400">No WBS nodes yet.</p>}
                {wbsNodes && wbsNodes.length > 0 && <WBSTree nodes={wbsNodes} parentId={null} />}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-6 py-4">
                <h2 className="font-brand text-base font-semibold text-zinc-900">Milestones</h2>
              </div>
              <div className="p-6">
                {sortedMilestones.length === 0 && <p className="text-sm text-zinc-400">No milestones yet.</p>}
                {sortedMilestones.length > 0 && (
                  <ol className="space-y-3">
                    {sortedMilestones.map((milestone) => (
                      <li key={milestone.id} className="flex items-center justify-between rounded-lg bg-stone-50 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-zinc-800">{milestone.name}</p>
                          <p className="mt-0.5 text-xs text-zinc-400">
                            target {new Date(milestone.target_date).toLocaleDateString()}
                            {milestone.actual_date && ` · actual ${new Date(milestone.actual_date).toLocaleDateString()}`}
                          </p>
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${milestoneColors[milestone.status]}`}>
                          {milestoneLabels[milestone.status]}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
