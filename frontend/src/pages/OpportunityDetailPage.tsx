import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { useUsers } from "../hooks/useUsers";
import { UserPicker } from "../components/UserPicker";
import { PermissionGate } from "../components/PermissionGate";
import { WorkflowPicker, type WorkflowDefinitionOption } from "../components/WorkflowPicker";

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
  handover_completed_at?: string | null;
  handover_completed_by?: string | null;
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

type HandoverItemKey =
  | "client_confirmation"
  | "commercial_terms_locked"
  | "site_information_handed_over"
  | "technical_owner_assigned";

const HANDOVER_ITEM_META: Record<HandoverItemKey, { title: string; description: string }> = {
  client_confirmation: {
    title: "Client Confirmation",
    description: "Signed contract, Letter of Award (LOA), or formal Purchase Order received.",
  },
  commercial_terms_locked: {
    title: "Commercial Terms Locked",
    description: "Payment milestones, advance payment %, retention terms, and performance bonds agreed.",
  },
  site_information_handed_over: {
    title: "Site Information Handed Over",
    description: "Site access dates, condition survey, mall fit-out manual, and logistics constraints handed over.",
  },
  technical_owner_assigned: {
    title: "Technical Owner Assigned",
    description: "Project Manager / Operations Technical Lead appointed and briefed.",
  },
};

const ALL_HANDOVER_KEYS: HandoverItemKey[] = [
  "client_confirmation",
  "commercial_terms_locked",
  "site_information_handed_over",
  "technical_owner_assigned",
];

interface HandoverChecklistItem {
  id?: string;
  item_key: HandoverItemKey;
  status: "pending" | "complete";
  evidence_url?: string | null;
  notes?: string | null;
  completed_at?: string | null;
  completed_by?: string | null;
}

interface HandoverException {
  id: string;
  opportunity_id: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "returned_for_correction";
  workflow_instance_id: string;
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

type Tab = "tenders" | "visits" | "handover";

const inputClass =
  "rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

export function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const { users } = useUsers();
  const [tab, setTab] = useState<Tab>("tenders");

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [clients, setClients] = useState<Client[] | null>(null);
  const [siteVisits, setSiteVisits] = useState<SiteVisit[] | null>(null);
  const [tenderSubmissions, setTenderSubmissions] = useState<TenderSubmission[] | null>(null);
  const [handoverItems, setHandoverItems] = useState<HandoverChecklistItem[]>([]);
  const [handoverExceptions, setHandoverExceptions] = useState<HandoverException[]>([]);
  const [workflowDefinitions, setWorkflowDefinitions] = useState<WorkflowDefinitionOption[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [exceptionReason, setExceptionReason] = useState("");
  const [showExceptionForm, setShowExceptionForm] = useState(false);
  const [completingHandover, setCompletingHandover] = useState(false);
  const [completingItemKey, setCompletingItemKey] = useState<string | null>(null);
  const [submittingException, setSubmittingException] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  function loadHandover() {
    if (!session || !id) return;
    apiFetch<{ items: HandoverChecklistItem[] }>(`/crm/opportunities/${id}/handover-checklist`, session.access_token)
      .then((data) => setHandoverItems(data.items ?? []))
      .catch(() => undefined);
    apiFetch<{ exceptions: HandoverException[] }>(`/crm/opportunities/${id}/handover-exceptions`, session.access_token)
      .then(async (data) => {
        const list = data.exceptions ?? [];
        const resolved = await Promise.all(
          list.map(async (exc) => {
            if (exc.status === "pending") {
              try {
                const res = await apiFetch<{ exception: HandoverException }>(
                  `/crm/handover-exceptions/${exc.id}`,
                  session.access_token,
                );
                return res.exception ?? exc;
              } catch {
                return exc;
              }
            }
            return exc;
          }),
        );
        setHandoverExceptions(resolved);
      })
      .catch(() => undefined);
  }

  function loadOpportunity() {
    if (!session || !id) return;
    apiFetch<{ opportunity: Opportunity }>(`/crm/opportunities/${id}`, session.access_token)
      .then((data) => setOpportunity(data.opportunity))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }

  useEffect(() => {
    if (!session || !id) return;
    loadOpportunity();
    apiFetch<{ clients: Client[] }>("/crm/clients", session.access_token)
      .then((data) => setClients(data.clients))
      .catch(() => undefined);
    apiFetch<{ definitions: WorkflowDefinitionOption[] }>("/workflow/definitions", session.access_token)
      .then((data) => setWorkflowDefinitions(data.definitions ?? []))
      .catch(() => undefined);
    loadSiteVisits();
    loadTenderSubmissions();
    loadHandover();
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

  async function handleCompleteHandoverItem(itemKey: HandoverItemKey) {
    if (!session || !id) return;
    setActionError(null);
    setCompletingItemKey(itemKey);
    try {
      await apiFetch(`/crm/opportunities/${id}/handover-checklist/${itemKey}/complete`, session.access_token, {
        method: "POST",
        body: JSON.stringify({}),
      });
      loadHandover();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not complete checklist item");
    } finally {
      setCompletingItemKey(null);
    }
  }

  async function handleCompleteHandover() {
    if (!session || !id) return;
    setActionError(null);
    setCompletingHandover(true);
    try {
      const res = await apiFetch<{ opportunity: Opportunity }>(
        `/crm/opportunities/${id}/handover/complete`,
        session.access_token,
        { method: "POST" },
      );
      setOpportunity(res.opportunity);
      loadHandover();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not complete sales-to-technical handover");
    } finally {
      setCompletingHandover(false);
    }
  }

  async function handleRequestException(event: FormEvent) {
    event.preventDefault();
    if (!session || !id || !exceptionReason.trim() || !selectedWorkflowId) return;
    setActionError(null);
    setSubmittingException(true);
    try {
      await apiFetch(`/crm/opportunities/${id}/handover-exceptions`, session.access_token, {
        method: "POST",
        body: JSON.stringify({
          reason: exceptionReason.trim(),
          definitionId: selectedWorkflowId,
        }),
      });
      setShowExceptionForm(false);
      setExceptionReason("");
      loadHandover();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not submit handover exception");
    } finally {
      setSubmittingException(false);
    }
  }

  const clientName = clients?.find((c) => c.id === opportunity?.client_id)?.name ?? opportunity?.client_id;
  const ownerLabel = users?.find((u) => u.id === opportunity?.owner_id)?.display_name ?? opportunity?.owner_id;

  const tabClass = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition ${
      active ? "bg-brand text-zinc-900" : "text-zinc-500 hover:bg-stone-100"
    }`;

  // Handover state derivation
  const isWon = opportunity?.stage === "won";
  const isHandoverSealed = Boolean(opportunity?.handover_completed_at);
  const checklistMap = new Map<HandoverItemKey, HandoverChecklistItem>();
  for (const item of handoverItems) {
    checklistMap.set(item.item_key, item);
  }
  const allItemsComplete = ALL_HANDOVER_KEYS.every((k) => checklistMap.get(k)?.status === "complete");
  const hasApprovedException = handoverExceptions.some((e) => e.status === "approved");
  const canCompleteHandover = isWon && !isHandoverSealed && (allItemsComplete || hasApprovedException);

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
              <div className="flex items-center gap-2">
                {isHandoverSealed && (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Handover Sealed
                  </span>
                )}
                <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-dim">
                  {STAGE_LABELS[opportunity.stage]}
                </span>
              </div>
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
              Tender Submissions ({tenderSubmissions?.length ?? 0})
            </button>
            <button onClick={() => setTab("visits")} className={tabClass(tab === "visits")}>
              Site Visits ({siteVisits?.length ?? 0})
            </button>
            <button onClick={() => setTab("handover")} className={tabClass(tab === "handover")}>
              Sales-to-Technical Handover {isHandoverSealed ? "✓" : isWon ? "⚠️" : ""}
            </button>
          </div>

          {tab === "tenders" && (
            <div className="space-y-4">
              <PermissionGate permission="crm.lead.manage">
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowTenderForm(true)}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim"
                  >
                    New tender submission
                  </button>
                </div>
              </PermissionGate>

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
              <PermissionGate permission="crm.lead.manage">
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowVisitForm(true)}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim"
                  >
                    Log site visit
                  </button>
                </div>
              </PermissionGate>

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

          {tab === "handover" && (
            <div className="space-y-6">
              {/* Handover Sealed Banner */}
              {isHandoverSealed && (
                <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="font-brand text-lg font-bold text-emerald-950">
                      ✓ Sales-to-Technical Handover Sealed
                    </h3>
                    <p className="mt-1 text-sm text-emerald-800">
                      Handover completed on{" "}
                      {opportunity.handover_completed_at
                        ? new Date(opportunity.handover_completed_at).toLocaleString()
                        : "record"}{" "}
                      by {opportunity.handover_completed_by ? (users?.find(u => u.id === opportunity.handover_completed_by)?.display_name ?? opportunity.handover_completed_by) : "authorized officer"}.
                      The opportunity scope is ready for operational delivery.
                    </p>
                  </div>
                  <Link
                    to="/projects"
                    className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
                  >
                    Go to Projects Module →
                  </Link>
                </div>
              )}

              {/* Won but not sealed banner */}
              {!isHandoverSealed && isWon && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
                  <h3 className="text-sm font-semibold text-amber-900">
                    Mandatory Sales-to-Technical Handover Gate (FR-CRM-004)
                  </h3>
                  <p className="mt-1 text-xs text-amber-800">
                    This opportunity has been won! All 4 items below must be signed off, or an authorized exception must be approved, before the handover can be sealed and operations mobilized.
                  </p>
                </div>
              )}

              {/* Not won yet */}
              {!isWon && !isHandoverSealed && (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                  <p className="text-xs text-zinc-600">
                    Handover gate items are tracked below. Final completion activates once this opportunity moves to <strong>Won</strong> status.
                  </p>
                </div>
              )}

              {/* 4 Mandatory Items */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {ALL_HANDOVER_KEYS.map((key) => {
                  const meta = HANDOVER_ITEM_META[key];
                  const item = checklistMap.get(key);
                  const isComplete = item?.status === "complete";
                  const completedUser = users?.find((u) => u.id === item?.completed_by)?.display_name ?? item?.completed_by;

                  return (
                    <div
                      key={key}
                      className={`relative flex flex-col justify-between rounded-2xl border p-5 transition ${
                        isComplete
                          ? "border-emerald-200 bg-white"
                          : "border-zinc-200 bg-white hover:border-zinc-300"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              isComplete
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-zinc-100 text-zinc-600"
                            }`}
                          >
                            {isComplete ? "✓ Complete" : "Pending"}
                          </span>
                        </div>
                        <h4 className="mt-2 font-medium text-zinc-900">{meta.title}</h4>
                        <p className="mt-1 text-xs text-zinc-500">{meta.description}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-zinc-100">
                        {isComplete ? (
                          <p className="text-xs text-zinc-400">
                            Signed off{" "}
                            {item?.completed_at
                              ? new Date(item.completed_at).toLocaleDateString()
                              : ""}{" "}
                            {completedUser ? `by ${completedUser}` : ""}
                          </p>
                        ) : (
                          <PermissionGate permission="crm.lead.manage">
                            <button
                              onClick={() => handleCompleteHandoverItem(key)}
                              disabled={completingItemKey === key || isHandoverSealed}
                              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                            >
                              {completingItemKey === key ? "Saving…" : "Mark as Complete"}
                            </button>
                          </PermissionGate>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Complete Handover Action */}
              {!isHandoverSealed && isWon && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
                  <div>
                    <h4 className="font-semibold text-zinc-900">Seal Handover to Operations</h4>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {allItemsComplete
                        ? "All 4 checklist requirements are satisfied. You may now seal the handover."
                        : hasApprovedException
                        ? "An authorized exception is approved on file. You may proceed with sealing handover."
                        : "Handover is gated until all 4 criteria are marked complete, or an approved exception is logged."}
                    </p>
                  </div>
                  <PermissionGate permission="crm.lead.manage">
                    <button
                      onClick={handleCompleteHandover}
                      disabled={!canCompleteHandover || completingHandover}
                      className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50"
                    >
                      {completingHandover ? "Sealing Handover…" : "Seal Handover Gate"}
                    </button>
                  </PermissionGate>
                </div>
              )}

              {/* Exceptions Section */}
              <div className="space-y-3 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-zinc-900">Handover Exceptions</h4>
                    <p className="text-xs text-zinc-500">
                      Route an exception request through the approval workflow if mobilization is needed before all gates can be checked.
                    </p>
                  </div>
                  {!isHandoverSealed && isWon && !showExceptionForm && (
                    <PermissionGate permission="crm.lead.manage">
                      <button
                        onClick={() => setShowExceptionForm(true)}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        Request Exception
                      </button>
                    </PermissionGate>
                  )}
                </div>

                {showExceptionForm && (
                  <form onSubmit={handleRequestException} className="space-y-3 pt-3 border-t border-zinc-100">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700">Exception Reason / Justification</label>
                      <textarea
                        rows={2}
                        value={exceptionReason}
                        onChange={(e) => setExceptionReason(e.target.value)}
                        placeholder="e.g. Client PO pending final board signature; landlord access permit already secured and mobilization urgently needed."
                        className="mt-1 w-full rounded-lg border border-zinc-200 p-2.5 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Select Approval Workflow
                      </label>
                      <WorkflowPicker
                        contextKey="handover_exception"
                        definitions={workflowDefinitions}
                        value={selectedWorkflowId}
                        onChange={setSelectedWorkflowId}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={submittingException || !exceptionReason.trim() || !selectedWorkflowId}
                        className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50"
                      >
                        {submittingException ? "Submitting…" : "Submit Exception for Approval"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowExceptionForm(false)}
                        className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {handoverExceptions.length === 0 ? (
                  <p className="text-xs text-zinc-400">No handover exceptions on record.</p>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {handoverExceptions.map((exc) => (
                      <div key={exc.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <span
                            className={`inline-block mr-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              exc.status === "approved"
                                ? "bg-emerald-100 text-emerald-800"
                                : exc.status === "rejected"
                                ? "bg-red-100 text-red-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {exc.status}
                          </span>
                          <span className="text-zinc-700">{exc.reason}</span>
                        </div>
                        {exc.status === "pending" && (
                          <button
                            onClick={loadHandover}
                            className="text-brand hover:underline font-medium"
                          >
                            Check Status
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
