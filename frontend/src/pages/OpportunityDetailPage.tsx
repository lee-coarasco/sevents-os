import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { usePermissions } from "../hooks/usePermissions";
import { useUsers } from "../hooks/useUsers";
import { UserPicker } from "../components/UserPicker";

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

interface Client {
  id: string;
  name: string;
}

interface SiteVisit {
  id: string;
  visited_by: string;
  visit_date: string;
  notes: string | null;
}

interface TenderSubmission {
  id: string;
  deadline_date: string;
  submitted_at: string | null;
  evidence_reference: string | null;
  notes: string | null;
}

const STAGE_LABELS: Record<OpportunityStage, string> = {
  lead: "Lead",
  qualified: "Qualified",
  site_visit: "Site visit",
  tender: "Tender",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

type Tab = "visits" | "tenders";

const inputClass =
  "rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

export function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const { has, loading: permissionsLoading } = usePermissions();
  const { users } = useUsers();
  const [tab, setTab] = useState<Tab>("tenders");

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [clients, setClients] = useState<Client[] | null>(null);
  const [siteVisits, setSiteVisits] = useState<SiteVisit[] | null>(null);
  const [tenderSubmissions, setTenderSubmissions] = useState<TenderSubmission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage = has("crm.lead.manage");

  const [showVisitForm, setShowVisitForm] = useState(false);
  const [visitBy, setVisitBy] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [visitNotes, setVisitNotes] = useState("");

  const [showTenderForm, setShowTenderForm] = useState(false);
  const [tenderDeadline, setTenderDeadline] = useState("");
  const [tenderSubmittedAt, setTenderSubmittedAt] = useState("");
  const [tenderEvidence, setTenderEvidence] = useState("");
  const [tenderNotes, setTenderNotes] = useState("");

  function loadSiteVisits() {
    if (!session || !id) return;
    apiFetch<{ siteVisits: SiteVisit[] }>(`/crm/opportunities/${id}/site-visits`, session.access_token)
      .then((data) => setSiteVisits(data.siteVisits))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }

  function loadTenderSubmissions() {
    if (!session || !id) return;
    apiFetch<{ tenderSubmissions: TenderSubmission[] }>(`/crm/opportunities/${id}/tender-submissions`, session.access_token)
      .then((data) => setTenderSubmissions(data.tenderSubmissions))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }

  useEffect(() => {
    if (!session || !id) return;
    apiFetch<{ opportunity: Opportunity }>(`/crm/opportunities/${id}`, session.access_token)
      .then((data) => setOpportunity(data.opportunity))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
    apiFetch<{ clients: Client[] }>("/crm/clients", session.access_token)
      .then((data) => setClients(data.clients))
      .catch(() => undefined);
    loadSiteVisits();
    loadTenderSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, id]);

  async function handleAddVisit(event: FormEvent) {
    event.preventDefault();
    if (!session || !id || !visitBy || !visitDate) return;
    setActionError(null);
    try {
      await apiFetch(`/crm/opportunities/${id}/site-visits`, session.access_token, {
        method: "POST",
        body: JSON.stringify({ visitedBy: visitBy, visitDate, notes: visitNotes.trim() || undefined }),
      });
      setShowVisitForm(false);
      setVisitBy("");
      setVisitDate("");
      setVisitNotes("");
      loadSiteVisits();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not add the site visit");
    }
  }

  async function handleAddTenderSubmission(event: FormEvent) {
    event.preventDefault();
    if (!session || !id || !tenderDeadline) return;
    setActionError(null);
    try {
      await apiFetch(`/crm/opportunities/${id}/tender-submissions`, session.access_token, {
        method: "POST",
        body: JSON.stringify({
          deadlineDate: tenderDeadline,
          submittedAt: tenderSubmittedAt || undefined,
          evidenceReference: tenderEvidence.trim() || undefined,
          notes: tenderNotes.trim() || undefined,
        }),
      });
      setShowTenderForm(false);
      setTenderDeadline("");
      setTenderSubmittedAt("");
      setTenderEvidence("");
      setTenderNotes("");
      loadTenderSubmissions();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not add the tender submission");
    }
  }

  const clientName = clients?.find((c) => c.id === opportunity?.client_id)?.name ?? opportunity?.client_id;
  const ownerLabel = users?.find((u) => u.id === opportunity?.owner_id)?.display_name ?? opportunity?.owner_id;

  const tabClass = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition ${
      active ? "bg-brand text-zinc-900" : "text-zinc-500 hover:bg-stone-100"
    }`;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/crm" className="text-sm text-zinc-400 hover:text-zinc-600">
          ← Back to CRM
        </Link>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!opportunity && !error && <p className="text-sm text-zinc-400">Loading…</p>}

      {opportunity && (
        <>
          <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-brand text-2xl font-bold text-zinc-900">{opportunity.title}</h1>
                <p className="mt-1 text-sm text-zinc-400">{clientName}</p>
              </div>
              <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-dim">
                {STAGE_LABELS[opportunity.stage]}
              </span>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Source</dt>
                <dd className="mt-1 text-sm text-zinc-800">{opportunity.source}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Owner</dt>
                <dd className="mt-1 text-sm text-zinc-800">{ownerLabel}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Expected value</dt>
                <dd className="mt-1 text-sm text-zinc-800">{opportunity.expected_value?.toLocaleString() ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Probability</dt>
                <dd className="mt-1 text-sm text-zinc-800">{opportunity.probability !== null ? `${opportunity.probability}%` : "—"}</dd>
              </div>
            </dl>
          </div>

          {actionError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}

          <div className="flex gap-2">
            <button onClick={() => setTab("tenders")} className={tabClass(tab === "tenders")}>
              Tender Submissions
            </button>
            <button onClick={() => setTab("visits")} className={tabClass(tab === "visits")}>
              Site Visits
            </button>
          </div>

          {tab === "tenders" && (
            <div className="space-y-4">
              {!permissionsLoading && canManage && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowTenderForm(true)}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim"
                  >
                    New tender submission
                  </button>
                </div>
              )}

              {showTenderForm && (
                <form
                  onSubmit={handleAddTenderSubmission}
                  className="grid grid-cols-1 gap-2 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm sm:grid-cols-2"
                >
                  <label className="flex flex-col gap-1 text-xs text-zinc-400">
                    Deadline date
                    <input type="date" value={tenderDeadline} onChange={(e) => setTenderDeadline(e.target.value)} className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-zinc-400">
                    Submitted at
                    <input type="date" value={tenderSubmittedAt} onChange={(e) => setTenderSubmittedAt(e.target.value)} className={inputClass} />
                  </label>
                  <input
                    value={tenderEvidence}
                    onChange={(e) => setTenderEvidence(e.target.value)}
                    placeholder="Evidence reference"
                    className={inputClass}
                  />
                  <input value={tenderNotes} onChange={(e) => setTenderNotes(e.target.value)} placeholder="Notes" className={inputClass} />
                  <div className="col-span-full flex gap-2">
                    <button
                      type="submit"
                      disabled={!tenderDeadline}
                      className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50"
                    >
                      Add tender submission
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowTenderForm(false)}
                      className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {tenderSubmissions?.length === 0 && <p className="text-sm text-zinc-400">No tender submissions yet.</p>}
              {tenderSubmissions && tenderSubmissions.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                        <th className="px-6 py-3">Deadline</th>
                        <th className="px-6 py-3">Submitted</th>
                        <th className="px-6 py-3">Evidence</th>
                        <th className="px-6 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {tenderSubmissions.map((ts) => (
                        <tr key={ts.id} className="border-b border-zinc-50 last:border-0 hover:bg-stone-50">
                          <td className="px-6 py-4 text-zinc-800">{new Date(ts.deadline_date).toLocaleDateString()}</td>
                          <td className="px-6 py-4 text-zinc-600">
                            {ts.submitted_at ? new Date(ts.submitted_at).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-6 py-4 text-zinc-600">{ts.evidence_reference ?? "—"}</td>
                          <td className="px-6 py-4 text-right">
                            <Link
                              to={`/tendering/tender-submissions/${ts.id}?opportunityId=${id}`}
                              className="text-xs text-zinc-400 hover:text-brand-dim"
                            >
                              Open documents, estimates &amp; bid decision →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "visits" && (
            <div className="space-y-4">
              {!permissionsLoading && canManage && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowVisitForm(true)}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim"
                  >
                    Log site visit
                  </button>
                </div>
              )}

              {showVisitForm && (
                <form onSubmit={handleAddVisit} className="grid grid-cols-1 gap-2 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm sm:grid-cols-3">
                  <UserPicker value={visitBy} onChange={setVisitBy} placeholder="Visited by…" />
                  <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} className={inputClass} />
                  <input value={visitNotes} onChange={(e) => setVisitNotes(e.target.value)} placeholder="Notes" className={inputClass} />
                  <div className="col-span-full flex gap-2">
                    <button
                      type="submit"
                      disabled={!visitBy || !visitDate}
                      className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50"
                    >
                      Add visit
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowVisitForm(false)}
                      className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {siteVisits?.length === 0 && <p className="text-sm text-zinc-400">No site visits logged yet.</p>}
              {siteVisits && siteVisits.length > 0 && (
                <ol className="space-y-3">
                  {siteVisits.map((visit) => (
                    <li key={visit.id} className="rounded-lg bg-stone-50 px-4 py-3">
                      <p className="text-sm font-medium text-zinc-800">{new Date(visit.visit_date).toLocaleDateString()}</p>
                      {visit.notes && <p className="mt-0.5 text-xs text-zinc-500">{visit.notes}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
