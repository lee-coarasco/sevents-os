import { beforeEach, describe, expect, it } from "vitest";
import { FakeWorkforceRepository } from "../../test/fakeWorkforceRepository.js";
import {
  NotFoundError,
  addEmployeeCertification,
  addEmployeeSkill,
  addTrainingRecord,
  createEmployeeRecord,
  createProjectAllocation,
  deactivateEmployeeRecord,
  getOwnEmployeeRecord,
  isCertificationExpired,
  listActiveProjectAllocations,
  updateEmployeeRecord,
} from "./service.js";

describe("employee record CRUD", () => {
  let repo: FakeWorkforceRepository;
  const TOKEN = "token-a";
  const TENANT = "tenant-a";

  beforeEach(() => {
    repo = new FakeWorkforceRepository();
    repo.addSession(TOKEN, "admin-a", TENANT);
  });

  it("creates an employee record", async () => {
    const employee = await createEmployeeRecord(repo, TOKEN, {
      company_id: "company-1",
      employee_code: "EMP-001",
      full_name: "Alice Site Engineer",
    });

    expect(employee.employment_status).toBe("active");
    expect(employee.tenant_id).toBe(TENANT);
  });

  it("updates an employee record", async () => {
    const employee = await createEmployeeRecord(repo, TOKEN, {
      company_id: "company-1",
      employee_code: "EMP-002",
      full_name: "Bob Storekeeper",
    });

    const updated = await updateEmployeeRecord(repo, TOKEN, employee.id, { full_name: "Bob K. Storekeeper" });

    expect(updated.full_name).toBe("Bob K. Storekeeper");
  });

  it("throws NotFoundError updating a record outside the caller's tenant", async () => {
    repo.addSession("token-b", "admin-b", "tenant-b");
    const employee = await createEmployeeRecord(repo, TOKEN, {
      company_id: "company-1",
      employee_code: "EMP-003",
      full_name: "Carol",
    });

    await expect(updateEmployeeRecord(repo, "token-b", employee.id, { full_name: "x" })).rejects.toThrow(
      NotFoundError,
    );
  });

  it("deactivates an employee, setting status to offboarded", async () => {
    const employee = await createEmployeeRecord(repo, TOKEN, {
      company_id: "company-1",
      employee_code: "EMP-004",
      full_name: "Dan Foreman",
    });

    const deactivated = await deactivateEmployeeRecord(repo, TOKEN, employee.id);

    expect(deactivated.employment_status).toBe("offboarded");
    expect(deactivated.offboarded_at).not.toBeNull();
  });
});

describe("self-service own employee record", () => {
  it("returns the caller's own record", async () => {
    const repo = new FakeWorkforceRepository();
    repo.addSession("admin-token", "admin-a", "tenant-a");
    repo.addSession("alice-token", "alice", "tenant-a");

    await createEmployeeRecord(repo, "admin-token", {
      company_id: "company-1",
      employee_code: "EMP-005",
      full_name: "Alice",
      app_user_id: "alice",
    });

    const own = await getOwnEmployeeRecord(repo, "alice-token");

    expect(own?.full_name).toBe("Alice");
  });

  it("returns null when the caller has no linked employee record", async () => {
    const repo = new FakeWorkforceRepository();
    repo.addSession("bob-token", "bob", "tenant-a");

    const own = await getOwnEmployeeRecord(repo, "bob-token");

    expect(own).toBeNull();
  });

  it("does not return another tenant's employee record", async () => {
    const repo = new FakeWorkforceRepository();
    repo.addSession("admin-a-token", "admin-a", "tenant-a");
    repo.addSession("alice-token-tenant-b", "alice", "tenant-b");

    await createEmployeeRecord(repo, "admin-a-token", {
      company_id: "company-1",
      employee_code: "EMP-006",
      full_name: "Alice In Tenant A",
      app_user_id: "alice",
    });

    const own = await getOwnEmployeeRecord(repo, "alice-token-tenant-b");

    expect(own).toBeNull();
  });
});

describe("skills, certifications and training", () => {
  let repo: FakeWorkforceRepository;
  const TOKEN = "token-a";

  beforeEach(() => {
    repo = new FakeWorkforceRepository();
    repo.addSession(TOKEN, "admin-a", "tenant-a");
  });

  it("attaches a skill to an employee", async () => {
    const employee = await createEmployeeRecord(repo, TOKEN, {
      company_id: "company-1",
      employee_code: "EMP-007",
      full_name: "Eve",
    });

    const employeeSkill = await addEmployeeSkill(repo, TOKEN, {
      employeeId: employee.id,
      skillName: "Rebar fixing",
    });

    expect(employeeSkill.employee_id).toBe(employee.id);
    expect(repo.skills.get(employeeSkill.skill_id)?.name).toBe("Rebar fixing");
  });

  it("attaches a training record to an employee", async () => {
    const employee = await createEmployeeRecord(repo, TOKEN, {
      company_id: "company-1",
      employee_code: "EMP-008",
      full_name: "Frank",
    });

    const trainingRecord = await addTrainingRecord(repo, TOKEN, {
      employeeId: employee.id,
      courseName: "Scaffolding safety",
      completedAt: "2026-01-15",
      result: "pass",
    });

    expect(trainingRecord.course_name).toBe("Scaffolding safety");
  });

  it("attaches a certification and computes expiry correctly", async () => {
    const employee = await createEmployeeRecord(repo, TOKEN, {
      company_id: "company-1",
      employee_code: "EMP-009",
      full_name: "Grace",
    });

    const stillValid = await addEmployeeCertification(repo, TOKEN, {
      employeeId: employee.id,
      certificationName: "First Aid",
      issuedAt: "2026-01-01",
      expiresAt: "2027-01-01",
    });
    const expired = await addEmployeeCertification(repo, TOKEN, {
      employeeId: employee.id,
      certificationName: "Scaffolding License",
      issuedAt: "2024-01-01",
      expiresAt: "2025-01-01",
    });
    const neverExpires = await addEmployeeCertification(repo, TOKEN, {
      employeeId: employee.id,
      certificationName: "Trade Licence",
      issuedAt: "2020-01-01",
    });

    const atIso = "2026-06-01T00:00:00.000Z";
    expect(isCertificationExpired(stillValid.expires_at, atIso)).toBe(false);
    expect(isCertificationExpired(expired.expires_at, atIso)).toBe(true);
    expect(isCertificationExpired(neverExpires.expires_at, atIso)).toBe(false);
  });
});

describe("effective-dated project allocations", () => {
  let repo: FakeWorkforceRepository;
  const TOKEN = "token-a";
  const TENANT = "tenant-a";

  beforeEach(() => {
    repo = new FakeWorkforceRepository();
    repo.addSession(TOKEN, "admin-a", TENANT);
  });

  it("includes only the allocation active at the query time, among past/current/future windows", async () => {
    const employee = await createEmployeeRecord(repo, TOKEN, {
      company_id: "company-1",
      employee_code: "EMP-010",
      full_name: "Hassan",
    });

    const past = await createProjectAllocation(repo, TOKEN, {
      employeeId: employee.id,
      projectId: "project-past",
      validFrom: "2025-01-01T00:00:00.000Z",
      validTo: "2025-06-01T00:00:00.000Z",
      createdBy: "admin-a",
    });
    const current = await createProjectAllocation(repo, TOKEN, {
      employeeId: employee.id,
      projectId: "project-current",
      validFrom: "2026-01-01T00:00:00.000Z",
      validTo: null,
      createdBy: "admin-a",
    });
    const future = await createProjectAllocation(repo, TOKEN, {
      employeeId: employee.id,
      projectId: "project-future",
      validFrom: "2027-01-01T00:00:00.000Z",
      validTo: null,
      createdBy: "admin-a",
    });

    const active = await listActiveProjectAllocations(repo, TENANT, employee.id, "2026-06-01T00:00:00.000Z");

    expect(active.map((allocation) => allocation.id)).toEqual([current.id]);
    expect(active.map((allocation) => allocation.id)).not.toContain(past.id);
    expect(active.map((allocation) => allocation.id)).not.toContain(future.id);
  });
});
