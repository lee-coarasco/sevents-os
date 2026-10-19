import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeIntegrationsRepository } from "../../test/fakeIntegrationsRepository.js";

describe("M34: Integrations & API Management routes", () => {
  let app: FastifyInstance;
  let authRepo: FakeAuthorityRepository;
  let integrationsRepo: FakeIntegrationsRepository;

  const tenantA = "tenant-a-111";
  const userA = "user-a-111";
  const tokenA = "token-a-valid";

  const permissions = [
    "integrations.api_key.manage",
    "integrations.api_key.revoke",
    "integrations.webhook.manage",
    "integrations.webhook.test",
    "integrations.connector.manage",
    "integrations.log.view",
  ];

  beforeEach(async () => {
    authRepo = new FakeAuthorityRepository();
    integrationsRepo = new FakeIntegrationsRepository();

    authRepo.addSession(tokenA, userA, tenantA);
    authRepo.roleAssignments.set("seed-admin-a", {
      id: "seed-admin-a",
      tenant_id: tenantA,
      user_id: userA,
      role_id: "role.platform_administrator",
      department_id: null,
      valid_from: "2000-01-01T00:00:00.000Z",
      valid_to: null,
    });
    permissions.forEach((perm) => authRepo.grantPermission("role.platform_administrator", perm));

    app = buildApp({
      getAuthorityRepository: () => authRepo,
      getIntegrationsRepository: () => integrationsRepo,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("creates, lists, and revokes external API keys", async () => {
    // 1. Create API Key
    const createRes = await app.inject({
      method: "POST",
      url: "/integrations/api-keys",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        name: "BIM 360 Site Sync",
        scopes: ["projects.read", "documents.read"],
        rate_limit_rpm: 120,
      },
    });

    expect(createRes.statusCode).toBe(201);
    const createdKey = createRes.json().api_key;
    expect(createdKey.name).toBe("BIM 360 Site Sync");
    expect(createdKey.plain_key).toBeDefined();
    expect(createdKey.key_prefix).toContain("sev_live_");

    // 2. List API Keys
    const listRes = await app.inject({
      method: "GET",
      url: "/integrations/api-keys",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(listRes.statusCode).toBe(200);
    const keys = listRes.json().api_keys;
    expect(keys.length).toBe(1);

    // 3. Revoke API Key
    const revokeRes = await app.inject({
      method: "POST",
      url: `/integrations/api-keys/${createdKey.id}/revoke`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(revokeRes.statusCode).toBe(200);
    expect(revokeRes.json().success).toBe(true);
  });

  it("creates, toggles, tests, and deletes webhook subscriptions", async () => {
    // 1. Create Webhook
    const createRes = await app.inject({
      method: "POST",
      url: "/integrations/webhooks",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        name: "Procore Submittal Sync",
        target_url: "https://api.procore.example.com/webhooks/sevents",
        event_types: ["po.approved", "invoice.issued"],
      },
    });

    expect(createRes.statusCode).toBe(201);
    const webhook = createRes.json().webhook;
    expect(webhook.name).toBe("Procore Submittal Sync");
    expect(webhook.secret_key).toContain("whsec_");

    // 2. Toggle active status
    const toggleRes = await app.inject({
      method: "PATCH",
      url: `/integrations/webhooks/${webhook.id}`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { is_active: false },
    });
    expect(toggleRes.statusCode).toBe(200);
    expect(toggleRes.json().webhook.is_active).toBe(false);

    // 3. Trigger test ping delivery
    const testRes = await app.inject({
      method: "POST",
      url: `/integrations/webhooks/${webhook.id}/test`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(testRes.statusCode).toBe(200);
    expect(testRes.json().delivery.status).toBe("success");
    expect(testRes.json().delivery.event_type).toBe("webhook.test_ping");

    // 4. List deliveries
    const delRes = await app.inject({
      method: "GET",
      url: "/integrations/deliveries",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(delRes.statusCode).toBe(200);
    expect(delRes.json().deliveries.length).toBeGreaterThan(0);

    // 5. Delete webhook
    const delWebhookRes = await app.inject({
      method: "DELETE",
      url: `/integrations/webhooks/${webhook.id}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(delWebhookRes.statusCode).toBe(200);
    expect(delWebhookRes.json().success).toBe(true);
  });

  it("manages service connectors (configure and disconnect)", async () => {
    // 1. List pre-seeded connectors
    const listRes = await app.inject({
      method: "GET",
      url: "/integrations/connectors",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(listRes.statusCode).toBe(200);
    const connectors = listRes.json().connectors;
    expect(connectors.length).toBeGreaterThanOrEqual(2);

    // 2. Configure connector
    const configRes = await app.inject({
      method: "POST",
      url: "/integrations/connectors",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        connector_key: "xero_accounting",
        name: "Xero Cloud Accounting",
        category: "accounting",
        credentials: { client_id: "xero_client_1", client_secret: "super_secret_key_8899" },
        settings: { sync_invoices: true, tax_code: "OUTPUT_TAX" },
      },
    });
    expect(configRes.statusCode).toBe(200);
    const connected = configRes.json().connector;
    expect(connected.status).toBe("connected");
    expect(connected.credentials_masked.client_secret).toBe("••••••••8899");

    // 3. Disconnect connector
    const disRes = await app.inject({
      method: "POST",
      url: `/integrations/connectors/${connected.id}/disconnect`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(disRes.statusCode).toBe(200);
    expect(disRes.json().success).toBe(true);
  });
});
