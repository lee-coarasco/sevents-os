import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AiAssistantDrawer } from "./AiAssistantDrawer";
import { aiService } from "../services/aiService";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    session: { access_token: "mock-ai-token", user: { email: "engineer@sevents.test" } },
    loading: false,
  }),
}));

vi.mock("../services/aiService", () => ({
  aiService: {
    chat: vi.fn(),
    submitFeedback: vi.fn(),
  },
}));

describe("AiAssistantDrawer (M28 Grounded Search)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    render(<AiAssistantDrawer isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText("AI Knowledge Assistant")).not.toBeInTheDocument();
  });

  it("renders assistant header and welcome greeting when opened", () => {
    render(<AiAssistantDrawer isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText("AI Knowledge Assistant")).toBeInTheDocument();
    expect(screen.getByText(/SEVENTS Construction Knowledge Assistant/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ask a question about project documents/i)).toBeInTheDocument();
  });

  it("sends query, shows citation pills and grounded confidence score", async () => {
    (aiService.chat as any).mockResolvedValueOnce({
      answer: "Basement slab requires 4mm APP modified bituminous membrane as per spec.",
      citations: [
        {
          documentId: "doc-123",
          title: "Basement Waterproofing Specification",
          sourceType: "specification",
          version: "v2.0",
          snippet: "Section 3.2: 4mm APP modified bituminous membrane with double torch lap.",
          similarity: 0.94,
        },
      ],
      confidence: 0.94,
      abstain: false,
      model: "gpt-4o-mini",
    });

    render(<AiAssistantDrawer isOpen={true} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText(/Ask a question about project documents/i);
    await userEvent.type(input, "Waterproofing spec for basement");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(aiService.chat).toHaveBeenCalledWith(
        "mock-ai-token",
        "Waterproofing spec for basement",
        undefined,
        []
      );
    });

    expect(
      await screen.findByText(/Basement slab requires 4mm APP modified bituminous membrane/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/94% match confidence/i)).toBeInTheDocument();
    expect(screen.getByText("Basement Waterproofing Specification")).toBeInTheDocument();
  });

  it("displays strict abstention warning banner when information is missing (FR-AI-003)", async () => {
    (aiService.chat as any).mockResolvedValueOnce({
      answer: "I cannot find any approved documentation specifying waterproofing for basement.",
      citations: [],
      confidence: 0,
      abstain: true,
      abstainReason: "No relevant documents found matching this specification.",
      model: "gpt-4o-mini",
    });

    render(<AiAssistantDrawer isOpen={true} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText(/Ask a question about project documents/i);
    await userEvent.type(input, "Unknown query");
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByText(/Strict Abstention Guardrail Active/i)).toBeInTheDocument();
    expect(screen.getByText(/No relevant documents found matching this specification/i)).toBeInTheDocument();
  });

  it("opens citation preview modal when a citation button is clicked", async () => {
    (aiService.chat as any).mockResolvedValueOnce({
      answer: "Tower foundation concrete is M40 grade.",
      citations: [
        {
          documentId: "doc-999",
          title: "Foundation Structural Drawing",
          sourceType: "drawing",
          version: "Rev-C",
          snippet: "Concrete grade: M40 as per IS 456-2000 table 2.",
          similarity: 0.88,
        },
      ],
      confidence: 0.88,
      abstain: false,
      model: "gemini-1.5-flash",
    });

    render(<AiAssistantDrawer isOpen={true} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText(/Ask a question about project documents/i);
    await userEvent.type(input, "Concrete grade");
    await userEvent.keyboard("{Enter}");

    const citationBtn = await screen.findByText("Foundation Structural Drawing");
    await userEvent.click(citationBtn);

    expect(await screen.findByText("Extracted Grounding Chunk")).toBeInTheDocument();
    expect(screen.getByText(/Concrete grade: M40 as per IS 456-2000 table 2/i)).toBeInTheDocument();
    expect(screen.getAllByText(/88% match/i).length).toBeGreaterThanOrEqual(1);
  });
});
