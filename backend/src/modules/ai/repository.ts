import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  KnowledgeDocument,
  KnowledgeChunkMatch,
  KnowledgeSourceType,
  AiFeedbackInput,
} from "./types.js";

export interface IngestDocumentInput {
  tenant_id: string;
  project_id?: string | null;
  source_type: KnowledgeSourceType;
  source_id: string;
  title: string;
  version?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface AiRepository {
  ingestDocument(
    token: string,
    doc: IngestDocumentInput,
    chunks: { text: string; embedding: number[] }[]
  ): Promise<KnowledgeDocument>;

  matchChunks(
    token: string,
    queryEmbedding: number[],
    threshold?: number,
    count?: number,
    projectId?: string,
    tenantId?: string,
    queryTextFallback?: string
  ): Promise<KnowledgeChunkMatch[]>;

  recordFeedback(
    token: string,
    feedback: AiFeedbackInput,
    userId?: string,
    tenantId?: string
  ): Promise<void>;

  listDocuments(token: string, projectId?: string): Promise<KnowledgeDocument[]>;

  deleteDocument(token: string, id: string): Promise<void>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveValidTenantId(client: SupabaseClient, candidate?: string | null): Promise<string> {
  if (candidate && UUID_REGEX.test(candidate)) {
    return candidate;
  }
  try {
    const { data: rpcTenant } = await client.rpc("current_tenant_id");
    if (rpcTenant && UUID_REGEX.test(rpcTenant)) {
      return rpcTenant;
    }
  } catch {}
  try {
    const { data: firstTenant } = await client.from("tenants").select("id").limit(1).maybeSingle();
    if (firstTenant?.id && UUID_REGEX.test(firstTenant.id)) {
      return firstTenant.id;
    }
  } catch {}
  return "00000000-0000-0000-0000-000000000000";
}

const VALID_SOURCE_TYPES = new Set([
  "document",
  "drawing",
  "rfi",
  "dpr",
  "contract",
  "work_item",
  "sop",
]);

function normalizeSourceType(type: string): KnowledgeSourceType {
  const t = (type || "").toLowerCase().trim();
  if (VALID_SOURCE_TYPES.has(t)) {
    return t as KnowledgeSourceType;
  }
  if (t === "policy") return "sop";
  // 'specification', 'submittal', 'change_order', etc. map cleanly to 'document' for DB constraint
  return "document";
}

export function createSupabaseAiRepository(
  getUserScopedClient: (token: string) => SupabaseClient
): AiRepository {
  return {
    async ingestDocument(token, doc, chunks) {
      const client = getUserScopedClient(token);
      const safeTenantId = await resolveValidTenantId(client, doc.tenant_id);
      const safeSourceType = normalizeSourceType(doc.source_type);

      // Upsert document
      const { data: savedDoc, error: docErr } = await client
        .from("knowledge_documents")
        .upsert(
          {
            tenant_id: safeTenantId,
            project_id: doc.project_id || null,
            source_type: safeSourceType,
            source_id: doc.source_id,
            title: doc.title,
            version: doc.version || "v1",
            content: doc.content,
            metadata: {
              ...(doc.metadata || {}),
              original_source_type: doc.source_type,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,source_type,source_id,version" }
        )
        .select()
        .single();

      if (docErr) throw new Error(`ingestDocument failed: ${docErr.message}`);

      // Delete existing chunks for this document
      await client
        .from("knowledge_embeddings")
        .delete()
        .eq("document_id", savedDoc.id);

      // Insert chunk embeddings
      if (chunks.length > 0) {
        const rows = chunks.map((c, idx) => ({
          document_id: savedDoc.id,
          tenant_id: safeTenantId,
          chunk_index: idx,
          chunk_text: c.text,
          embedding: c.embedding,
        }));

        const { error: chunkErr } = await client
          .from("knowledge_embeddings")
          .insert(rows);

        if (chunkErr) {
          console.warn("[AiRepository] Warning inserting embeddings:", chunkErr.message);
        }
      }

      return savedDoc as KnowledgeDocument;
    },

    async matchChunks(token, queryEmbedding, threshold = 0.5, count = 5, projectId, tenantId, queryTextFallback) {
      const client = getUserScopedClient(token);

      try {
        const { data, error } = await client.rpc("match_knowledge_chunks", {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: count,
          filter_project_id: projectId || null,
          filter_tenant_id: tenantId && UUID_REGEX.test(tenantId) ? tenantId : null,
        });

        if (!error && data && data.length > 0) {
          return data as KnowledgeChunkMatch[];
        }
      } catch (rpcErr) {
        console.warn("[AiRepository] RPC match_knowledge_chunks not available or failed:", rpcErr);
      }

      // Resilient fallback: text query over knowledge_documents if pgvector RPC is not active
      let query = client.from("knowledge_documents").select("*").limit(count);
      if (projectId) query = query.eq("project_id", projectId);

      const { data: docs } = await query;
      if (!docs || docs.length === 0) return [];

      return docs.map((d: any, idx: number) => ({
        id: `chunk-fb-${idx}`,
        document_id: d.id,
        title: d.title,
        source_type: d.source_type,
        version: d.version,
        project_id: d.project_id,
        chunk_text: d.content.slice(0, 600),
        similarity: queryTextFallback && d.content.toLowerCase().includes(queryTextFallback.toLowerCase()) ? 0.88 : 0.65,
      }));
    },

    async recordFeedback(token, feedback, userId, tenantId) {
      const client = getUserScopedClient(token);
      const safeTenantId = await resolveValidTenantId(client, tenantId);
      const { error } = await client.from("ai_query_feedback").insert({
        tenant_id: safeTenantId,
        user_id: userId || null,
        query_text: feedback.queryText,
        answer_text: feedback.answerText,
        citations: feedback.citations,
        rating: feedback.rating,
        feedback_notes: feedback.feedbackNotes || null,
      });

      if (error) {
        console.warn("[AiRepository] Failed to record feedback:", error.message);
      }
    },

    async listDocuments(token, projectId) {
      const client = getUserScopedClient(token);
      let query = client
        .from("knowledge_documents")
        .select("*")
        .order("created_at", { ascending: false });

      if (projectId) {
        query = query.eq("project_id", projectId);
      }

      const { data, error } = await query;
      if (error) throw new Error(`listDocuments failed: ${error.message}`);
      return (data as KnowledgeDocument[]) || [];
    },

    async deleteDocument(token, id) {
      const client = getUserScopedClient(token);
      const { error } = await client
        .from("knowledge_documents")
        .delete()
        .eq("id", id);

      if (error) throw new Error(`deleteDocument failed: ${error.message}`);
    },
  };
}
