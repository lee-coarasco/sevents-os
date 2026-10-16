import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates the very first Platform Administrator for a brand-new Supabase
 * project: a tenant, an auth user, an app_users row, and the
 * role.platform_administrator role_assignment. This is the service-role
 * bootstrap step DECISIONS.md (2026-10-15 12:05 UTC) and tickets 0055/0056
 * already called for but never turned into a runnable procedure — ticket
 * 0093 is the owner asking for exactly this. `POST /identity/invite`
 * requires `identity.user.invite`, which nobody holds until this runs once;
 * there is deliberately no API path for it (same "admin operation, not
 * self-service" precedent as tenant creation).
 */
export interface BootstrapRepository {
  findTenantByName(name: string): Promise<{ id: string; name: string } | null>;
  insertTenant(name: string): Promise<{ id: string; name: string }>;
  findAppUserByEmail(email: string): Promise<{ id: string; tenant_id: string | null } | null>;
  createAuthUser(email: string, password: string): Promise<{ id: string }>;
  insertAppUser(input: {
    id: string;
    email: string;
    display_name: string | null;
    tenant_id: string;
  }): Promise<void>;
  findRoleAssignment(tenantId: string, userId: string, roleId: string): Promise<{ id: string } | null>;
  insertRoleAssignment(input: { tenant_id: string; user_id: string; role_id: string }): Promise<void>;
  insertAuditEvent(userId: string | null, eventType: string, metadata: Record<string, unknown>): Promise<void>;
}

export interface BootstrapInput {
  email: string;
  password: string;
  tenantName: string;
  displayName?: string | null;
}

export interface BootstrapResult {
  tenantId: string;
  userId: string;
  /** False if this user/tenant/role-assignment already existed — re-running is a safe no-op. */
  created: boolean;
}

const PLATFORM_ADMINISTRATOR_ROLE_ID = "role.platform_administrator";

export async function bootstrapFirstAdmin(
  repo: BootstrapRepository,
  input: BootstrapInput,
): Promise<BootstrapResult> {
  const tenant = (await repo.findTenantByName(input.tenantName)) ?? (await repo.insertTenant(input.tenantName));

  let created = false;
  let appUser = await repo.findAppUserByEmail(input.email);
  if (!appUser) {
    const authUser = await repo.createAuthUser(input.email, input.password);
    await repo.insertAppUser({
      id: authUser.id,
      email: input.email,
      display_name: input.displayName ?? null,
      tenant_id: tenant.id,
    });
    await repo.insertAuditEvent(authUser.id, "invited", { bootstrap: true });
    await repo.insertAuditEvent(authUser.id, "invite_accepted", { bootstrap: true });
    appUser = { id: authUser.id, tenant_id: tenant.id };
    created = true;
  }

  const existingAssignment = await repo.findRoleAssignment(tenant.id, appUser.id, PLATFORM_ADMINISTRATOR_ROLE_ID);
  if (!existingAssignment) {
    await repo.insertRoleAssignment({
      tenant_id: tenant.id,
      user_id: appUser.id,
      role_id: PLATFORM_ADMINISTRATOR_ROLE_ID,
    });
    await repo.insertAuditEvent(appUser.id, "role_assignment_created", {
      bootstrap: true,
      role_id: PLATFORM_ADMINISTRATOR_ROLE_ID,
    });
    created = true;
  }

  return { tenantId: tenant.id, userId: appUser.id, created };
}

/**
 * Supabase-backed implementation, service-role only (RLS has no
 * insert/update policy for tenants/app_users/role_assignments reachable by
 * anon/authenticated — see the ticket 0055/0056 migrations — so this must
 * bypass RLS, same as `createServiceClient()`'s doc comment says it's for).
 * Not exercised against a live Supabase project in this session (no
 * reachable credentials in this sandbox, same gap already flagged for
 * every other Supabase-backed repository in this codebase).
 */
export function createSupabaseBootstrapRepository(serviceClient: SupabaseClient): BootstrapRepository {
  return {
    async findTenantByName(name) {
      const { data, error } = await serviceClient.from("tenants").select("id, name").eq("name", name).maybeSingle();
      if (error) throw new Error(`findTenantByName: ${error.message}`);
      return (data as { id: string; name: string } | null) ?? null;
    },

    async insertTenant(name) {
      const { data, error } = await serviceClient.from("tenants").insert({ name }).select("id, name").single();
      if (error || !data) throw new Error(`insertTenant: ${error?.message ?? "no row returned"}`);
      return data as { id: string; name: string };
    },

    async findAppUserByEmail(email) {
      const { data, error } = await serviceClient
        .from("app_users")
        .select("id, tenant_id")
        .ilike("email", email)
        .maybeSingle();
      if (error) throw new Error(`findAppUserByEmail: ${error.message}`);
      return (data as { id: string; tenant_id: string | null } | null) ?? null;
    },

    async createAuthUser(email, password) {
      const { data, error } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data?.user) throw new Error(`createAuthUser: ${error?.message ?? "no user returned"}`);
      return { id: data.user.id };
    },

    async insertAppUser(input) {
      const { error } = await serviceClient.from("app_users").insert({
        id: input.id,
        email: input.email,
        display_name: input.display_name,
        tenant_id: input.tenant_id,
        status: "active",
        activated_at: new Date().toISOString(),
        invited_by: null,
      });
      if (error) throw new Error(`insertAppUser: ${error.message}`);
    },

    async findRoleAssignment(tenantId, userId, roleId) {
      const { data, error } = await serviceClient
        .from("role_assignments")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .eq("role_id", roleId)
        .maybeSingle();
      if (error) throw new Error(`findRoleAssignment: ${error.message}`);
      return (data as { id: string } | null) ?? null;
    },

    async insertRoleAssignment(input) {
      const { error } = await serviceClient.from("role_assignments").insert({
        tenant_id: input.tenant_id,
        user_id: input.user_id,
        role_id: input.role_id,
        department_id: null,
        valid_from: new Date().toISOString(),
        valid_to: null,
        created_by: null,
      });
      if (error) throw new Error(`insertRoleAssignment: ${error.message}`);
    },

    async insertAuditEvent(userId, eventType, metadata) {
      const { error } = await serviceClient.from("auth_audit_log").insert({
        user_id: userId,
        event_type: eventType,
        metadata,
      });
      if (error) throw new Error(`insertAuditEvent: ${error.message}`);
    },
  };
}
