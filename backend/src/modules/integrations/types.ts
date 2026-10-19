export interface ApiKey {
  id: string;
  tenant_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit_rpm: number;
  expires_at?: string | null;
  revoked_at?: string | null;
  last_used_at?: string | null;
  created_by?: string | null;
  created_at: string;
  plain_key?: string; // returned ONLY on initial generation
}

export interface CreateApiKeyInput {
  name: string;
  scopes: string[];
  rate_limit_rpm?: number;
  expires_at?: string | null;
}

export interface WebhookSubscription {
  id: string;
  tenant_id: string;
  name: string;
  target_url: string;
  event_types: string[];
  secret_key: string;
  is_active: boolean;
  failure_count: number;
  last_triggered_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWebhookInput {
  name: string;
  target_url: string;
  event_types: string[];
}

export interface WebhookDelivery {
  id: string;
  tenant_id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_status?: number | null;
  response_body?: string | null;
  status: "success" | "failed" | "retrying";
  delivered_at: string;
}

export type ConnectorCategory =
  | "accounting"
  | "banking"
  | "e_sign"
  | "storage"
  | "ocr"
  | "custom";

export type ConnectorStatus = "connected" | "disconnected" | "error" | "syncing";

export interface ServiceConnector {
  id: string;
  tenant_id: string;
  connector_key: string;
  name: string;
  category: ConnectorCategory;
  status: ConnectorStatus;
  credentials_masked: Record<string, unknown>;
  settings: Record<string, unknown>;
  last_sync_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConfigureConnectorInput {
  connector_key: string;
  name: string;
  category: ConnectorCategory;
  credentials: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface IntegrationsRepository {
  listApiKeys(tenantId: string): Promise<ApiKey[]>;
  createApiKey(tenantId: string, input: CreateApiKeyInput, createdBy?: string): Promise<ApiKey>;
  revokeApiKey(tenantId: string, id: string): Promise<boolean>;

  listWebhooks(tenantId: string): Promise<WebhookSubscription[]>;
  createWebhook(tenantId: string, input: CreateWebhookInput): Promise<WebhookSubscription>;
  toggleWebhook(tenantId: string, id: string, isActive: boolean): Promise<WebhookSubscription>;
  deleteWebhook(tenantId: string, id: string): Promise<boolean>;

  listDeliveries(tenantId: string, webhookId?: string): Promise<WebhookDelivery[]>;
  recordDelivery(tenantId: string, delivery: Omit<WebhookDelivery, "id" | "delivered_at" | "tenant_id">): Promise<WebhookDelivery>;

  listConnectors(tenantId: string): Promise<ServiceConnector[]>;
  configureConnector(tenantId: string, input: ConfigureConnectorInput): Promise<ServiceConnector>;
  disconnectConnector(tenantId: string, id: string): Promise<boolean>;
}
