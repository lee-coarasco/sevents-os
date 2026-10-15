import type {
  ApprovalLimitFilter,
  AuthorityRepository,
  CreateApprovalLimitInput,
  CreateDelegationInput,
  CreateDepartmentInput,
  CreateRoleAssignmentInput,
} from "./repository.js";
import type {
  ApprovalLimit,
  Delegation,
  DepartmentDefinition,
  RoleAssignment,
  SegregationOfDutiesPolicy,
} from "./types.js";

export class UnauthorizedError extends Error {
  constructor(message = "invalid session") {
    super(message);
  }
}

export class ForbiddenError extends Error {
  constructor(message = "forbidden") {
    super(message);
  }
}

export class CrossTenantError extends Error {
  constructor(message = "cannot grant or exercise a role outside the caller's own tenant") {
    super(message);
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

/** What every later module's authorization check calls: direct + delegated roles' union of permissions, at time T. */
export async function getEffectivePermissions(
  repo: AuthorityRepository,
  userId: string,
  tenantId: string,
  atIso: string = nowIso(),
): Promise<Set<string>> {
  const roleIds = await repo.listActiveRoleIds(tenantId, userId, atIso);
  const permissions = await repo.listPermissionsForRoles(roleIds);
  return new Set(permissions);
}

export async function hasPermission(
  repo: AuthorityRepository,
  userId: string,
  tenantId: string,
  permissionKey: string,
  atIso: string = nowIso(),
): Promise<boolean> {
  const permissions = await getEffectivePermissions(repo, userId, tenantId, atIso);
  return permissions.has(permissionKey);
}

export async function createDepartment(
  repo: AuthorityRepository,
  accessToken: string,
  callerUserId: string | null,
  input: CreateDepartmentInput,
): Promise<DepartmentDefinition> {
  const department = await repo.createDepartment(accessToken, input);
  await repo.insertAuditEvent(callerUserId, "department_created", {
    department_id: department.id,
    name: department.name,
  });
  return department;
}

/** Idempotency/dedup across assignments is a later-module concern; this always creates a new effective-dated row. */
export async function assignRole(
  repo: AuthorityRepository,
  accessToken: string,
  callerUserId: string | null,
  input: { userId: string; roleId: string; departmentId?: string | null; validFrom?: string; validTo?: string | null },
): Promise<RoleAssignment> {
  const callerContext = await repo.resolveCallerContext(accessToken);
  if (!callerContext) {
    throw new UnauthorizedError();
  }

  const targetTenantId = await repo.getUserTenantId(input.userId);
  if (!targetTenantId || targetTenantId !== callerContext.tenantId) {
    throw new CrossTenantError();
  }

  const createInput: CreateRoleAssignmentInput = {
    user_id: input.userId,
    role_id: input.roleId,
    department_id: input.departmentId ?? null,
    valid_to: input.validTo ?? null,
    created_by: callerUserId,
    ...(input.validFrom ? { valid_from: input.validFrom } : {}),
  };
  const assignment = await repo.createRoleAssignment(accessToken, createInput);
  await repo.insertAuditEvent(callerUserId, "role_assignment_created", {
    role_assignment_id: assignment.id,
    user_id: assignment.user_id,
    role_id: assignment.role_id,
  });
  return assignment;
}

export async function createDelegation(
  repo: AuthorityRepository,
  accessToken: string,
  callerUserId: string | null,
  input: {
    roleAssignmentId: string;
    delegateUserId: string;
    validFrom?: string;
    validTo?: string | null;
    reason?: string | null;
  },
): Promise<Delegation> {
  const createInput: CreateDelegationInput = {
    role_assignment_id: input.roleAssignmentId,
    delegate_user_id: input.delegateUserId,
    valid_to: input.validTo ?? null,
    reason: input.reason ?? null,
    created_by: callerUserId,
    ...(input.validFrom ? { valid_from: input.validFrom } : {}),
  };
  const delegation = await repo.createDelegation(accessToken, createInput);
  await repo.insertAuditEvent(callerUserId, "delegation_created", {
    delegation_id: delegation.id,
    role_assignment_id: delegation.role_assignment_id,
    delegate_user_id: delegation.delegate_user_id,
  });
  return delegation;
}

export async function createApprovalLimit(
  repo: AuthorityRepository,
  accessToken: string,
  callerUserId: string | null,
  input: { roleId?: string | null; departmentId?: string | null; currency: string; maxValue: number },
): Promise<ApprovalLimit> {
  const createInput: CreateApprovalLimitInput = {
    role_id: input.roleId ?? null,
    department_id: input.departmentId ?? null,
    currency: input.currency,
    max_value: input.maxValue,
    created_by: callerUserId,
  };
  const limit = await repo.createApprovalLimit(accessToken, createInput);
  await repo.insertAuditEvent(callerUserId, "approval_limit_created", {
    approval_limit_id: limit.id,
    role_id: limit.role_id,
    department_id: limit.department_id,
    currency: limit.currency,
    max_value: limit.max_value,
  });
  return limit;
}

/**
 * Deny-by-default per PRD §5 open decision #1: no matching row means
 * "not authorized to approve at this value," never "unlimited." Zero
 * rows are seeded in this ticket, so every call returns false until the
 * business owner answers the open decision and real rows are added.
 */
export async function isWithinApprovalLimit(
  repo: AuthorityRepository,
  tenantId: string,
  filter: ApprovalLimitFilter,
  amount: number,
): Promise<boolean> {
  const limit = await repo.findApprovalLimit(tenantId, filter);
  if (!limit) return false;
  return amount <= limit.max_value;
}

/**
 * Generic, unexercised segregation-of-duties check (ticket 0056: build
 * the mechanism, "do not hard-code it as always-on or invent which
 * workflows it applies to yet" — that's M06/M08 territory). No
 * ApprovalPolicy/workflow entity calls this yet; `policy.enforced`
 * must come from that future caller, never default to true here.
 */
export function checkSegregationOfDuties(
  policy: SegregationOfDutiesPolicy,
  requesterId: string,
  approverId: string,
): boolean {
  if (!policy.enforced) return true;
  return requesterId !== approverId;
}
