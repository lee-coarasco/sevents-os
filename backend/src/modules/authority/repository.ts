import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ApprovalLimit,
  AuthorityAuditEventType,
  Delegation,
  DepartmentDefinition,
  PermissionDefinition,
  RoleAssignment,
  RoleDefinition,
} from "./types.js";

export interface CreateDepartmentInput {
  company_id: string;
  name: string;
  parent_id?: string | null;
}

export interface CreateRoleAssignmentInput {
  user_id: string;
  role_id: string;
  department_id?: string | null;
  valid_from?: string;
  valid_to?: string | null;
  created_by: string | null;
}

export interface CreateDelegationInput {
  role_assignment_id: string;
  delegate_user_id: string;
  valid_from?: string;
  valid_to?: string | null;
  reason?: string | null;
  created_by: string | null;
}

export interface CreateApprovalLimitInput {
  role_id?: string | null;
  department_id?: string | null;
  currency: string;
  max_value: number;
  created_by: string | null;
}

export interface ApprovalLimitFilter {
  roleId: string | null;
  departmentId: string | null;
  currency: string;
  /** Ticket 0066 (M08): effective-dated lookup, same idiom as listActiveRoleIds — "the limit in force at this instant," not just "the latest row." */
  atIso: string;
}

export interface ListRoleAssignmentsFilter {
  userId?: string | null;
}

/**
 * Everything the authority service needs. Mutating methods take the
 * caller's own access token and go through the user-scoped client, same
 * convention as modules/tenancy/repository.ts — RLS (tenant_id =
 * current_tenant_id()) is the real isolation mechanism, this adapter
 * just has to not bypass it. Read methods used by the "effective
 * permissions" / "approval limit" checks take explicit ids and go
 * through the service-role client instead: those checks must work for
 * *any* user being checked, not just the caller themselves (e.g. a
 * future approval step checking the approver's authority, not the
 * requester's).
 */
export interface AuthorityRepository {
  resolveCallerContext(accessToken: string): Promise<{ userId: string; tenantId: string } | null>;
  getUserTenantId(userId: string): Promise<string | null>;
  createDepartment(accessToken: string, input: CreateDepartmentInput): Promise<DepartmentDefinition>;
  /** Self-service read, same "visible to anyone with a session in this tenant" precedent as GET /tenancy/companies — no extra permission. */
  listDepartments(accessToken: string, companyId: string): Promise<DepartmentDefinition[]>;
  /**
   * Idempotent seed: extracts distinct department_cluster values from
   * role_definitions and work_item_definitions, then inserts any that don't
   * already exist as department_definitions for the given company.
   */
  seedDepartmentsFromCatalogue(
    accessToken: string,
    companyId: string,
  ): Promise<{ created: number; skipped: number; departments: DepartmentDefinition[] }>;
  /** Create a tenant-scoped custom role definition. */
  createRoleDefinition(
    tenantId: string,
    input: { label: string; departmentCluster?: string | null },
  ): Promise<RoleDefinition>;
  /** RLS (role_definitions_select) already returns platform-wide rows plus the caller's own tenant's rows; this goes through the user-scoped client so that filter applies for free. */
  listRoleDefinitions(accessToken: string): Promise<RoleDefinition[]>;
  createRoleAssignment(accessToken: string, input: CreateRoleAssignmentInput): Promise<RoleAssignment>;
  listRoleAssignments(accessToken: string, filter?: ListRoleAssignmentsFilter): Promise<RoleAssignment[]>;
  getRoleAssignment(roleAssignmentId: string): Promise<RoleAssignment | null>;
  createDelegation(accessToken: string, input: CreateDelegationInput): Promise<Delegation>;
  createApprovalLimit(accessToken: string, input: CreateApprovalLimitInput): Promise<ApprovalLimit>;
  findApprovalLimit(tenantId: string, filter: ApprovalLimitFilter): Promise<ApprovalLimit | null>;
  /** Role ids held directly or via an active delegation, at time `atIso`. */
  listActiveRoleIds(tenantId: string, userId: string, atIso: string): Promise<string[]>;
  listPermissionsForRoles(roleIds: string[]): Promise<string[]>;
  listAllPermissions(): Promise<PermissionDefinition[]>;
  listPermissionsForRole(roleId: string): Promise<string[]>;
  setRolePermissions(roleId: string, permissionIds: string[]): Promise<void>;
  insertAuditEvent(
    actorUserId: string | null,
    eventType: AuthorityAuditEventType,
    metadata: Record<string, unknown>,
  ): Promise<void>;
}

/**
 * Supabase-backed implementation. Not exercised against a live
 * Supabase project in this session (no reachable credentials in this
 * sandbox, same gap already flagged in tickets 0053/0054/0055) —
 * service.test.ts/routes.test.ts cover all business logic through the
 * interface above via FakeAuthorityRepository instead.
 */
export function createSupabaseAuthorityRepository(
  serviceClient: SupabaseClient,
  userScopedClientFactory: (accessToken: string) => SupabaseClient,
): AuthorityRepository {
  return {
    async resolveCallerContext(accessToken) {
      const userClient = userScopedClientFactory(accessToken);
      const { data: authData, error: authError } = await userClient.auth.getUser();
      if (authError || !authData?.user) return null;
      const { data, error } = await userClient
        .from("app_users")
        .select("tenant_id")
        .eq("id", authData.user.id)
        .maybeSingle();
      if (error || !data?.tenant_id) return null;
      return { userId: authData.user.id, tenantId: data.tenant_id as string };
    },

    async getUserTenantId(userId) {
      const { data, error } = await serviceClient
        .from("app_users")
        .select("tenant_id")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw new Error(`getUserTenantId: ${error.message}`);
      return (data?.tenant_id as string | undefined) ?? null;
    },

    async createDepartment(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("department_definitions")
        .insert({ parent_id: null, ...input })
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(`createDepartment: ${error?.message ?? "no row returned"}`);
      }
      return data as DepartmentDefinition;
    },

    async listDepartments(accessToken, companyId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("department_definitions")
        .select("*")
        .eq("company_id", companyId);
      if (error) throw new Error(`listDepartments: ${error.message}`);
      return (data as DepartmentDefinition[]) ?? [];
    },

    async seedDepartmentsFromCatalogue(accessToken, companyId) {
      // Read distinct cluster labels via service client so we get all
      // platform-wide rows regardless of the caller's tenant context.
      const [{ data: roleData }, { data: widdData }] = await Promise.all([
        serviceClient.from("role_definitions").select("department_cluster").not("department_cluster", "is", null),
        serviceClient.from("work_item_definitions").select("department_cluster").not("department_cluster", "is", null),
      ]);

      const allClusters = new Set<string>();
      for (const row of [...(roleData ?? []), ...(widdData ?? [])]) {
        const name = (row as { department_cluster: string }).department_cluster?.trim();
        if (name) allClusters.add(name);
      }

      const userClient = userScopedClientFactory(accessToken);
      const { data: existing, error: listErr } = await userClient
        .from("department_definitions")
        .select("name")
        .eq("company_id", companyId);
      if (listErr) throw new Error(`seedDepartmentsFromCatalogue list: ${listErr.message}`);

      const existingNames = new Set(
        (existing ?? []).map((d: { name: string }) => d.name.toLowerCase()),
      );
      const toInsert = [...allClusters]
        .filter((name) => !existingNames.has(name.toLowerCase()))
        .sort()
        .map((name) => ({ company_id: companyId, name, parent_id: null }));

      if (toInsert.length === 0) {
        return { created: 0, skipped: allClusters.size, departments: [] };
      }

      const { data: inserted, error: insertErr } = await userClient
        .from("department_definitions")
        .insert(toInsert)
        .select("*");
      if (insertErr) throw new Error(`seedDepartmentsFromCatalogue insert: ${insertErr.message}`);

      const departments = (inserted as DepartmentDefinition[]) ?? [];
      return { created: departments.length, skipped: allClusters.size - departments.length, departments };
    },

    async createRoleDefinition(tenantId, input) {
      const baseSlug = input.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      const uniqueSuffix = Math.random().toString(16).slice(2, 10);
      const id = `role.${baseSlug}.${uniqueSuffix}`;
      const { data, error } = await serviceClient
        .from("role_definitions")
        .insert({
          id,
          tenant_id: tenantId,
          label: input.label,
          department_cluster: input.departmentCluster ?? null,
          is_platform_role: false,
        })
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(`createRoleDefinition: ${error?.message ?? "no row returned"}`);
      }
      return data as RoleDefinition;
    },

    async listRoleDefinitions(accessToken) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("role_definitions").select("*");
      if (error) throw new Error(`listRoleDefinitions: ${error.message}`);
      return (data as RoleDefinition[]) ?? [];
    },

    async createRoleAssignment(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("role_assignments")
        .insert({ department_id: null, valid_to: null, ...input })
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(`createRoleAssignment: ${error?.message ?? "no row returned"}`);
      }
      return data as RoleAssignment;
    },

    async listRoleAssignments(accessToken, filter) {
      const client = userScopedClientFactory(accessToken);
      let query = client.from("role_assignments").select("*");
      if (filter?.userId) query = query.eq("user_id", filter.userId);
      const { data, error } = await query;
      if (error) throw new Error(`listRoleAssignments: ${error.message}`);
      return (data as RoleAssignment[]) ?? [];
    },

    async getRoleAssignment(roleAssignmentId) {
      const { data, error } = await serviceClient
        .from("role_assignments")
        .select("*")
        .eq("id", roleAssignmentId)
        .maybeSingle();
      if (error) throw new Error(`getRoleAssignment: ${error.message}`);
      return (data as RoleAssignment | null) ?? null;
    },

    async createDelegation(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("delegations")
        .insert({ valid_to: null, reason: null, ...input })
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(`createDelegation: ${error?.message ?? "no row returned"}`);
      }
      return data as Delegation;
    },

    async createApprovalLimit(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const nowIso = new Date().toISOString();

      // Ticket 0066 (M08), FR-APP-005: a new limit for the same scope
      // supersedes the previous one by closing its valid_to — never an
      // in-place edit of the old row.
      let closeQuery = client
        .from("approval_limits")
        .update({ valid_to: nowIso })
        .eq("currency", input.currency)
        .is("valid_to", null);
      closeQuery = input.role_id ? closeQuery.eq("role_id", input.role_id) : closeQuery.is("role_id", null);
      closeQuery = input.department_id
        ? closeQuery.eq("department_id", input.department_id)
        : closeQuery.is("department_id", null);
      const { error: closeError } = await closeQuery;
      if (closeError) throw new Error(`createApprovalLimit (superseding previous row): ${closeError.message}`);

      const { data, error } = await client
        .from("approval_limits")
        .insert({ role_id: null, department_id: null, valid_from: nowIso, ...input })
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(`createApprovalLimit: ${error?.message ?? "no row returned"}`);
      }
      return data as ApprovalLimit;
    },

    async findApprovalLimit(tenantId, filter) {
      let query = serviceClient
        .from("approval_limits")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("currency", filter.currency)
        .lte("valid_from", filter.atIso)
        .or(`valid_to.is.null,valid_to.gt.${filter.atIso}`);
      query = filter.roleId ? query.eq("role_id", filter.roleId) : query.is("role_id", null);
      query = filter.departmentId
        ? query.eq("department_id", filter.departmentId)
        : query.is("department_id", null);
      const { data, error } = await query.maybeSingle();
      if (error) throw new Error(`findApprovalLimit: ${error.message}`);
      return (data as ApprovalLimit | null) ?? null;
    },

    async listActiveRoleIds(tenantId, userId, atIso) {
      const { data: direct, error: directError } = await serviceClient
        .from("role_assignments")
        .select("id, role_id, valid_from, valid_to")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .lte("valid_from", atIso)
        .or(`valid_to.is.null,valid_to.gt.${atIso}`);
      if (directError) throw new Error(`listActiveRoleIds (direct): ${directError.message}`);

      const { data: delegated, error: delegatedError } = await serviceClient
        .from("delegations")
        .select("role_assignments(id, role_id, valid_from, valid_to)")
        .eq("tenant_id", tenantId)
        .eq("delegate_user_id", userId)
        .lte("valid_from", atIso)
        .or(`valid_to.is.null,valid_to.gt.${atIso}`);
      if (delegatedError) throw new Error(`listActiveRoleIds (delegated): ${delegatedError.message}`);

      const roleIds = new Set<string>();
      for (const row of direct ?? []) roleIds.add(row.role_id as string);
      for (const row of delegated ?? []) {
        const assignment = (
          row as unknown as { role_assignments: { role_id: string; valid_from: string; valid_to: string | null } | null }
        ).role_assignments;
        if (!assignment) continue;
        if (assignment.valid_from > atIso) continue;
        if (assignment.valid_to && assignment.valid_to <= atIso) continue;
        roleIds.add(assignment.role_id);
      }
      return [...roleIds];
    },

    async listPermissionsForRoles(roleIds) {
      if (roleIds.length === 0) return [];
      const { data, error } = await serviceClient
        .from("role_permissions")
        .select("permission_id")
        .in("role_id", roleIds);
      if (error) throw new Error(`listPermissionsForRoles: ${error.message}`);
      return [...new Set((data ?? []).map((row) => row.permission_id as string))];
    },

    async listAllPermissions() {
      const { data, error } = await serviceClient
        .from("permissions")
        .select("id, description")
        .order("id");
      if (error) throw new Error(`listAllPermissions: ${error.message}`);
      return (data ?? []).map((r) => ({ id: r.id as string, description: (r.description as string) ?? "" }));
    },

    async listPermissionsForRole(roleId) {
      const { data, error } = await serviceClient
        .from("role_permissions")
        .select("permission_id")
        .eq("role_id", roleId);
      if (error) throw new Error(`listPermissionsForRole: ${error.message}`);
      return (data ?? []).map((r) => r.permission_id as string);
    },

    async setRolePermissions(roleId, permissionIds) {
      const { error: delError } = await serviceClient
        .from("role_permissions")
        .delete()
        .eq("role_id", roleId);
      if (delError) throw new Error(`setRolePermissions delete: ${delError.message}`);
      if (permissionIds.length > 0) {
        const rows = permissionIds.map((p) => ({ role_id: roleId, permission_id: p }));
        const { error: insError } = await serviceClient
          .from("role_permissions")
          .insert(rows);
        if (insError) throw new Error(`setRolePermissions insert: ${insError.message}`);
      }
    },

    async insertAuditEvent(actorUserId, eventType, metadata) {
      const { error } = await serviceClient.from("auth_audit_log").insert({
        user_id: actorUserId,
        event_type: eventType,
        metadata,
      });
      if (error) throw new Error(`insertAuditEvent: ${error.message}`);
    },
  };
}
