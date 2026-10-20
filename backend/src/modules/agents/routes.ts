import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { AgentsRepository, ListExecutionsFilters } from "./repository.js";
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
    const interveneGuard = { preHandler: [options.permissionGuard("ai.agent.intervene")] };
    const auditGuard = { preHandler: [options.permissionGuard("ai.agent.audit")] };
    const incidentGuard = { preHandler: [options.permissionGuard("ai.agent.incident")] };

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
     * POST /agents/tools/custom
     * Register a new dynamic custom tool
     */
    app.post<{
      Body: {
        key: string;
        name: string;
        description: string;
        category?: string;
        requiredPermission?: string;
        isMutation?: boolean;
        schema: Record<string, unknown>;
        webhookUrl?: string;
      };
    }>("/agents/tools/custom", manageGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      const { key, name, description, category, requiredPermission, isMutation, schema, webhookUrl } = req.body;
      if (!key || !name || !description) {
        return reply.status(400).send({ error: "key, name, and description are required" });
      }

      try {
        const tool = await service.createCustomTool(token, {
          key: key.trim(),
          name: name.trim(),
          description: description.trim(),
          category: category || "custom",
          required_permission: requiredPermission || "ai.assistant.query",
          is_mutation: isMutation ?? false,
          schema: schema || { type: "object", properties: {} },
          webhook_url: webhookUrl,
        });
        return reply.status(201).send({ tool });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    /**
     * DELETE /agents/tools/custom/:key
     * Remove a custom tool
     */
    app.delete<{ Params: { key: string } }>("/agents/tools/custom/:key", manageGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      try {
        await service.deleteCustomTool(token, req.params.key);
        return reply.send({ success: true });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    /**
     * GET /agents/mcp-servers
     * List registered MCP servers
     */
    app.get("/agents/mcp-servers", manageGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      try {
        const servers = await service.listMcpServers(token);
        return reply.send({ servers });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    /**
     * POST /agents/mcp-servers
     * Connect a new Model Context Protocol (MCP) server
     */
    app.post<{
      Body: {
        name: string;
        url: string;
        transport?: "http" | "sse";
        apiKey?: string;
        description?: string;
      };
    }>("/agents/mcp-servers", manageGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      const user = (req as any).user;
      const tenantId = user?.app_metadata?.tenant_id || user?.user_metadata?.tenant_id || "default-tenant";

      const { name, url, transport, apiKey, description } = req.body;
      if (!name || !url) {
        return reply.status(400).send({ error: "name and url are required" });
      }

      try {
        const server = await service.createMcpServer(token, tenantId, {
          name: name.trim(),
          url: url.trim(),
          transport,
          apiKey,
          description,
        });
        return reply.status(201).send({ server });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    /**
     * POST /agents/mcp-servers/:id/sync
     * Discover and sync tools from an MCP server
     */
    app.post<{ Params: { id: string } }>("/agents/mcp-servers/:id/sync", manageGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      try {
        const result = await service.syncMcpServer(token, req.params.id);
        return reply.send({ success: true, ...result });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    /**
     * DELETE /agents/mcp-servers/:id
     * Disconnect an MCP server
     */
    app.delete<{ Params: { id: string } }>("/agents/mcp-servers/:id", manageGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      try {
        await service.deleteMcpServer(token, req.params.id);
        return reply.send({ success: true });
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
     * PUT /agents/:id/kill-switch
     * Emergency pause or resume an agent globally or per tenant (FR-AG-006)
     */
    app.put<{ Params: { id: string }; Body: { isPaused: boolean; reason?: string } }>(
      "/agents/:id/kill-switch",
      interveneGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const { isPaused, reason } = req.body;
          const agent = await service.toggleAgentKillSwitch(token, req.params.id, isPaused, reason);
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
     * List execution history with filters (M30 Run Queue)
     */
    app.get<{ Querystring: ListExecutionsFilters }>(
      "/agents/executions",
      executeGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const executions = await service.listExecutions(token, req.query);
          return reply.send({ executions });
        } catch (err: any) {
          return reply.status(500).send({ error: err.message });
        }
      }
    );

    /**
     * GET /agents/executions/:id
     * Get a specific execution with its full message history & structured steps
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
     * GET /agents/executions/:id/audit
     * Get immutable audit trail for a specific execution
     */
    app.get<{ Params: { id: string } }>(
      "/agents/executions/:id/audit",
      auditGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const auditLogs = await service.listAuditLogs(token, req.params.id);
          return reply.send({ auditLogs });
        } catch (err: any) {
          return reply.status(500).send({ error: err.message });
        }
      }
    );

    /**
     * POST /agents/executions/:id/approve
     * Confirm or reject a pending Human-in-the-Loop action (with parameter modification)
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
          const { approved, rejectionReason, modifiedInput, notes } = req.body;
          if (typeof approved !== "boolean") {
            return reply.status(400).send({ error: "approved boolean is required" });
          }

          const execution = await service.approveAction(
            token,
            tenantId,
            req.params.id,
            { approved, rejectionReason, modifiedInput, notes },
            user?.id
          );
          return reply.send({ execution });
        } catch (err: any) {
          return reply.status(500).send({ error: err.message });
        }
      }
    );

    /**
     * POST /agents/executions/:id/retry
     * Operator retry of failed or cancelled execution
     */
    app.post<{ Params: { id: string } }>(
      "/agents/executions/:id/retry",
      interveneGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        const user = (req as any).user;
        const tenantId = user?.app_metadata?.tenant_id || user?.user_metadata?.tenant_id || "default-tenant";

        try {
          const execution = await service.retryExecution(token, tenantId, req.params.id, user?.id);
          return reply.send({ execution });
        } catch (err: any) {
          return reply.status(500).send({ error: err.message });
        }
      }
    );

    /**
     * POST /agents/executions/:id/cancel
     * Cancel an in-flight or paused execution
     */
    app.post<{ Params: { id: string }; Body: { reason: string } }>(
      "/agents/executions/:id/cancel",
      interveneGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        const user = (req as any).user;

        try {
          const reason = req.body?.reason || "Execution cancelled by operator";
          const execution = await service.cancelExecution(token, req.params.id, reason, user?.id);
          return reply.send({ execution });
        } catch (err: any) {
          return reply.status(500).send({ error: err.message });
        }
      }
    );

    /**
     * GET /agents/analytics/costs
     * Token consumption & spend analytics across agents & models
     */
    app.get("/agents/analytics/costs", auditGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      try {
        const analytics = await service.getCostAnalytics(token);
        return reply.send({ analytics });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    /**
     * GET /agents/incidents
     * List safety, cost limit, and prompt injection incident reviews
     */
    app.get<{ Querystring: { isResolved?: string } }>(
      "/agents/incidents",
      incidentGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const isResolved =
            req.query.isResolved !== undefined ? req.query.isResolved === "true" : undefined;
          const incidents = await service.listIncidents(token, isResolved);
          return reply.send({ incidents });
        } catch (err: any) {
          return reply.status(500).send({ error: err.message });
        }
      }
    );

    /**
     * POST /agents/incidents/:id/resolve
     * Resolve and redact flagged AI incident review
     */
    app.post<{ Params: { id: string }; Body: { notes: string } }>(
      "/agents/incidents/:id/resolve",
      incidentGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        const user = (req as any).user;
        try {
          const notes = req.body?.notes || "Incident reviewed and resolved";
          const incident = await service.resolveIncident(token, req.params.id, notes, user?.id || "system");
          return reply.send({ incident });
        } catch (err: any) {
          return reply.status(500).send({ error: err.message });
        }
      }
    );
  };
}
