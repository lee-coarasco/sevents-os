import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client, Contact, Opportunity, OpportunityStage } from "./types.js";

export interface CreateClientInput {
  name: string;
  trade_license_number?: string | null;
  registration_country?: string | null;
  created_by: string | null;
}

export interface CreateContactInput {
  client_id: string;
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  is_primary?: boolean;
}

export interface CreateOpportunityInput {
  client_id: string;
  title: string;
  source: string;
  owner_id: string;
  expected_value?: number | null;
  probability?: number | null;
  next_action?: string | null;
  due_date?: string | null;
  created_by: string | null;
}

export interface UpdateOpportunityInput {
  stage?: OpportunityStage;
  owner_id?: string;
  expected_value?: number | null;
  probability?: number | null;
  next_action?: string | null;
  due_date?: string | null;
}

export interface ListOpportunitiesFilter {
  clientId?: string;
  stage?: OpportunityStage;
}

/**
 * Every method goes through the caller's own user-scoped client, same
 * convention as modules/tenancy and modules/projects — RLS
 * (tenant_id = current_tenant_id()) is the real isolation mechanism,
 * this adapter just has to not bypass it.
 */
export interface CrmRepository {
  createClient(accessToken: string, input: CreateClientInput): Promise<Client>;
  getClient(accessToken: string, clientId: string): Promise<Client | null>;
  /** FR-CRM-002: case-insensitive name search surfacing likely duplicates for a human to resolve. */
  searchClients(accessToken: string, search?: string): Promise<Client[]>;
  createContact(accessToken: string, input: CreateContactInput): Promise<Contact>;
  listContactsForClient(accessToken: string, clientId: string): Promise<Contact[]>;
  /** FR-CRM-002: case-insensitive name/email/phone search surfacing likely duplicates for a human to resolve. */
  searchContacts(accessToken: string, search?: string): Promise<Contact[]>;
  createOpportunity(accessToken: string, input: CreateOpportunityInput): Promise<Opportunity>;
  getOpportunity(accessToken: string, opportunityId: string): Promise<Opportunity | null>;
  listOpportunities(accessToken: string, filter?: ListOpportunitiesFilter): Promise<Opportunity[]>;
  updateOpportunity(
    accessToken: string,
    opportunityId: string,
    input: UpdateOpportunityInput,
  ): Promise<Opportunity | null>;
}

/**
 * Supabase-backed implementation. Not exercised against a live
 * Supabase project in this session (no reachable credentials in this
 * sandbox, same gap already flagged for every other Supabase-backed
 * repository in this codebase).
 */
export function createSupabaseCrmRepository(
  userScopedClientFactory: (accessToken: string) => SupabaseClient,
): CrmRepository {
  return {
    async createClient(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("clients")
        .insert({ trade_license_number: null, registration_country: null, ...input })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createClient: ${error?.message ?? "no row returned"}`);
      return data as Client;
    },

    async getClient(accessToken, clientId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("clients").select("*").eq("id", clientId).maybeSingle();
      if (error) throw new Error(`getClient: ${error.message}`);
      return (data as Client | null) ?? null;
    },

    async searchClients(accessToken, search) {
      const client = userScopedClientFactory(accessToken);
      let query = client.from("clients").select("*");
      if (search) query = query.ilike("name", `%${search}%`);
      const { data, error } = await query;
      if (error) throw new Error(`searchClients: ${error.message}`);
      return (data as Client[]) ?? [];
    },

    async createContact(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("contacts")
        .insert({ title: null, email: null, phone: null, is_primary: false, ...input })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createContact: ${error?.message ?? "no row returned"}`);
      return data as Contact;
    },

    async listContactsForClient(accessToken, clientId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("contacts").select("*").eq("client_id", clientId);
      if (error) throw new Error(`listContactsForClient: ${error.message}`);
      return (data as Contact[]) ?? [];
    },

    async searchContacts(accessToken, search) {
      const client = userScopedClientFactory(accessToken);
      let query = client.from("contacts").select("*");
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
      }
      const { data, error } = await query;
      if (error) throw new Error(`searchContacts: ${error.message}`);
      return (data as Contact[]) ?? [];
    },

    async createOpportunity(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("opportunities")
        .insert({ expected_value: null, probability: null, next_action: null, due_date: null, ...input })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createOpportunity: ${error?.message ?? "no row returned"}`);
      return data as Opportunity;
    },

    async getOpportunity(accessToken, opportunityId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("opportunities")
        .select("*")
        .eq("id", opportunityId)
        .maybeSingle();
      if (error) throw new Error(`getOpportunity: ${error.message}`);
      return (data as Opportunity | null) ?? null;
    },

    async listOpportunities(accessToken, filter) {
      const client = userScopedClientFactory(accessToken);
      let query = client.from("opportunities").select("*");
      if (filter?.clientId) query = query.eq("client_id", filter.clientId);
      if (filter?.stage) query = query.eq("stage", filter.stage);
      const { data, error } = await query;
      if (error) throw new Error(`listOpportunities: ${error.message}`);
      return (data as Opportunity[]) ?? [];
    },

    async updateOpportunity(accessToken, opportunityId, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("opportunities")
        .update(input)
        .eq("id", opportunityId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateOpportunity: ${error.message}`);
      return (data as Opportunity | null) ?? null;
    },
  };
}
