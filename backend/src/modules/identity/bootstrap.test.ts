import { beforeEach, describe, expect, it } from "vitest";
import { type BootstrapRepository, bootstrapFirstAdmin } from "./bootstrap.js";

class FakeBootstrapRepository implements BootstrapRepository {
  tenants = new Map<string, { id: string; name: string }>();
  appUsers = new Map<string, { id: string; tenant_id: string | null; email: string }>();
  authUsers = new Set<string>();
  roleAssignments: { tenant_id: string; user_id: string; role_id: string }[] = [];
  auditLog: { user_id: string | null; event_type: string; metadata: Record<string, unknown> }[] = [];
  private nextId = 1;

  async findTenantByName(name: string) {
    for (const tenant of this.tenants.values()) if (tenant.name === name) return tenant;
    return null;
  }

  async insertTenant(name: string) {
    const tenant = { id: `tenant-${this.nextId++}`, name };
    this.tenants.set(tenant.id, tenant);
    return tenant;
  }

  async findAppUserByEmail(email: string) {
    for (const user of this.appUsers.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) return { id: user.id, tenant_id: user.tenant_id };
    }
    return null;
  }

  async createAuthUser(email: string, _password: string) {
    const id = `user-${this.nextId++}`;
    this.authUsers.add(id);
    return { id };
  }

  async insertAppUser(input: { id: string; email: string; display_name: string | null; tenant_id: string }) {
    this.appUsers.set(input.id, { id: input.id, tenant_id: input.tenant_id, email: input.email });
  }

  async findRoleAssignment(tenantId: string, userId: string, roleId: string) {
    const match = this.roleAssignments.find(
      (row) => row.tenant_id === tenantId && row.user_id === userId && row.role_id === roleId,
    );
    return match ? { id: `${match.tenant_id}:${match.user_id}:${match.role_id}` } : null;
  }

  async insertRoleAssignment(input: { tenant_id: string; user_id: string; role_id: string }) {
    this.roleAssignments.push(input);
  }

  async insertAuditEvent(userId: string | null, eventType: string, metadata: Record<string, unknown>) {
    this.auditLog.push({ user_id: userId, event_type: eventType, metadata });
  }
}

describe("bootstrapFirstAdmin", () => {
  let repo: FakeBootstrapRepository;

  beforeEach(() => {
    repo = new FakeBootstrapRepository();
  });

  const input = { email: "owner@sevents.test", password: "correct-horse-battery-staple", tenantName: "Acme" };

  it("creates a tenant, an active app user, and the platform_administrator role assignment", async () => {
    const result = await bootstrapFirstAdmin(repo, input);

    expect(result.created).toBe(true);
    expect(repo.tenants.size).toBe(1);
    expect(repo.appUsers.get(result.userId)?.email).toBe(input.email);
    expect(repo.roleAssignments).toEqual([
      { tenant_id: result.tenantId, user_id: result.userId, role_id: "role.platform_administrator" },
    ]);
    expect(repo.auditLog.map((e) => e.event_type)).toEqual(["invited", "invite_accepted", "role_assignment_created"]);
  });

  it("is idempotent: re-running with the same email/tenant does not duplicate anything", async () => {
    const first = await bootstrapFirstAdmin(repo, input);
    const second = await bootstrapFirstAdmin(repo, input);

    expect(second.userId).toBe(first.userId);
    expect(second.tenantId).toBe(first.tenantId);
    expect(second.created).toBe(false);
    expect(repo.appUsers.size).toBe(1);
    expect(repo.tenants.size).toBe(1);
    expect(repo.roleAssignments).toHaveLength(1);
    expect(repo.auditLog.filter((e) => e.event_type === "role_assignment_created")).toHaveLength(1);
  });

  it("reuses an existing tenant by name instead of creating a second one", async () => {
    await repo.insertTenant("Acme");

    const result = await bootstrapFirstAdmin(repo, input);

    expect(repo.tenants.size).toBe(1);
    expect(result.tenantId).toBe([...repo.tenants.values()][0]?.id);
  });

  it("grants the role assignment to a pre-existing app user without creating a duplicate auth user", async () => {
    const tenant = await repo.insertTenant("Acme");
    await repo.insertAppUser({ id: "existing-user", email: input.email, display_name: null, tenant_id: tenant.id });

    const result = await bootstrapFirstAdmin(repo, input);

    expect(result.userId).toBe("existing-user");
    expect(repo.authUsers.size).toBe(0);
    expect(repo.roleAssignments).toEqual([
      { tenant_id: tenant.id, user_id: "existing-user", role_id: "role.platform_administrator" },
    ]);
  });
});
