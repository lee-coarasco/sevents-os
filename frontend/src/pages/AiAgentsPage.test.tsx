import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AiAgentsPage } from "./AiAgentsPage";
import { agentService } from "../services/agentService";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    session: { access_token: "mock-token-agent", user: { email: "lead@sevents.test" } },
    loading: false,
  }),
}));

vi.mock("../services/agentService", () => ({
  agentService: {
    listAgents: vi.fn(),
    listTools: vi.fn(),
    listExecutions: vi.fn(),
    runAgent: vi.fn(),
    approveAction: vi.fn(),
    createAgent: vi.fn(),
    updateAgent: vi.fn(),
    deleteAgent: vi.fn(),
  },
}));

const mockAgents = [
  {
    id: "a1",
    tenant_id: "t1",
    key: "agent.site_engineer",
    name: "Site Engineering Copilot",
    description: "Assists site engineers with drawings, specifications, and RFIs.",
    system_prompt: "You are a professional Site Engineer.",
    model: "gpt-4o-mini",
    temperature: 0.2,
    canonical_role_id: "role.site_engineer",
    allowed_tools: ["search_knowledge_base", "create_site_rfi"],
    hitl_policy: "require_for_mutations" as const,
    is_active: true,
    created_at: "2026-10-18T10:00:00Z",
    updated_at: "2026-10-18T10:00:00Z",
  },
];

const mockTools = [
  {
    key: "search_knowledge_base",
    name: "Search Project Knowledge Base",
    description: "Semantic search over project drawings and specs.",
    category: "engineering",
    required_permission: "ai.assistant.query",
    is_mutation: false,
    schema: {},
  },
  {
    key: "create_site_rfi",
    name: "Draft Site RFI",
    description: "Formally create an RFI to consultant.",
    category: "engineering",
    required_permission: "design.rfi.create",
    is_mutation: true,
    schema: {},
  },
];

const mockExecutions = [
  {
    id: "exec-101",
    tenant_id: "t1",
    agent_id: "a1",
    user_id: "u1",
    session_id: null,
    input_prompt: "Check schedule for Level 12 slab casting",
    status: "completed" as const,
    messages: [
      { id: "m1", role: "user" as const, content: "Check schedule", timestamp: "10:00" },
      { id: "m2", role: "assistant" as const, content: "Scheduled for Oct 28", timestamp: "10:01" },
    ],
    pending_action: null,
    output_summary: "Scheduled for Oct 28",
    created_at: "2026-10-18T10:00:00Z",
    updated_at: "2026-10-18T10:01:00Z",
  },
];

describe("AiAgentsPage (M29 Agent Studio & Tool Registry)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page title, tabs, and agent cards", async () => {
    (agentService.listAgents as any).mockResolvedValueOnce(mockAgents);
    (agentService.listTools as any).mockResolvedValueOnce(mockTools);
    (agentService.listExecutions as any).mockResolvedValueOnce(mockExecutions);

    render(
      <MemoryRouter>
        <AiAgentsPage />
      </MemoryRouter>
    );

    expect(screen.getByText("AI Agent Studio & Tool Registry")).toBeInTheDocument();
    expect(screen.getByText(/Configure autonomous construction agents/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Site Engineering Copilot")).toBeInTheDocument();
      expect(screen.getByText("agent.site_engineer")).toBeInTheDocument();
      expect(screen.getByText("gpt-4o-mini")).toBeInTheDocument();
    });
  });

  it("switches to Tool Registry tab and displays state-modifying badge", async () => {
    (agentService.listAgents as any).mockResolvedValueOnce(mockAgents);
    (agentService.listTools as any).mockResolvedValueOnce(mockTools);
    (agentService.listExecutions as any).mockResolvedValueOnce(mockExecutions);

    render(
      <MemoryRouter>
        <AiAgentsPage />
      </MemoryRouter>
    );
    await waitFor(() => screen.getByText("Site Engineering Copilot"));

    const toolsTab = screen.getByRole("button", { name: /Tool Registry/i });
    await userEvent.click(toolsTab);

    expect(await screen.findByText("Search Project Knowledge Base")).toBeInTheDocument();
    expect(screen.getByText("Draft Site RFI")).toBeInTheDocument();
    expect(screen.getByText(/State-Modifying \(Requires HITL\)/i)).toBeInTheDocument();
  });

  it("triggers Human-In-The-Loop checkpoint in console and handles approval", async () => {
    (agentService.listAgents as any).mockResolvedValue(mockAgents);
    (agentService.listTools as any).mockResolvedValue(mockTools);
    (agentService.listExecutions as any).mockResolvedValue(mockExecutions);

    const pausedExecution = {
      id: "exec-paused-99",
      tenant_id: "t1",
      agent_id: "a1",
      user_id: "u1",
      session_id: null,
      input_prompt: "Draft an RFI regarding beam rebar clash",
      status: "paused_waiting_approval" as const,
      messages: [
        { id: "m1", role: "user" as const, content: "Draft an RFI", timestamp: "10:00" },
        { id: "m2", role: "assistant" as const, content: "I plan to call Draft Site RFI", timestamp: "10:01" },
      ],
      pending_action: {
        toolKey: "create_site_rfi",
        toolName: "Draft Site RFI",
        input: { title: "Beam clash", question: "Advise on offset" },
        rationale: "Requires consultant confirmation.",
        callId: "call-1",
      },
      output_summary: "Paused awaiting approval",
      created_at: "2026-10-18T10:00:00Z",
      updated_at: "2026-10-18T10:01:00Z",
    };

    (agentService.runAgent as any).mockResolvedValueOnce(pausedExecution);
    (agentService.approveAction as any).mockResolvedValueOnce({
      ...pausedExecution,
      status: "completed",
      pending_action: null,
      messages: [
        ...pausedExecution.messages,
        { id: "m3", role: "assistant" as const, content: "RFI registered as RFI-001", timestamp: "10:02" },
      ],
    });

    render(
      <MemoryRouter>
        <AiAgentsPage />
      </MemoryRouter>
    );
    await waitFor(() => screen.getByText("Site Engineering Copilot"));

    // Switch to console tab
    const consoleTab = screen.getByRole("button", { name: /Interactive Console/i });
    await userEvent.click(consoleTab);

    // Send prompt
    const input = screen.getByPlaceholderText(/Instruct agent/i);
    await userEvent.type(input, "Draft an RFI regarding beam clash");
    const sendBtn = screen.getByRole("button", { name: /Send Prompt/i });
    await userEvent.click(sendBtn);

    // Verify HITL checkpoint renders
    await waitFor(() => {
      expect(screen.getByText("Proposed Tool Payload")).toBeInTheDocument();
    });
    expect(screen.getByText(/Proposed Tool Payload/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Approve & Execute Action/i })).toBeInTheDocument();

    // Click Approve
    const approveBtn = screen.getByRole("button", { name: /Approve & Execute Action/i });
    await userEvent.click(approveBtn);

    await waitFor(() => {
      expect(agentService.approveAction).toHaveBeenCalledWith(
        "mock-token-agent",
        "exec-paused-99",
        true,
        undefined
      );
    });
  });
});
