import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeTenancyRepository } from "../../test/fakeTenancyRepository.js";

function grantManageAll(authorityRepo: FakeAuthorityRepository) {
  authorityRepo.grantPermission("role.platform_administrator", "tenancy.company.manage");
  authorityRepo.grantPermission("role.platform_administrator", "tenancy.branch.manage");
  authorityRepo.grantPermission("role.platform_administrator", "tenancy.project.manage");
}

function appWithFakeRepo() {
  const repo = new FakeTenancyRepository();
  repo.addSession("token-a", "tenant-a");
  repo.addSession("token-b", "tenant-b");

  // ticket 0056: company/branch/project creation is gated on
  // tenancy.*.manage — both tenants' admin callers hold it here so
  // the pre-existing tenant-isolation assertions below still exercise
  // the same create/list flow they did before the permission check
  // existed.
  const authorityRepo = new FakeAuthorityRepository();
  authorityRepo.addSession("token-a", "user-a", "tenant-a");
  authorityRepo.addSession("token-b", "user-b", "tenant-b");
  grantManageAll(authorityRepo);
  authorityRepo.roleAssignments.set("seed-a", {
    id: "seed-a",
    tenant_id: "tenant-a",
    user_id: "user-a",
    role_id: "role.platform_administrator",
    department_id: null,
    valid_from: "2000-01-01T00:00:00.000Z",
    valid_to: null,
  });
  authorityRepo.roleAssignments.set("seed-b", {
    id: "seed-b",
    tenant_id: "tenant-b",
    user_id: "user-b",
    role_id: "role.platform_administrator",
    department_id: null,
    valid_from: "2000-01-01T00:00:00.000Z",
    valid_to: null,
  });

  const app = buildApp({
    getTenancyRepository: () => repo,
    getAuthorityRepository: () => authorityRepo,
  });
  return { app, repo, authorityRepo };
}

describe("tenancy routes", () => {
  it("401s every /tenancy/* route with no bearer token", async () => {
    const { app } = appWithFakeRepo();
    const response = await app.inject({ method: "GET", url: "/tenancy/companies" });
    expect(response.statusCode).toBe(401);
  });

  it("creates a company scoped to the caller's tenant", async () => {
    const { app } = appWithFakeRepo();
    const response = await app.inject({
      method: "POST",
      url: "/tenancy/companies",
      headers: { authorization: "Bearer token-a" },
      payload: { legalName: "Tenant A Co" },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().company.tenant_id).toBe("tenant-a");
  });

  it("403s creating a company without tenancy.company.manage", async () => {
    const { app, authorityRepo } = appWithFakeRepo();
    authorityRepo.addSession("token-no-permission", "plain-user", "tenant-a");

    const response = await app.inject({
      method: "POST",
      url: "/tenancy/companies",
      headers: { authorization: "Bearer token-no-permission" },
      payload: { legalName: "Should not be created" },
    });

    expect(response.statusCode).toBe(403);
  });

  it("a tenant's company list never includes another tenant's company", async () => {
    const { app } = appWithFakeRepo();
    await app.inject({
      method: "POST",
      url: "/tenancy/companies",
      headers: { authorization: "Bearer token-a" },
      payload: { legalName: "Tenant A Co" },
    });
    await app.inject({
      method: "POST",
      url: "/tenancy/companies",
      headers: { authorization: "Bearer token-b" },
      payload: { legalName: "Tenant B Co" },
    });

    const response = await app.inject({
      method: "GET",
      url: "/tenancy/companies",
      headers: { authorization: "Bearer token-a" },
    });

    const companies = response.json().companies;
    expect(companies).toHaveLength(1);
    expect(companies[0].legal_name).toBe("Tenant A Co");
  });
});

describe("GET /tenancy/branches", () => {
  it("400s without companyId", async () => {
    const { app } = appWithFakeRepo();
    const response = await app.inject({
      method: "GET",
      url: "/tenancy/branches",
      headers: { authorization: "Bearer token-a" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("lists branches for a company, isolated by tenant", async () => {
    const { app } = appWithFakeRepo();
    const createA = await app.inject({
      method: "POST",
      url: "/tenancy/branches",
      headers: { authorization: "Bearer token-a" },
      payload: { companyId: "company-1", name: "Dubai Branch" },
    });
    expect(createA.statusCode).toBe(201);

    await app.inject({
      method: "POST",
      url: "/tenancy/branches",
      headers: { authorization: "Bearer token-b" },
      payload: { companyId: "company-1", name: "Should not be visible to tenant A" },
    });

    const response = await app.inject({
      method: "GET",
      url: "/tenancy/branches?companyId=company-1",
      headers: { authorization: "Bearer token-a" },
    });

    expect(response.statusCode).toBe(200);
    const branches = response.json().branches;
    expect(branches).toHaveLength(1);
    expect(branches[0].name).toBe("Dubai Branch");
  });
});
