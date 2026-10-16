import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeWorkforceRepository } from "../../test/fakeWorkforceRepository.js";

const ADMIN_TOKEN = "admin-token";
const ADMIN_USER = "admin-user";
const TENANT_ID = "tenant-a";
const PLAIN_TOKEN = "plain-token";
const PLAIN_USER = "plain-user";

function appWithFakeRepos() {
  const authorityRepo = new FakeAuthorityRepository();
  authorityRepo.addSession(ADMIN_TOKEN, ADMIN_USER, TENANT_ID);
  authorityRepo.addSession(PLAIN_TOKEN, PLAIN_USER, TENANT_ID);
  authorityRepo.roleAssignments.set("seed", {
    id: "seed",
    tenant_id: TENANT_ID,
    user_id: ADMIN_USER,
    role_id: "role.platform_administrator",
    department_id: null,
    valid_from: "2000-01-01T00:00:00.000Z",
    valid_to: null,
  });
  authorityRepo.grantPermission("role.platform_administrator", "employee.directory.manage");

  const workforceRepo = new FakeWorkforceRepository();
  workforceRepo.addSession(ADMIN_TOKEN, ADMIN_USER, TENANT_ID);
  workforceRepo.addSession(PLAIN_TOKEN, PLAIN_USER, TENANT_ID);

  const app = buildApp({
    getAuthorityRepository: () => authorityRepo,
    getWorkforceRepository: () => workforceRepo,
  });
  return { app, authorityRepo, workforceRepo };
}

describe("POST /employees", () => {
  it("201s for a caller with employee.directory.manage", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({
      method: "POST",
      url: "/employees",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { companyId: "company-1", employeeCode: "EMP-100", fullName: "Alice" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().employee.full_name).toBe("Alice");
  });

  it("403s without the permission", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({
      method: "POST",
      url: "/employees",
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { companyId: "company-1", employeeCode: "EMP-101", fullName: "Should not be created" },
    });

    expect(response.statusCode).toBe(403);
  });
});

describe("PATCH /employees/:id", () => {
  it("links an existing employee to an app user, 403s without the permission", async () => {
    const { app, workforceRepo } = appWithFakeRepos();
    const created = await workforceRepo.createEmployeeRecord(ADMIN_TOKEN, {
      company_id: "company-1",
      employee_code: "EMP-200",
      full_name: "Bob",
      app_user_id: null,
      department_id: null,
      reporting_role_id: null,
      emergency_contact_name: null,
      emergency_contact_phone: null,
      onboarded_at: null,
    });

    const forbidden = await app.inject({
      method: "PATCH",
      url: `/employees/${created.id}`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { appUserId: "auth-user-1" },
    });
    expect(forbidden.statusCode).toBe(403);

    const response = await app.inject({
      method: "PATCH",
      url: `/employees/${created.id}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { appUserId: "auth-user-1" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().employee.app_user_id).toBe("auth-user-1");
  });
});

describe("GET /employees", () => {
  it("lists employees in the caller's tenant, filterable by department, 403s without the permission", async () => {
    const { app, workforceRepo } = appWithFakeRepos();
    await workforceRepo.createEmployeeRecord(ADMIN_TOKEN, {
      company_id: "company-1",
      employee_code: "EMP-200",
      full_name: "Bea",
      department_id: "dept-1",
    });
    await workforceRepo.createEmployeeRecord(ADMIN_TOKEN, {
      company_id: "company-1",
      employee_code: "EMP-201",
      full_name: "Amir",
      department_id: "dept-2",
    });

    const other = "other-tenant-token";
    workforceRepo.addSession(other, "other-user", "tenant-b");
    await workforceRepo.createEmployeeRecord(other, {
      company_id: "company-9",
      employee_code: "EMP-900",
      full_name: "Outside",
    });

    const list = await app.inject({
      method: "GET",
      url: "/employees",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(list.statusCode).toBe(200);
    const names = list.json().employees.map((e: { full_name: string }) => e.full_name);
    expect(names).toEqual(["Amir", "Bea"]);

    const filtered = await app.inject({
      method: "GET",
      url: "/employees?departmentId=dept-1",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(filtered.statusCode).toBe(200);
    expect(filtered.json().employees.map((e: { full_name: string }) => e.full_name)).toEqual(["Bea"]);

    const forbidden = await app.inject({
      method: "GET",
      url: "/employees",
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
    });
    expect(forbidden.statusCode).toBe(403);
  });
});

describe("GET /employees/me", () => {
  it("returns the caller's own record without employee.directory.manage", async () => {
    const { app, workforceRepo } = appWithFakeRepos();
    workforceRepo.addSession("alice-token", "alice", TENANT_ID);
    await workforceRepo.createEmployeeRecord(ADMIN_TOKEN, {
      company_id: "company-1",
      employee_code: "EMP-102",
      full_name: "Alice",
      app_user_id: "alice",
    });

    const response = await app.inject({
      method: "GET",
      url: "/employees/me",
      headers: { authorization: "Bearer alice-token" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().employee.full_name).toBe("Alice");
  });

  it("401s with no bearer token", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({ method: "GET", url: "/employees/me" });

    expect(response.statusCode).toBe(401);
  });
});

describe("GET /employees/:id", () => {
  it("403s reading another employee's record without the permission", async () => {
    const { app, workforceRepo } = appWithFakeRepos();
    const employee = await workforceRepo.createEmployeeRecord(ADMIN_TOKEN, {
      company_id: "company-1",
      employee_code: "EMP-103",
      full_name: "Bob",
    });

    const response = await app.inject({
      method: "GET",
      url: `/employees/${employee.id}`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it("200s reading an employee's record with the permission", async () => {
    const { app, workforceRepo } = appWithFakeRepos();
    const employee = await workforceRepo.createEmployeeRecord(ADMIN_TOKEN, {
      company_id: "company-1",
      employee_code: "EMP-104",
      full_name: "Carol",
    });

    const response = await app.inject({
      method: "GET",
      url: `/employees/${employee.id}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().employee.full_name).toBe("Carol");
  });

  it("404s a record from another tenant even with the permission", async () => {
    const { app, authorityRepo, workforceRepo } = appWithFakeRepos();
    authorityRepo.addSession("other-tenant-admin-token", "other-tenant-admin", "tenant-b");
    authorityRepo.roleAssignments.set("seed-other", {
      id: "seed-other",
      tenant_id: "tenant-b",
      user_id: "other-tenant-admin",
      role_id: "role.platform_administrator",
      department_id: null,
      valid_from: "2000-01-01T00:00:00.000Z",
      valid_to: null,
    });
    workforceRepo.addSession("other-tenant-admin-token", "other-tenant-admin", "tenant-b");
    const employee = await workforceRepo.createEmployeeRecord(ADMIN_TOKEN, {
      company_id: "company-1",
      employee_code: "EMP-105",
      full_name: "Dan",
    });

    const response = await app.inject({
      method: "GET",
      url: `/employees/${employee.id}`,
      headers: { authorization: "Bearer other-tenant-admin-token" },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe("POST /employees/:id/project-allocations", () => {
  it("201s and creates an effective-dated allocation", async () => {
    const { app, workforceRepo } = appWithFakeRepos();
    const employee = await workforceRepo.createEmployeeRecord(ADMIN_TOKEN, {
      company_id: "company-1",
      employee_code: "EMP-106",
      full_name: "Eve",
    });

    const response = await app.inject({
      method: "POST",
      url: `/employees/${employee.id}/project-allocations`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { projectId: "project-1", siteAssignment: "Tower A" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().allocation.project_id).toBe("project-1");
  });
});
