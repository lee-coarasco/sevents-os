import type {
  ApprovalLimitFilter,
  AuthorityRepository,
  CreateApprovalLimitInput,
  CreateDelegationInput,
  CreateDepartmentInput,
  CreateRoleAssignmentInput,
  ListRoleAssignmentsFilter,
} from "../modules/authority/repository.js";
import type {
  ApprovalLimit,
  AuthorityAuditEventType,
  Delegation,
  DepartmentDefinition,
  RoleAssignment,
  RoleDefinition,
} from "../modules/authority/types.js";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * In-memory stand-in for AuthorityRepository. Reproduces the same
 * contracts the real RLS-backed adapter relies on: mutating methods are
 * keyed off an access token's own tenant (like tenancy's fake), and the
 * effective-permissions computation is a direct+delegated role union,
 * filtered by effective dates, exactly like the real SQL would do.
 */
export class FakeAuthorityRepository implements AuthorityRepository {
  sessions = new Map<string, { userId: string; tenantId: string }>();
  userTenants = new Map<string, string>();
  departments = new Map<string, DepartmentDefinition>();
  roleDefinitions = new Map<string, RoleDefinition>();
  roleAssignments = new Map<string, RoleAssignment>();
  delegations = new Map<string, Delegation>();
  approvalLimits = new Map<string, ApprovalLimit>();
  rolePermissions = new Map<string, Set<string>>();
  auditLog: Array<{ userId: string | null; eventType: AuthorityAuditEventType; metadata: Record<string, unknown> }> = [];

  addSession(accessToken: string, userId: string, tenantId: string) {
    this.sessions.set(accessToken, { userId, tenantId });
    this.userTenants.set(userId, tenantId);
  }

  setUserTenant(userId: string, tenantId: string) {
    this.userTenants.set(userId, tenantId);
  }

  grantPermission(roleId: string, permissionId: string) {
    const existing = this.rolePermissions.get(roleId) ?? new Set<string>();
    existing.add(permissionId);
    this.rolePermissions.set(roleId, existing);
  }

  private contextOf(accessToken: string) {
    const context = this.sessions.get(accessToken);
    if (!context) throw new Error("no caller context for this access token");
    return context;
  }

  async resolveCallerContext(accessToken: string) {
    return this.sessions.get(accessToken) ?? null;
  }

  async getUserTenantId(userId: string) {
    return this.userTenants.get(userId) ?? null;
  }

  async createDepartment(accessToken: string, input: CreateDepartmentInput) {
    const { tenantId } = this.contextOf(accessToken);
    const department: DepartmentDefinition = {
      id: nextId("department"),
      tenant_id: tenantId,
      company_id: input.company_id,
      parent_id: input.parent_id ?? null,
      name: input.name,
    };
    this.departments.set(department.id, department);
    return department;
  }

  async listDepartments(accessToken: string, companyId: string) {
    const { tenantId } = this.contextOf(accessToken);
    return [...this.departments.values()].filter(
      (d) => d.tenant_id === tenantId && d.company_id === companyId,
    );
  }

  async seedDepartmentsFromCatalogue(_accessToken: string, _companyId: string) {
    return { created: 0, skipped: 0, departments: [] };
  }

  async createRoleDefinition(tenantId: string, input: { label: string; departmentCluster?: string | null }) {
    const id = `role.custom.${Math.random().toString(16).slice(2, 10)}`;
    const role: RoleDefinition = {
      id,
      tenant_id: tenantId,
      label: input.label,
      department_cluster: input.departmentCluster ?? null,
      is_platform_role: false,
    };
    this.roleDefinitions.set(id, role);
    return role;
  }

  async listRoleDefinitions(accessToken: string) {
    const { tenantId } = this.contextOf(accessToken);
    return [...this.roleDefinitions.values()].filter(
      (r) => r.tenant_id === null || r.tenant_id === tenantId,
    );
  }

  async createRoleAssignment(accessToken: string, input: CreateRoleAssignmentInput) {
    const { tenantId } = this.contextOf(accessToken);
    const assignment: RoleAssignment = {
      id: nextId("role-assignment"),
      tenant_id: tenantId,
      user_id: input.user_id,
      role_id: input.role_id,
      department_id: input.department_id ?? null,
      valid_from: input.valid_from ?? new Date().toISOString(),
      valid_to: input.valid_to ?? null,
    };
    this.roleAssignments.set(assignment.id, assignment);
    return assignment;
  }

  async listRoleAssignments(accessToken: string, filter?: ListRoleAssignmentsFilter) {
    const { tenantId } = this.contextOf(accessToken);
    return [...this.roleAssignments.values()].filter(
      (a) => a.tenant_id === tenantId && (!filter?.userId || a.user_id === filter.userId),
    );
  }

  async getRoleAssignment(roleAssignmentId: string) {
    return this.roleAssignments.get(roleAssignmentId) ?? null;
  }

  async createDelegation(accessToken: string, input: CreateDelegationInput) {
    const { tenantId } = this.contextOf(accessToken);
    const delegation: Delegation = {
      id: nextId("delegation"),
      tenant_id: tenantId,
      role_assignment_id: input.role_assignment_id,
      delegate_user_id: input.delegate_user_id,
      valid_from: input.valid_from ?? new Date().toISOString(),
      valid_to: input.valid_to ?? null,
      reason: input.reason ?? null,
    };
    this.delegations.set(delegation.id, delegation);
    return delegation;
  }

  async createApprovalLimit(accessToken: string, input: CreateApprovalLimitInput) {
    const { tenantId } = this.contextOf(accessToken);
    const nowIso = new Date().toISOString();
    const roleId = input.role_id ?? null;
    const departmentId = input.department_id ?? null;

    // Ticket 0066 (M08), FR-APP-005: supersede the previous active row
    // for this scope rather than editing it in place.
    for (const existing of this.approvalLimits.values()) {
      if (
        existing.tenant_id === tenantId &&
        existing.currency === input.currency &&
        existing.role_id === roleId &&
        existing.department_id === departmentId &&
        existing.valid_to === null
      ) {
        existing.valid_to = nowIso;
      }
    }

    const limit: ApprovalLimit = {
      id: nextId("approval-limit"),
      tenant_id: tenantId,
      role_id: roleId,
      department_id: departmentId,
      currency: input.currency,
      max_value: input.max_value,
      valid_from: nowIso,
      valid_to: null,
    };
    this.approvalLimits.set(limit.id, limit);
    return limit;
  }

  async findApprovalLimit(tenantId: string, filter: ApprovalLimitFilter) {
    for (const limit of this.approvalLimits.values()) {
      if (
        limit.tenant_id === tenantId &&
        limit.currency === filter.currency &&
        limit.role_id === filter.roleId &&
        limit.department_id === filter.departmentId &&
        limit.valid_from <= filter.atIso &&
        (limit.valid_to === null || limit.valid_to > filter.atIso)
      ) {
        return limit;
      }
    }
    return null;
  }

  async listActiveRoleIds(tenantId: string, userId: string, atIso: string) {
    const roleIds = new Set<string>();

    for (const assignment of this.roleAssignments.values()) {
      if (
        assignment.tenant_id === tenantId &&
        assignment.user_id === userId &&
        assignment.valid_from <= atIso &&
        (!assignment.valid_to || assignment.valid_to > atIso)
      ) {
        roleIds.add(assignment.role_id);
      }
    }

    for (const delegation of this.delegations.values()) {
      if (
        delegation.tenant_id !== tenantId ||
        delegation.delegate_user_id !== userId ||
        delegation.valid_from > atIso ||
        (delegation.valid_to && delegation.valid_to <= atIso)
      ) {
        continue;
      }
      const assignment = this.roleAssignments.get(delegation.role_assignment_id);
      if (!assignment) continue;
      if (assignment.valid_from > atIso) continue;
      if (assignment.valid_to && assignment.valid_to <= atIso) continue;
      roleIds.add(assignment.role_id);
    }

    return [...roleIds];
  }

  async listPermissionsForRoles(roleIds: string[]) {
    const permissions = new Set<string>();
    for (const roleId of roleIds) {
      for (const permissionId of this.rolePermissions.get(roleId) ?? []) {
        permissions.add(permissionId);
      }
    }
    return [...permissions];
  }

  async insertAuditEvent(
    actorUserId: string | null,
    eventType: AuthorityAuditEventType,
    metadata: Record<string, unknown>,
  ) {
    this.auditLog.push({ userId: actorUserId, eventType, metadata });
  }
}
