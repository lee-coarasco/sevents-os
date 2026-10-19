import { describe, expect, it, vi } from "vitest";
import { createAgentsService } from "./service.js";
import { createAgentsRepository } from "./repository.js";
import type { SupabaseClient } from "@supabase/supabase-js";

function mockSupabaseClient(): SupabaseClient {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  } as unknown as SupabaseClient;
}

describe("M29 AI Agent Studio & Tool Registry", () => {
  const getClient = () => mockSupabaseClient();
  const repo = createAgentsRepository(getClient);
  const service = createAgentsService(repo, getClient);

  it("lists pre-seeded standard agent profiles and tools", async () => {
    const agents = await service.listAgents("token");
    expect(agents.length).toBeGreaterThanOrEqual(3);
    const siteEng = agents.find((a) => a.key === "agent.site_engineer");
    expect(siteEng).toBeDefined();
    expect(siteEng?.allowed_tools).toContain("create_site_rfi");

    const tools = await service.listTools("token");
    expect(tools.length).toBeGreaterThanOrEqual(7);
    const rfiTool = tools.find((t) => t.key === "create_site_rfi");
    expect(rfiTool?.is_mutation).toBe(true);
  });

  it("creates and updates a custom agent profile", async () => {
    const newAgent = await service.createAgent("token", "tenant-1", {
      key: "agent.custom_planner",
      name: "Custom Planner",
      systemPrompt: "You plan daily site workflows.",
      allowedTools: ["query_project_schedule"],
      hitlPolicy: "require_for_mutations",
    });

    expect(newAgent.id).toBeDefined();
    expect(newAgent.name).toBe("Custom Planner");

    const updated = await service.updateAgent("token", newAgent.id, {
      name: "Senior Custom Planner",
    });
    expect(updated.name).toBe("Senior Custom Planner");
  });

  it("executes read tools directly without Human-In-The-Loop pause", async () => {
    const agents = await service.listAgents("token");
    const siteEng = agents.find((a) => a.key === "agent.site_engineer")!;

    const execution = await service.runAgent("token", "tenant-1", {
      agentId: siteEng.id,
      inputPrompt: "Calculate delay impact for 10 days delay on structural works",
    });

    expect(execution.status).toBe("completed");
    expect(execution.pending_action).toBeNull();
    expect(execution.output_summary).toContain("critical path slip");
    expect(execution.messages.length).toBeGreaterThanOrEqual(3);
  });

  it("pauses execution with pending_action when mutation tool requires HITL approval", async () => {
    const agents = await service.listAgents("token");
    const siteEng = agents.find((a) => a.key === "agent.site_engineer")!;

    const execution = await service.runAgent("token", "tenant-1", {
      agentId: siteEng.id,
      inputPrompt: "Draft an RFI regarding beam rebar clash on Level 12",
    });

    // Must be paused waiting for human approval per BRD HITL rules
    expect(execution.status).toBe("paused_waiting_approval");
    expect(execution.pending_action).toBeDefined();
    expect(execution.pending_action?.toolKey).toBe("create_site_rfi");
    expect(execution.pending_action?.toolName).toContain("Site RFI");
  });

  it("resumes paused execution and completes action upon human supervisor approval", async () => {
    const agents = await service.listAgents("token");
    const siteEng = agents.find((a) => a.key === "agent.site_engineer")!;

    // 1. Initial run creates paused execution
    const paused = await service.runAgent("token", "tenant-1", {
      agentId: siteEng.id,
      inputPrompt: "Draft an RFI for architect clarification",
    });
    expect(paused.status).toBe("paused_waiting_approval");

    // 2. Supervisor approves
    const resumed = await service.approveAction("token", "tenant-1", paused.id, {
      approved: true,
    });

    expect(resumed.status).toBe("completed");
    expect(resumed.pending_action).toBeNull();
    expect(resumed.output_summary).toContain("RFI-");
    expect(resumed.output_summary).toContain("officially registered");
  });

  it("marks execution as rejected when supervisor rejects the proposed action", async () => {
    const agents = await service.listAgents("token");
    const siteEng = agents.find((a) => a.key === "agent.site_engineer")!;

    const paused = await service.runAgent("token", "tenant-1", {
      agentId: siteEng.id,
      inputPrompt: "Draft an RFI regarding drawing discrepancy",
    });
    expect(paused.status).toBe("paused_waiting_approval");

    // Supervisor rejects
    const rejected = await service.approveAction("token", "tenant-1", paused.id, {
      approved: false,
      rejectionReason: "Drawing S-104 revision C already addressed this clash.",
    });

    expect(rejected.status).toBe("rejected");
    expect(rejected.pending_action).toBeNull();
    expect(rejected.output_summary).toContain("Action rejected");
  });
});
