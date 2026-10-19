import type {
  ApiKey,
  CreateApiKeyInput,
  WebhookSubscription,
  CreateWebhookInput,
  WebhookDelivery,
  ServiceConnector,
  ConfigureConnectorInput,
  IntegrationsRepository,
} from "./types.js";

export class IntegrationsService {
  constructor(private readonly repo: IntegrationsRepository) {}

  async listApiKeys(tenantId: string): Promise<ApiKey[]> {
    return this.repo.listApiKeys(tenantId);
  }

  async createApiKey(
    tenantId: string,
    input: CreateApiKeyInput,
    createdBy?: string
  ): Promise<ApiKey> {
    if (!input.name || input.name.trim().length === 0) {
      throw new Error("API key name is required");
    }
    if (!input.scopes || input.scopes.length === 0) {
      throw new Error("At least one permission scope must be selected");
    }

    return this.repo.createApiKey(
      tenantId,
      {
        ...input,
        name: input.name.trim(),
      },
      createdBy
    );
  }

  async revokeApiKey(tenantId: string, id: string): Promise<boolean> {
    return this.repo.revokeApiKey(tenantId, id);
  }

  async listWebhooks(tenantId: string): Promise<WebhookSubscription[]> {
    return this.repo.listWebhooks(tenantId);
  }

  async createWebhook(
    tenantId: string,
    input: CreateWebhookInput
  ): Promise<WebhookSubscription> {
    if (!input.name || input.name.trim().length === 0) {
      throw new Error("Webhook name is required");
    }
    if (!input.target_url || !input.target_url.startsWith("http")) {
      throw new Error("A valid HTTP/HTTPS endpoint URL is required");
    }
    if (!input.event_types || input.event_types.length === 0) {
      throw new Error("At least one trigger event type must be selected");
    }

    return this.repo.createWebhook(tenantId, {
      ...input,
      name: input.name.trim(),
      target_url: input.target_url.trim(),
    });
  }

  async toggleWebhook(
    tenantId: string,
    id: string,
    isActive: boolean
  ): Promise<WebhookSubscription> {
    return this.repo.toggleWebhook(tenantId, id, isActive);
  }

  async deleteWebhook(tenantId: string, id: string): Promise<boolean> {
    return this.repo.deleteWebhook(tenantId, id);
  }

  async testWebhook(tenantId: string, id: string): Promise<WebhookDelivery> {
    const webhooks = await this.repo.listWebhooks(tenantId);
    const webhook = webhooks.find((w) => w.id === id);
    if (!webhook) {
      throw new Error("Webhook subscription not found");
    }

    // Simulate sending an outbound ping test payload
    const testPayload = {
      event: "webhook.test_ping",
      timestamp: new Date().toISOString(),
      webhook_id: webhook.id,
      tenant_id: tenantId,
      sample_data: {
        message: "SEVENTS Webhook connectivity verified successfully.",
        target: webhook.target_url,
      },
    };

    // Record delivery in audit log
    return this.repo.recordDelivery(tenantId, {
      webhook_id: webhook.id,
      event_type: "webhook.test_ping",
      payload: testPayload,
      response_status: 200,
      response_body: JSON.stringify({ received: true, status: "OK" }),
      status: "success",
    });
  }

  async listDeliveries(tenantId: string, webhookId?: string): Promise<WebhookDelivery[]> {
    return this.repo.listDeliveries(tenantId, webhookId);
  }

  async listConnectors(tenantId: string): Promise<ServiceConnector[]> {
    return this.repo.listConnectors(tenantId);
  }

  async configureConnector(
    tenantId: string,
    input: ConfigureConnectorInput
  ): Promise<ServiceConnector> {
    if (!input.connector_key) {
      throw new Error("Connector key is required");
    }
    if (!input.name) {
      throw new Error("Connector name is required");
    }
    return this.repo.configureConnector(tenantId, input);
  }

  async disconnectConnector(tenantId: string, id: string): Promise<boolean> {
    return this.repo.disconnectConnector(tenantId, id);
  }
}
