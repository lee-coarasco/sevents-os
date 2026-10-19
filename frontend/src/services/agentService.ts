import { apiFetch } from "../lib/api";

export type HitlPolicy = "always" | "require_for_mutations" | "never";

export type AgentExecutionStatus =
  | "running"
  | "paused_waiting_approval"
  | "completed"
  | "failed"
  | "rejected";

export interface AgentDefinition {
  id: string;
  tenant_id: string;
  key: string;
  name: string;
  description: string | null;
  system_prompt: string;
  model: string;
  temperature: number;
  canonical_role_id: string | null;
  allowed_tools: string[];
  hitl_policy: HitlPolicy;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentTool {
  key: string;
  name: string;
  description: string;
  category: string;
  required_permission: string;
  is_mutation: boolean;
  schema: Record<string, unknown>;
  created_at?: string;
}

export interface PendingAction {
  toolKey: string;
  toolName: string;
  input: Record<string, unknown>;
  rationale: string;
  callId: string;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: string;
  toolCallId?: string;
  toolName?: string;
}

export interface AgentExecution {
  id: string;
  tenant_id: string;
  agent_id: string;
  user_id: string | null;
  session_id: string | null;
  input_prompt: string;
  status: AgentExecutionStatus;
  messages: AgentMessage[];
  pending_action: PendingAction | null;
  output_summary: string | null;
  created_at: string;
  updated_at: string;
  agent?: Partial<AgentDefinition>;
}

export interface CreateAgentPayload {
  key: string;
  name: string;
  description?: string;
  systemPrompt: string;
  model?: string;
  temperature?: number;
  canonicalRoleId?: string;
  allowedTools?: string[];
  hitlPolicy?: HitlPolicy;
}

export interface UpdateAgentPayload {
  name?: string;
  description?: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  canonicalRoleId?: string;
  allowedTools?: string[];
  hitlPolicy?: HitlPolicy;
  isActive?: boolean;
}

export const agentService = {
  async listAgents(token: string): Promise<AgentDefinition[]> {
    const res = await apiFetch<{ agents: AgentDefinition[] }>("/agents", token);
    return res.agents;
  },

  async getAgent(token: string, id: string): Promise<AgentDefinition> {
    const res = await apiFetch<{ agent: AgentDefinition }>(`/agents/${id}`, token);
    return res.agent;
  },

  async createAgent(token: string, payload: CreateAgentPayload): Promise<AgentDefinition> {
    const res = await apiFetch<{ agent: AgentDefinition }>("/agents", token, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return res.agent;
  },

  async updateAgent(token: string, id: string, payload: UpdateAgentPayload): Promise<AgentDefinition> {
    const res = await apiFetch<{ agent: AgentDefinition }>(`/agents/${id}`, token, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return res.agent;
  },

  async deleteAgent(token: string, id: string): Promise<void> {
    await apiFetch<{ success: boolean }>(`/agents/${id}`, token, {
      method: "DELETE",
    });
  },

  async listTools(token: string): Promise<AgentTool[]> {
    const res = await apiFetch<{ tools: AgentTool[] }>("/agents/tools", token);
    return res.tools;
  },

  async runAgent(
    token: string,
    agentId: string,
    inputPrompt: string,
    projectId?: string
  ): Promise<AgentExecution> {
    const res = await apiFetch<{ execution: AgentExecution }>("/agents/run", token, {
      method: "POST",
      body: JSON.stringify({ agentId, inputPrompt, projectId }),
    });
    return res.execution;
  },

  async listExecutions(token: string, agentId?: string): Promise<AgentExecution[]> {
    const qs = agentId ? `?agentId=${encodeURIComponent(agentId)}` : "";
    const res = await apiFetch<{ executions: AgentExecution[] }>(`/agents/executions${qs}`, token);
    return res.executions;
  },

  async getExecution(token: string, id: string): Promise<AgentExecution> {
    const res = await apiFetch<{ execution: AgentExecution }>(`/agents/executions/${id}`, token);
    return res.execution;
  },

  async approveAction(
    token: string,
    executionId: string,
    approved: boolean,
    rejectionReason?: string
  ): Promise<AgentExecution> {
    const res = await apiFetch<{ execution: AgentExecution }>(
      `/agents/executions/${executionId}/approve`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ approved, rejectionReason }),
      }
    );
    return res.execution;
  },
};
