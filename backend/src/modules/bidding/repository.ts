import type { SupabaseClient } from "@supabase/supabase-js";
import type { BidCriterion, BidNoBidCriteriaScore, BidNoBidDecision, BidNoBidStatus, BidRecommendation, BidSubmission } from "./types.js";

export interface CreateBidNoBidDecisionInput {
  estimate_id: string;
  recommendation: BidRecommendation;
  status?: BidNoBidStatus;
  created_by: string | null;
}

export interface UpdateBidNoBidDecisionInput {
  recommendation?: BidRecommendation;
  status?: BidNoBidStatus;
  conditions?: string | null;
  workflow_instance_id?: string | null;
}

export interface CreateCriteriaScoreInput {
  bid_no_bid_decision_id: string;
  criterion: BidCriterion;
  score: number;
  rationale: string;
}

export interface CreateBidSubmissionInput {
  bid_no_bid_decision_id: string;
  submitted_to: string;
  submitted_at: string;
  evidence_reference: string | null;
  submitted_by: string | null;
}

/**
 * Every method goes through the caller's own user-scoped client, same
 * convention as modules/estimating and modules/tendering — RLS
 * (tenant_id = current_tenant_id()) is the real isolation mechanism.
 */
export interface BiddingRepository {
  createDecision(accessToken: string, input: CreateBidNoBidDecisionInput): Promise<BidNoBidDecision>;
  listDecisions(accessToken: string, estimateId: string): Promise<BidNoBidDecision[]>;
  getDecision(accessToken: string, decisionId: string): Promise<BidNoBidDecision | null>;
  updateDecision(accessToken: string, decisionId: string, input: UpdateBidNoBidDecisionInput): Promise<BidNoBidDecision | null>;
  createCriteriaScore(accessToken: string, input: CreateCriteriaScoreInput): Promise<BidNoBidCriteriaScore>;
  listCriteriaScores(accessToken: string, decisionId: string): Promise<BidNoBidCriteriaScore[]>;
  deleteCriteriaScore(accessToken: string, scoreId: string): Promise<boolean>;
  createBidSubmission(accessToken: string, input: CreateBidSubmissionInput): Promise<BidSubmission>;
  listBidSubmissions(accessToken: string, decisionId: string): Promise<BidSubmission[]>;
}

/**
 * Supabase-backed implementation. Not exercised against a live
 * Supabase project in this session (no reachable Supabase MCP tools in
 * this sandbox — see ticket 0094 — same gap already flagged for every
 * other Supabase-backed repository in this codebase).
 */
export function createSupabaseBiddingRepository(
  userScopedClientFactory: (accessToken: string) => SupabaseClient,
): BiddingRepository {
  return {
    async createDecision(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("bid_no_bid_decisions")
        .insert({ status: "draft", conditions: null, workflow_instance_id: null, ...input })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createDecision: ${error?.message ?? "no row returned"}`);
      return data as BidNoBidDecision;
    },

    async listDecisions(accessToken, estimateId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("bid_no_bid_decisions").select("*").eq("estimate_id", estimateId);
      if (error) throw new Error(`listDecisions: ${error.message}`);
      return (data as BidNoBidDecision[]) ?? [];
    },

    async getDecision(accessToken, decisionId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("bid_no_bid_decisions").select("*").eq("id", decisionId).maybeSingle();
      if (error) throw new Error(`getDecision: ${error.message}`);
      return (data as BidNoBidDecision | null) ?? null;
    },

    async updateDecision(accessToken, decisionId, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("bid_no_bid_decisions")
        .update(input)
        .eq("id", decisionId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateDecision: ${error.message}`);
      return (data as BidNoBidDecision | null) ?? null;
    },

    async createCriteriaScore(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("bid_no_bid_criteria_scores").insert(input).select("*").single();
      if (error || !data) throw new Error(`createCriteriaScore: ${error?.message ?? "no row returned"}`);
      return data as BidNoBidCriteriaScore;
    },

    async listCriteriaScores(accessToken, decisionId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("bid_no_bid_criteria_scores")
        .select("*")
        .eq("bid_no_bid_decision_id", decisionId);
      if (error) throw new Error(`listCriteriaScores: ${error.message}`);
      return (data as BidNoBidCriteriaScore[]) ?? [];
    },

    async deleteCriteriaScore(accessToken, scoreId) {
      const client = userScopedClientFactory(accessToken);
      const { error, count } = await client.from("bid_no_bid_criteria_scores").delete({ count: "exact" }).eq("id", scoreId);
      if (error) throw new Error(`deleteCriteriaScore: ${error.message}`);
      return (count ?? 0) > 0;
    },

    async createBidSubmission(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("bid_submissions").insert(input).select("*").single();
      if (error || !data) throw new Error(`createBidSubmission: ${error?.message ?? "no row returned"}`);
      return data as BidSubmission;
    },

    async listBidSubmissions(accessToken, decisionId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("bid_submissions").select("*").eq("bid_no_bid_decision_id", decisionId);
      if (error) throw new Error(`listBidSubmissions: ${error.message}`);
      return (data as BidSubmission[]) ?? [];
    },
  };
}
