import type {
  BiddingRepository,
  CreateBidNoBidDecisionInput,
  CreateBidSubmissionInput,
  CreateCriteriaScoreInput,
  UpdateBidNoBidDecisionInput,
} from "../modules/bidding/repository.js";
import type { BidNoBidCriteriaScore, BidNoBidDecision, BidSubmission } from "../modules/bidding/types.js";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * In-memory stand-in for BiddingRepository. Mutating/reads are keyed
 * off an access token's own session (same convention as every other
 * fake repository in this test suite) so "wrong tenant = not found" is
 * actually exercised, not just asserted.
 */
export class FakeBiddingRepository implements BiddingRepository {
  sessions = new Map<string, { tenantId: string }>();
  decisions = new Map<string, BidNoBidDecision>();
  criteriaScores = new Map<string, BidNoBidCriteriaScore>();
  bidSubmissions = new Map<string, BidSubmission>();

  addSession(accessToken: string, tenantId: string) {
    this.sessions.set(accessToken, { tenantId });
  }

  private tenantOf(accessToken: string): string {
    const context = this.sessions.get(accessToken);
    if (!context) throw new Error("no caller context for this access token");
    return context.tenantId;
  }

  async createDecision(accessToken: string, input: CreateBidNoBidDecisionInput) {
    const tenant_id = this.tenantOf(accessToken);
    const now = new Date().toISOString();
    const decision: BidNoBidDecision = {
      id: nextId("bid-decision"),
      tenant_id,
      estimate_id: input.estimate_id,
      recommendation: input.recommendation,
      status: input.status ?? "draft",
      conditions: null,
      workflow_instance_id: null,
      created_by: input.created_by,
      created_at: now,
      updated_at: now,
    };
    this.decisions.set(decision.id, decision);
    return decision;
  }

  async listDecisions(accessToken: string, estimateId: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.decisions.values()].filter((d) => d.tenant_id === tenant_id && d.estimate_id === estimateId);
  }

  async getDecision(accessToken: string, decisionId: string) {
    const tenant_id = this.tenantOf(accessToken);
    const decision = this.decisions.get(decisionId);
    if (!decision || decision.tenant_id !== tenant_id) return null;
    return decision;
  }

  async updateDecision(accessToken: string, decisionId: string, input: UpdateBidNoBidDecisionInput) {
    const tenant_id = this.tenantOf(accessToken);
    const decision = this.decisions.get(decisionId);
    if (!decision || decision.tenant_id !== tenant_id) return null;
    const updated: BidNoBidDecision = { ...decision, ...input, updated_at: new Date().toISOString() };
    this.decisions.set(decisionId, updated);
    return updated;
  }

  async createCriteriaScore(accessToken: string, input: CreateCriteriaScoreInput) {
    const tenant_id = this.tenantOf(accessToken);
    const now = new Date().toISOString();
    const score: BidNoBidCriteriaScore = {
      id: nextId("criteria-score"),
      tenant_id,
      bid_no_bid_decision_id: input.bid_no_bid_decision_id,
      criterion: input.criterion,
      score: input.score,
      rationale: input.rationale,
      created_at: now,
      updated_at: now,
    };
    this.criteriaScores.set(score.id, score);
    return score;
  }

  async listCriteriaScores(accessToken: string, decisionId: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.criteriaScores.values()].filter(
      (s) => s.tenant_id === tenant_id && s.bid_no_bid_decision_id === decisionId,
    );
  }

  async deleteCriteriaScore(accessToken: string, scoreId: string) {
    const tenant_id = this.tenantOf(accessToken);
    const score = this.criteriaScores.get(scoreId);
    if (!score || score.tenant_id !== tenant_id) return false;
    this.criteriaScores.delete(scoreId);
    return true;
  }

  async createBidSubmission(accessToken: string, input: CreateBidSubmissionInput) {
    const tenant_id = this.tenantOf(accessToken);
    const now = new Date().toISOString();
    const submission: BidSubmission = {
      id: nextId("bid-submission"),
      tenant_id,
      bid_no_bid_decision_id: input.bid_no_bid_decision_id,
      submitted_to: input.submitted_to,
      submitted_at: input.submitted_at,
      evidence_reference: input.evidence_reference,
      submitted_by: input.submitted_by,
      created_at: now,
    };
    this.bidSubmissions.set(submission.id, submission);
    return submission;
  }

  async listBidSubmissions(accessToken: string, decisionId: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.bidSubmissions.values()].filter(
      (s) => s.tenant_id === tenant_id && s.bid_no_bid_decision_id === decisionId,
    );
  }
}
