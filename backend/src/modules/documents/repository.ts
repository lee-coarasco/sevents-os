import type { SupabaseClient } from "@supabase/supabase-js";
import type { Document, DocumentRevision, DocumentRevisionStatus } from "./types.js";

export interface CreateDocumentInput {
  document_type: string;
  title: string;
  document_number?: string | null;
  project_id?: string | null;
  discipline?: string | null;
  access_class?: string | null;
  tags?: string[];
  originator_id?: string | null;
}

export interface UpdateDocumentInput {
  title?: string;
  document_number?: string | null;
  project_id?: string | null;
  discipline?: string | null;
  access_class?: string | null;
  tags?: string[];
  originator_id?: string | null;
}

export interface CreateDocumentRevisionInput {
  document_id: string;
  revision_code: string;
  status?: DocumentRevisionStatus;
  storage_reference?: string | null;
  reviewer_id?: string | null;
  approver_id?: string | null;
  created_by: string | null;
}

export interface UpdateDocumentRevisionInput {
  status?: DocumentRevisionStatus;
  storage_reference?: string | null;
  reviewer_id?: string | null;
  approver_id?: string | null;
  superseded_by_revision_id?: string | null;
}

export interface ListRevisionsOptions {
  /** FR-DOC-002: current-for-construction views exclude superseded/rejected by default. */
  includeSuperseded?: boolean;
}

/**
 * Every method goes through the caller's own user-scoped client, same
 * convention as modules/tendering and modules/crm — RLS
 * (tenant_id = current_tenant_id()) is the real isolation mechanism,
 * this adapter just has to not bypass it.
 */
export interface DocumentsRepository {
  createDocument(accessToken: string, input: CreateDocumentInput): Promise<Document>;
  getDocument(accessToken: string, documentId: string): Promise<Document | null>;
  listDocuments(accessToken: string, filters?: { projectId?: string }): Promise<Document[]>;
  updateDocument(accessToken: string, documentId: string, input: UpdateDocumentInput): Promise<Document | null>;
  setDocumentCurrentRevision(accessToken: string, documentId: string, revisionId: string): Promise<Document | null>;

  createDocumentRevision(accessToken: string, input: CreateDocumentRevisionInput): Promise<DocumentRevision>;
  getDocumentRevision(accessToken: string, revisionId: string): Promise<DocumentRevision | null>;
  updateDocumentRevision(
    accessToken: string,
    revisionId: string,
    input: UpdateDocumentRevisionInput,
  ): Promise<DocumentRevision | null>;
  /** All revisions of a document, oldest-to-newest, full field set — the raw data a revision-comparison screen needs. */
  listDocumentRevisionHistory(accessToken: string, documentId: string): Promise<DocumentRevision[]>;
  /** Defaults to excluding superseded/rejected (FR-DOC-002); includeSuperseded=true returns everything. */
  listDocumentRevisions(
    accessToken: string,
    documentId: string,
    options?: ListRevisionsOptions,
  ): Promise<DocumentRevision[]>;
}

/**
 * Supabase-backed implementation. Not exercised against a live Supabase
 * project in this session (no reachable Supabase MCP tools in this
 * sandbox — same gap already flagged for every other Supabase-backed
 * repository in this codebase).
 */
export function createSupabaseDocumentsRepository(
  userScopedClientFactory: (accessToken: string) => SupabaseClient,
): DocumentsRepository {
  return {
    async createDocument(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("documents")
        .insert({
          document_number: null,
          project_id: null,
          discipline: null,
          access_class: null,
          tags: [],
          originator_id: null,
          ...input,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createDocument: ${error?.message ?? "no row returned"}`);
      return data as Document;
    },

    async getDocument(accessToken, documentId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("documents").select("*").eq("id", documentId).maybeSingle();
      if (error) throw new Error(`getDocument: ${error.message}`);
      return (data as Document | null) ?? null;
    },

    async listDocuments(accessToken, filters) {
      const client = userScopedClientFactory(accessToken);
      let query = client.from("documents").select("*");
      if (filters?.projectId) query = query.eq("project_id", filters.projectId);
      const { data, error } = await query;
      if (error) throw new Error(`listDocuments: ${error.message}`);
      return (data as Document[]) ?? [];
    },

    async updateDocument(accessToken, documentId, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("documents")
        .update(input)
        .eq("id", documentId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateDocument: ${error.message}`);
      return (data as Document | null) ?? null;
    },

    async setDocumentCurrentRevision(accessToken, documentId, revisionId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("documents")
        .update({ current_revision_id: revisionId })
        .eq("id", documentId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`setDocumentCurrentRevision: ${error.message}`);
      return (data as Document | null) ?? null;
    },

    async createDocumentRevision(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("document_revisions")
        .insert({
          status: "draft",
          storage_reference: null,
          reviewer_id: null,
          approver_id: null,
          ...input,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createDocumentRevision: ${error?.message ?? "no row returned"}`);
      return data as DocumentRevision;
    },

    async getDocumentRevision(accessToken, revisionId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("document_revisions")
        .select("*")
        .eq("id", revisionId)
        .maybeSingle();
      if (error) throw new Error(`getDocumentRevision: ${error.message}`);
      return (data as DocumentRevision | null) ?? null;
    },

    async updateDocumentRevision(accessToken, revisionId, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("document_revisions")
        .update(input)
        .eq("id", revisionId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateDocumentRevision: ${error.message}`);
      return (data as DocumentRevision | null) ?? null;
    },

    async listDocumentRevisionHistory(accessToken, documentId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("document_revisions")
        .select("*")
        .eq("document_id", documentId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(`listDocumentRevisionHistory: ${error.message}`);
      return (data as DocumentRevision[]) ?? [];
    },

    async listDocumentRevisions(accessToken, documentId, options) {
      const client = userScopedClientFactory(accessToken);
      let query = client.from("document_revisions").select("*").eq("document_id", documentId);
      if (!options?.includeSuperseded) {
        query = query.not("status", "in", "(superseded,rejected)");
      }
      const { data, error } = await query.order("created_at", { ascending: true });
      if (error) throw new Error(`listDocumentRevisions: ${error.message}`);
      return (data as DocumentRevision[]) ?? [];
    },
  };
}
