import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeProjectsRepository } from "../../test/fakeProjectsRepository.js";

const ADMIN_TOKEN = "admin-token";
const ADMIN_USER = "admin-user";
const TENANT_A = "tenant-a";
const PLAIN_TOKEN = "plain-token";
const PLAIN_USER = "plain-user";
const OTHER_TENANT_TOKEN = "other-tenant-token";

function appWithFakeRepos() {
  const authorityRepo = new FakeAuthorityRepository();
  authorityRepo.addSession(ADMIN_TOKEN, ADMIN_USER, TENANT_A);
  authorityRepo.addSession(PLAIN_TOKEN, PLAIN_USER, TENANT_A);
  authorityRepo.addSession(OTHER_TENANT_TOKEN, "other-user", "tenant-b");
  authorityRepo.roleAssignments.set("seed", {
    id: "seed",
    tenant_id: TENANT_A,
    user_id: ADMIN_USER,
    role_id: "role.platform_administrator",
    department_id: null,
    valid_from: "2000-01-01T00:00:00.000Z",
    valid_to: null,
  });
  authorityRepo.roleAssignments.set("seed-other", {
    id: "seed-other",
    tenant_id: "tenant-b",
    user_id: "other-user",
    role_id: "role.platform_administrator",
    department_id: null,
    valid_from: "2000-01-01T00:00:00.000Z",
    valid_to: null,
  });
  authorityRepo.grantPermission("role.platform_administrator", "tenancy.project.manage");

  const projectsRepo = new FakeProjectsRepository();
  projectsRepo.addSession(ADMIN_TOKEN, TENANT_A);
  projectsRepo.addSession(PLAIN_TOKEN, TENANT_A);
  projectsRepo.addSession(OTHER_TENANT_TOKEN, "tenant-b");

  const app = buildApp({
    getAuthorityRepository: () => authorityRepo,
    getProjectsRepository: () => projectsRepo,
  });
  return { app, authorityRepo, projectsRepo };
}

describe("POST /projects", () => {
  it("201s for a caller with tenancy.project.manage and persists the FR-PROJ-002 fields", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({
      method: "POST",
      url: "/projects",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        companyId: "company-1",
        name: "A Tower",
        clientName: "Acme Developer",
        budgetAmount: 1_000_000,
        budgetCurrency: "AED",
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.project.name).toBe("A Tower");
    expect(body.project.client_name).toBe("Acme Developer");
    expect(body.project.budget_amount).toBe(1_000_000);
  });

  it("403s without tenancy.project.manage", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({
      method: "POST",
      url: "/projects",
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { companyId: "company-1", name: "Should not be created" },
    });

    expect(response.statusCode).toBe(403);
  });

  it("401s with no bearer token", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({ method: "POST", url: "/projects", payload: {} });

    expect(response.statusCode).toBe(401);
  });

  it("400s when companyId or name is missing", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({
      method: "POST",
      url: "/projects",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { companyId: "company-1" },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe("GET/PATCH /projects/:id", () => {
  it("a project is invisible and unpatchable from another tenant", async () => {
    const { app } = appWithFakeRepos();
    const created = await app.inject({
      method: "POST",
      url: "/projects",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { companyId: "company-1", name: "A Tower" },
    });
    const projectId = created.json().project.id;

    const getResponse = await app.inject({
      method: "GET",
      url: `/projects/${projectId}`,
      headers: { authorization: `Bearer ${OTHER_TENANT_TOKEN}` },
    });
    expect(getResponse.statusCode).toBe(404);

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/projects/${projectId}`,
      headers: { authorization: `Bearer ${OTHER_TENANT_TOKEN}` },
      payload: { name: "Hijacked" },
    });
    expect(patchResponse.statusCode).toBe(404);
  });

  it("PATCH updates only the fields supplied", async () => {
    const { app } = appWithFakeRepos();
    const created = await app.inject({
      method: "POST",
      url: "/projects",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { companyId: "company-1", name: "A Tower" },
    });
    const projectId = created.json().project.id;

    const response = await app.inject({
      method: "PATCH",
      url: `/projects/${projectId}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { budgetAmount: 2_000_000, budgetCurrency: "AED" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.project.budget_amount).toBe(2_000_000);
    expect(body.project.name).toBe("A Tower");
  });
});

describe("GET /projects", () => {
  it("lists only the caller's own tenant's projects", async () => {
    const { app } = appWithFakeRepos();
    await app.inject({
      method: "POST",
      url: "/projects",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { companyId: "company-1", name: "A Tower" },
    });
    await app.inject({
      method: "POST",
      url: "/projects",
      headers: { authorization: `Bearer ${OTHER_TENANT_TOKEN}` },
      payload: { companyId: "company-2", name: "B Tower" },
    });

    const response = await app.inject({
      method: "GET",
      url: "/projects",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });

    const projects = response.json().projects;
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("A Tower");
  });
});

describe("POST/GET /project-types", () => {
  it("creates and lists a tenant-scoped project type", async () => {
    const { app } = appWithFakeRepos();

    const created = await app.inject({
      method: "POST",
      url: "/project-types",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { name: "Residential", code: "RES" },
    });
    expect(created.statusCode).toBe(201);

    const listed = await app.inject({
      method: "GET",
      url: "/project-types",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(listed.json().projectTypes).toHaveLength(1);
  });

  it("403s creating a project type without tenancy.project.manage", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({
      method: "POST",
      url: "/project-types",
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { name: "Should not be created" },
    });

    expect(response.statusCode).toBe(403);
  });
});
