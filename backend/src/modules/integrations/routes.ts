import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { IntegrationsRepository } from "./types.js";
import { IntegrationsService } from "./service.js";
import type {
  CreateApiKeyInput,
  CreateWebhookInput,
  ConfigureConnectorInput,
} from "./types.js";

export interface IntegrationsRoutesOptions {
  getRepository: () => IntegrationsRepository;
  permissionGuard: (permissionKey: string) => (request: any, reply: any) => Promise<void>;
}

function bearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export function registerIntegrationsRoutes(options: IntegrationsRoutesOptions): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    const service = new IntegrationsService(options.getRepository());

    const apiKeyManageGuard = { preHandler: [options.permissionGuard("integrations.api_key.manage")] };
    const apiKeyRevokeGuard = { preHandler: [options.permissionGuard("integrations.api_key.revoke")] };
    const webhookManageGuard = { preHandler: [options.permissionGuard("integrations.webhook.manage")] };
    const webhookTestGuard = { preHandler: [options.permissionGuard("integrations.webhook.test")] };
    const connectorManageGuard = { preHandler: [options.permissionGuard("integrations.connector.manage")] };
    const logViewGuard = { preHandler: [options.permissionGuard("integrations.log.view")] };

    // =======================================================================
    // 1. API KEYS
    // =======================================================================
    app.get("/integrations/api-keys", apiKeyManageGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      try {
        const keys = await service.listApiKeys(token);
        return reply.send({ api_keys: keys });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    app.post<{ Body: CreateApiKeyInput }>(
      "/integrations/api-keys",
      apiKeyManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const key = await service.createApiKey(token, req.body);
          return reply.status(201).send({ api_key: key });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Params: { id: string } }>(
      "/integrations/api-keys/:id/revoke",
      apiKeyRevokeGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const success = await service.revokeApiKey(token, req.params.id);
          return reply.send({ success });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 2. WEBHOOKS
    // =======================================================================
    app.get("/integrations/webhooks", webhookManageGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      try {
        const webhooks = await service.listWebhooks(token);
        return reply.send({ webhooks });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    app.post<{ Body: CreateWebhookInput }>(
      "/integrations/webhooks",
      webhookManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const webhook = await service.createWebhook(token, req.body);
          return reply.status(201).send({ webhook });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.patch<{ Params: { id: string }; Body: { is_active: boolean } }>(
      "/integrations/webhooks/:id",
      webhookManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const webhook = await service.toggleWebhook(token, req.params.id, req.body.is_active);
          return reply.send({ webhook });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.delete<{ Params: { id: string } }>(
      "/integrations/webhooks/:id",
      webhookManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const success = await service.deleteWebhook(token, req.params.id);
          return reply.send({ success });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Params: { id: string } }>(
      "/integrations/webhooks/:id/test",
      webhookTestGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const delivery = await service.testWebhook(token, req.params.id);
          return reply.send({ delivery });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 3. DELIVERY LOGS
    // =======================================================================
    app.get<{ Querystring: { webhookId?: string } }>(
      "/integrations/deliveries",
      logViewGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const deliveries = await service.listDeliveries(token, req.query.webhookId);
          return reply.send({ deliveries });
        } catch (err: any) {
          return reply.status(500).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 4. SERVICE CONNECTORS
    // =======================================================================
    app.get("/integrations/connectors", connectorManageGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      try {
        const connectors = await service.listConnectors(token);
        return reply.send({ connectors });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    app.post<{ Body: ConfigureConnectorInput }>(
      "/integrations/connectors",
      connectorManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const connector = await service.configureConnector(token, req.body);
          return reply.status(200).send({ connector });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Params: { id: string } }>(
      "/integrations/connectors/:id/disconnect",
      connectorManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const success = await service.disconnectConnector(token, req.params.id);
          return reply.send({ success });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );
  };
}
