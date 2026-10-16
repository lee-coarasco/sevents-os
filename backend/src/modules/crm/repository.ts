import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Client,
  ClientCommunication,
  Contact,
  HandoverExceptionStatus,
  HandoverItemKey,
  HandoverItemStatus,
  Opportunity,
  OpportunityHandoverChecklistItem,
  OpportunityHandoverException,
  OpportunityStage,
  SiteVisit,
  TenderSubmission,
} from "./types.js";

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
  handover_completed_at?: string;
  handover_completed_by?: string | null;
}

export interface ListOpportunitiesFilter {
  clientId?: string;
  stage?: OpportunityStage;
}

export interface CreateSiteVisitInput {
  opportunity_id: string;
  visited_by: string;
  visit_date: string;
  notes?: string | null;
}

export interface CreateTenderSubmissionInput {
  opportunity_id: string;
  deadline_date: string;
  submitted_at?: string | null;
  evidence_reference?: string | null;
  notes?: string | null;
  created_by: string | null;
}

export interface CreateClientCommunicationInput {
  client_id: string;
  opportunity_id?: string | null;
  channel: string;
  summary: string;
  logged_by: string;
  occurred_at?: string;
}

export interface CreateHandoverChecklistItemInput {
  opportunity_id: string;
  item_key: HandoverItemKey;
  status?: HandoverItemStatus;
  completed_by?: string | null;
  completed_at?: string | null;
}

export interface UpdateHandoverChecklistItemInput {
  status?: HandoverItemStatus;
  completed_by?: string | null;
  completed_at?: string | null;
}

export interface CreateHandoverExceptionInput {
  opportunity_id: string;
  reason: string;
  requested_by: string | null;
  workflow_instance_id: string;
}

export interface UpdateHandoverExceptionInput {
  status?: HandoverExceptionStatus;
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
  createSiteVisit(accessToken: string, input: CreateSiteVisitInput): Promise<SiteVisit>;
  listSiteVisits(accessToken: string, opportunityId: string): Promise<SiteVisit[]>;
  createTenderSubmission(accessToken: string, input: CreateTenderSubmissionInput): Promise<TenderSubmission>;
  listTenderSubmissions(accessToken: string, opportunityId: string): Promise<TenderSubmission[]>;
  createClientCommunication(
    accessToken: string,
    input: CreateClientCommunicationInput,
  ): Promise<ClientCommunication>;
  listClientCommunications(
    accessToken: string,
    filter: { clientId?: string; opportunityId?: string },
  ): Promise<ClientCommunication[]>;
  listHandoverChecklistItems(accessToken: string, opportunityId: string): Promise<OpportunityHandoverChecklistItem[]>;
  createHandoverChecklistItem(
    accessToken: string,
    input: CreateHandoverChecklistItemInput,
  ): Promise<OpportunityHandoverChecklistItem>;
  updateHandoverChecklistItem(
    accessToken: string,
    itemId: string,
    input: UpdateHandoverChecklistItemInput,
  ): Promise<OpportunityHandoverChecklistItem | null>;
  createHandoverException(
    accessToken: string,
    input: CreateHandoverExceptionInput,
  ): Promise<OpportunityHandoverException>;
  getHandoverException(accessToken: string, exceptionId: string): Promise<OpportunityHandoverException | null>;
  listHandoverExceptions(accessToken: string, opportunityId: string): Promise<OpportunityHandoverException[]>;
  updateHandoverException(
    accessToken: string,
    exceptionId: string,
    input: UpdateHandoverExceptionInput,
  ): Promise<OpportunityHandoverException | null>;
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

    async createSiteVisit(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("site_visits")
        .insert({ notes: null, ...input })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createSiteVisit: ${error?.message ?? "no row returned"}`);
      return data as SiteVisit;
    },

    async listSiteVisits(accessToken, opportunityId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("site_visits").select("*").eq("opportunity_id", opportunityId);
      if (error) throw new Error(`listSiteVisits: ${error.message}`);
      return (data as SiteVisit[]) ?? [];
    },

    async createTenderSubmission(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("tender_submissions")
        .insert({ submitted_at: null, evidence_reference: null, notes: null, ...input })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createTenderSubmission: ${error?.message ?? "no row returned"}`);
      return data as TenderSubmission;
    },

    async listTenderSubmissions(accessToken, opportunityId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("tender_submissions")
        .select("*")
        .eq("opportunity_id", opportunityId);
      if (error) throw new Error(`listTenderSubmissions: ${error.message}`);
      return (data as TenderSubmission[]) ?? [];
    },

    async createClientCommunication(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("client_communications")
        .insert({ opportunity_id: null, ...input })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createClientCommunication: ${error?.message ?? "no row returned"}`);
      return data as ClientCommunication;
    },

    async listClientCommunications(accessToken, filter) {
      const client = userScopedClientFactory(accessToken);
      let query = client.from("client_communications").select("*");
      if (filter.clientId) query = query.eq("client_id", filter.clientId);
      if (filter.opportunityId) query = query.eq("opportunity_id", filter.opportunityId);
      const { data, error } = await query;
      if (error) throw new Error(`listClientCommunications: ${error.message}`);
      return (data as ClientCommunication[]) ?? [];
    },

    async listHandoverChecklistItems(accessToken, opportunityId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("opportunity_handover_checklists")
        .select("*")
        .eq("opportunity_id", opportunityId);
      if (error) throw new Error(`listHandoverChecklistItems: ${error.message}`);
      return (data as OpportunityHandoverChecklistItem[]) ?? [];
    },

    async createHandoverChecklistItem(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("opportunity_handover_checklists")
        .insert({ status: "pending", completed_by: null, completed_at: null, ...input })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createHandoverChecklistItem: ${error?.message ?? "no row returned"}`);
      return data as OpportunityHandoverChecklistItem;
    },

    async updateHandoverChecklistItem(accessToken, itemId, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("opportunity_handover_checklists")
        .update(input)
        .eq("id", itemId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateHandoverChecklistItem: ${error.message}`);
      return (data as OpportunityHandoverChecklistItem | null) ?? null;
    },

    async createHandoverException(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("opportunity_handover_exceptions")
        .insert(input)
        .select("*")
        .single();
      if (error || !data) throw new Error(`createHandoverException: ${error?.message ?? "no row returned"}`);
      return data as OpportunityHandoverException;
    },

    async getHandoverException(accessToken, exceptionId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("opportunity_handover_exceptions")
        .select("*")
        .eq("id", exceptionId)
        .maybeSingle();
      if (error) throw new Error(`getHandoverException: ${error.message}`);
      return (data as OpportunityHandoverException | null) ?? null;
    },

    async listHandoverExceptions(accessToken, opportunityId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("opportunity_handover_exceptions")
        .select("*")
        .eq("opportunity_id", opportunityId);
      if (error) throw new Error(`listHandoverExceptions: ${error.message}`);
      return (data as OpportunityHandoverException[]) ?? [];
    },

    async updateHandoverException(accessToken, exceptionId, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("opportunity_handover_exceptions")
        .update(input)
        .eq("id", exceptionId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateHandoverException: ${error.message}`);
      return (data as OpportunityHandoverException | null) ?? null;
    },
  };
}
