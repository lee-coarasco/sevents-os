import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AiKnowledgePage } from "./AiKnowledgePage";
import { aiService } from "../services/aiService";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    session: { access_token: "mock-token-xyz", user: { email: "lead@sevents.test" } },
    loading: false,
  }),
}));

vi.mock("../services/aiService", () => ({
  aiService: {
    listDocuments: vi.fn(),
    ingestDocument: vi.fn(),
    deleteDocument: vi.fn(),
    chat: vi.fn(),
  },
}));

const mockDocs = [
  {
    id: "doc-1",
    tenant_id: "t1",
    project_id: "prj-101",
    source_type: "drawing",
    source_id: "DWG-STR-01",
    title: "Tower B Foundation Drawing",
    version: "v2.1",
    metadata: {},
    created_at: "2026-10-18T10:00:00Z",
    updated_at: "2026-10-18T10:00:00Z",
  },
  {
    id: "doc-2",
    tenant_id: "t1",
    project_id: null,
    source_type: "contract",
    source_id: "CTR-2026-004",
    title: "Subcontractor Master Agreement",
    version: "v1.0",
    metadata: {},
    created_at: "2026-10-18T11:00:00Z",
    updated_at: "2026-10-18T11:00:00Z",
  },
];

describe("AiKnowledgePage (M28 Knowledge Management)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders knowledge base stats, documents table, and vector test bench", async () => {
    (aiService.listDocuments as any).mockResolvedValueOnce(mockDocs);

    render(<AiKnowledgePage />);

    expect(screen.getByText("AI Knowledge Base & Search")).toBeInTheDocument();
    expect(screen.getByText("Module M28")).toBeInTheDocument();
    expect(screen.getByText(/Semantic Search & Similarity Test Bench/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Tower B Foundation Drawing")).toBeInTheDocument();
      expect(screen.getByText("Subcontractor Master Agreement")).toBeInTheDocument();
    });

    // Check stats
    expect(screen.getByText("2")).toBeInTheDocument(); // 2 indexed docs
  });

  it("opens Ingest modal and vectorizes a new document", async () => {
    (aiService.listDocuments as any).mockResolvedValue(mockDocs);
    (aiService.ingestDocument as any).mockResolvedValueOnce({
      id: "doc-3",
      title: "RFI-44 Shoring Detail",
    });

    render(<AiKnowledgePage />);
    await waitFor(() => screen.getByText("Tower B Foundation Drawing"));

    const ingestBtn = screen.getByRole("button", { name: /ingest document/i });
    await userEvent.click(ingestBtn);

    expect(screen.getByText(/Ingest & Vectorize Project Document/i)).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText(/e.g. DWG-STR-A-101/i), "RFI-44");
    await userEvent.type(screen.getByPlaceholderText(/e.g. Basement Waterproofing/i), "RFI-44 Shoring Detail");
    await userEvent.type(
      screen.getByPlaceholderText(/Paste drawing notes/i),
      "Shoring piles spacing is 1.5m center-to-center with 600mm diameter."
    );

    const submitBtn = screen.getByRole("button", { name: /index document/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(aiService.ingestDocument).toHaveBeenCalledWith("mock-token-xyz", {
        sourceType: "drawing",
        sourceId: "RFI-44",
        title: "RFI-44 Shoring Detail",
        version: "v1.0",
        projectId: undefined,
        content: "Shoring piles spacing is 1.5m center-to-center with 600mm diameter.",
      });
    });
  });

  it("runs similarity test query on test bench", async () => {
    (aiService.listDocuments as any).mockResolvedValue(mockDocs);
    (aiService.chat as any).mockResolvedValueOnce({
      answer: "Found 1 matching chunk",
      citations: [
        {
          documentId: "doc-1",
          title: "Tower B Foundation Drawing",
          sourceType: "drawing",
          version: "v2.1",
          snippet: "Concrete grade M40 for foundation raft.",
          similarity: 0.91,
        },
      ],
      confidence: 0.91,
      abstain: false,
      model: "gpt-4o-mini",
    });

    render(<AiKnowledgePage />);
    await waitFor(() => screen.getByText("Tower B Foundation Drawing"));

    const testInput = screen.getByPlaceholderText(/e.g. Waterproofing membrane thickness/i);
    await userEvent.type(testInput, "Foundation concrete");

    const testBtn = screen.getByRole("button", { name: /test vector match/i });
    await userEvent.click(testBtn);

    expect(await screen.findByText(/Retrieved Chunks/i)).toBeInTheDocument();
    expect(screen.getByText(/91% match/i)).toBeInTheDocument();
    expect(screen.getByText(/Concrete grade M40 for foundation raft/i)).toBeInTheDocument();
  });
});
