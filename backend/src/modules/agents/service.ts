import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentsRepository } from "./repository.js";
import type {
  AgentDefinition,
  AgentTool,
  AgentExecution,
  CreateAgentInput,
  UpdateAgentInput,
  RunAgentInput,
  ApproveAgentInput,
} from "./types.js";
import { ToolExecutor } from "./tools/toolExecutor.js";
import { AgentRunner } from "./graph/agentRunner.js";

export interface AgentsService {
  listAgents(token: string): Promise<AgentDefinition[]>;
  getAgent(token: string, id: string): Promise<AgentDefinition>;
  createAgent(token: string, tenantId: string, input: CreateAgentInput): Promise<AgentDefinition>;
  updateAgent(token: string, id: string, input: UpdateAgentInput): Promise<AgentDefinition>;
  deleteAgent(token: string, id: string): Promise<void>;
  listTools(token: string): Promise<AgentTool[]>;
  runAgent(token: string, tenantId: string, input: RunAgentInput, userId?: string): Promise<AgentExecution>;
  approveAction(token: string, tenantId: string, executionId: string, input: ApproveAgentInput): Promise<AgentExecution>;
  listExecutions(token: string, agentId?: string): Promise<AgentExecution[]>;
  getExecution(token: string, id: string): Promise<AgentExecution>;
}

export function createAgentsService(
  repository: AgentsRepository,
  getClient: (token: string) => SupabaseClient
): AgentsService {
  const toolExecutor = new ToolExecutor(getClient);

  return {
    async listAgents(token: string): Promise<AgentDefinition[]> {
      return repository.listAgents(token);
    },

    async getAgent(token: string, id: string): Promise<AgentDefinition> {
      const agent = await repository.getAgentById(token, id);
      if (!agent) throw new Error(`Agent definition not found: ${id}`);
      return agent;
    },

    async createAgent(
      token: string,
      tenantId: string,
      input: CreateAgentInput
    ): Promise<AgentDefinition> {
      return repository.createAgent(token, tenantId, {
        key: input.key,
        name: input.name,
        description: input.description || null,
        system_prompt: input.systemPrompt,
        model: input.model || "gpt-4o-mini",
        temperature: input.temperature ?? 0.2,
        canonical_role_id: input.canonicalRoleId || null,
        allowed_tools: input.allowedTools || [],
        hitl_policy: input.hitlPolicy || "require_for_mutations",
        is_active: true,
      });
    },

    async updateAgent(
      token: string,
      id: string,
      input: UpdateAgentInput
    ): Promise<AgentDefinition> {
      return repository.updateAgent(token, id, {
        ...(input.name ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.systemPrompt ? { system_prompt: input.systemPrompt } : {}),
        ...(input.model ? { model: input.model } : {}),
        ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
        ...(input.canonicalRoleId !== undefined ? { canonical_role_id: input.canonicalRoleId } : {}),
        ...(input.allowedTools ? { allowed_tools: input.allowedTools } : {}),
        ...(input.hitlPolicy ? { hitl_policy: input.hitlPolicy } : {}),
        ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
      });
    },

    async deleteAgent(token: string, id: string): Promise<void> {
      return repository.deleteAgent(token, id);
    },

    async listTools(token: string): Promise<AgentTool[]> {
      return repository.listTools(token);
    },

    async runAgent(
      token: string,
      tenantId: string,
      input: RunAgentInput,
      userId?: string
    ): Promise<AgentExecution> {
      const agent = await repository.getAgentById(token, input.agentId);
      if (!agent) {
        throw new Error(`Agent definition not found with id: ${input.agentId}`);
      }
      if (!agent.is_active) {
        throw new Error(`Agent "${agent.name}" is currently deactivated.`);
      }

      const toolsList = await repository.listTools(token);
      const toolsMap = new Map<string, AgentTool>(toolsList.map((t) => [t.key, t]));

      const runner = new AgentRunner({
        token,
        tenantId,
        userId,
        agent,
        tools: toolsMap,
        toolExecutor,
      });

      const execution = await runner.run(input.inputPrompt);
      return repository.saveExecution(token, execution);
    },

    async approveAction(
      token: string,
      tenantId: string,
      executionId: string,
      input: ApproveAgentInput
    ): Promise<AgentExecution> {
      const execution = await repository.getExecutionById(token, executionId);
      if (!execution) {
        throw new Error(`Execution record not found: ${executionId}`);
      }
      if (execution.status !== "paused_waiting_approval") {
        throw new Error(`Execution is not waiting for approval (current status: ${execution.status})`);
      }

      const agent = await repository.getAgentById(token, execution.agent_id);
      if (!agent) {
        throw new Error(`Agent definition not found: ${execution.agent_id}`);
      }

      const toolsList = await repository.listTools(token);
      const toolsMap = new Map<string, AgentTool>(toolsList.map((t) => [t.key, t]));

      const runner = new AgentRunner({
        token,
        tenantId,
        agent,
        tools: toolsMap,
        toolExecutor,
      });

      const updated = await runner.resume(execution, input.approved, input.rejectionReason);
      return repository.saveExecution(token, updated);
    },

    async listExecutions(token: string, agentId?: string): Promise<AgentExecution[]> {
      return repository.listExecutions(token, agentId);
    },

    async getExecution(token: string, id: string): Promise<AgentExecution> {
      const exec = await repository.getExecutionById(token, id);
      if (!exec) throw new Error(`Agent execution not found: ${id}`);
      return exec;
    },
  };
}
