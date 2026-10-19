import type { AiRepository, IngestDocumentInput } from "./repository.js";
import { type LlmProvider, DefaultLlmProvider } from "./llmProvider.js";
import type {
  AiChatRequest,
  AiChatResponse,
  AiFeedbackInput,
  Citation,
  KnowledgeDocument,
} from "./types.js";

export interface AiKnowledgeService {
  ingest(
    token: string,
    tenantId: string,
    input: Omit<IngestDocumentInput, "tenant_id">
  ): Promise<KnowledgeDocument>;

  chat(
    token: string,
    tenantId: string,
    request: AiChatRequest,
    userId?: string
  ): Promise<AiChatResponse>;

  submitFeedback(
    token: string,
    tenantId: string,
    feedback: AiFeedbackInput,
    userId?: string
  ): Promise<void>;

  listDocuments(token: string, projectId?: string): Promise<KnowledgeDocument[]>;

  deleteDocument(token: string, id: string): Promise<void>;
}

export function createAiKnowledgeService(
  repo: AiRepository,
  llmProvider: LlmProvider = new DefaultLlmProvider()
): AiKnowledgeService {
  /**
   * Helper to split large documents into semantically coherent passages
   */
  function chunkContent(content: string, chunkSize = 500, overlap = 50): string[] {
    const text = content.trim();
    if (text.length <= chunkSize) return [text];

    const paragraphs = text.split(/\n\s*\n/);
    const chunks: string[] = [];
    let current = "";

    for (const p of paragraphs) {
      if ((current + "\n\n" + p).length <= chunkSize) {
        current = current ? current + "\n\n" + p : p;
      } else {
        if (current) chunks.push(current.trim());
        current = p;
      }
    }
    if (current) chunks.push(current.trim());

    // Fallback if no paragraph breaks existed
    if (chunks.length === 0) {
      for (let i = 0; i < text.length; i += chunkSize - overlap) {
        chunks.push(text.slice(i, i + chunkSize));
      }
    }

    return chunks;
  }

  return {
    async ingest(token, tenantId, input) {
      const chunks = chunkContent(input.content);
      const embeddedChunks = await Promise.all(
        chunks.map(async (text) => ({
          text,
          embedding: await llmProvider.generateEmbedding(text),
        }))
      );

      return repo.ingestDocument(
        token,
        {
          ...input,
          tenant_id: tenantId,
        },
        embeddedChunks
      );
    },

    async chat(token, tenantId, request, _userId) {
      const query = request.message.trim();
      const queryEmbedding = await llmProvider.generateEmbedding(query);

      // Match chunks with permission and project scoping (FR-AI-002)
      const matches = await repo.matchChunks(
        token,
        queryEmbedding,
        0.5,
        4,
        request.projectId,
        tenantId,
        query
      );

      // If no valid matches found, abstain per FR-AI-003
      if (matches.length === 0) {
        return {
          answer:
            "Based on approved company records and drawings, there is insufficient evidence to answer your inquiry. Per SEVENTS AI Governance policy (FR-AI-003), this request has been logged for human clarification. Please verify with the project lead or submit an RFI.",
          citations: [],
          confidence: 0,
          outputType: "recommendation",
          modelUsed: "sevents-governance-guardrail",
          abstained: true,
        };
      }

      // Format citations per FR-AI-001
      const citations: Citation[] = matches.map((m) => ({
        documentId: m.document_id,
        title: m.title,
        sourceType: m.source_type,
        version: m.version,
        snippet: m.chunk_text.slice(0, 180),
        similarity: Number(m.similarity.toFixed(3)),
      }));

      // Pass context passages to LLM
      const contextPassages = matches.map((m) => ({
        title: m.title,
        version: m.version,
        text: m.chunk_text,
      }));

      const generated = await llmProvider.generateAnswer(query, contextPassages, request.history);

      const avgConfidence =
        matches.reduce((acc, curr) => acc + curr.similarity, 0) / matches.length;

      return {
        answer: generated.answer,
        citations,
        confidence: Number(avgConfidence.toFixed(2)),
        outputType: generated.outputType,
        modelUsed: generated.model,
        abstained: generated.abstained,
      };
    },

    async submitFeedback(token, tenantId, feedback, userId) {
      await repo.recordFeedback(token, feedback, userId, tenantId);
    },

    async listDocuments(token, projectId) {
      return repo.listDocuments(token, projectId);
    },

    async deleteDocument(token, id) {
      return repo.deleteDocument(token, id);
    },
  };
}
