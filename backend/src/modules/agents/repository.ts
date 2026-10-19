import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentDefinition, AgentTool, AgentExecution } from "./types.js";

export interface AgentsRepository {
  listAgents(token: string): Promise<AgentDefinition[]>;
  getAgentById(token: string, id: string): Promise<AgentDefinition | null>;
  createAgent(token: string, tenantId: string, input: Partial<AgentDefinition>): Promise<AgentDefinition>;
  updateAgent(token: string, id: string, input: Partial<AgentDefinition>): Promise<AgentDefinition>;
  deleteAgent(token: string, id: string): Promise<void>;
  listTools(token: string): Promise<AgentTool[]>;
  saveExecution(token: string, execution: AgentExecution): Promise<AgentExecution>;
  getExecutionById(token: string, id: string): Promise<AgentExecution | null>;
  listExecutions(token: string, agentId?: string): Promise<AgentExecution[]>;
}

export function createAgentsRepository(
  getClient: (token: string) => SupabaseClient
): AgentsRepository {
  // Pre-seeded fallback agents for testing or development before DB seeding
  const inMemoryAgents = new Map<string, AgentDefinition>([
    [
      "agent-site-eng",
      {
        id: "agent-site-eng",
        tenant_id: "default-tenant",
        key: "agent.site_engineer",
        name: "Site Engineering Copilot",
        description: "Assists site engineers with drawings, specifications, RFI drafting, and schedule lookahead delays.",
        system_prompt: "You are a professional Senior Site Engineer. Always adhere to structural standards and project specifications.",
        model: "gpt-4o-mini",
        temperature: 0.2,
        canonical_role_id: "role.site_engineer",
        allowed_tools: ["search_knowledge_base", "query_project_schedule", "create_site_rfi", "calculate_delay_impact"],
        hitl_policy: "require_for_mutations",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    [
      "agent-procure",
      {
        id: "agent-procure",
        tenant_id: "default-tenant",
        key: "agent.procurement_estimator",
        name: "Procurement & Cost Estimator",
        description: "Checks inventory balances, evaluates BOQ work items, and computes material lead times.",
        system_prompt: "You are an expert Quantity Surveyor and Procurement Manager.",
        model: "gpt-4o-mini",
        temperature: 0.1,
        canonical_role_id: "role.qs_estimator",
        allowed_tools: ["get_boq_items", "check_inventory_stock", "search_knowledge_base"],
        hitl_policy: "require_for_mutations",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    [
      "agent-safety",
      {
        id: "agent-safety",
        tenant_id: "default-tenant",
        key: "agent.hse_compliance",
        name: "HSE & Quality Inspector",
        description: "Monitors safety compliance, identifies job-site hazards, and registers formal observations.",
        system_prompt: "You are a strict HSE Compliance Officer. Zero tolerance for safety protocol violations.",
        model: "gpt-4o-mini",
        temperature: 0.1,
        canonical_role_id: "role.safety_officer",
        allowed_tools: ["log_safety_observation", "search_knowledge_base"],
        hitl_policy: "always",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  ]);

  const inMemoryExecutions = new Map<string, AgentExecution>();

  return {
    async listAgents(token: string): Promise<AgentDefinition[]> {
      const supabase = getClient(token);
      try {
        const { data, error } = await supabase
          .from("agent_definitions")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0) {
          return data as AgentDefinition[];
        }
      } catch {}

      return Array.from(inMemoryAgents.values());
    },

    async getAgentById(token: string, id: string): Promise<AgentDefinition | null> {
      const supabase = getClient(token);
      try {
        const { data, error } = await supabase
          .from("agent_definitions")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (!error && data) return data as AgentDefinition;
      } catch {}

      return inMemoryAgents.get(id) || null;
    },

    async createAgent(
      token: string,
      tenantId: string,
      input: Partial<AgentDefinition>
    ): Promise<AgentDefinition> {
      const supabase = getClient(token);
      const newAgent: AgentDefinition = {
        id: input.id || "agent-" + Date.now(),
        tenant_id: tenantId,
        key: input.key || "agent.custom_" + Date.now(),
        name: input.name || "Custom Assistant",
        description: input.description || null,
        system_prompt: input.system_prompt || "You are a helpful construction assistant.",
        model: input.model || "gpt-4o-mini",
        temperature: input.temperature ?? 0.2,
        canonical_role_id: input.canonical_role_id || null,
        allowed_tools: input.allowed_tools || [],
        hitl_policy: input.hitl_policy || "require_for_mutations",
        is_active: input.is_active ?? true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      try {
        const { data, error } = await supabase
          .from("agent_definitions")
          .insert(newAgent)
          .select()
          .single();

        if (!error && data) return data as AgentDefinition;
      } catch {}

      inMemoryAgents.set(newAgent.id, newAgent);
      return newAgent;
    },

    async updateAgent(
      token: string,
      id: string,
      input: Partial<AgentDefinition>
    ): Promise<AgentDefinition> {
      const supabase = getClient(token);
      try {
        const { data, error } = await supabase
          .from("agent_definitions")
          .update({
            ...input,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select()
          .single();

        if (!error && data) return data as AgentDefinition;
      } catch {}

      const existing = inMemoryAgents.get(id);
      if (!existing) throw new Error(`Agent definition not found: ${id}`);
      const updated = { ...existing, ...input, updated_at: new Date().toISOString() };
      inMemoryAgents.set(id, updated);
      return updated;
    },

    async deleteAgent(token: string, id: string): Promise<void> {
      const supabase = getClient(token);
      try {
        await supabase.from("agent_definitions").delete().eq("id", id);
      } catch {}
      inMemoryAgents.delete(id);
    },

    async listTools(token: string): Promise<AgentTool[]> {
      const supabase = getClient(token);
      try {
        const { data, error } = await supabase
          .from("agent_tool_registry")
          .select("*")
          .order("category", { ascending: true });

        if (!error && data && data.length > 0) return data as AgentTool[];
      } catch {}

      // Fallback default registry
      return [
        {
          key: "search_knowledge_base",
          name: "Search Project Knowledge Base",
          description: "Semantic vector search across project drawings, specifications, RFIs, and contracts with citations.",
          category: "engineering",
          required_permission: "ai.assistant.query",
          is_mutation: false,
          schema: { type: "object", properties: { query: { type: "string" }, projectId: { type: "string" } }, required: ["query"] },
        },
        {
          key: "query_project_schedule",
          name: "Query Schedule & Milestones",
          description: "Inspect project WBS milestones, planned vs actual finish dates, and lookahead tasks.",
          category: "schedule",
          required_permission: "project.schedule.view",
          is_mutation: false,
          schema: { type: "object", properties: { projectId: { type: "string" } }, required: ["projectId"] },
        },
        {
          key: "get_boq_items",
          name: "Get Bill of Quantities Items",
          description: "Retrieve work-item catalogue lines, approved quantities, and unit rates for a project.",
          category: "finance",
          required_permission: "catalogue.workitem.view",
          is_mutation: false,
          schema: { type: "object", properties: { search: { type: "string" } } },
        },
        {
          key: "check_inventory_stock",
          name: "Check Inventory & Warehouse Stock",
          description: "Check on-site inventory balances, storage locations, and minimum threshold alerts.",
          category: "procurement",
          required_permission: "inventory.item.view",
          is_mutation: false,
          schema: { type: "object", properties: { itemName: { type: "string" } }, required: ["itemName"] },
        },
        {
          key: "create_site_rfi",
          name: "Draft Site RFI (Request for Information)",
          description: "Create and submit a formal RFI to the consultant or structural engineer regarding drawing discrepancy.",
          category: "engineering",
          required_permission: "design.rfi.create",
          is_mutation: true,
          schema: { type: "object", properties: { projectId: { type: "string" }, title: { type: "string" }, question: { type: "string" } }, required: ["projectId", "title", "question"] },
        },
        {
          key: "calculate_delay_impact",
          name: "Calculate Schedule Delay Impact",
          description: "Analyze site delay events against project completion baseline and estimate critical path slip.",
          category: "schedule",
          required_permission: "project.schedule.manage",
          is_mutation: false,
          schema: { type: "object", properties: { projectId: { type: "string" }, delayDays: { type: "number" } }, required: ["projectId", "delayDays"] },
        },
        {
          key: "log_safety_observation",
          name: "Log Safety Hazard or Observation",
          description: "Record a safety hazard observation or near miss on site for HSE compliance review.",
          category: "safety",
          required_permission: "safety.hazard.report",
          is_mutation: true,
          schema: { type: "object", properties: { projectId: { type: "string" }, hazardType: { type: "string" }, description: { type: "string" } }, required: ["projectId", "hazardType", "description"] },
        },
      ];
    },

    async saveExecution(token: string, execution: AgentExecution): Promise<AgentExecution> {
      const supabase = getClient(token);
      try {
        const { data, error } = await supabase
          .from("agent_executions")
          .upsert(execution)
          .select()
          .single();

        if (!error && data) return data as AgentExecution;
      } catch {}

      inMemoryExecutions.set(execution.id, execution);
      return execution;
    },

    async getExecutionById(token: string, id: string): Promise<AgentExecution | null> {
      const supabase = getClient(token);
      try {
        const { data, error } = await supabase
          .from("agent_executions")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (!error && data) return data as AgentExecution;
      } catch {}

      return inMemoryExecutions.get(id) || null;
    },

    async listExecutions(token: string, agentId?: string): Promise<AgentExecution[]> {
      const supabase = getClient(token);
      try {
        let q = supabase
          .from("agent_executions")
          .select("*")
          .order("created_at", { ascending: false });

        if (agentId) {
          q = q.eq("agent_id", agentId);
        }

        const { data, error } = await q.limit(50);
        if (!error && data && data.length > 0) return data as AgentExecution[];
      } catch {}

      const all = Array.from(inMemoryExecutions.values());
      return agentId ? all.filter((e) => e.agent_id === agentId) : all;
    },
  };
}
