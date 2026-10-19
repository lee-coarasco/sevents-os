import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { createFakeDashboardRepository } from "../../test/fakeDashboardRepository.js";

describe("M32: Dashboards, Reports & KPI Builder routes", () => {
  let app: FastifyInstance;
  let authRepo: FakeAuthorityRepository;
  const fakeDashboardRepo = createFakeDashboardRepository();

  const tenantA = "tenant-a-111";
  const userA = "user-a-111";
  const tokenA = "token-a-valid";

  const permissions = [
    "dashboard.executive.view",
    "dashboard.financial.view",
    "dashboard.operations.view",
    "dashboard.reports.manage",
    "dashboard.reports.export",
  ];

  beforeEach(async () => {
    authRepo = new FakeAuthorityRepository();

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
      getDashboardRepository: () => fakeDashboardRepo,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns dashboard summary overview counts", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/dashboard/summary",
      headers: { authorization: `Bearer ${tokenA}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.summary).toBeDefined();
    expect(body.summary.projects).toBe(4);
    expect(body.summary.activeEmployees).toBe(25);
  });

  it("returns executive analytics KPIs and recent project status", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/dashboard/analytics/executive",
      headers: { authorization: `Bearer ${tokenA}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.analytics.total_projects).toBe(4);
    expect(body.analytics.total_contract_value).toBe(28500000);
    expect(body.analytics.average_progress_pct).toBe(64);
    expect(body.analytics.recent_projects.length).toBeGreaterThan(0);
  });

  it("returns financial analytics with budget, commitments, and cost variance", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/dashboard/analytics/financial",
      headers: { authorization: `Bearer ${tokenA}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.analytics.total_budget).toBe(25000000);
    expect(body.analytics.committed_costs).toBe(11200000);
    expect(body.analytics.cash_collected).toBe(14200000);
    expect(body.analytics.cost_variance).toBe(5800000);
  });

  it("returns operations, fleet and QHSE health metrics", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/dashboard/analytics/operations",
      headers: { authorization: `Bearer ${tokenA}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.analytics.manpower_efficiency_pct).toBe(92);
    expect(body.analytics.equipment_utilization_pct).toBe(88);
    expect(body.analytics.safe_man_hours).toBe(124500);
    expect(body.analytics.quality_ncr_closure_rate_pct).toBe(88);
  });

  it("manages custom reports (list, create, delete)", async () => {
    // List initial reports
    const listRes = await app.inject({
      method: "GET",
      url: "/dashboard/reports",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(listRes.statusCode).toBe(200);
    const initialList = listRes.json().reports;
    expect(initialList.length).toBeGreaterThanOrEqual(1);

    // Create a new custom report
    const createRes = await app.inject({
      method: "POST",
      url: "/dashboard/reports",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        name: "Custom Safety & NCR Audit",
        description: "Monthly safety audit metrics",
        category: "qhse",
        config: { entity: "quality_ncrs", severity: "high" },
      },
    });
    expect(createRes.statusCode).toBe(201);
    const newReport = createRes.json().report;
    expect(newReport.name).toBe("Custom Safety & NCR Audit");

    // Delete the report
    const delRes = await app.inject({
      method: "DELETE",
      url: `/dashboard/reports/${newReport.id}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(delRes.statusCode).toBe(200);
    expect(delRes.json().success).toBe(true);
  });

  it("generates tabular report dataset with columns and summary", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/dashboard/reports/generate",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        entity: "projects",
        filters: { limit: 10 },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.result.entity).toBe("projects");
    expect(body.result.columns.length).toBeGreaterThan(0);
    expect(body.result.rows.length).toBeGreaterThan(0);
    expect(body.result.summary["Total Projects"]).toBe(2);
  });
});
