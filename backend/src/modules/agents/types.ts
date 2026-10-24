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
  mcp_server_id?: string | null;
  webhook_url?: string | null;
  is_custom?: boolean;
  created_at?: string;
}

export interface McpServer {
  id: string;
  tenant_id: string;
  name: string;
  url: string;
  transport: "http" | "sse";
  api_key?: string | null;
  description?: string | null;
  is_active: boolean;
  cached_tools: AgentTool[];
  last_synced_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegisterCustomToolInput {
  key: string;
  name: string;
  description: string;
  category?: string;
  required_permission?: string;
  is_mutation?: boolean;
  schema: Record<string, unknown>;
  webhook_url?: string;
}

export interface RegisterMcpServerInput {
  name: string;
  url: string;
  transport?: "http" | "sse";
  apiKey?: string;
  description?: string;
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

export interface RunAgentInput {
  agentId: string;
  inputPrompt: string;
  projectId?: string;
  sessionId?: string;
  idempotencyKey?: string;
  model?: string;
  systemPrompt?: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface ApproveAgentInput {
  approved: boolean;
  modifiedInput?: Record<string, unknown>;
  notes?: string;
  rejectionReason?: string;
}

export interface CreateAgentInput {
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

export interface UpdateAgentInput {
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

/** Standard Model Cost Schedule ($/1M tokens) */
export const MODEL_TOKEN_PRICING: Record<string, { promptPerM: number; completionPerM: number }> = {
  "gpt-4o": { promptPerM: 2.50, completionPerM: 10.00 },
  "gpt-4o-mini": { promptPerM: 0.15, completionPerM: 0.60 },
  "claude-3-5-sonnet": { promptPerM: 3.00, completionPerM: 15.00 },
  "claude-3-5-haiku": { promptPerM: 0.80, completionPerM: 4.00 },
  "gemini-1.5-pro": { promptPerM: 1.25, completionPerM: 5.00 },
  "gemini-1.5-flash": { promptPerM: 0.075, completionPerM: 0.30 },
  "local-engine": { promptPerM: 0.00, completionPerM: 0.00 },
};

export function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_TOKEN_PRICING[model] ?? MODEL_TOKEN_PRICING["gpt-4o-mini"] ?? { promptPerM: 0.15, completionPerM: 0.60 };
  const promptCost = (promptTokens / 1_000_000) * pricing.promptPerM;
  const completionCost = (completionTokens / 1_000_000) * pricing.completionPerM;
  return Number((promptCost + completionCost).toFixed(6));
}
