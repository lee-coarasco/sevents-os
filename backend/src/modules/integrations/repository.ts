import { randomBytes, createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
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

export type { IntegrationsRepository } from "./types.js";

function hashToken(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function generateApiKeySecret(): { plainKey: string; keyPrefix: string; keyHash: string } {
  const randomSuffix = randomBytes(24).toString("hex");
  const plainKey = `sev_live_${randomSuffix}`;
  const keyPrefix = `sev_live_${randomSuffix.substring(0, 6)}...`;
  const keyHash = hashToken(plainKey);
  return { plainKey, keyPrefix, keyHash };
}

function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

export function createSupabaseIntegrationsRepository(
  getUserScopedClient: (token: string) => SupabaseClient
): IntegrationsRepository {
  return {
    async listApiKeys(accessToken: string): Promise<ApiKey[]> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from("api_keys")
        .select("id, tenant_id, name, key_prefix, scopes, rate_limit_rpm, expires_at, revoked_at, last_used_at, created_by, created_at")
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return (data || []) as ApiKey[];
    },

    async createApiKey(accessToken: string, input: CreateApiKeyInput, createdBy?: string): Promise<ApiKey> {
      const client = getUserScopedClient(accessToken);
      const { plainKey, keyPrefix, keyHash } = generateApiKeySecret();

      const { data, error } = await client
        .from("api_keys")
        .insert({
          name: input.name,
          key_prefix: keyPrefix,
          key_hash: keyHash,
          scopes: input.scopes || [],
          rate_limit_rpm: input.rate_limit_rpm || 60,
          expires_at: input.expires_at || null,
          created_by: createdBy || null,
        })
        .select("id, tenant_id, name, key_prefix, scopes, rate_limit_rpm, expires_at, revoked_at, last_used_at, created_by, created_at")
        .single();

      if (error) throw new Error(error.message);
      return {
        ...(data as ApiKey),
        plain_key: plainKey, // Returned once upon creation
      };
    },

    async revokeApiKey(accessToken: string, id: string): Promise<boolean> {
      const client = getUserScopedClient(accessToken);
      const { error } = await client
        .from("api_keys")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw new Error(error.message);
      return true;
    },

    async listWebhooks(accessToken: string): Promise<WebhookSubscription[]> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from("webhook_subscriptions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return (data || []) as WebhookSubscription[];
    },

    async createWebhook(accessToken: string, input: CreateWebhookInput): Promise<WebhookSubscription> {
      const client = getUserScopedClient(accessToken);
      const secretKey = `whsec_${randomBytes(24).toString("hex")}`;

      const { data, error } = await client
        .from("webhook_subscriptions")
        .insert({
          name: input.name,
          target_url: input.target_url,
          event_types: input.event_types || [],
          secret_key: secretKey,
          is_active: true,
        })
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return data as WebhookSubscription;
    },

    async toggleWebhook(accessToken: string, id: string, isActive: boolean): Promise<WebhookSubscription> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from("webhook_subscriptions")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return data as WebhookSubscription;
    },

    async deleteWebhook(accessToken: string, id: string): Promise<boolean> {
      const client = getUserScopedClient(accessToken);
      const { error } = await client.from("webhook_subscriptions").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return true;
    },

    async listDeliveries(accessToken: string, webhookId?: string): Promise<WebhookDelivery[]> {
      const client = getUserScopedClient(accessToken);
      let query = client
        .from("webhook_deliveries")
        .select("*")
        .order("delivered_at", { ascending: false })
        .limit(50);

      if (webhookId) {
        query = query.eq("webhook_id", webhookId);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data || []) as WebhookDelivery[];
    },

    async recordDelivery(
      accessToken: string,
      delivery: Omit<WebhookDelivery, "id" | "delivered_at" | "tenant_id">
    ): Promise<WebhookDelivery> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from("webhook_deliveries")
        .insert({
          webhook_id: delivery.webhook_id,
          event_type: delivery.event_type,
          payload: delivery.payload || {},
          response_status: delivery.response_status || null,
          response_body: delivery.response_body || null,
          status: delivery.status,
        })
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return data as WebhookDelivery;
    },

    async listConnectors(accessToken: string): Promise<ServiceConnector[]> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from("service_connectors")
        .select("*")
        .order("category", { ascending: true });

      if (error) throw new Error(error.message);
      return (data || []) as ServiceConnector[];
    },

    async configureConnector(accessToken: string, input: ConfigureConnectorInput): Promise<ServiceConnector> {
      const client = getUserScopedClient(accessToken);
      // Mask credentials before storage
      const masked: Record<string, string> = {};
      for (const [k, v] of Object.entries(input.credentials)) {
        const str = String(v);
        masked[k] = str.length > 4 ? `••••••••${str.slice(-4)}` : "••••••••";
      }

      const { data, error } = await client
        .from("service_connectors")
        .upsert(
          {
            connector_key: input.connector_key,
            name: input.name,
            category: input.category,
            status: "connected",
            credentials_masked: masked,
            settings: input.settings || {},
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,connector_key" }
        )
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return data as ServiceConnector;
    },

    async disconnectConnector(accessToken: string, id: string): Promise<boolean> {
      const client = getUserScopedClient(accessToken);
      const { error } = await client
        .from("service_connectors")
        .update({
          status: "disconnected",
          credentials_masked: {},
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw new Error(error.message);
      return true;
    },
  };
}
