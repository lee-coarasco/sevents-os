import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakePlatformAdminRepository } from "../../test/fakePlatformAdminRepository.js";

describe("M36: Platform Administration & Support routes", () => {
  let app: FastifyInstance;
  let authRepo: FakeAuthorityRepository;
  let adminRepo: FakePlatformAdminRepository;

  const tenantA = "tenant-a-111";
  const userA = "user-a-111";
  const tokenA = "token-a-valid";

  const permissions = [
    "platform.settings.view",
    "platform.settings.manage",
    "platform.feature_flags.manage",
    "platform.health.view",
    "platform.maintenance.manage",
    "platform.support.view",
    "platform.support.manage",
  ];

  beforeEach(async () => {
    authRepo = new FakeAuthorityRepository();
    adminRepo = new FakePlatformAdminRepository();

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
      getPlatformAdminRepository: () => adminRepo,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("fetches and updates tenant settings", async () => {
    // 1. Get settings
    const getRes = await app.inject({
      method: "GET",
      url: "/platform-admin/settings",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(getRes.statusCode).toBe(200);
    const settings = getRes.json().settings;
    expect(settings.organization_name).toBe("SEVENTS Contracting LLC");
    expect(settings.default_currency).toBe("AED");

    // 2. Update settings
    const updateRes = await app.inject({
      method: "PATCH",
      url: "/platform-admin/settings",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        organization_name: "SEVENTS Global Holdings LLC",
        session_timeout_minutes: 120,
        mfa_enforced: true,
      },
    });
    expect(updateRes.statusCode).toBe(200);
    const updated = updateRes.json().settings;
    expect(updated.organization_name).toBe("SEVENTS Global Holdings LLC");
    expect(updated.session_timeout_minutes).toBe(120);
    expect(updated.mfa_enforced).toBe(true);
  });

  it("lists and toggles tenant feature flags", async () => {
    // 1. List flags
    const listRes = await app.inject({
      method: "GET",
      url: "/platform-admin/feature-flags",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(listRes.statusCode).toBe(200);
    const flags = listRes.json().flags;
    expect(flags.length).toBeGreaterThan(0);
    expect(flags.some((f: any) => f.flag_key === "ai_copilot_enabled")).toBe(true);

    // 2. Toggle flag
    const toggleRes = await app.inject({
      method: "POST",
      url: "/platform-admin/feature-flags/toggle",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        flag_key: "wps_banking_export",
        is_enabled: true,
        updated_by: "admin@sevents.ae",
      },
    });
    expect(toggleRes.statusCode).toBe(200);
    const toggled = toggleRes.json().flag;
    expect(toggled.flag_key).toBe("wps_banking_export");
    expect(toggled.is_enabled).toBe(true);
  });

  it("manages maintenance windows and queries system health", async () => {
    // 1. Query health probe
    const healthRes = await app.inject({
      method: "GET",
      url: "/platform-admin/health",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(healthRes.statusCode).toBe(200);
    const health = healthRes.json().health;
    expect(health.status).toBe("healthy");
    expect(health.components.database.status).toBe("up");

    // 2. Create maintenance window
    const createRes = await app.inject({
      method: "POST",
      url: "/platform-admin/maintenance",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        title: "Emergency Network Maintenance",
        message: "Upgrading core cloud gateways.",
        severity: "warning",
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 3600000).toISOString(),
      },
    });
    expect(createRes.statusCode).toBe(201);
    const win = createRes.json().maintenance_window;
    expect(win.title).toBe("Emergency Network Maintenance");

    // 3. Toggle maintenance window
    const toggleRes = await app.inject({
      method: "PATCH",
      url: `/platform-admin/maintenance/${win.id}/toggle`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { is_active: false },
    });
    expect(toggleRes.statusCode).toBe(200);
    expect(toggleRes.json().maintenance_window.is_active).toBe(false);
  });

  it("creates, lists, and resolves platform support tickets", async () => {
    // 1. Create ticket
    const createRes = await app.inject({
      method: "POST",
      url: "/platform-admin/support-tickets",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        title: "Subcontractor claim currency mismatch",
        description: "Currency defaulting to USD instead of AED on SC-009.",
        category: "data",
        priority: "medium",
        reported_by: "qs@sevents.ae",
      },
    });
    expect(createRes.statusCode).toBe(201);
    const tkt = createRes.json().ticket;
    expect(tkt.title).toBe("Subcontractor claim currency mismatch");
    expect(tkt.status).toBe("open");

    // 2. List tickets
    const listRes = await app.inject({
      method: "GET",
      url: "/platform-admin/support-tickets",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().tickets.length).toBeGreaterThanOrEqual(2);

    // 3. Resolve ticket
    const resolveRes = await app.inject({
      method: "PATCH",
      url: `/platform-admin/support-tickets/${tkt.id}/resolve`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        status: "resolved",
        resolution_notes: "Corrected project master currency assignment and re-indexed contract.",
        assigned_to: "it-support@sevents.ae",
      },
    });
    expect(resolveRes.statusCode).toBe(200);
    const resolved = resolveRes.json().ticket;
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolved_at).toBeTruthy();
  });
});
