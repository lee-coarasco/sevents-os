import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { PermissionGate } from "../components/PermissionGate";
import { StatusBadge } from "../components/StatusBadge";
import { ActivityThread, type ActivityComment, type ActivityDecision } from "../components/ActivityThread";
import { FileAttachment, AttachmentLink, type AttachmentResult } from "../components/FileAttachment";
import { CurrencyInput } from "../components/CurrencyInput";
import { CurrencyDisplay } from "../components/CurrencyDisplay";
import { EntityPicker } from "../components/EntityPicker";

interface TenderDocument {
  id: string;
  document_type: string;
  title: string;
  document_number: string | null;
  revision: string | null;
  received_date: string | null;
  storage_reference: string | null;
  created_by: string | null;
  created_at: string;
}

type EstimateStatus = "draft" | "pending_approval" | "approved" | "rejected" | "returned_for_correction" | "superseded";

interface Estimate {
  id: string;
  version: number;
  status: EstimateStatus;
  assumptions: string | null;
  inclusions: string | null;
  exclusions: string | null;
  taxes: number;
  overheads: number;
  contingency: number;
  margin: number;
  subtotal_amount: number;
  total_amount: number;
  workflow_instance_id: string | null;
}

type CostCategory = "labour" | "material" | "equipment" | "subcontractor";
const COST_CATEGORIES: CostCategory[] = ["labour", "material", "equipment", "subcontractor"];

interface EstimateLine {
  id: string;
  item: string;
  quantity: number;
  unit: string;
  rate: number;
  cost_category: CostCategory;
  line_total: number;
}

type BidRecommendation = "bid" | "no_bid";
type BidNoBidStatus = "draft" | "pending_approval" | "approved" | "approved_with_conditions" | "rejected" | "returned_for_correction";

interface BidNoBidDecision {
  id: string;
  estimate_id: string;
  recommendation: BidRecommendation;
  status: BidNoBidStatus;
  conditions: string | null;
}

type BidCriterion = "financial_viability" | "technical_capability" | "risk_exposure" | "strategic_fit" | "resource_availability";
const BID_CRITERIA: BidCriterion[] = ["financial_viability", "technical_capability", "risk_exposure", "strategic_fit", "resource_availability"];

interface BidCriteriaScore {
  id: string;
  criterion: BidCriterion;
  score: number;
  rationale: string;
}

interface BidSubmission {
  id: string;
  submitted_to: string;
  submitted_at: string;
  evidence_reference: string | null;
}

interface WorkflowDefinitionOption {
  id: string;
  name: string;
}

type Tab = "documents" | "estimates" | "bidding";

const inputClass =
  "rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

function DefinitionPicker({
  definitions,
  value,
  onChange,
}: {
  definitions: WorkflowDefinitionOption[] | null;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      <option value="">Select approval workflow…</option>
      {definitions?.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </select>
  );
}

export function TenderSubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const opportunityId = searchParams.get("opportunityId");
  const { session } = useAuth();
  const [tab, setTab] = useState<Tab>("documents");
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [definitions, setDefinitions] = useState<WorkflowDefinitionOption[] | null>(null);
  const [baseCurrency, setBaseCurrency] = useState("AED");

  // Documents
  const [documents, setDocuments] = useState<TenderDocument[] | null>(null);
  const [showDocForm, setShowDocForm] = useState(false);
  const [docType, setDocType] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [docRevision, setDocRevision] = useState("");
  const [docReceivedDate, setDocReceivedDate] = useState("");
  const [docAttachment, setDocAttachment] = useState<AttachmentResult | null>(null);

  // Estimates
  const [estimates, setEstimates] = useState<Estimate[] | null>(null);
  const [showEstimateForm, setShowEstimateForm] = useState(false);
  const [creatingEstimate, setCreatingEstimate] = useState(false);
  const [creatingVersionId, setCreatingVersionId] = useState<string | null>(null);
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [estAssumptions, setEstAssumptions] = useState("");
  const [estInclusions, setEstInclusions] = useState("");
  const [estExclusions, setEstExclusions] = useState("");
  const [estTaxes, setEstTaxes] = useState("0");
  const [estOverheads, setEstOverheads] = useState("0");
  const [estContingency, setEstContingency] = useState("0");
  const [estMargin, setEstMargin] = useState("0");
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null);
  const [lines, setLines] = useState<EstimateLine[] | null>(null);
  const [lineItem, setLineItem] = useState("");
  const [lineQty, setLineQty] = useState("");
  const [lineUomId, setLineUomId] = useState("");
  const [lineRate, setLineRate] = useState<number | null>(null);
  const [lineCategory, setLineCategory] = useState<CostCategory>("material");
  const [estimateDefinitionId, setEstimateDefinitionId] = useState("");
  const [estimateComments, setEstimateComments] = useState<ActivityComment[]>([]);
  const [estimateDecisions, setEstimateDecisions] = useState<ActivityDecision[]>([]);

  // Bid / no-bid
  const [bidEstimateId, setBidEstimateId] = useState("");
  const [decision, setDecision] = useState<BidNoBidDecision | null>(null);
  const [decisionRecommendation, setDecisionRecommendation] = useState<BidRecommendation>("bid");
  const [criteriaScores, setCriteriaScores] = useState<BidCriteriaScore[] | null>(null);
  const [criterion, setCriterion] = useState<BidCriterion>("financial_viability");
  const [criterionScore, setCriterionScore] = useState("");
  const [criterionRationale, setCriterionRationale] = useState("");
  const [bidDefinitionId, setBidDefinitionId] = useState("");
  const [submissions, setSubmissions] = useState<BidSubmission[] | null>(null);
  const [submittedTo, setSubmittedTo] = useState("");
  const [submittedAt, setSubmittedAt] = useState("");
  const [submissionEvidence, setSubmissionEvidence] = useState("");

  function loadDocuments() {
    if (!session || !id) return;
    apiFetch<{ documents: TenderDocument[] }>(`/tendering/tender-submissions/${id}/documents`, session.access_token)
      .then((data) => setDocuments(data.documents))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }

  function loadEstimates() {
    if (!session || !id) return;
    apiFetch<{ estimates: Estimate[] }>(`/tendering/tender-submissions/${id}/estimates`, session.access_token, { cache: "reload" })
      .then(async (data) => {
        setEstimates(data.estimates);
        const pending = (data.estimates || []).filter((e) => e.status === "pending_approval" && e.workflow_instance_id);
        if (pending.length > 0) {
          const results = await Promise.allSettled(
            pending.map((e) =>
              apiFetch<{ estimate: Estimate }>(`/estimates/${e.id}/approval-status`, session.access_token, { cache: "reload" })
            )
          );
          let changed = false;
          const updated = [...(data.estimates || [])];
          for (const r of results) {
            if (r.status === "fulfilled" && r.value?.estimate) {
              const idx = updated.findIndex((x) => x.id === r.value.estimate.id);
              if (idx !== -1 && updated[idx].status !== r.value.estimate.status) {
                updated[idx] = r.value.estimate;
                changed = true;
              }
            }
          }
          if (changed) setEstimates(updated);
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }

  function loadLines(estimateId: string) {
    if (!session) return;
    apiFetch<{ lines: EstimateLine[] }>(`/estimates/${estimateId}/lines`, session.access_token)
      .then((data) => setLines(data.lines))
      .catch((err) => setActionError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }

  function loadEstimateActivity(estimate: Estimate) {
    if (!session || !estimate.workflow_instance_id) {
      setEstimateComments([]);
      setEstimateDecisions([]);
      return;
    }
    apiFetch<{ approvals: { comments?: ActivityComment[]; decisions?: ActivityDecision[] }[] }>(
      `/approvals?workflowInstanceId=${estimate.workflow_instance_id}`,
      session.access_token,
    )
      .then((data) => {
        const approval = data.approvals?.[0];
        setEstimateComments(approval?.comments ?? []);
        setEstimateDecisions(approval?.decisions ?? []);
      })
      .catch(() => {
        setEstimateComments([]);
        setEstimateDecisions([]);
      });
  }

  function loadBidDecision(estimateId: string) {
    if (!session) return;
    apiFetch<{ decisions: BidNoBidDecision[] }>(`/estimates/${estimateId}/bid-decisions`, session.access_token)
      .then((data) => {
        const found = data.decisions[0] ?? null;
        setDecision(found);
        if (found) {
          loadCriteriaScores(found.id);
          loadSubmissions(found.id);
        } else {
          setCriteriaScores(null);
          setSubmissions(null);
        }
      })
      .catch((err) => setActionError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }

  function loadCriteriaScores(decisionId: string) {
    if (!session) return;
    apiFetch<{ scores: BidCriteriaScore[] }>(`/bid-decisions/${decisionId}/criteria`, session.access_token)
      .then((data) => setCriteriaScores(data.scores))
      .catch(() => undefined);
  }

  function loadSubmissions(decisionId: string) {
    if (!session) return;
    apiFetch<{ submissions: BidSubmission[] }>(`/bid-decisions/${decisionId}/submissions`, session.access_token)
      .then((data) => setSubmissions(data.submissions))
      .catch(() => undefined);
  }

  useEffect(() => {
    if (!session) return;
    apiFetch<{ definitions: WorkflowDefinitionOption[] }>("/workflow/definitions/published", session.access_token)
      .then((data) => setDefinitions(data.definitions))
      .catch(() => setDefinitions([]));
    // Try to find the base currency for display; fall back to AED if unavailable.
    apiFetch<{ currencies: { code: string; is_base_currency: boolean }[] }>("/master-data/currencies", session.access_token)
      .then((data) => {
        const base = data.currencies.find((c) => c.is_base_currency);
        if (base) setBaseCurrency(base.code);
      })
      .catch(() => undefined);
  }, [session]);

  useEffect(loadDocuments, [session, id]);
  useEffect(loadEstimates, [session, id]);

  useEffect(() => {
    if (tab === "estimates") {
      loadEstimates();
    }
  }, [tab]);

  useEffect(() => {
    const hasPending = estimates?.some((e) => e.status === "pending_approval");
    if (!hasPending || tab !== "estimates") return;
    const interval = setInterval(() => {
      loadEstimates();
    }, 5000);
    return () => clearInterval(interval);
  }, [estimates, tab, session, id]);

  useEffect(() => {
    if (!selectedEstimateId) {
      setLines(null);
      setEstimateComments([]);
      setEstimateDecisions([]);
      return;
    }
    loadLines(selectedEstimateId);
    const est = estimates?.find((e) => e.id === selectedEstimateId);
    if (est) loadEstimateActivity(est);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, selectedEstimateId, estimates]);

  useEffect(() => {
    if (!bidEstimateId) {
      setDecision(null);
      setCriteriaScores(null);
      setSubmissions(null);
      return;
    }
    loadBidDecision(bidEstimateId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, bidEstimateId]);

  async function handleAddDocument(event: FormEvent) {
    event.preventDefault();
    if (!session || !id || !docType.trim() || !docTitle.trim()) return;
    setActionError(null);
    try {
      await apiFetch(`/tendering/tender-submissions/${id}/documents`, session.access_token, {
        method: "POST",
        body: JSON.stringify({
          documentType: docType.trim(),
          title: docTitle.trim(),
          documentNumber: docNumber.trim() || undefined,
          revision: docRevision.trim() || undefined,
          receivedDate: docReceivedDate || undefined,
          storageReference: docAttachment?.url ?? undefined,
        }),
      });
      setShowDocForm(false);
      setDocType("");
      setDocTitle("");
      setDocNumber("");
      setDocRevision("");
      setDocReceivedDate("");
      setDocAttachment(null);
      loadDocuments();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not add the document");
    }
  }

  async function handleAddEstimate(event: FormEvent) {
    event.preventDefault();
    if (!session || !id || creatingEstimate) return;
    setCreatingEstimate(true);
    setActionError(null);
    try {
      await apiFetch(`/tendering/tender-submissions/${id}/estimates`, session.access_token, {
        method: "POST",
        body: JSON.stringify({
          assumptions: estAssumptions.trim() || undefined,
          inclusions: estInclusions.trim() || undefined,
          exclusions: estExclusions.trim() || undefined,
          taxes: Number(estTaxes) || 0,
          overheads: Number(estOverheads) || 0,
          contingency: Number(estContingency) || 0,
          margin: Number(estMargin) || 0,
        }),
      });
      setShowEstimateForm(false);
      setEstAssumptions("");
      setEstInclusions("");
      setEstExclusions("");
      setEstTaxes("0");
      setEstOverheads("0");
      setEstContingency("0");
      setEstMargin("0");
      loadEstimates();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not create the estimate version");
    } finally {
      setCreatingEstimate(false);
    }
  }

  async function handleAddLine(event: FormEvent) {
    event.preventDefault();
    if (!session || !selectedEstimateId || !lineItem.trim() || !lineQty || !lineRate) return;
    setActionError(null);
    try {
      // unit: if a UoM was picked, look up its code from the EntityPicker label (we use the id for the API call)
      await apiFetch(`/estimates/${selectedEstimateId}/lines`, session.access_token, {
        method: "POST",
        body: JSON.stringify({
          item: lineItem.trim(),
          quantity: Number(lineQty),
          unit: lineUomId || "EA",
          rate: lineRate,
          costCategory: lineCategory,
        }),
      });
      setLineItem("");
      setLineQty("");
      setLineUomId("");
      setLineRate(null);
      loadLines(selectedEstimateId);
      loadEstimates();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not add the line");
    }
  }

  async function handleDeleteLine(lineId: string) {
    if (!session || !selectedEstimateId) return;
    setActionError(null);
    try {
      await apiFetch(`/estimates/${selectedEstimateId}/lines/${lineId}`, session.access_token, { method: "DELETE" });
      loadLines(selectedEstimateId);
      loadEstimates();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not remove the line");
    }
  }

  async function handleSubmitEstimateForApproval() {
    if (!session || !selectedEstimateId || !estimateDefinitionId || submittingApproval) return;
    setSubmittingApproval(true);
    setActionError(null);
    try {
      await apiFetch(`/estimates/${selectedEstimateId}/submit-for-approval`, session.access_token, {
        method: "POST",
        body: JSON.stringify({ definitionId: estimateDefinitionId }),
      });
      loadEstimates();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not submit the estimate for approval");
    } finally {
      setSubmittingApproval(false);
    }
  }

  async function handleNewEstimateVersion(estimateId: string) {
    if (!session || creatingVersionId) return;
    setCreatingVersionId(estimateId);
    setActionError(null);
    try {
      await apiFetch(`/estimates/${estimateId}/new-version`, session.access_token, { method: "POST" });
      loadEstimates();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not create a new version");
    } finally {
      setCreatingVersionId(null);
    }
  }

  async function handleCreateDecision(event: FormEvent) {
    event.preventDefault();
    if (!session || !bidEstimateId) return;
    setActionError(null);
    try {
      await apiFetch(`/estimates/${bidEstimateId}/bid-decisions`, session.access_token, {
        method: "POST",
        body: JSON.stringify({ recommendation: decisionRecommendation }),
      });
      loadBidDecision(bidEstimateId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not create the bid/no-bid decision");
    }
  }

  async function handleAddScore(event: FormEvent) {
    event.preventDefault();
    if (!session || !decision || !criterionScore || !criterionRationale.trim()) return;
    setActionError(null);
    try {
      await apiFetch(`/bid-decisions/${decision.id}/criteria`, session.access_token, {
        method: "POST",
        body: JSON.stringify({ criterion, score: Number(criterionScore), rationale: criterionRationale.trim() }),
      });
      setCriterionScore("");
      setCriterionRationale("");
      loadCriteriaScores(decision.id);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not add the criteria score");
    }
  }

  async function handleRemoveScore(scoreId: string) {
    if (!session || !decision) return;
    setActionError(null);
    try {
      await apiFetch(`/bid-decisions/${decision.id}/criteria/${scoreId}`, session.access_token, { method: "DELETE" });
      loadCriteriaScores(decision.id);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not remove the score");
    }
  }

  async function handleSubmitDecisionForApproval() {
    if (!session || !decision || !bidDefinitionId) return;
    setActionError(null);
    try {
      await apiFetch(`/bid-decisions/${decision.id}/submit-for-approval`, session.access_token, {
        method: "POST",
        body: JSON.stringify({ definitionId: bidDefinitionId }),
      });
      loadBidDecision(bidEstimateId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not submit the decision for approval");
    }
  }

  async function handleAddSubmission(event: FormEvent) {
    event.preventDefault();
    if (!session || !decision || !submittedTo.trim() || !submittedAt) return;
    setActionError(null);
    try {
      await apiFetch(`/bid-decisions/${decision.id}/submissions`, session.access_token, {
        method: "POST",
        body: JSON.stringify({
          submittedTo: submittedTo.trim(),
          submittedAt,
          evidenceReference: submissionEvidence.trim() || undefined,
        }),
      });
      setSubmittedTo("");
      setSubmittedAt("");
      setSubmissionEvidence("");
      loadSubmissions(decision.id);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not record the bid submission");
    }
  }

  const tabClass = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition ${
      active ? "bg-brand text-zinc-900" : "text-zinc-500 hover:bg-stone-100"
    }`;

  return (
    <div className="space-y-6">
      <div>
        {opportunityId ? (
          <Link to={`/crm/opportunities/${opportunityId}`} className="text-sm text-zinc-400 hover:text-zinc-600">
            ← Back to opportunity
          </Link>
        ) : (
          <Link to="/crm" className="text-sm text-zinc-400 hover:text-zinc-600">
            ← Back to CRM
          </Link>
        )}
      </div>

      <div>
        <h1 className="font-brand text-2xl font-bold text-zinc-900">Tender submission</h1>
        <p className="mt-1 text-sm text-zinc-400">Documents, estimates, and the bid/no-bid decision</p>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {actionError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}

      <div className="flex gap-2">
        <button onClick={() => setTab("documents")} className={tabClass(tab === "documents")}>
          Tender Documents
        </button>
        <button onClick={() => setTab("estimates")} className={tabClass(tab === "estimates")}>
          Estimates
        </button>
        <button onClick={() => setTab("bidding")} className={tabClass(tab === "bidding")}>
          Bid / No-Bid
        </button>
      </div>

      {tab === "documents" && (
        <div className="space-y-4">
          <PermissionGate permission="tendering.document.manage">
            <div className="flex justify-end">
              <button
                onClick={() => setShowDocForm(true)}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim"
              >
                Upload document
              </button>
            </div>
          </PermissionGate>

          {showDocForm && (
            <form onSubmit={handleAddDocument} className="grid grid-cols-1 gap-2 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm sm:grid-cols-3">
              <input value={docType} onChange={(e) => setDocType(e.target.value)} placeholder="Document type" className={inputClass} />
              <input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Title" className={inputClass} />
              <input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} placeholder="Document number" className={inputClass} />
              <input value={docRevision} onChange={(e) => setDocRevision(e.target.value)} placeholder="Revision" className={inputClass} />
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                Received date
                <input type="date" value={docReceivedDate} onChange={(e) => setDocReceivedDate(e.target.value)} className={inputClass} />
              </label>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-zinc-400">File attachment</span>
                {docAttachment ? (
                  <div className="flex items-center gap-2">
                    <AttachmentLink attachment={docAttachment} />
                    <button type="button" onClick={() => setDocAttachment(null)} className="text-xs text-zinc-400 hover:text-red-600">Remove</button>
                  </div>
                ) : (
                  <FileAttachment onUploaded={setDocAttachment} label="Attach document" />
                )}
              </div>
              <div className="col-span-full flex gap-2">
                <button
                  type="submit"
                  disabled={!docType.trim() || !docTitle.trim()}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50"
                >
                  Add document
                </button>
                <button type="button" onClick={() => setShowDocForm(false)} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {documents?.length === 0 && <p className="text-sm text-zinc-400">No documents uploaded yet.</p>}
          {documents && documents.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    <th className="px-6 py-3">Title</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Attachment</th>
                    <th className="px-6 py-3">Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="border-b border-zinc-50 last:border-0 hover:bg-stone-50">
                      <td className="px-6 py-4 font-medium text-zinc-800">{doc.title}</td>
                      <td className="px-6 py-4 text-zinc-600">{doc.document_type}</td>
                      <td className="px-6 py-4 text-zinc-600">
                        {doc.storage_reference ? (
                          <a href={doc.storage_reference} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                            View file
                          </a>
                        ) : "—"}
                      </td>
                      <td className="px-6 py-4 text-zinc-600">{new Date(doc.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "estimates" && (
        <div className="space-y-4">
          <PermissionGate permission="tendering.document.manage">
            <div className="flex justify-end">
              <button
                onClick={() => setShowEstimateForm(true)}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim"
              >
                New estimate version
              </button>
            </div>
          </PermissionGate>

          {showEstimateForm && (
            <form onSubmit={handleAddEstimate} className="grid grid-cols-1 gap-2 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm sm:grid-cols-2">
              <textarea value={estAssumptions} onChange={(e) => setEstAssumptions(e.target.value)} placeholder="Assumptions" className={`${inputClass} sm:col-span-2`} />
              <textarea value={estInclusions} onChange={(e) => setEstInclusions(e.target.value)} placeholder="Inclusions" className={inputClass} />
              <textarea value={estExclusions} onChange={(e) => setEstExclusions(e.target.value)} placeholder="Exclusions" className={inputClass} />
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                Taxes %
                <input type="number" value={estTaxes} onChange={(e) => setEstTaxes(e.target.value)} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                Overheads %
                <input type="number" value={estOverheads} onChange={(e) => setEstOverheads(e.target.value)} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                Contingency %
                <input type="number" value={estContingency} onChange={(e) => setEstContingency(e.target.value)} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                Margin %
                <input type="number" value={estMargin} onChange={(e) => setEstMargin(e.target.value)} className={inputClass} />
              </label>
              <div className="col-span-full flex gap-2">
                <button
                  type="submit"
                  disabled={creatingEstimate}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingEstimate ? "Creating…" : "Create version"}
                </button>
                <button type="button" onClick={() => setShowEstimateForm(false)} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {estimates?.length === 0 && <p className="text-sm text-zinc-400">No estimate versions yet.</p>}
          {estimates && estimates.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    <th className="px-6 py-3">Version</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Total</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {estimates.map((estimate) => (
                    <tr key={estimate.id} className="border-b border-zinc-50 last:border-0 hover:bg-stone-50">
                      <td className="px-6 py-4 font-medium text-zinc-800">v{estimate.version}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={estimate.status} />
                      </td>
                      <td className="px-6 py-4">
                        <CurrencyDisplay amount={estimate.total_amount} currencyCode={baseCurrency} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedEstimateId(selectedEstimateId === estimate.id ? null : estimate.id)}
                          className="text-xs text-zinc-400 hover:text-brand-dim"
                        >
                          {selectedEstimateId === estimate.id ? "Close" : "Manage lines"}
                        </button>
                        {estimate.status !== "draft" && (
                          <PermissionGate permission="tendering.document.manage">
                            <button
                              onClick={() => handleNewEstimateVersion(estimate.id)}
                              disabled={creatingVersionId !== null}
                              className="ml-3 text-xs text-zinc-400 hover:text-brand-dim disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {creatingVersionId === estimate.id ? "Creating…" : "New version"}
                            </button>
                          </PermissionGate>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedEstimateId && (
            <div className="space-y-4 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
              <h2 className="font-brand text-base font-semibold text-zinc-900">Lines</h2>
              <PermissionGate permission="tendering.document.manage">
                <form onSubmit={handleAddLine} className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                  <input value={lineItem} onChange={(e) => setLineItem(e.target.value)} placeholder="Item description" className={inputClass} />
                  <input type="number" value={lineQty} onChange={(e) => setLineQty(e.target.value)} placeholder="Qty" className={inputClass} />
                  <EntityPicker type="uom" value={lineUomId} onChange={setLineUomId} placeholder="Unit of measure…" />
                  <CurrencyInput value={lineRate} onChange={setLineRate} currencyCode={baseCurrency} />
                  <select value={lineCategory} onChange={(e) => setLineCategory(e.target.value as CostCategory)} className={inputClass}>
                    {COST_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="col-span-full w-fit rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-brand-dim">
                    Add line
                  </button>
                </form>
              </PermissionGate>

              {lines?.length === 0 && <p className="text-sm text-zinc-400">No lines yet.</p>}
              {lines && lines.length > 0 && (
                <>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2">Qty</th>
                        <th className="px-3 py-2">Unit</th>
                        <th className="px-3 py-2">Rate</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Line total</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => (
                        <tr key={line.id} className="border-b border-zinc-50 last:border-0">
                          <td className="px-3 py-2 text-zinc-800">{line.item}</td>
                          <td className="px-3 py-2 text-zinc-600">{line.quantity}</td>
                          <td className="px-3 py-2 text-zinc-600">{line.unit}</td>
                          <td className="px-3 py-2">
                            <CurrencyDisplay amount={line.rate} currencyCode={baseCurrency} />
                          </td>
                          <td className="px-3 py-2 text-zinc-600">{line.cost_category}</td>
                          <td className="px-3 py-2">
                            <CurrencyDisplay amount={line.line_total} currencyCode={baseCurrency} />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <PermissionGate permission="tendering.document.manage">
                              <button onClick={() => handleDeleteLine(line.id)} className="text-xs text-zinc-400 hover:text-red-600">
                                Remove
                              </button>
                            </PermissionGate>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex items-center justify-end gap-4 border-t border-zinc-100 pt-3 text-sm">
                    <span className="text-zinc-500">Subtotal</span>
                    <CurrencyDisplay
                      amount={estimates?.find((e) => e.id === selectedEstimateId)?.subtotal_amount}
                      currencyCode={baseCurrency}
                      className="font-medium text-zinc-800"
                    />
                    <span className="text-zinc-500">Total</span>
                    <CurrencyDisplay
                      amount={estimates?.find((e) => e.id === selectedEstimateId)?.total_amount}
                      currencyCode={baseCurrency}
                      className="font-semibold text-zinc-900"
                    />
                  </div>
                </>
              )}

              <PermissionGate permission="tendering.document.manage">
                <div className="flex items-center gap-2 border-t border-zinc-100 pt-4">
                  <DefinitionPicker definitions={definitions} value={estimateDefinitionId} onChange={setEstimateDefinitionId} />
                  <button
                    onClick={handleSubmitEstimateForApproval}
                    disabled={!estimateDefinitionId || submittingApproval}
                    className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingApproval ? "Submitting…" : "Submit for approval"}
                  </button>
                </div>
              </PermissionGate>

              {(estimateComments.length > 0 || estimateDecisions.length > 0) && (
                <ActivityThread
                  comments={estimateComments}
                  decisions={estimateDecisions}
                  decisionLabels={{ approved: "Approved", rejected: "Rejected", returned_for_correction: "Returned for correction" }}
                />
              )}
            </div>
          )}
        </div>
      )}

      {tab === "bidding" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              Estimate version
              <select value={bidEstimateId} onChange={(e) => setBidEstimateId(e.target.value)} className={`max-w-sm ${inputClass}`}>
                <option value="">Select an estimate version…</option>
                {estimates?.map((estimate) => (
                  <option key={estimate.id} value={estimate.id}>
                    v{estimate.version} — {estimate.status.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {bidEstimateId && !decision && (
            <PermissionGate permission="tendering.document.manage">
              <form onSubmit={handleCreateDecision} className="flex items-end gap-2 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
                <label className="flex flex-col gap-1 text-xs text-zinc-400">
                  Recommendation
                  <select value={decisionRecommendation} onChange={(e) => setDecisionRecommendation(e.target.value as BidRecommendation)} className={inputClass}>
                    <option value="bid">Bid</option>
                    <option value="no_bid">No bid</option>
                  </select>
                </label>
                <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-brand-dim">
                  Create decision
                </button>
              </form>
            </PermissionGate>
          )}

          {decision && (
            <div className="space-y-4 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-800">Recommendation: {decision.recommendation === "bid" ? "Bid" : "No bid"}</p>
                  {decision.conditions && <p className="mt-1 text-xs text-zinc-500">Conditions: {decision.conditions}</p>}
                </div>
                <StatusBadge status={decision.status} />
              </div>

              <div>
                <h3 className="font-brand text-sm font-semibold text-zinc-900">Criteria scores</h3>
                <PermissionGate permission="tendering.document.manage">
                  {decision.status === "draft" && (
                    <form onSubmit={handleAddScore} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-4">
                      <select value={criterion} onChange={(e) => setCriterion(e.target.value as BidCriterion)} className={inputClass}>
                        {BID_CRITERIA.map((c) => (
                          <option key={c} value={c}>
                            {c.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                      <input type="number" value={criterionScore} onChange={(e) => setCriterionScore(e.target.value)} placeholder="Score" className={inputClass} />
                      <input value={criterionRationale} onChange={(e) => setCriterionRationale(e.target.value)} placeholder="Rationale" className={inputClass} />
                      <button type="submit" className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-brand-dim">
                        Add score
                      </button>
                    </form>
                  )}
                </PermissionGate>
                {criteriaScores?.length === 0 && <p className="mt-2 text-sm text-zinc-400">No criteria scored yet.</p>}
                {criteriaScores && criteriaScores.length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {criteriaScores.map((score) => (
                      <li key={score.id} className="flex items-center justify-between rounded-lg bg-stone-50 px-4 py-2 text-sm">
                        <span>
                          <span className="font-medium text-zinc-800">{score.criterion.replace(/_/g, " ")}</span>: {score.score} — {score.rationale}
                        </span>
                        <PermissionGate permission="tendering.document.manage">
                          {decision.status === "draft" && (
                            <button onClick={() => handleRemoveScore(score.id)} className="text-xs text-zinc-400 hover:text-red-600">
                              Remove
                            </button>
                          )}
                        </PermissionGate>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <PermissionGate permission="tendering.document.manage">
                {decision.status === "draft" && (
                  <div className="flex items-center gap-2 border-t border-zinc-100 pt-4">
                    <DefinitionPicker definitions={definitions} value={bidDefinitionId} onChange={setBidDefinitionId} />
                    <button
                      onClick={handleSubmitDecisionForApproval}
                      disabled={!bidDefinitionId}
                      className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50"
                    >
                      Submit for approval
                    </button>
                  </div>
                )}
              </PermissionGate>

              <div className="border-t border-zinc-100 pt-4">
                <h3 className="font-brand text-sm font-semibold text-zinc-900">Bid submissions</h3>
                {decision.status !== "approved" && decision.status !== "approved_with_conditions" ? (
                  <p className="mt-2 text-sm text-zinc-400">A bid submission can be recorded once this decision is approved.</p>
                ) : (
                  <>
                    <PermissionGate permission="tendering.document.manage">
                      <form onSubmit={handleAddSubmission} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <input value={submittedTo} onChange={(e) => setSubmittedTo(e.target.value)} placeholder="Submitted to" className={inputClass} />
                        <input type="datetime-local" value={submittedAt} onChange={(e) => setSubmittedAt(e.target.value)} className={inputClass} />
                        <input value={submissionEvidence} onChange={(e) => setSubmissionEvidence(e.target.value)} placeholder="Evidence reference" className={inputClass} />
                        <button type="submit" className="col-span-full w-fit rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-brand-dim">
                          Record submission
                        </button>
                      </form>
                    </PermissionGate>
                    {submissions?.length === 0 && <p className="mt-2 text-sm text-zinc-400">No bid submissions recorded yet.</p>}
                    {submissions && submissions.length > 0 && (
                      <ul className="mt-2 space-y-2">
                        {submissions.map((sub) => (
                          <li key={sub.id} className="rounded-lg bg-stone-50 px-4 py-2 text-sm">
                            Submitted to {sub.submitted_to} on {new Date(sub.submitted_at).toLocaleString()}
                            {sub.evidence_reference && ` — ${sub.evidence_reference}`}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
