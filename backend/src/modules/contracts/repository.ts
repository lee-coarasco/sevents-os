import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ContractsRepository,
  Contract,
  VariationOrder,
  ContractClaim,
  ContractSecurity,
  CreateContractInput,
  CreateVariationInput,
  CreateClaimInput,
  CreateSecurityInput,
} from "./types.js";

export type { ContractsRepository } from "./types.js";

export function createSupabaseContractsRepository(
  createUserScopedClient: (token: string) => SupabaseClient
): ContractsRepository {
  async function resolveTenant(client: SupabaseClient): Promise<string> {
    const { data: tenantId, error } = await client.rpc("current_tenant_id");
    if (error || !tenantId) {
      throw new Error("Unable to resolve tenant id for caller");
    }
    return tenantId as string;
  }

  return {
    // Contracts
    async listContracts(accessToken, projectId) {
      const client = createUserScopedClient(accessToken);
      let query = client.from("contracts").select("*").order("created_at", { ascending: false });
      if (projectId) {
        query = query.eq("project_id", projectId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Contract[];
    },

    async getContractById(accessToken, id) {
      const client = createUserScopedClient(accessToken);
      const { data, error } = await client.from("contracts").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return (data as Contract) || null;
    },

    async createContract(accessToken, input) {
      const client = createUserScopedClient(accessToken);
      const tenantId = await resolveTenant(client);
      const { data, error } = await client
        .from("contracts")
        .insert({
          tenant_id: tenantId,
          project_id: input.project_id,
          contract_reference: input.contract_reference,
          title: input.title,
          contract_type: input.contract_type || "main_contract",
          counterparty_name: input.counterparty_name,
          original_value: input.original_value,
          revised_value: input.revised_value,
          signed_date: input.signed_date || null,
          commencement_date: input.commencement_date,
          contractual_completion_date: input.contractual_completion_date,
          revised_completion_date: input.revised_completion_date,
          governing_law: input.governing_law || "UAE Law / FIDIC 1999 Red Book",
          status: "active",
          notes: input.notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Contract;
    },

    async updateContract(accessToken, id, updates) {
      const client = createUserScopedClient(accessToken);
      const { data, error } = await client
        .from("contracts")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return (data as Contract) || null;
    },

    // Variations
    async listVariations(accessToken, projectId, contractId) {
      const client = createUserScopedClient(accessToken);
      let query = client.from("variation_orders").select("*").order("created_at", { ascending: false });
      if (projectId) query = query.eq("project_id", projectId);
      if (contractId) query = query.eq("contract_id", contractId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as VariationOrder[];
    },

    async getVariationById(accessToken, id) {
      const client = createUserScopedClient(accessToken);
      const { data, error } = await client.from("variation_orders").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return (data as VariationOrder) || null;
    },

    async createVariation(accessToken, input) {
      const client = createUserScopedClient(accessToken);
      const tenantId = await resolveTenant(client);
      const { data, error } = await client
        .from("variation_orders")
        .insert({
          tenant_id: tenantId,
          contract_id: input.contract_id,
          project_id: input.project_id,
          vo_number: input.vo_number,
          title: input.title,
          description: input.description,
          reason: input.reason || "client_request",
          proposed_cost_amount: input.proposed_cost_amount ?? 0,
          proposed_time_days: input.proposed_time_days ?? 0,
          approved_cost_amount: 0,
          approved_time_days: 0,
          status: "identified",
          notes: input.notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as VariationOrder;
    },

    async updateVariation(accessToken, id, updates) {
      const client = createUserScopedClient(accessToken);
      const { data, error } = await client
        .from("variation_orders")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return (data as VariationOrder) || null;
    },

    // Claims
    async listClaims(accessToken, projectId, contractId) {
      const client = createUserScopedClient(accessToken);
      let query = client.from("contract_claims").select("*").order("created_at", { ascending: false });
      if (projectId) query = query.eq("project_id", projectId);
      if (contractId) query = query.eq("contract_id", contractId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ContractClaim[];
    },

    async getClaimById(accessToken, id) {
      const client = createUserScopedClient(accessToken);
      const { data, error } = await client.from("contract_claims").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return (data as ContractClaim) || null;
    },

    async createClaim(accessToken, input) {
      const client = createUserScopedClient(accessToken);
      const tenantId = await resolveTenant(client);
      const { data, error } = await client
        .from("contract_claims")
        .insert({
          tenant_id: tenantId,
          contract_id: input.contract_id,
          project_id: input.project_id,
          claim_number: input.claim_number,
          title: input.title,
          event_type: input.event_type || "employer_delay",
          event_date: input.event_date,
          notice_date: input.notice_date,
          notice_deadline_date: input.notice_deadline_date,
          particulars_submitted_date: input.particulars_submitted_date || null,
          claimed_days: input.claimed_days ?? 0,
          claimed_cost_amount: input.claimed_cost_amount ?? 0,
          certified_days: 0,
          certified_cost_amount: 0,
          status: "notice_issued",
          assessment_notes: input.assessment_notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ContractClaim;
    },

    async updateClaim(accessToken, id, updates) {
      const client = createUserScopedClient(accessToken);
      const { data, error } = await client
        .from("contract_claims")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return (data as ContractClaim) || null;
    },

    // Securities
    async listSecurities(accessToken, projectId, contractId) {
      const client = createUserScopedClient(accessToken);
      let query = client.from("contract_securities").select("*").order("expiry_date", { ascending: true });
      if (projectId) query = query.eq("project_id", projectId);
      if (contractId) query = query.eq("contract_id", contractId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ContractSecurity[];
    },

    async getSecurityById(accessToken, id) {
      const client = createUserScopedClient(accessToken);
      const { data, error } = await client.from("contract_securities").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return (data as ContractSecurity) || null;
    },

    async createSecurity(accessToken, input) {
      const client = createUserScopedClient(accessToken);
      const tenantId = await resolveTenant(client);
      const { data, error } = await client
        .from("contract_securities")
        .insert({
          tenant_id: tenantId,
          contract_id: input.contract_id,
          project_id: input.project_id,
          security_type: input.security_type,
          reference_number: input.reference_number,
          issuing_institution: input.issuing_institution,
          beneficiary: input.beneficiary,
          amount: input.amount,
          currency: input.currency || "AED",
          effective_date: input.effective_date,
          expiry_date: input.expiry_date,
          status: "active",
          notes: input.notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ContractSecurity;
    },

    async updateSecurity(accessToken, id, updates) {
      const client = createUserScopedClient(accessToken);
      const { data, error } = await client
        .from("contract_securities")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return (data as ContractSecurity) || null;
    },
  };
}
