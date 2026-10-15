import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { FakeTenancyRepository } from "../../test/fakeTenancyRepository.js";

function appWithFakeRepo() {
  const repo = new FakeTenancyRepository();
  repo.addSession("token-a", "tenant-a");
  repo.addSession("token-b", "tenant-b");
  const app = buildApp({ getTenancyRepository: () => repo });
  return { app, repo };
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
