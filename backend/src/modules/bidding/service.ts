import type { WorkflowRepository } from "../workflow/repository.js";
import { getWorkflowInstance, startWorkflowInstance } from "../workflow/service.js";
import type { BiddingRepository, CreateCriteriaScoreInput } from "./repository.js";
import type { BidCriterion, BidNoBidDecision, BidRecommendation } from "./types.js";

export class NotFoundError extends Error {
  constructor(message = "not found") {
    super(message);
  }
}

export class BidDecisionLockedError extends Error {}
export class BidDecisionNotDraftError extends Error {}
export class MissingCriteriaScoresError extends Error {}
export class BidNotApprovedError extends Error {}

async function requireDecision(repo: BiddingRepository, accessToken: string, decisionId: string): Promise<BidNoBidDecision> {
  const decision = await repo.getDecision(accessToken, decisionId);
  if (!decision) throw new NotFoundError();
  return decision;
}

/**
 * Mirrors ticket 0097's requireDraft: draft and returned-for-correction
 * are both editable; approved/approved_with_conditions are locked
 * (FR-BID-001's own approval is the gate, not a silent rewrite);
 * rejected is a dead end — this module has no versioning concept to
 * supersede into, unlike estimates, since the ticket only asks for one
 * decision per estimate, not a version history of them.
 */
function requireDraft(decision: BidNoBidDecision): void {
  if (decision.status === "draft" || decision.status === "returned_for_correction") return;
  if (decision.status === "approved" || decision.status === "approved_with_conditions") {
    throw new BidDecisionLockedError(`bid/no-bid decision ${decision.id} is ${decision.status} and locked`);
  }
  throw new BidDecisionNotDraftError(`bid/no-bid decision ${decision.id} is ${decision.status}, not draft`);
}

export interface CreateBidNoBidDecisionInput {
  estimateId: string;
  recommendation: BidRecommendation;
  createdBy: string | null;
}

export async function createBidNoBidDecision(
  repo: BiddingRepository,
  accessToken: string,
  input: CreateBidNoBidDecisionInput,
): Promise<BidNoBidDecision> {
  return repo.createDecision(accessToken, {
    estimate_id: input.estimateId,
    recommendation: input.recommendation,
    created_by: input.createdBy,
  });
}

export async function listBidNoBidDecisions(repo: BiddingRepository, accessToken: string, estimateId: string) {
  return repo.listDecisions(accessToken, estimateId);
}

export async function getBidNoBidDecision(repo: BiddingRepository, accessToken: string, decisionId: string) {
  return requireDecision(repo, accessToken, decisionId);
}

export async function updateBidNoBidRecommendation(
  repo: BiddingRepository,
  accessToken: string,
  decisionId: string,
  recommendation: BidRecommendation,
): Promise<BidNoBidDecision> {
  const decision = await requireDecision(repo, accessToken, decisionId);
  requireDraft(decision);
  const updated = await repo.updateDecision(accessToken, decisionId, { recommendation });
  if (!updated) throw new NotFoundError();
  return updated;
}

export interface AddCriteriaScoreInput {
  criterion: BidCriterion;
  score: number;
  rationale: string;
}

export async function addCriteriaScore(
  repo: BiddingRepository,
  accessToken: string,
  decisionId: string,
  input: AddCriteriaScoreInput,
) {
  const decision = await requireDecision(repo, accessToken, decisionId);
  requireDraft(decision);
  const scoreInput: CreateCriteriaScoreInput = {
    bid_no_bid_decision_id: decisionId,
    criterion: input.criterion,
    score: input.score,
    rationale: input.rationale,
  };
  return repo.createCriteriaScore(accessToken, scoreInput);
}

export async function listCriteriaScores(repo: BiddingRepository, accessToken: string, decisionId: string) {
  return repo.listCriteriaScores(accessToken, decisionId);
}

export async function removeCriteriaScore(
  repo: BiddingRepository,
  accessToken: string,
  decisionId: string,
  scoreId: string,
): Promise<void> {
  const decision = await requireDecision(repo, accessToken, decisionId);
  requireDraft(decision);
  const deleted = await repo.deleteCriteriaScore(accessToken, scoreId);
  if (!deleted) throw new NotFoundError();
}

export interface SubmitBidNoBidForApprovalInput {
  decisionId: string;
  /** Names which published approval workflow to run — same "no automatic resolution" convention as ticket 0066/0097; this module does not guess a definition. */
  definitionId: string;
  submittedBy: string | null;
}

/**
 * FR-BID-001: starts a real request_approval workflow instance (ticket
 * 0066/0062's seam), same shape as ticket 0097's
 * submitEstimateForApproval. Requires at least one criteria score to
 * already exist — "so a reviewer can actually compare across
 * decisions" (ticket text) means a bid/no-bid decision with no scored
 * criteria has nothing for an approver to review yet.
 */
export async function submitBidNoBidForApproval(
  repo: BiddingRepository,
  workflowRepo: WorkflowRepository,
  accessToken: string,
  input: SubmitBidNoBidForApprovalInput,
): Promise<BidNoBidDecision> {
  const decision = await requireDecision(repo, accessToken, input.decisionId);
  requireDraft(decision);

  const scores = await repo.listCriteriaScores(accessToken, input.decisionId);
  if (scores.length === 0) {
    throw new MissingCriteriaScoresError(
      `bid/no-bid decision ${input.decisionId} has no scored criteria yet; score at least one before submitting`,
    );
  }

  const { instance } = await startWorkflowInstance(workflowRepo, accessToken, input.definitionId, input.submittedBy, {
    bidNoBidDecisionId: decision.id,
    estimateId: decision.estimate_id,
    recommendation: decision.recommendation,
  });

  const updated = await repo.updateDecision(accessToken, decision.id, {
    status: "pending_approval",
    workflow_instance_id: instance.id,
  });
  if (!updated) throw new NotFoundError();
  return updated;
}

/**
 * The polling half of the seam — same convention as ticket 0097's
 * resolveEstimateApproval: no event bus exists, so the outcome is read
 * back on demand from the linked workflow instance's step instances.
 * Idempotent once the decision has left 'pending_approval'.
 *
 * On 'approved_with_conditions', looks up the specific approval
 * decision record that carried that verdict (via
 * approvalDecisionIds on the completed step's output) and copies its
 * `reason` up as this decision's `conditions` text — the approver only
 * ever types it once.
 */
export async function resolveBidNoBidApproval(
  repo: BiddingRepository,
  workflowRepo: WorkflowRepository,
  accessToken: string,
  decisionId: string,
): Promise<BidNoBidDecision> {
  const decision = await requireDecision(repo, accessToken, decisionId);
  if (decision.status !== "pending_approval") return decision;
  if (!decision.workflow_instance_id) return decision;

  const { stepInstances } = await getWorkflowInstance(workflowRepo, accessToken, decision.workflow_instance_id);
  const decidedStep = stepInstances.find((s) => typeof s.output?.decision === "string");
  if (!decidedStep) return decision;

  const outcome = decidedStep.output.decision as string;

  if (outcome === "approved_with_conditions") {
    const decisionIds = (decidedStep.output.approvalDecisionIds as string[] | undefined) ?? [];
    let conditions: string | null = null;
    for (const id of decisionIds) {
      const record = await workflowRepo.getApprovalDecision(accessToken, id);
      if (record?.decision === "approved_with_conditions") {
        conditions = record.reason;
        break;
      }
    }
    const updated = await repo.updateDecision(accessToken, decisionId, { status: "approved_with_conditions", conditions });
    return updated!;
  }

  if (outcome === "approved") {
    const updated = await repo.updateDecision(accessToken, decisionId, { status: "approved" });
    return updated!;
  }

  // "rejected" and "returned_for_correction" — literal pass-through,
  // same as ticket 0097's resolveEstimateApproval.
  const updated = await repo.updateDecision(accessToken, decisionId, {
    status: outcome as "rejected" | "returned_for_correction",
  });
  return updated!;
}

export interface RecordBidSubmissionInput {
  decisionId: string;
  submittedTo: string;
  submittedAt: string;
  evidenceReference: string | null;
  submittedBy: string | null;
}

/**
 * BRD §10.1 step 8: only legal once the decision is approved (with or
 * without conditions) — a rejected/draft/pending recommendation has
 * nothing to submit.
 */
export async function recordBidSubmission(repo: BiddingRepository, accessToken: string, input: RecordBidSubmissionInput) {
  const decision = await requireDecision(repo, accessToken, input.decisionId);
  if (decision.status !== "approved" && decision.status !== "approved_with_conditions") {
    throw new BidNotApprovedError(`bid/no-bid decision ${decision.id} is ${decision.status}, not approved`);
  }
  return repo.createBidSubmission(accessToken, {
    bid_no_bid_decision_id: input.decisionId,
    submitted_to: input.submittedTo,
    submitted_at: input.submittedAt,
    evidence_reference: input.evidenceReference,
    submitted_by: input.submittedBy,
  });
}

export async function listBidSubmissions(repo: BiddingRepository, accessToken: string, decisionId: string) {
  await requireDecision(repo, accessToken, decisionId);
  return repo.listBidSubmissions(accessToken, decisionId);
}
