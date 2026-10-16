import type { SupabaseClient } from "@supabase/supabase-js";
import type { Estimate, EstimateLine, EstimateStatus, CostCategory, EstimateLineSource } from "./types.js";

export interface CreateEstimateInput {
  tender_submission_id: string;
  version: number;
  status?: EstimateStatus;
  assumptions?: string | null;
  inclusions?: string | null;
  exclusions?: string | null;
  taxes?: number;
  overheads?: number;
  contingency?: number;
  margin?: number;
  subtotal_amount?: number;
  total_amount?: number;
  workflow_instance_id?: string | null;
  created_by: string | null;
}

export interface UpdateEstimateInput {
  status?: EstimateStatus;
  assumptions?: string | null;
  inclusions?: string | null;
  exclusions?: string | null;
  taxes?: number;
  overheads?: number;
  contingency?: number;
  margin?: number;
  subtotal_amount?: number;
  total_amount?: number;
  workflow_instance_id?: string | null;
}

export interface CreateEstimateLineInput {
  estimate_id: string;
  item: string;
  quantity: number;
  unit: string;
  rate: number;
  cost_category: CostCategory;
  line_total: number;
  source?: EstimateLineSource;
  confidence?: number | null;
}

/**
 * Every method goes through the caller's own user-scoped client, same
 * convention as modules/tendering and modules/crm — RLS (tenant_id =
 * current_tenant_id()) is the real isolation mechanism, this adapter
 * just has to not bypass it.
 */
export interface EstimatingRepository {
  createEstimate(accessToken: string, input: CreateEstimateInput): Promise<Estimate>;
  listEstimates(accessToken: string, tenderSubmissionId: string): Promise<Estimate[]>;
  getEstimate(accessToken: string, estimateId: string): Promise<Estimate | null>;
  updateEstimate(accessToken: string, estimateId: string, input: UpdateEstimateInput): Promise<Estimate | null>;
  createEstimateLine(accessToken: string, input: CreateEstimateLineInput): Promise<EstimateLine>;
  listEstimateLines(accessToken: string, estimateId: string): Promise<EstimateLine[]>;
  deleteEstimateLine(accessToken: string, lineId: string): Promise<boolean>;
}

/**
 * Supabase-backed implementation. Not exercised against a live
 * Supabase project in this session (no reachable Supabase MCP tools in
 * this sandbox — see ticket 0094 — same gap already flagged for every
 * other Supabase-backed repository in this codebase).
 */
export function createSupabaseEstimatingRepository(
  userScopedClientFactory: (accessToken: string) => SupabaseClient,
): EstimatingRepository {
  return {
    async createEstimate(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("estimates")
        .insert({
          status: "draft",
          assumptions: null,
          inclusions: null,
          exclusions: null,
          taxes: 0,
          overheads: 0,
          contingency: 0,
          margin: 0,
          subtotal_amount: 0,
          total_amount: 0,
          workflow_instance_id: null,
          ...input,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createEstimate: ${error?.message ?? "no row returned"}`);
      return data as Estimate;
    },

    async listEstimates(accessToken, tenderSubmissionId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("estimates")
        .select("*")
        .eq("tender_submission_id", tenderSubmissionId);
      if (error) throw new Error(`listEstimates: ${error.message}`);
      return (data as Estimate[]) ?? [];
    },

    async getEstimate(accessToken, estimateId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("estimates").select("*").eq("id", estimateId).maybeSingle();
      if (error) throw new Error(`getEstimate: ${error.message}`);
      return (data as Estimate | null) ?? null;
    },

    async updateEstimate(accessToken, estimateId, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("estimates")
        .update(input)
        .eq("id", estimateId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateEstimate: ${error.message}`);
      return (data as Estimate | null) ?? null;
    },

    async createEstimateLine(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("estimate_lines")
        .insert({ source: "manual", confidence: null, ...input })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createEstimateLine: ${error?.message ?? "no row returned"}`);
      return data as EstimateLine;
    },

    async listEstimateLines(accessToken, estimateId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("estimate_lines").select("*").eq("estimate_id", estimateId);
      if (error) throw new Error(`listEstimateLines: ${error.message}`);
      return (data as EstimateLine[]) ?? [];
    },

    async deleteEstimateLine(accessToken, lineId) {
      const client = userScopedClientFactory(accessToken);
      const { error, count } = await client.from("estimate_lines").delete({ count: "exact" }).eq("id", lineId);
      if (error) throw new Error(`deleteEstimateLine: ${error.message}`);
      return (count ?? 0) > 0;
    },
  };
}
