import { beforeEach, describe, expect, it } from "vitest";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import {
  CrossTenantError,
  assignRole,
  checkSegregationOfDuties,
  createApprovalLimit,
  createDelegation,
  createDepartment,
  getEffectivePermissions,
  isWithinApprovalLimit,
} from "./service.js";

describe("getEffectivePermissions", () => {
  let repo: FakeAuthorityRepository;
  const TENANT = "tenant-a";
  const TOKEN = "token-a";
  const ADMIN = "admin-user";
  const ALICE = "alice";
  const BOB = "bob";

  beforeEach(() => {
    repo = new FakeAuthorityRepository();
    repo.addSession(TOKEN, ADMIN, TENANT);
    repo.setUserTenant(ALICE, TENANT);
    repo.setUserTenant(BOB, TENANT);
    repo.grantPermission("role.storekeeper", "tenancy.project.manage");
  });

  it("includes permissions from a currently-active role assignment", async () => {
    repo.roleAssignments.set("ra-1", {
      id: "ra-1",
      tenant_id: TENANT,
      user_id: ALICE,
      role_id: "role.storekeeper",
      department_id: null,
      valid_from: "2026-01-01T00:00:00.000Z",
      valid_to: null,
    });

    const permissions = await getEffectivePermissions(repo, ALICE, TENANT, "2026-06-01T00:00:00.000Z");

    expect(permissions.has("tenancy.project.manage")).toBe(true);
  });

  it("excludes a role assignment that hasn't started yet", async () => {
    repo.roleAssignments.set("ra-future", {
      id: "ra-future",
      tenant_id: TENANT,
      user_id: ALICE,
      role_id: "role.storekeeper",
      department_id: null,
      valid_from: "2027-01-01T00:00:00.000Z",
      valid_to: null,
    });

    const permissions = await getEffectivePermissions(repo, ALICE, TENANT, "2026-06-01T00:00:00.000Z");

    expect(permissions.has("tenancy.project.manage")).toBe(false);
  });

  it("excludes a role assignment that has already ended", async () => {
    repo.roleAssignments.set("ra-ended", {
      id: "ra-ended",
      tenant_id: TENANT,
      user_id: ALICE,
      role_id: "role.storekeeper",
      department_id: null,
      valid_from: "2025-01-01T00:00:00.000Z",
      valid_to: "2025-06-01T00:00:00.000Z",
    });

    const permissions = await getEffectivePermissions(repo, ALICE, TENANT, "2026-06-01T00:00:00.000Z");

    expect(permissions.has("tenancy.project.manage")).toBe(false);
  });

  it("includes permissions a deputy holds via an active delegation", async () => {
    repo.roleAssignments.set("ra-alice", {
      id: "ra-alice",
      tenant_id: TENANT,
      user_id: ALICE,
      role_id: "role.storekeeper",
      department_id: null,
      valid_from: "2026-01-01T00:00:00.000Z",
      valid_to: null,
    });
    repo.delegations.set("delegation-1", {
      id: "delegation-1",
      tenant_id: TENANT,
      role_assignment_id: "ra-alice",
      delegate_user_id: BOB,
      valid_from: "2026-06-01T00:00:00.000Z",
      valid_to: "2026-06-10T00:00:00.000Z",
      reason: "annual leave",
    });

    const duringDelegation = await getEffectivePermissions(repo, BOB, TENANT, "2026-06-05T00:00:00.000Z");
    const afterDelegation = await getEffectivePermissions(repo, BOB, TENANT, "2026-07-01T00:00:00.000Z");

    expect(duringDelegation.has("tenancy.project.manage")).toBe(true);
    expect(afterDelegation.has("tenancy.project.manage")).toBe(false);
  });
});

describe("assignRole cross-tenant guard", () => {
  it("refuses to assign a role to a user outside the caller's own tenant", async () => {
    const repo = new FakeAuthorityRepository();
    repo.addSession("token-a", "admin-a", "tenant-a");
    repo.setUserTenant("bob-in-tenant-b", "tenant-b");

    await expect(
      assignRole(repo, "token-a", "admin-a", { userId: "bob-in-tenant-b", roleId: "role.storekeeper" }),
    ).rejects.toThrow(CrossTenantError);
  });

  it("assigns the role when the target user is in the caller's own tenant", async () => {
    const repo = new FakeAuthorityRepository();
    repo.addSession("token-a", "admin-a", "tenant-a");
    repo.setUserTenant("alice", "tenant-a");

    const assignment = await assignRole(repo, "token-a", "admin-a", {
      userId: "alice",
      roleId: "role.storekeeper",
    });

    expect(assignment.tenant_id).toBe("tenant-a");
    expect(repo.auditLog).toContainEqual(
      expect.objectContaining({ userId: "admin-a", eventType: "role_assignment_created" }),
    );
  });
});

describe("isWithinApprovalLimit", () => {
  it("denies by default when no matching ApprovalLimit row exists", async () => {
    const repo = new FakeAuthorityRepository();

    const allowed = await isWithinApprovalLimit(
      repo,
      "tenant-a",
      { roleId: "role.quantity_surveyor", departmentId: null, currency: "AED" },
      1,
    );

    expect(allowed).toBe(false);
  });

  it("allows only up to the seeded max_value, never beyond it", async () => {
    const repo = new FakeAuthorityRepository();
    repo.addSession("token-a", "admin-a", "tenant-a");
    await createApprovalLimit(repo, "token-a", "admin-a", {
      roleId: "role.quantity_surveyor",
      currency: "AED",
      maxValue: 5000,
    });

    const withinLimit = await isWithinApprovalLimit(
      repo,
      "tenant-a",
      { roleId: "role.quantity_surveyor", departmentId: null, currency: "AED" },
      5000,
    );
    const overLimit = await isWithinApprovalLimit(
      repo,
      "tenant-a",
      { roleId: "role.quantity_surveyor", departmentId: null, currency: "AED" },
      5000.01,
    );

    expect(withinLimit).toBe(true);
    expect(overLimit).toBe(false);
  });
});

describe("audit trail", () => {
  it("writes an audit row for department/delegation creation", async () => {
    const repo = new FakeAuthorityRepository();
    repo.addSession("token-a", "admin-a", "tenant-a");

    repo.setUserTenant("alice", "tenant-a");

    const department = await createDepartment(repo, "token-a", "admin-a", {
      company_id: "company-1",
      name: "Site Operations",
    });
    const assignment = await assignRole(repo, "token-a", "admin-a", {
      userId: "alice",
      roleId: "role.storekeeper",
    });
    await createDelegation(repo, "token-a", "admin-a", {
      roleAssignmentId: assignment.id,
      delegateUserId: "bob",
    });

    expect(repo.auditLog.map((entry) => entry.eventType)).toEqual(
      expect.arrayContaining(["department_created", "role_assignment_created", "delegation_created"]),
    );
    expect(department.name).toBe("Site Operations");
  });
});

describe("checkSegregationOfDuties", () => {
  it("is a no-op when the policy is not enforced (default, unexercised state)", () => {
    expect(checkSegregationOfDuties({ enforced: false }, "same-user", "same-user")).toBe(true);
  });

  it("denies the same actor as both requester and approver once enforced", () => {
    expect(checkSegregationOfDuties({ enforced: true }, "same-user", "same-user")).toBe(false);
  });

  it("allows distinct requester/approver once enforced", () => {
    expect(checkSegregationOfDuties({ enforced: true }, "requester", "approver")).toBe(true);
  });
});
