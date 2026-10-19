import { apiFetch } from "../lib/api";

export type KnowledgeSourceType =
  | "drawing"
  | "rfi"
  | "submittal"
  | "contract"
  | "dpr"
  | "specification"
  | "change_order"
  | "policy";

export interface KnowledgeDocument {
  id: string;
  tenant_id: string;
  project_id: string | null;
  source_type: KnowledgeSourceType;
  source_id: string;
  title: string;
  version: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  chunk_count?: number;
}

export interface AiCitation {
  documentId: string;
  title: string;
  sourceType: KnowledgeSourceType;
  version: string;
  projectId?: string;
  snippet: string;
  similarity: number;
}

export interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  citations?: AiCitation[];
  confidence?: number;
  abstain?: boolean;
  abstainReason?: string;
  model?: string;
}

export interface AiChatResponse {
  answer: string;
  citations: AiCitation[];
  confidence: number;
  abstain: boolean;
  abstainReason?: string;
  model: string;
  tokensUsed?: { prompt: number; completion: number; total: number };
}

export interface IngestDocumentPayload {
  projectId?: string;
  sourceType: KnowledgeSourceType;
  sourceId: string;
  title: string;
  version?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface AiFeedbackPayload {
  queryText: string;
  responseText?: string;
  rating: 1 | -1;
  comment?: string;
  citationId?: string;
  isKnowledgeGap?: boolean;
}

export const aiService = {
  async chat(
    token: string,
    message: string,
    projectId?: string,
    history?: { role: "user" | "assistant"; content: string }[]
  ): Promise<AiChatResponse> {
    return apiFetch<AiChatResponse>("/ai/chat", token, {
      method: "POST",
      body: JSON.stringify({ message, projectId, history }),
    });
  },

  async listDocuments(token: string, projectId?: string): Promise<KnowledgeDocument[]> {
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    const res = await apiFetch<{ documents: KnowledgeDocument[] }>(`/ai/documents${qs}`, token);
    return res.documents;
  },

  async ingestDocument(token: string, payload: IngestDocumentPayload): Promise<KnowledgeDocument> {
    const res = await apiFetch<{ document: KnowledgeDocument }>("/ai/ingest", token, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return res.document;
  },

  async deleteDocument(token: string, id: string): Promise<void> {
    await apiFetch<{ success: boolean }>(`/ai/documents/${id}`, token, {
      method: "DELETE",
    });
  },

  async submitFeedback(token: string, payload: AiFeedbackPayload): Promise<void> {
    await apiFetch<{ success: boolean }>("/ai/feedback", token, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listProviders(token: string): Promise<ProviderMeta[]> {
    const res = await apiFetch<{ providers: ProviderMeta[] }>("/ai/providers", token);
    return res.providers;
  },

  async testProvider(
    token: string,
    provider: string,
    apiKey?: string
  ): Promise<{ ok: boolean; message: string; latencyMs: number }> {
    const res = await apiFetch<{ result: { ok: boolean; message: string; latencyMs: number } }>(
      "/ai/providers/test",
      token,
      {
        method: "POST",
        body: JSON.stringify({ provider, apiKey }),
      }
    );
    return res.result;
  },
};

export interface ProviderMeta {
  id: "openai" | "gemini" | "anthropic" | "azure" | "local";
  name: string;
  defaultModel: string;
  supportedModels: string[];
  isConfigured: boolean;
  requiresKey: boolean;
}

