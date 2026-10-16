import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";

const TOKEN = "admin-token";
const USER_ID = "admin-user";
const TENANT_ID = "tenant-a";

function appWithFakeRepo() {
  const authorityRepo = new FakeAuthorityRepository();
  authorityRepo.addSession(TOKEN, USER_ID, TENANT_ID);
  authorityRepo.roleAssignments.set("seed", {
    id: "seed",
    tenant_id: TENANT_ID,
    user_id: USER_ID,
    role_id: "role.platform_administrator",
    department_id: null,
    valid_from: "2000-01-01T00:00:00.000Z",
    valid_to: null,
  });
  for (const permission of [
    "authority.department.manage",
    "authority.role_assignment.manage",
    "authority.delegation.manage",
    "authority.approval_limit.manage",
  ]) {
    authorityRepo.grantPermission("role.platform_administrator", permission);
  }
  const app = buildApp({ getAuthorityRepository: () => authorityRepo });
  return { app, authorityRepo };
}

describe("POST /authority/departments", () => {
  it("201s and audits for a caller with authority.department.manage", async () => {
    const { app, authorityRepo } = appWithFakeRepo();

    const response = await app.inject({
      method: "POST",
      url: "/authority/departments",
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { companyId: "company-1", name: "Site Operations" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().department.name).toBe("Site Operations");
    expect(authorityRepo.auditLog.some((e) => e.eventType === "department_created")).toBe(true);
  });

  it("403s without the permission", async () => {
    const { app, authorityRepo } = appWithFakeRepo();
    authorityRepo.addSession("plain-token", "plain-user", TENANT_ID);

    const response = await app.inject({
      method: "POST",
      url: "/authority/departments",
      headers: { authorization: "Bearer plain-token" },
      payload: { companyId: "company-1", name: "Should not be created" },
    });

    expect(response.statusCode).toBe(403);
  });
});

describe("POST /authority/role-assignments", () => {
  it("201s when the target user is in the caller's own tenant", async () => {
    const { app, authorityRepo } = appWithFakeRepo();
    authorityRepo.setUserTenant("alice", TENANT_ID);

    const response = await app.inject({
      method: "POST",
      url: "/authority/role-assignments",
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { userId: "alice", roleId: "role.storekeeper" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().roleAssignment.user_id).toBe("alice");
  });

  it("403s cross-tenant role assignment attempts", async () => {
    const { app, authorityRepo } = appWithFakeRepo();
    authorityRepo.setUserTenant("bob", "tenant-b");

    const response = await app.inject({
      method: "POST",
      url: "/authority/role-assignments",
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { userId: "bob", roleId: "role.storekeeper" },
    });

    expect(response.statusCode).toBe(403);
  });
});

describe("GET /authority/departments", () => {
  it("400s without companyId", async () => {
    const { app } = appWithFakeRepo();
    const response = await app.inject({
      method: "GET",
      url: "/authority/departments",
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(response.statusCode).toBe(400);
  });

  it("401s with no bearer token", async () => {
    const { app } = appWithFakeRepo();
    const response = await app.inject({ method: "GET", url: "/authority/departments?companyId=company-1" });
    expect(response.statusCode).toBe(401);
  });

  it("lists departments for a company, isolated by tenant", async () => {
    const { app, authorityRepo } = appWithFakeRepo();
    authorityRepo.addSession("token-b", "user-b", "tenant-b");

    await app.inject({
      method: "POST",
      url: "/authority/departments",
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { companyId: "company-1", name: "Site Operations" },
    });
    await app.inject({
      method: "POST",
      url: "/authority/departments",
      headers: { authorization: "Bearer token-b" },
      payload: { companyId: "company-1", name: "Should not be visible to tenant-a" },
    });

    const response = await app.inject({
      method: "GET",
      url: "/authority/departments?companyId=company-1",
      headers: { authorization: `Bearer ${TOKEN}` },
    });

    expect(response.statusCode).toBe(200);
    const departments = response.json().departments;
    expect(departments).toHaveLength(1);
    expect(departments[0].name).toBe("Site Operations");
  });
});

describe("GET /authority/roles", () => {
  it("401s with no bearer token", async () => {
    const { app } = appWithFakeRepo();
    const response = await app.inject({ method: "GET", url: "/authority/roles" });
    expect(response.statusCode).toBe(401);
  });

  it("returns platform-wide roles plus the caller's own tenant's roles, never another tenant's", async () => {
    const { app, authorityRepo } = appWithFakeRepo();
    authorityRepo.roleDefinitions.set("role.platform_administrator", {
      id: "role.platform_administrator",
      tenant_id: null,
      label: "Platform Administrator",
      is_platform_role: true,
    });
    authorityRepo.roleDefinitions.set("custom-a", {
      id: "custom-a",
      tenant_id: TENANT_ID,
      label: "Tenant A custom role",
      is_platform_role: false,
    });
    authorityRepo.roleDefinitions.set("custom-b", {
      id: "custom-b",
      tenant_id: "tenant-b",
      label: "Tenant B custom role",
      is_platform_role: false,
    });

    const response = await app.inject({
      method: "GET",
      url: "/authority/roles",
      headers: { authorization: `Bearer ${TOKEN}` },
    });

    expect(response.statusCode).toBe(200);
    const roleIds = response.json().roles.map((r: { id: string }) => r.id);
    expect(roleIds).toEqual(expect.arrayContaining(["role.platform_administrator", "custom-a"]));
    expect(roleIds).not.toContain("custom-b");
  });
});

describe("GET /authority/role-assignments", () => {
  it("401s with no bearer token", async () => {
    const { app } = appWithFakeRepo();
    const response = await app.inject({ method: "GET", url: "/authority/role-assignments" });
    expect(response.statusCode).toBe(401);
  });

  it("lists role assignments for the caller's tenant, filterable by userId", async () => {
    const { app, authorityRepo } = appWithFakeRepo();
    authorityRepo.setUserTenant("alice", TENANT_ID);
    authorityRepo.setUserTenant("carol", TENANT_ID);

    await app.inject({
      method: "POST",
      url: "/authority/role-assignments",
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { userId: "alice", roleId: "role.storekeeper" },
    });
    await app.inject({
      method: "POST",
      url: "/authority/role-assignments",
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { userId: "carol", roleId: "role.accountant" },
    });

    const all = await app.inject({
      method: "GET",
      url: "/authority/role-assignments",
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(all.statusCode).toBe(200);
    // seed row (admin) + alice + carol
    expect(all.json().roleAssignments).toHaveLength(3);

    const filtered = await app.inject({
      method: "GET",
      url: "/authority/role-assignments?userId=alice",
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(filtered.statusCode).toBe(200);
    const assignments = filtered.json().roleAssignments;
    expect(assignments).toHaveLength(1);
    expect(assignments[0].user_id).toBe("alice");
  });
});

describe("GET /authority/effective-permissions", () => {
  it("returns the caller's own effective permissions with no extra permission required", async () => {
    const { app } = appWithFakeRepo();

    const response = await app.inject({
      method: "GET",
      url: "/authority/effective-permissions",
      headers: { authorization: `Bearer ${TOKEN}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().permissions).toEqual(
      expect.arrayContaining(["authority.department.manage"]),
    );
  });

  it("401s with no bearer token", async () => {
    const { app } = appWithFakeRepo();

    const response = await app.inject({ method: "GET", url: "/authority/effective-permissions" });

    expect(response.statusCode).toBe(401);
  });
});
