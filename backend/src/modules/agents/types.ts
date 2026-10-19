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

export interface RunAgentInput {
  agentId: string;
  inputPrompt: string;
  projectId?: string;
  sessionId?: string;
}

export interface ApproveAgentInput {
  approved: boolean;
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
}
