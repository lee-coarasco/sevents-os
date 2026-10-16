import type { FastifyInstance } from "fastify";
import type { AuthenticatedRequest } from "./guard.js";
import { requirePermission } from "./guard.js";
import type { AuthorityRepository } from "./repository.js";
import {
  CrossTenantError,
  UnauthorizedError,
  assignRole,
  createApprovalLimit,
  createDelegation,
  createDepartment,
  getEffectivePermissions,
} from "./service.js";

export interface AuthorityRouteOptions {
  getRepository: () => AuthorityRepository;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export async function authorityRoutes(app: FastifyInstance, options: AuthorityRouteOptions) {
  app.post<{ Body: { companyId: string; name: string; parentId?: string } }>(
    "/authority/departments",
    { preHandler: requirePermission(options.getRepository, "authority.department.manage") },
    async (request, reply) => {
      const { companyId, name, parentId } = request.body ?? ({} as never);
      if (!companyId || !name) {
        reply.code(400);
        return { error: "companyId and name are required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      const department = await createDepartment(options.getRepository(), token, callerUserId, {
        company_id: companyId,
        name,
        parent_id: parentId ?? null,
      });
      reply.code(201);
      return { department };
    },
  );

  app.post<{
    Body: { userId: string; roleId: string; departmentId?: string; validFrom?: string; validTo?: string };
  }>(
    "/authority/role-assignments",
    { preHandler: requirePermission(options.getRepository, "authority.role_assignment.manage") },
    async (request, reply) => {
      const { userId, roleId, departmentId, validFrom, validTo } = request.body ?? ({} as never);
      if (!userId || !roleId) {
        reply.code(400);
        return { error: "userId and roleId are required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      try {
        const assignment = await assignRole(options.getRepository(), token, callerUserId, {
          userId,
          roleId,
          departmentId: departmentId ?? null,
          validFrom,
          validTo: validTo ?? null,
        });
        reply.code(201);
        return { roleAssignment: assignment };
      } catch (error) {
        if (error instanceof CrossTenantError) {
          reply.code(403);
          return { error: error.message };
        }
        if (error instanceof UnauthorizedError) {
          reply.code(401);
          return { error: error.message };
        }
        throw error;
      }
    },
  );

  app.post<{
    Body: { roleAssignmentId: string; delegateUserId: string; validFrom?: string; validTo?: string; reason?: string };
  }>(
    "/authority/delegations",
    { preHandler: requirePermission(options.getRepository, "authority.delegation.manage") },
    async (request, reply) => {
      const { roleAssignmentId, delegateUserId, validFrom, validTo, reason } =
        request.body ?? ({} as never);
      if (!roleAssignmentId || !delegateUserId) {
        reply.code(400);
        return { error: "roleAssignmentId and delegateUserId are required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      const delegation = await createDelegation(options.getRepository(), token, callerUserId, {
        roleAssignmentId,
        delegateUserId,
        validFrom,
        validTo: validTo ?? null,
        reason: reason ?? null,
      });
      reply.code(201);
      return { delegation };
    },
  );

  app.post<{ Body: { roleId?: string; departmentId?: string; currency: string; maxValue: number } }>(
    "/authority/approval-limits",
    { preHandler: requirePermission(options.getRepository, "authority.approval_limit.manage") },
    async (request, reply) => {
      const { roleId, departmentId, currency, maxValue } = request.body ?? ({} as never);
      if (!currency || typeof maxValue !== "number" || (!roleId && !departmentId)) {
        reply.code(400);
        return { error: "currency, maxValue and one of roleId/departmentId are required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      const approvalLimit = await createApprovalLimit(options.getRepository(), token, callerUserId, {
        roleId: roleId ?? null,
        departmentId: departmentId ?? null,
        currency,
        maxValue,
      });
      reply.code(201);
      return { approvalLimit };
    },
  );

  // Ticket 0088: self-service reads, no permission required beyond a
  // valid session — same "visible to anyone with a session in this
  // tenant" precedent GET /tenancy/companies already set (no
  // requirePermission on that GET either). A caller deciding what
  // department/role/assignment to pick needs to see what already
  // exists, same reasoning as GET /authority/effective-permissions.
  app.get<{ Querystring: { companyId?: string } }>("/authority/departments", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return { error: "missing bearer token" };
    }
    const repo = options.getRepository();
    const context = await repo.resolveCallerContext(token);
    if (!context) {
      reply.code(401);
      return { error: "invalid session" };
    }
    const { companyId } = request.query ?? {};
    if (!companyId) {
      reply.code(400);
      return { error: "companyId is required" };
    }
    const departments = await repo.listDepartments(token, companyId);
    return { departments };
  });

  app.get("/authority/roles", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return { error: "missing bearer token" };
    }
    const repo = options.getRepository();
    const context = await repo.resolveCallerContext(token);
    if (!context) {
      reply.code(401);
      return { error: "invalid session" };
    }
    const roles = await repo.listRoleDefinitions(token);
    return { roles };
  });

  app.get<{ Querystring: { userId?: string } }>("/authority/role-assignments", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return { error: "missing bearer token" };
    }
    const repo = options.getRepository();
    const context = await repo.resolveCallerContext(token);
    if (!context) {
      reply.code(401);
      return { error: "invalid session" };
    }
    const { userId } = request.query ?? {};
    const roleAssignments = await repo.listRoleAssignments(token, { userId });
    return { roleAssignments };
  });

  // Self-service only — no permission required beyond having a valid
  // session, same "is this your own row" exemption ticket 0054 used for
  // GET /identity/audit-log.
  app.get("/authority/effective-permissions", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return { error: "missing bearer token" };
    }
    const repo = options.getRepository();
    const context = await repo.resolveCallerContext(token);
    if (!context) {
      reply.code(401);
      return { error: "invalid session" };
    }
    const permissions = await getEffectivePermissions(repo, context.userId, context.tenantId);
    return { permissions: [...permissions] };
  });
}
