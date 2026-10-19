import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAiKnowledgeService } from "./service.js";
import type { AiRepository } from "./repository.js";
import type { LlmProvider } from "./llmProvider.js";
import type { KnowledgeDocument } from "./types.js";

describe("Module M28: AI Knowledge Assistant & Search Service", () => {
  let mockRepo: AiRepository;
  let mockLlm: LlmProvider;

  beforeEach(() => {
    mockRepo = {
      ingestDocument: vi.fn().mockImplementation(async (_token, doc, chunks) => ({
        id: "doc-101",
        tenant_id: doc.tenant_id,
        project_id: doc.project_id,
        source_type: doc.source_type,
        source_id: doc.source_id,
        title: doc.title,
        version: doc.version,
        content: doc.content,
        metadata: doc.metadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as KnowledgeDocument)),
      matchChunks: vi.fn(),
      recordFeedback: vi.fn().mockResolvedValue(undefined),
      listDocuments: vi.fn().mockResolvedValue([]),
      deleteDocument: vi.fn().mockResolvedValue(undefined),
    };

    mockLlm = {
      generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.05)),
      generateAnswer: vi.fn().mockImplementation(async (query, context) => ({
        answer: `Answer to ${query} based on ${context[0]?.title}`,
        outputType: "summary",
        model: "mock-model",
        abstained: false,
      })),
    };
  });

  it("chunks documents and stores embeddings on ingestion", async () => {
    const service = createAiKnowledgeService(mockRepo, mockLlm);

    const doc = await service.ingest("token", "tenant-1", {
      project_id: "proj-1",
      source_type: "document",
      source_id: "SPEC-01",
      title: "Project Specification - Concrete Mix",
      version: "v2",
      content: "All structural columns must use C40/50 ready-mix concrete with silica fume additive.",
    });

    expect(doc.id).toBe("doc-101");
    expect(mockLlm.generateEmbedding).toHaveBeenCalled();
    expect(mockRepo.ingestDocument).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({
        title: "Project Specification - Concrete Mix",
        tenant_id: "tenant-1",
      }),
      expect.arrayContaining([
        expect.objectContaining({
          text: expect.stringContaining("All structural columns"),
        }),
      ])
    );
  });

  it("returns grounded answer with exact citations when matching documents exist (FR-AI-001)", async () => {
    const service = createAiKnowledgeService(mockRepo, mockLlm);

    vi.mocked(mockRepo.matchChunks).mockResolvedValue([
      {
        id: "chunk-1",
        document_id: "doc-101",
        title: "Project Specification - Concrete Mix",
        source_type: "document",
        version: "v2",
        project_id: "proj-1",
        chunk_text: "All structural columns must use C40/50 ready-mix concrete.",
        similarity: 0.89,
      },
    ]);

    const res = await service.chat(
      "token",
      "tenant-1",
      {
        message: "What concrete grade is required for columns?",
        projectId: "proj-1",
      },
      "user-1"
    );

    expect(res.abstained).toBe(false);
    expect(res.confidence).toBe(0.89);
    expect(res.citations).toHaveLength(1);
    expect(res.citations[0]).toEqual(
      expect.objectContaining({
        title: "Project Specification - Concrete Mix",
        version: "v2",
        similarity: 0.89,
      })
    );
    expect(res.outputType).toBe("summary");
  });

  it("abstains with uncertainty notice when no matching evidence is found (FR-AI-003)", async () => {
    const service = createAiKnowledgeService(mockRepo, mockLlm);

    vi.mocked(mockRepo.matchChunks).mockResolvedValue([]); // No matches

    const res = await service.chat(
      "token",
      "tenant-1",
      {
        message: "What is the fire rating of unapproved door type X?",
      }
    );

    expect(res.abstained).toBe(true);
    expect(res.confidence).toBe(0);
    expect(res.citations).toHaveLength(0);
    expect(res.answer).toContain("insufficient evidence");
  });

  it("submits feedback and reports knowledge gap", async () => {
    const service = createAiKnowledgeService(mockRepo, mockLlm);

    await service.submitFeedback(
      "token",
      "tenant-1",
      {
        queryText: "How many cranes are on site?",
        answerText: "Answer text",
        citations: [],
        rating: "missing_info",
        feedbackNotes: "Daily plant log missing for Tower C",
      },
      "user-1"
    );

    expect(mockRepo.recordFeedback).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({
        rating: "missing_info",
        feedbackNotes: "Daily plant log missing for Tower C",
      }),
      "user-1",
      "tenant-1"
    );
  });
});
