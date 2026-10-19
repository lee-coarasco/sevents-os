import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { AiRepository } from "./repository.js";
import { createAiKnowledgeService } from "./service.js";
import type { AiChatRequest, KnowledgeSourceType, AiFeedbackInput } from "./types.js";
import {
  listSupportedProviders,
  createAiAdapter,
  resolveDefaultProvider,
  setRuntimeDefaultProvider,
  registerCustomProvider,
  removeCustomProvider,
  addModelToProvider,
  type AiProviderType,
  type CustomProviderInput,
} from "./adapters/index.js";

export interface AiRoutesOptions {
  getRepository: () => AiRepository;
  permissionGuard: (permissionKey: string) => (request: any, reply: any) => Promise<void>;
}

function bearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export function registerAiRoutes(options: AiRoutesOptions): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    const service = createAiKnowledgeService(options.getRepository());

    const queryGuard = { preHandler: [options.permissionGuard("ai.assistant.query")] };
    const manageGuard = { preHandler: [options.permissionGuard("ai.knowledge.manage")] };
    const feedbackGuard = { preHandler: [options.permissionGuard("ai.feedback.submit")] };

    /**
     * POST /ai/chat
     * Grounded conversational Q&A over authorized documents with citations
     */
    app.post<{ Body: AiChatRequest }>("/ai/chat", queryGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      const user = (req as any).user;
      const tenantId = user?.app_metadata?.tenant_id || user?.user_metadata?.tenant_id || "default-tenant";

      try {
        const { message, projectId, history } = req.body;
        if (!message || typeof message !== "string") {
          return reply.status(400).send({ error: "Message string is required" });
        }

        const response = await service.chat(
          token,
          tenantId,
          { message, projectId, history },
          user?.id
        );

        return reply.send(response);
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    /**
     * POST /ai/ingest
     * Ingest and index a project document, drawing, RFI, or contract
     */
    app.post<{
      Body: {
        projectId?: string;
        sourceType: KnowledgeSourceType;
        sourceId: string;
        title: string;
        version?: string;
        content: string;
        metadata?: Record<string, unknown>;
      };
    }>("/ai/ingest", manageGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      const user = (req as any).user;
      const tenantId = user?.app_metadata?.tenant_id || user?.user_metadata?.tenant_id || "default-tenant";

      try {
        const { projectId, sourceType, sourceId, title, version, content, metadata } = req.body;
        if (!sourceType || !sourceId || !title || !content) {
          return reply.status(400).send({ error: "sourceType, sourceId, title, and content are required" });
        }

        const doc = await service.ingest(token, tenantId, {
          project_id: projectId || null,
          source_type: sourceType,
          source_id: sourceId,
          title,
          version: version || "v1",
          content,
          metadata,
        });

        return reply.status(201).send({ document: doc });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    /**
     * GET /ai/documents
     * List indexed knowledge documents
     */
    app.get<{ Querystring: { projectId?: string } }>("/ai/documents", queryGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      try {
        const documents = await service.listDocuments(token, req.query.projectId);
        return reply.send({ documents });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    /**
     * DELETE /ai/documents/:id
     * Remove a document and its embeddings from the index
     */
    app.delete<{ Params: { id: string } }>("/ai/documents/:id", manageGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      try {
        await service.deleteDocument(token, req.params.id);
        return reply.send({ success: true });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    /**
     * POST /ai/feedback
     * Submit user feedback or report knowledge gap
     */
    app.post<{ Body: AiFeedbackInput }>("/ai/feedback", feedbackGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      const user = (req as any).user;
      const tenantId = user?.app_metadata?.tenant_id || user?.user_metadata?.tenant_id || "default-tenant";

      try {
        await service.submitFeedback(token, tenantId, req.body, user?.id);
        return reply.send({ success: true });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    /**
     * GET /ai/providers
     * List all supported AI providers and their configuration status
     */
    app.get("/ai/providers", queryGuard, async (_req, reply) => {
      const providers = listSupportedProviders();
      const activeProvider = resolveDefaultProvider();
      return reply.send({ providers, activeProvider });
    });

    /**
     * POST /ai/providers/active
     * Dynamically select the system-wide active AI provider
     */
    app.post<{ Body: { provider: AiProviderType } }>(
      "/ai/providers/active",
      manageGuard,
      async (req, reply) => {
        try {
          const { provider } = req.body;
          if (!provider) {
            return reply.status(400).send({ error: "provider is required" });
          }
          setRuntimeDefaultProvider(provider);
          return reply.send({ success: true, activeProvider: resolveDefaultProvider() });
        } catch (err: any) {
          return reply.status(500).send({ error: err.message });
        }
      }
    );

    /**
     * POST /ai/providers/test
     * Test connection to a specific AI provider
     */
    app.post<{ Body: { provider: AiProviderType; apiKey?: string; baseUrl?: string } }>(
      "/ai/providers/test",
      manageGuard,
      async (req, reply) => {
        try {
          const { provider, apiKey, baseUrl } = req.body;
          const adapter = createAiAdapter({ provider, apiKey, baseUrl });
          const result = await adapter.testConnection();
          return reply.send({ result });
        } catch (err: any) {
          return reply.status(500).send({ error: err.message });
        }
      }
    );

    /**
     * POST /ai/providers/custom
     * Dynamically register or update a custom AI provider (OpenAI-compatible)
     */
    app.post<{ Body: CustomProviderInput }>(
      "/ai/providers/custom",
      manageGuard,
      async (req, reply) => {
        try {
          const { id, name, baseUrl, defaultModel } = req.body;
          if (!id || !name || !baseUrl || !defaultModel) {
            return reply.status(400).send({
              error: "id, name, baseUrl, and defaultModel are required to register a custom provider",
            });
          }

          const provider = registerCustomProvider(req.body);
          return reply.status(201).send({
            success: true,
            provider,
            providers: listSupportedProviders(),
          });
        } catch (err: any) {
          return reply.status(500).send({ error: err.message });
        }
      }
    );

    /**
     * DELETE /ai/providers/custom/:id
     * Remove a custom registered AI provider
     */
    app.delete<{ Params: { id: string } }>(
      "/ai/providers/custom/:id",
      manageGuard,
      async (req, reply) => {
        try {
          const { id } = req.params;
          if (!id) return reply.status(400).send({ error: "Provider ID is required" });

          const removed = removeCustomProvider(id);
          return reply.send({
            success: removed,
            providers: listSupportedProviders(),
          });
        } catch (err: any) {
          return reply.status(500).send({ error: err.message });
        }
      }
    );

    /**
     * POST /ai/providers/models
     * Dynamically add a new model to an existing or custom provider
     */
    app.post<{ Body: { providerId: string; model: string } }>(
      "/ai/providers/models",
      manageGuard,
      async (req, reply) => {
        try {
          const { providerId, model } = req.body;
          if (!providerId || !model) {
            return reply.status(400).send({ error: "providerId and model are required" });
          }

          const updated = addModelToProvider(providerId, model);
          if (!updated) {
            return reply.status(404).send({ error: "Provider not found" });
          }

          return reply.send({
            success: true,
            provider: updated,
            providers: listSupportedProviders(),
          });
        } catch (err: any) {
          return reply.status(500).send({ error: err.message });
        }
      }
    );
  };
}
