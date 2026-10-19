import type {
  ApiKey,
  CreateApiKeyInput,
  WebhookSubscription,
  CreateWebhookInput,
  WebhookDelivery,
  ServiceConnector,
  ConfigureConnectorInput,
  IntegrationsRepository,
} from "../modules/integrations/types.js";

export class FakeIntegrationsRepository implements IntegrationsRepository {
  public apiKeys: ApiKey[] = [];
  public webhooks: WebhookSubscription[] = [];
  public deliveries: WebhookDelivery[] = [];
  public connectors: ServiceConnector[] = [];

  constructor() {
    // Seed default connectors
    this.connectors = [
      {
        id: "conn-1",
        tenant_id: "tenant-default",
        connector_key: "xero_accounting",
        name: "Xero Cloud Accounting",
        category: "accounting",
        status: "disconnected",
        credentials_masked: {},
        settings: { sync_invoices: true, sync_bills: true },
        last_sync_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "conn-2",
        tenant_id: "tenant-default",
        connector_key: "docusign_esign",
        name: "DocuSign Digital Signatures",
        category: "e_sign",
        status: "disconnected",
        credentials_masked: {},
        settings: { auto_send_subcontractor_agreements: true },
        last_sync_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  }

  async listApiKeys(_tenantId: string): Promise<ApiKey[]> {
    return [...this.apiKeys];
  }

  async createApiKey(tenantId: string, input: CreateApiKeyInput, createdBy?: string): Promise<ApiKey> {
    const plainKey = `sev_live_test_${Math.random().toString(36).substring(2, 12)}`;
    const newKey: ApiKey = {
      id: `key-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: tenantId,
      name: input.name,
      key_prefix: `sev_live_${plainKey.substring(9, 15)}...`,
      scopes: input.scopes || [],
      rate_limit_rpm: input.rate_limit_rpm || 60,
      expires_at: input.expires_at || null,
      revoked_at: null,
      last_used_at: null,
      created_by: createdBy || null,
      created_at: new Date().toISOString(),
      plain_key: plainKey,
    };
    this.apiKeys.push(newKey);
    return newKey;
  }

  async revokeApiKey(_tenantId: string, id: string): Promise<boolean> {
    const key = this.apiKeys.find((k) => k.id === id);
    if (!key) return false;
    key.revoked_at = new Date().toISOString();
    return true;
  }

  async listWebhooks(_tenantId: string): Promise<WebhookSubscription[]> {
    return [...this.webhooks];
  }

  async createWebhook(tenantId: string, input: CreateWebhookInput): Promise<WebhookSubscription> {
    const newWebhook: WebhookSubscription = {
      id: `wh-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: tenantId,
      name: input.name,
      target_url: input.target_url,
      event_types: input.event_types || [],
      secret_key: `whsec_${Math.random().toString(36).substring(2, 12)}`,
      is_active: true,
      failure_count: 0,
      last_triggered_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.webhooks.push(newWebhook);
    return newWebhook;
  }

  async toggleWebhook(_tenantId: string, id: string, isActive: boolean): Promise<WebhookSubscription> {
    const wh = this.webhooks.find((w) => w.id === id);
    if (!wh) throw new Error("Webhook not found");
    wh.is_active = isActive;
    wh.updated_at = new Date().toISOString();
    return wh;
  }

  async deleteWebhook(_tenantId: string, id: string): Promise<boolean> {
    const initLen = this.webhooks.length;
    this.webhooks = this.webhooks.filter((w) => w.id !== id);
    return this.webhooks.length < initLen;
  }

  async listDeliveries(_tenantId: string, webhookId?: string): Promise<WebhookDelivery[]> {
    if (webhookId) {
      return this.deliveries.filter((d) => d.webhook_id === webhookId);
    }
    return [...this.deliveries];
  }

  async recordDelivery(
    tenantId: string,
    delivery: Omit<WebhookDelivery, "id" | "delivered_at" | "tenant_id">
  ): Promise<WebhookDelivery> {
    const newDel: WebhookDelivery = {
      id: `del-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: tenantId,
      webhook_id: delivery.webhook_id,
      event_type: delivery.event_type,
      payload: delivery.payload,
      response_status: delivery.response_status || null,
      response_body: delivery.response_body || null,
      status: delivery.status,
      delivered_at: new Date().toISOString(),
    };
    this.deliveries.unshift(newDel);
    return newDel;
  }

  async listConnectors(_tenantId: string): Promise<ServiceConnector[]> {
    return [...this.connectors];
  }

  async configureConnector(tenantId: string, input: ConfigureConnectorInput): Promise<ServiceConnector> {
    const masked: Record<string, string> = {};
    for (const [k, v] of Object.entries(input.credentials)) {
      const str = String(v);
      masked[k] = str.length > 4 ? `••••••••${str.slice(-4)}` : "••••••••";
    }

    const existing = this.connectors.find((c) => c.connector_key === input.connector_key);
    if (existing) {
      existing.status = "connected";
      existing.credentials_masked = masked;
      existing.settings = input.settings || {};
      existing.last_sync_at = new Date().toISOString();
      existing.updated_at = new Date().toISOString();
      return existing;
    }

    const newConn: ServiceConnector = {
      id: `conn-${Date.now()}`,
      tenant_id: tenantId,
      connector_key: input.connector_key,
      name: input.name,
      category: input.category,
      status: "connected",
      credentials_masked: masked,
      settings: input.settings || {},
      last_sync_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.connectors.push(newConn);
    return newConn;
  }

  async disconnectConnector(_tenantId: string, id: string): Promise<boolean> {
    const conn = this.connectors.find((c) => c.id === id);
    if (!conn) return false;
    conn.status = "disconnected";
    conn.credentials_masked = {};
    conn.updated_at = new Date().toISOString();
    return true;
  }
}
