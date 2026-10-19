import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentsRepository, ListExecutionsFilters } from "./repository.js";
import type {
  AgentDefinition,
  AgentTool,
  AgentExecution,
  AgentRunAuditLog,
  AgentIncidentReview,
  CostAnalyticsSummary,
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
  toggleAgentKillSwitch(token: string, id: string, isPaused: boolean, reason?: string): Promise<AgentDefinition>;
  listTools(token: string): Promise<AgentTool[]>;
  runAgent(token: string, tenantId: string, input: RunAgentInput, userId?: string): Promise<AgentExecution>;
  approveAction(
    token: string,
    tenantId: string,
    executionId: string,
    input: ApproveAgentInput,
    reviewerId?: string
  ): Promise<AgentExecution>;
  retryExecution(token: string, tenantId: string, executionId: string, userId?: string): Promise<AgentExecution>;
  cancelExecution(token: string, executionId: string, reason: string, userId?: string): Promise<AgentExecution>;
  listExecutions(token: string, filters?: ListExecutionsFilters | string): Promise<AgentExecution[]>;
  getExecution(token: string, id: string): Promise<AgentExecution>;
  listAuditLogs(token: string, executionId: string): Promise<AgentRunAuditLog[]>;
  listIncidents(token: string, isResolved?: boolean): Promise<AgentIncidentReview[]>;
  resolveIncident(token: string, incidentId: string, notes: string, resolvedBy: string): Promise<AgentIncidentReview>;
  getCostAnalytics(token: string): Promise<CostAnalyticsSummary>;
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
        max_steps: input.maxSteps ?? 10,
        timeout_seconds: input.timeoutSeconds ?? 60,
        spend_budget_usd: input.spendBudgetUsd ?? 5.0,
        risk_tier: input.riskTier ?? "medium",
        is_paused: false,
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
        ...(input.maxSteps !== undefined ? { max_steps: input.maxSteps } : {}),
        ...(input.timeoutSeconds !== undefined ? { timeout_seconds: input.timeoutSeconds } : {}),
        ...(input.spendBudgetUsd !== undefined ? { spend_budget_usd: input.spendBudgetUsd } : {}),
        ...(input.riskTier ? { risk_tier: input.riskTier } : {}),
        ...(input.isPaused !== undefined ? { is_paused: input.isPaused } : {}),
        ...(input.pauseReason !== undefined ? { pause_reason: input.pauseReason } : {}),
      });
    },

    async toggleAgentKillSwitch(
      token: string,
      id: string,
      isPaused: boolean,
      reason?: string
    ): Promise<AgentDefinition> {
      const agent = await repository.getAgentById(token, id);
      if (!agent) throw new Error(`Agent not found: ${id}`);

      const updated = await repository.updateAgent(token, id, {
        is_paused: isPaused,
        pause_reason: isPaused ? reason || "Emergency kill switch activated by administrator" : null,
      });

      await repository.saveRunAuditLog(token, {
        id: "audit-" + Date.now(),
        tenant_id: agent.tenant_id,
        execution_id: "global",
        agent_id: agent.id,
        actor_type: "human_reviewer",
        actor_id: null,
        event_type: isPaused ? "kill_switch_activated" : "kill_switch_deactivated",
        details: { reason, isPaused },
        created_at: new Date().toISOString(),
      });

      return updated;
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
      // Replay Safety / Idempotency Check (BRD §8.10 FR-AG-002)
      if (input.idempotencyKey) {
        const existing = await repository.findExecutionByIdempotencyKey(
          token,
          tenantId,
          input.idempotencyKey
        );
        if (existing) {
          return existing;
        }
      }

      const agent = await repository.getAgentById(token, input.agentId);
      if (!agent) {
        throw new Error(`Agent definition not found with id: ${input.agentId}`);
      }
      if (!agent.is_active) {
        throw new Error(`Agent "${agent.name}" is currently deactivated.`);
      }

      const toolsList = await repository.listTools(token);
      const toolsMap = new Map<string, AgentTool>(toolsList.map((t) => [t.key, t]));

      const executionId = "exec-" + Date.now();

      const runner = new AgentRunner({
        token,
        tenantId,
        userId,
        agent,
        tools: toolsMap,
        toolExecutor,
        onAuditLog: async (event) => {
          await repository.saveRunAuditLog(token, {
            id: "audit-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
            tenant_id: tenantId,
            execution_id: executionId,
            agent_id: agent.id,
            actor_type: event.actorType || "agent",
            actor_id: event.actorId || userId || null,
            event_type: event.eventType,
            details: event.details,
            created_at: new Date().toISOString(),
          });
        },
        onIncident: async (incident) => {
          await repository.createIncident(token, {
            id: "inc-" + Date.now(),
            tenant_id: tenantId,
            execution_id: executionId,
            agent_id: agent.id,
            incident_type: incident.incidentType,
            severity: incident.severity,
            description: incident.description,
            raw_content: incident.rawContent || null,
            is_resolved: false,
            created_at: new Date().toISOString(),
          });
        },
      });

      const execution = await runner.run(input.inputPrompt, {
        id: executionId,
        tenant_id: tenantId,
        agent_id: agent.id,
        user_id: userId || null,
        session_id: input.sessionId || null,
        input_prompt: input.inputPrompt,
        status: "running",
        messages: [],
        pending_action: null,
        output_summary: null,
        idempotency_key: input.idempotencyKey || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return repository.saveExecution(token, execution);
    },

    async approveAction(
      token: string,
      tenantId: string,
      executionId: string,
      input: ApproveAgentInput,
      reviewerId?: string
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
        onAuditLog: async (event) => {
          await repository.saveRunAuditLog(token, {
            id: "audit-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
            tenant_id: tenantId,
            execution_id: executionId,
            agent_id: agent.id,
            actor_type: event.actorType || "human_reviewer",
            actor_id: event.actorId || reviewerId || null,
            event_type: event.eventType,
            details: event.details,
            created_at: new Date().toISOString(),
          });
        },
      });

      const updated = await runner.resume(
        execution,
        input.approved,
        input.rejectionReason,
        input.modifiedInput,
        input.notes,
        reviewerId
      );

      return repository.saveExecution(token, updated);
    },

    async retryExecution(
      token: string,
      tenantId: string,
      executionId: string,
      userId?: string
    ): Promise<AgentExecution> {
      const existing = await repository.getExecutionById(token, executionId);
      if (!existing) {
        throw new Error(`Execution not found: ${executionId}`);
      }

      const agent = await repository.getAgentById(token, existing.agent_id);
      if (!agent) {
        throw new Error(`Agent not found: ${existing.agent_id}`);
      }

      const retryCount = (existing.retry_count || 0) + 1;
      const toolsList = await repository.listTools(token);
      const toolsMap = new Map<string, AgentTool>(toolsList.map((t) => [t.key, t]));

      await repository.saveRunAuditLog(token, {
        id: "audit-" + Date.now(),
        tenant_id: tenantId,
        execution_id: executionId,
        agent_id: agent.id,
        actor_type: "human_reviewer",
        actor_id: userId || null,
        event_type: "run_retried",
        details: { retryCount },
        created_at: new Date().toISOString(),
      });

      const runner = new AgentRunner({
        token,
        tenantId,
        userId,
        agent,
        tools: toolsMap,
        toolExecutor,
      });

      const retried = await runner.run(existing.input_prompt, {
        ...existing,
        status: "running",
        retry_count: retryCount,
        pending_action: null,
      });

      return repository.saveExecution(token, retried);
    },

    async cancelExecution(
      token: string,
      executionId: string,
      reason: string,
      userId?: string
    ): Promise<AgentExecution> {
      const existing = await repository.getExecutionById(token, executionId);
      if (!existing) {
        throw new Error(`Execution not found: ${executionId}`);
      }

      const agent = await repository.getAgentById(token, existing.agent_id);
      if (!agent) {
        throw new Error(`Agent not found: ${existing.agent_id}`);
      }

      const toolsList = await repository.listTools(token);
      const toolsMap = new Map<string, AgentTool>(toolsList.map((t) => [t.key, t]));

      const runner = new AgentRunner({
        token,
        tenantId: existing.tenant_id,
        userId,
        agent,
        tools: toolsMap,
        toolExecutor,
        onAuditLog: async (event) => {
          await repository.saveRunAuditLog(token, {
            id: "audit-" + Date.now(),
            tenant_id: existing.tenant_id,
            execution_id: executionId,
            agent_id: agent.id,
            actor_type: event.actorType || "human_reviewer",
            actor_id: event.actorId || userId || null,
            event_type: event.eventType,
            details: event.details,
            created_at: new Date().toISOString(),
          });
        },
      });

      const cancelled = await runner.cancel(existing, reason, userId);
      return repository.saveExecution(token, cancelled);
    },

    async listExecutions(
      token: string,
      filters?: ListExecutionsFilters | string
    ): Promise<AgentExecution[]> {
      return repository.listExecutions(token, filters);
    },

    async getExecution(token: string, id: string): Promise<AgentExecution> {
      const exec = await repository.getExecutionById(token, id);
      if (!exec) throw new Error(`Agent execution not found: ${id}`);
      return exec;
    },

    async listAuditLogs(token: string, executionId: string): Promise<AgentRunAuditLog[]> {
      return repository.listRunAuditLogs(token, executionId);
    },

    async listIncidents(token: string, isResolved?: boolean): Promise<AgentIncidentReview[]> {
      return repository.listIncidents(token, isResolved !== undefined ? { isResolved } : undefined);
    },

    async resolveIncident(
      token: string,
      incidentId: string,
      notes: string,
      resolvedBy: string
    ): Promise<AgentIncidentReview> {
      return repository.resolveIncident(token, incidentId, resolvedBy, notes);
    },

    async getCostAnalytics(token: string): Promise<CostAnalyticsSummary> {
      return repository.getCostAnalytics(token);
    },
  };
}
