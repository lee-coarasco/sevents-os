import { apiFetch } from "../lib/api";

export type HitlPolicy = "always" | "require_for_mutations" | "never";

export type AgentExecutionStatus =
  | "queued"
  | "running"
  | "paused_waiting_approval"
  | "completed"
  | "failed"
  | "rejected"
  | "cancelled";

export type AgentRiskTier = "low" | "medium" | "high" | "critical";

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
  max_steps?: number;
  timeout_seconds?: number;
  spend_budget_usd?: number;
  risk_tier?: AgentRiskTier;
  is_paused?: boolean;
  pause_reason?: string | null;
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

export interface AgentExecutionStep {
  stepNumber: number;
  type: "thought" | "tool_call" | "synthesis" | "human_approval";
  thought?: string;
  toolKey?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: Record<string, unknown> | unknown[] | string;
  confidence: number;
  tokens?: { prompt: number; completion: number; total: number };
  costUsd: number;
  latencyMs: number;
  status: "success" | "pending" | "paused" | "failed" | "skipped";
  error?: string;
}

export interface ApprovalMetadata {
  approvedBy?: string;
  approvedAt?: string;
  modifiedInput?: Record<string, unknown>;
  rejectionReason?: string;
  notes?: string;
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
  tokens_prompt?: number;
  tokens_completion?: number;
  total_tokens?: number;
  cost_usd?: number;
  latency_ms?: number;
  steps_count?: number;
  plan_steps?: AgentExecutionStep[];
  confidence_score?: number;
  approval_metadata?: ApprovalMetadata | null;
  error_details?: Record<string, unknown> | null;
  retry_count?: number;
  idempotency_key?: string | null;
  created_at: string;
  updated_at: string;
  agent?: Partial<AgentDefinition>;
}

export interface AgentRunAuditLog {
  id: string;
  tenant_id: string;
  execution_id: string;
  agent_id: string | null;
  actor_type: "agent" | "human_reviewer" | "system";
  actor_id: string | null;
  event_type: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface AgentIncidentReview {
  id: string;
  tenant_id: string;
  execution_id: string;
  agent_id: string | null;
  incident_type: string;
  severity: AgentRiskTier;
  description: string;
  raw_content?: string | null;
  redacted_content?: string | null;
  is_resolved: boolean;
  resolved_by?: string | null;
  resolution_notes?: string | null;
  created_at: string;
  resolved_at?: string | null;
}

export interface CostAnalyticsSummary {
  totalTokens: number;
  totalCostUsd: number;
  totalRuns: number;
  costByAgent: { agentId: string; agentName: string; costUsd: number; runCount: number }[];
  costByModel: { model: string; costUsd: number; tokenCount: number }[];
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
  maxSteps?: number;
  timeoutSeconds?: number;
  spendBudgetUsd?: number;
  riskTier?: AgentRiskTier;
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
  maxSteps?: number;
  timeoutSeconds?: number;
  spendBudgetUsd?: number;
  riskTier?: AgentRiskTier;
  isPaused?: boolean;
  pauseReason?: string;
}

export interface ListExecutionsFilters {
  agentId?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
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

  async toggleKillSwitch(
    token: string,
    id: string,
    isPaused: boolean,
    reason?: string
  ): Promise<AgentDefinition> {
    const res = await apiFetch<{ agent: AgentDefinition }>(`/agents/${id}/kill-switch`, token, {
      method: "PUT",
      body: JSON.stringify({ isPaused, reason }),
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
    projectId?: string,
    idempotencyKey?: string
  ): Promise<AgentExecution> {
    const res = await apiFetch<{ execution: AgentExecution }>("/agents/run", token, {
      method: "POST",
      body: JSON.stringify({ agentId, inputPrompt, projectId, idempotencyKey }),
    });
    return res.execution;
  },

  async listExecutions(
    token: string,
    filters?: ListExecutionsFilters | string
  ): Promise<AgentExecution[]> {
    const parsed: ListExecutionsFilters =
      typeof filters === "string" ? { agentId: filters } : filters || {};
    const params = new URLSearchParams();
    if (parsed.agentId) params.set("agentId", parsed.agentId);
    if (parsed.status) params.set("status", parsed.status);
    if (parsed.from) params.set("from", parsed.from);
    if (parsed.to) params.set("to", parsed.to);
    if (parsed.limit) params.set("limit", String(parsed.limit));

    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await apiFetch<{ executions: AgentExecution[] }>(`/agents/executions${qs}`, token);
    return res.executions;
  },

  async getExecution(token: string, id: string): Promise<AgentExecution> {
    const res = await apiFetch<{ execution: AgentExecution }>(`/agents/executions/${id}`, token);
    return res.execution;
  },

  async getExecutionAudit(token: string, id: string): Promise<AgentRunAuditLog[]> {
    const res = await apiFetch<{ auditLogs: AgentRunAuditLog[] }>(`/agents/executions/${id}/audit`, token);
    return res.auditLogs;
  },

  async approveAction(
    token: string,
    executionId: string,
    approved: boolean,
    rejectionReason?: string,
    modifiedInput?: Record<string, unknown>,
    notes?: string
  ): Promise<AgentExecution> {
    const res = await apiFetch<{ execution: AgentExecution }>(
      `/agents/executions/${executionId}/approve`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ approved, rejectionReason, modifiedInput, notes }),
      }
    );
    return res.execution;
  },

  async retryExecution(token: string, executionId: string): Promise<AgentExecution> {
    const res = await apiFetch<{ execution: AgentExecution }>(
      `/agents/executions/${executionId}/retry`,
      token,
      {
        method: "POST",
      }
    );
    return res.execution;
  },

  async cancelExecution(token: string, executionId: string, reason: string): Promise<AgentExecution> {
    const res = await apiFetch<{ execution: AgentExecution }>(
      `/agents/executions/${executionId}/cancel`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
      }
    );
    return res.execution;
  },

  async getCostAnalytics(token: string): Promise<CostAnalyticsSummary> {
    const res = await apiFetch<{ analytics: CostAnalyticsSummary }>("/agents/analytics/costs", token);
    return res.analytics;
  },

  async listIncidents(token: string, isResolved?: boolean): Promise<AgentIncidentReview[]> {
    const qs = isResolved !== undefined ? `?isResolved=${isResolved}` : "";
    const res = await apiFetch<{ incidents: AgentIncidentReview[] }>(`/agents/incidents${qs}`, token);
    return res.incidents;
  },

  async resolveIncident(token: string, incidentId: string, notes: string): Promise<AgentIncidentReview> {
    const res = await apiFetch<{ incident: AgentIncidentReview }>(
      `/agents/incidents/${incidentId}/resolve`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ notes }),
      }
    );
    return res.incident;
  },
};
