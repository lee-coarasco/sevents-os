import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { AgentsRepository } from "./repository.js";
import { createAgentsService } from "./service.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateAgentInput,
  UpdateAgentInput,
  RunAgentInput,
  ApproveAgentInput,
} from "./types.js";

export interface AgentsRoutesOptions {
  getRepository: () => AgentsRepository;
  getClient: (token: string) => SupabaseClient;
  permissionGuard: (permissionKey: string) => (request: any, reply: any) => Promise<void>;
}

function bearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export function registerAgentsRoutes(options: AgentsRoutesOptions): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    const service = createAgentsService(options.getRepository(), options.getClient);

    const manageGuard = { preHandler: [options.permissionGuard("ai.agent.manage")] };
    const executeGuard = { preHandler: [options.permissionGuard("ai.agent.execute")] };
    const approveGuard = { preHandler: [options.permissionGuard("ai.agent.approve")] };

    /**
     * GET /agents
     * List all agent studio profiles
     */
    app.get("/agents", executeGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      try {
        const agents = await service.listAgents(token);
        return reply.send({ agents });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    /**
     * GET /agents/tools
     * List registered tools in the tool registry
     */
    app.get("/agents/tools", executeGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      try {
        const tools = await service.listTools(token);
        return reply.send({ tools });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    /**
     * POST /agents
     * Create a new agent studio profile
     */
    app.post<{ Body: CreateAgentInput }>("/agents", manageGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      const user = (req as any).user;
      const tenantId = user?.app_metadata?.tenant_id || user?.user_metadata?.tenant_id || "default-tenant";

      try {
        const { key, name, systemPrompt } = req.body;
        if (!key || !name || !systemPrompt) {
          return reply.status(400).send({ error: "key, name, and systemPrompt are required fields" });
        }

        const agent = await service.createAgent(token, tenantId, req.body);
        return reply.status(201).send({ agent });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    /**
     * GET /agents/:id
     * Get a specific agent profile
     */
    app.get<{ Params: { id: string } }>("/agents/:id", executeGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      try {
        const agent = await service.getAgent(token, req.params.id);
        return reply.send({ agent });
      } catch (err: any) {
        return reply.status(404).send({ error: err.message });
      }
    });

    /**
     * PUT /agents/:id
     * Update an agent profile configuration
     */
    app.put<{ Params: { id: string }; Body: UpdateAgentInput }>(
      "/agents/:id",
      manageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const agent = await service.updateAgent(token, req.params.id, req.body);
          return reply.send({ agent });
        } catch (err: any) {
          return reply.status(500).send({ error: err.message });
        }
      }
    );

    /**
     * DELETE /agents/:id
     * Remove an agent definition
     */
    app.delete<{ Params: { id: string } }>("/agents/:id", manageGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      try {
        await service.deleteAgent(token, req.params.id);
        return reply.send({ success: true });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    /**
     * POST /agents/run
     * Issue a prompt to run an agent state machine
     */
    app.post<{ Body: RunAgentInput }>("/agents/run", executeGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      const user = (req as any).user;
      const tenantId = user?.app_metadata?.tenant_id || user?.user_metadata?.tenant_id || "default-tenant";

      try {
        const { agentId, inputPrompt } = req.body;
        if (!agentId || !inputPrompt) {
          return reply.status(400).send({ error: "agentId and inputPrompt are required" });
        }

        const execution = await service.runAgent(token, tenantId, req.body, user?.id);
        return reply.send({ execution });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    /**
     * GET /agents/executions
     * List execution history and audit logs
     */
    app.get<{ Querystring: { agentId?: string } }>(
      "/agents/executions",
      executeGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const executions = await service.listExecutions(token, req.query.agentId);
          return reply.send({ executions });
        } catch (err: any) {
          return reply.status(500).send({ error: err.message });
        }
      }
    );

    /**
     * GET /agents/executions/:id
     * Get a specific execution with its full message history & pending action
     */
    app.get<{ Params: { id: string } }>(
      "/agents/executions/:id",
      executeGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const execution = await service.getExecution(token, req.params.id);
          return reply.send({ execution });
        } catch (err: any) {
          return reply.status(404).send({ error: err.message });
        }
      }
    );

    /**
     * POST /agents/executions/:id/approve
     * Confirm or reject a pending Human-in-the-Loop action
     */
    app.post<{ Params: { id: string }; Body: ApproveAgentInput }>(
      "/agents/executions/:id/approve",
      approveGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        const user = (req as any).user;
        const tenantId = user?.app_metadata?.tenant_id || user?.user_metadata?.tenant_id || "default-tenant";

        try {
          const { approved, rejectionReason } = req.body;
          if (typeof approved !== "boolean") {
            return reply.status(400).send({ error: "approved boolean is required" });
          }

          const execution = await service.approveAction(
            token,
            tenantId,
            req.params.id,
            { approved, rejectionReason }
          );
          return reply.send({ execution });
        } catch (err: any) {
          return reply.status(500).send({ error: err.message });
        }
      }
    );
  };
}
