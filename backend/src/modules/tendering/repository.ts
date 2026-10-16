import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenderClarification, TenderDocument } from "./types.js";

export interface CreateTenderDocumentInput {
  tender_submission_id: string;
  document_type: string;
  title: string;
  document_number?: string | null;
  revision?: string | null;
  received_date?: string | null;
  storage_reference?: string | null;
  created_by: string | null;
}

export interface CreateTenderClarificationInput {
  tender_submission_id: string;
  item: string;
  raised_by: string;
  raised_at?: string;
  response?: string | null;
  resolved_at?: string | null;
}

export interface UpdateTenderClarificationInput {
  response?: string | null;
  resolved_at?: string | null;
}

/**
 * Every method goes through the caller's own user-scoped client, same
 * convention as modules/crm — RLS (tenant_id = current_tenant_id()) is
 * the real isolation mechanism, this adapter just has to not bypass it.
 */
export interface TenderingRepository {
  createTenderDocument(accessToken: string, input: CreateTenderDocumentInput): Promise<TenderDocument>;
  listTenderDocuments(accessToken: string, tenderSubmissionId: string): Promise<TenderDocument[]>;
  createTenderClarification(
    accessToken: string,
    input: CreateTenderClarificationInput,
  ): Promise<TenderClarification>;
  listTenderClarifications(accessToken: string, tenderSubmissionId: string): Promise<TenderClarification[]>;
  updateTenderClarification(
    accessToken: string,
    clarificationId: string,
    input: UpdateTenderClarificationInput,
  ): Promise<TenderClarification | null>;
}

/**
 * Supabase-backed implementation. Not exercised against a live
 * Supabase project in this session (no reachable Supabase MCP tools in
 * this sandbox — see ticket 0094 — same gap already flagged for every
 * other Supabase-backed repository in this codebase).
 */
export function createSupabaseTenderingRepository(
  userScopedClientFactory: (accessToken: string) => SupabaseClient,
): TenderingRepository {
  return {
    async createTenderDocument(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("tender_documents")
        .insert({ document_number: null, revision: null, received_date: null, storage_reference: null, ...input })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createTenderDocument: ${error?.message ?? "no row returned"}`);
      return data as TenderDocument;
    },

    async listTenderDocuments(accessToken, tenderSubmissionId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("tender_documents")
        .select("*")
        .eq("tender_submission_id", tenderSubmissionId);
      if (error) throw new Error(`listTenderDocuments: ${error.message}`);
      return (data as TenderDocument[]) ?? [];
    },

    async createTenderClarification(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("tender_clarifications")
        .insert({ response: null, resolved_at: null, ...input })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createTenderClarification: ${error?.message ?? "no row returned"}`);
      return data as TenderClarification;
    },

    async listTenderClarifications(accessToken, tenderSubmissionId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("tender_clarifications")
        .select("*")
        .eq("tender_submission_id", tenderSubmissionId);
      if (error) throw new Error(`listTenderClarifications: ${error.message}`);
      return (data as TenderClarification[]) ?? [];
    },

    async updateTenderClarification(accessToken, clarificationId, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("tender_clarifications")
        .update(input)
        .eq("id", clarificationId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateTenderClarification: ${error.message}`);
      return (data as TenderClarification | null) ?? null;
    },
  };
}
