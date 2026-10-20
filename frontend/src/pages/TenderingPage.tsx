import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { PermissionGate } from "../components/PermissionGate";
import { StatusBadge } from "../components/StatusBadge";
import { CurrencyDisplay } from "../components/CurrencyDisplay";

interface Client {
  id: string;
  name: string;
}

type OpportunityStage = "lead" | "qualified" | "site_visit" | "tender" | "negotiation" | "won" | "lost";

interface Opportunity {
  id: string;
  client_id: string;
  title: string;
  source: string;
  owner_id: string;
  stage: OpportunityStage;
  expected_value: number | null;
  probability: number | null;
}

interface TenderSubmission {
  id: string;
  deadline_date: string;
  submitted_at: string | null;
  evidence_reference: string | null;
  notes: string | null;
}

interface TenderOpportunitySummary {
  opportunity: Opportunity;
  clientName: string;
  submissions: TenderSubmission[];
}

export function TenderingPage() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [tenders, setTenders] = useState<TenderOpportunitySummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [baseCurrency, setBaseCurrency] = useState("AED");

  // New submission modal state
  const [activeOppForSubmission, setActiveOppForSubmission] = useState<Opportunity | null>(null);
  const [submissionDeadline, setSubmissionDeadline] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    loadAllTenderData();
    // Load base currency from currencies endpoint if available
    apiFetch<{ currencies: { code: string; is_base: boolean }[] }>("/master-data/currencies", session.access_token)
      .then((data) => {
        const base = data.currencies?.find((c) => c.is_base);
        if (base) setBaseCurrency(base.code);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function loadAllTenderData() {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const [oppRes, clientRes] = await Promise.all([
        apiFetch<{ opportunities: Opportunity[] }>("/crm/opportunities", session.access_token),
        apiFetch<{ clients: Client[] }>("/crm/clients", session.access_token).catch(() => ({ clients: [] })),
      ]);

      const clientMap = new Map<string, string>();
      for (const c of clientRes.clients || []) {
        clientMap.set(c.id, c.name);
      }

      const opportunities = oppRes.opportunities || [];

      // Fetch tender submissions for each opportunity concurrently
      const summaries: TenderOpportunitySummary[] = await Promise.all(
        opportunities.map(async (opp) => {
          try {
            const subRes = await apiFetch<{ tenderSubmissions: TenderSubmission[] }>(
              `/crm/opportunities/${opp.id}/tender-submissions`,
              session.access_token
            );
            return {
              opportunity: opp,
              clientName: clientMap.get(opp.client_id) ?? "Unknown Client",
              submissions: subRes.tenderSubmissions || [],
            };
          } catch {
            return {
              opportunity: opp,
              clientName: clientMap.get(opp.client_id) ?? "Unknown Client",
              submissions: [],
            };
          }
        })
      );

      setTenders(summaries);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load tendering and estimation records.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSubmission(e: FormEvent) {
    e.preventDefault();
    if (!session || !activeOppForSubmission || !submissionDeadline) return;
    setSubmitting(true);
    setModalError(null);

    try {
      const res = await apiFetch<{ tenderSubmission: TenderSubmission }>(
        `/crm/opportunities/${activeOppForSubmission.id}/tender-submissions`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            deadlineDate: submissionDeadline,
            notes: submissionNotes.trim() || undefined,
          }),
        }
      );

      // Close modal and navigate directly to estimation & documents workspace
      setActiveOppForSubmission(null);
      setSubmissionDeadline("");
      setSubmissionNotes("");
      navigate(`/tendering/tender-submissions/${res.tenderSubmission.id}?opportunityId=${activeOppForSubmission.id}`);
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : "Failed to create tender submission");
      setSubmitting(false);
    }
  }

  // Filtered list
  const filteredTenders = (tenders || []).filter(({ opportunity, clientName, submissions }) => {
    const matchesSearch =
      !search.trim() ||
      opportunity.title.toLowerCase().includes(search.toLowerCase()) ||
      clientName.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (stageFilter === "active") {
      return opportunity.stage === "tender" || opportunity.stage === "qualified" || opportunity.stage === "site_visit";
    }
    if (stageFilter === "submitted") {
      return submissions.some((s) => s.submitted_at !== null) || opportunity.stage === "negotiation";
    }
    if (stageFilter === "won") {
      return opportunity.stage === "won";
    }
    return true;
  });

  // Analytics Metrics
  const totalTenders = tenders?.length || 0;
  const activeTendersCount =
    tenders?.filter((t) => ["tender", "qualified", "site_visit", "lead"].includes(t.opportunity.stage)).length || 0;
  const totalPipelineValue =
    tenders?.reduce((sum, t) => sum + Number(t.opportunity.expected_value || 0), 0) || 0;
  const totalSubmissionsCount =
    tenders?.reduce((sum, t) => sum + t.submissions.length, 0) || 0;
  const wonCount = tenders?.filter((t) => t.opportunity.stage === "won").length || 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-brand text-2xl font-bold tracking-tight text-zinc-900">
            Tendering, Estimation &amp; Commercials
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Bid preparation, document registers, BoQ quantity take-off, cost build-ups, and commercial bid decisions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/crm"
            className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            Manage CRM Opportunities →
          </Link>
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Active Bid Pipeline</div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 font-display">
            {activeTendersCount} Tenders
          </div>
          <div className="mt-1 text-xs text-zinc-500">Across {totalTenders} total opportunities</div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Tender Value</div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-amber-600 font-display">
            <CurrencyDisplay amount={totalPipelineValue} currencyCode={baseCurrency} />
          </div>
          <div className="mt-1 text-xs text-zinc-500">Expected contract sum across pipeline</div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Tender Submissions</div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-indigo-600 font-display">
            {totalSubmissionsCount} Submissions
          </div>
          <div className="mt-1 text-xs text-zinc-500">Bid documents &amp; estimate versions</div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Won / Awarded Bids</div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 font-display">
            {wonCount} Won
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {totalTenders > 0 ? `${Math.round((wonCount / totalTenders) * 100)}% pipeline conversion` : "No tenders"}
          </div>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200">{error}</div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto">
          {[
            { key: "all", label: "All Tenders" },
            { key: "active", label: "In Preparation / Active" },
            { key: "submitted", label: "Submitted" },
            { key: "won", label: "Awarded / Won" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStageFilter(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                stageFilter === tab.key
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Search tender or client…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Main Registry Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        {loading && (
          <div className="py-12 text-center text-xs text-zinc-400 font-medium">
            Loading tendering and cost estimation records…
          </div>
        )}

        {!loading && filteredTenders.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm font-semibold text-zinc-700">No tendering opportunities found.</p>
            <p className="mt-1 text-xs text-zinc-400">
              Create an opportunity in CRM and set its stage to "Tender" to track its estimate and bid submission here.
            </p>
            <div className="mt-4">
              <Link
                to="/crm"
                className="inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800"
              >
                Go to CRM &amp; Pipeline
              </Link>
            </div>
          </div>
        )}

        {!loading && filteredTenders.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-100 bg-zinc-50 font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-6 py-3.5">Opportunity &amp; Package</th>
                  <th className="px-6 py-3.5">Client</th>
                  <th className="px-6 py-3.5">Stage</th>
                  <th className="px-6 py-3.5">Expected Value</th>
                  <th className="px-6 py-3.5">Tender Submissions</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredTenders.map(({ opportunity, clientName, submissions }) => {
                  const latestSubmission = submissions[submissions.length - 1];

                  return (
                    <tr key={opportunity.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <Link
                          to={`/crm/opportunities/${opportunity.id}`}
                          className="font-semibold text-zinc-900 hover:text-amber-600 block text-sm"
                        >
                          {opportunity.title}
                        </Link>
                        <span className="text-[11px] text-zinc-400">
                          Source: {opportunity.source || "Direct Client RFQ"}
                        </span>
                      </td>

                      <td className="px-6 py-4 font-medium text-zinc-700">
                        {clientName}
                      </td>

                      <td className="px-6 py-4">
                        <StatusBadge status={opportunity.stage} />
                      </td>

                      <td className="px-6 py-4 font-semibold text-zinc-900">
                        {opportunity.expected_value ? (
                          <CurrencyDisplay amount={opportunity.expected_value} currencyCode={baseCurrency} />
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {submissions.length === 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-600">
                            No submissions yet
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-700">
                              {submissions.length} submission{submissions.length === 1 ? "" : "s"}
                            </span>
                            {latestSubmission && (
                              <div className="text-[11px] text-zinc-500">
                                Due: {new Date(latestSubmission.deadline_date).toLocaleDateString()}
                                {latestSubmission.submitted_at && " (Submitted)"}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          {submissions.length > 0 ? (
                            <Link
                              to={`/tendering/tender-submissions/${latestSubmission.id}?opportunityId=${opportunity.id}`}
                              className="rounded-lg bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                            >
                              Open Estimating Workspace →
                            </Link>
                          ) : (
                            <PermissionGate permission="tendering.document.manage">
                              <button
                                onClick={() => {
                                  setActiveOppForSubmission(opportunity);
                                  setSubmissionDeadline("");
                                  setSubmissionNotes("");
                                  setModalError(null);
                                }}
                                className="rounded-lg bg-zinc-900 hover:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                              >
                                + Start Tender Submission
                              </button>
                            </PermissionGate>
                          )}

                          <Link
                            to={`/crm/opportunities/${opportunity.id}`}
                            className="rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-600"
                            title="View CRM Opportunity"
                          >
                            CRM
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Start Submission Modal */}
      {activeOppForSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-zinc-200">
            <h2 className="text-base font-bold text-zinc-900 font-display">
              Start Tender Submission
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Create a tender submission package for <span className="font-semibold text-zinc-800">{activeOppForSubmission.title}</span> to begin BoQ estimation and document management.
            </p>

            {modalError && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateSubmission} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Submission Deadline Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={submissionDeadline}
                  onChange={(e) => setSubmissionDeadline(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Commercial &amp; Submission Notes (optional)
                </label>
                <textarea
                  rows={3}
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  placeholder="e.g. Turnkey Civil & MEP package, 5% bid bond required"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveOppForSubmission(null)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !submissionDeadline}
                  className="rounded-lg bg-amber-500 hover:bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-50"
                >
                  {submitting ? "Creating…" : "Create & Launch Estimating"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
