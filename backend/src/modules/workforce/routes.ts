import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { AuthenticatedRequest } from "../authority/guard.js";
import type { WorkforceRepository } from "./repository.js";
import {
  NotFoundError,
  addEmployeeCertification,
  addEmployeeSkill,
  addTrainingRecord,
  createEmployeeRecord,
  createProjectAllocation,
  deactivateEmployeeRecord,
  getEmployeeRecord,
  getOwnEmployeeRecord,
  listActiveProjectAllocations,
  listEmployeeRecords,
  updateEmployeeRecord,
} from "./service.js";

export interface WorkforceRouteOptions {
  getRepository: () => WorkforceRepository;
  requirePermission: (permissionKey: string) => preHandlerHookHandler;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export async function workforceRoutes(app: FastifyInstance, options: WorkforceRouteOptions) {
  app.addHook("preHandler", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return reply.send({ error: "missing bearer token" });
    }
  });

  // Self-service only — no permission required, same "is this your own
  // row" exemption ticket 0054 used for GET /identity/audit-log. Must be
  // registered before /employees/:id so "me" isn't swallowed by the :id
  // param route.
  app.get("/employees/me", async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    const record = await getOwnEmployeeRecord(options.getRepository(), token);
    if (!record) {
      reply.code(404);
      return { error: "no employee record linked to this account" };
    }
    return { employee: record };
  });

  // Tenant-wide list, same convention as ticket 0088's GET /tenancy/branches —
  // registered before /employees/:id so the :id param route doesn't swallow it.
  app.get<{ Querystring: { companyId?: string; departmentId?: string } }>(
    "/employees",
    { preHandler: options.requirePermission("employee.directory.manage") },
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const employees = await listEmployeeRecords(options.getRepository(), token, {
        companyId: request.query.companyId,
        departmentId: request.query.departmentId,
      });
      return { employees };
    },
  );

  app.post<{
    Body: {
      companyId: string;
      employeeCode: string;
      fullName: string;
      appUserId?: string;
      departmentId?: string;
      reportingRoleId?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      onboardedAt?: string;
    };
  }>(
    "/employees",
    { preHandler: options.requirePermission("employee.directory.manage") },
    async (request, reply) => {
      const body = request.body ?? ({} as never);
      if (!body.companyId || !body.employeeCode || !body.fullName) {
        reply.code(400);
        return { error: "companyId, employeeCode and fullName are required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const employee = await createEmployeeRecord(options.getRepository(), token, {
        company_id: body.companyId,
        employee_code: body.employeeCode,
        full_name: body.fullName,
        app_user_id: body.appUserId ?? null,
        department_id: body.departmentId ?? null,
        reporting_role_id: body.reportingRoleId ?? null,
        emergency_contact_name: body.emergencyContactName ?? null,
        emergency_contact_phone: body.emergencyContactPhone ?? null,
        onboarded_at: body.onboardedAt ?? null,
      });
      reply.code(201);
      return { employee };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/employees/:id",
    { preHandler: options.requirePermission("employee.directory.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const employee = await getEmployeeRecord(options.getRepository(), token, request.params.id);
        return { employee };
      } catch (error) {
        if (error instanceof NotFoundError) {
          reply.code(404);
          return { error: error.message };
        }
        throw error;
      }
    },
  );

  app.patch<{
    Params: { id: string };
    Body: {
      fullName?: string;
      departmentId?: string | null;
      reportingRoleId?: string | null;
      employmentStatus?: "active" | "on_leave" | "suspended" | "offboarded";
      emergencyContactName?: string | null;
      emergencyContactPhone?: string | null;
      appUserId?: string | null;
    };
  }>(
    "/employees/:id",
    { preHandler: options.requirePermission("employee.directory.manage") },
    async (request, reply) => {
      const body = request.body ?? {};
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const employee = await updateEmployeeRecord(options.getRepository(), token, request.params.id, {
          ...(body.fullName !== undefined ? { full_name: body.fullName } : {}),
          ...(body.departmentId !== undefined ? { department_id: body.departmentId } : {}),
          ...(body.reportingRoleId !== undefined ? { reporting_role_id: body.reportingRoleId } : {}),
          ...(body.employmentStatus !== undefined ? { employment_status: body.employmentStatus } : {}),
          ...(body.emergencyContactName !== undefined
            ? { emergency_contact_name: body.emergencyContactName }
            : {}),
          ...(body.emergencyContactPhone !== undefined
            ? { emergency_contact_phone: body.emergencyContactPhone }
            : {}),
          ...(body.appUserId !== undefined ? { app_user_id: body.appUserId } : {}),
        });
        return { employee };
      } catch (error) {
        if (error instanceof NotFoundError) {
          reply.code(404);
          return { error: error.message };
        }
        throw error;
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/employees/:id/deactivate",
    { preHandler: options.requirePermission("employee.directory.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const employee = await deactivateEmployeeRecord(options.getRepository(), token, request.params.id);
        return { employee };
      } catch (error) {
        if (error instanceof NotFoundError) {
          reply.code(404);
          return { error: error.message };
        }
        throw error;
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { skillName: string; proficiencyNote?: string } }>(
    "/employees/:id/skills",
    { preHandler: options.requirePermission("employee.directory.manage") },
    async (request, reply) => {
      const { skillName, proficiencyNote } = request.body ?? ({} as never);
      if (!skillName) {
        reply.code(400);
        return { error: "skillName is required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const employeeSkill = await addEmployeeSkill(options.getRepository(), token, {
        employeeId: request.params.id,
        skillName,
        proficiencyNote: proficiencyNote ?? null,
      });
      reply.code(201);
      return { employeeSkill };
    },
  );

  app.post<{
    Params: { id: string };
    Body: { certificationName: string; issuingBody?: string; issuedAt: string; expiresAt?: string };
  }>(
    "/employees/:id/certifications",
    { preHandler: options.requirePermission("employee.directory.manage") },
    async (request, reply) => {
      const { certificationName, issuingBody, issuedAt, expiresAt } = request.body ?? ({} as never);
      if (!certificationName || !issuedAt) {
        reply.code(400);
        return { error: "certificationName and issuedAt are required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const employeeCertification = await addEmployeeCertification(options.getRepository(), token, {
        employeeId: request.params.id,
        certificationName,
        issuingBody: issuingBody ?? null,
        issuedAt,
        expiresAt: expiresAt ?? null,
      });
      reply.code(201);
      return { employeeCertification };
    },
  );

  app.post<{ Params: { id: string }; Body: { courseName: string; completedAt: string; result?: string } }>(
    "/employees/:id/training",
    { preHandler: options.requirePermission("employee.directory.manage") },
    async (request, reply) => {
      const { courseName, completedAt, result } = request.body ?? ({} as never);
      if (!courseName || !completedAt) {
        reply.code(400);
        return { error: "courseName and completedAt are required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const trainingRecord = await addTrainingRecord(options.getRepository(), token, {
        employeeId: request.params.id,
        courseName,
        completedAt,
        result: result ?? null,
      });
      reply.code(201);
      return { trainingRecord };
    },
  );

  app.post<{
    Params: { id: string };
    Body: { projectId: string; siteAssignment?: string; validFrom?: string; validTo?: string };
  }>(
    "/employees/:id/project-allocations",
    { preHandler: options.requirePermission("employee.directory.manage") },
    async (request, reply) => {
      const { projectId, siteAssignment, validFrom, validTo } = request.body ?? ({} as never);
      if (!projectId) {
        reply.code(400);
        return { error: "projectId is required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      const allocation = await createProjectAllocation(options.getRepository(), token, {
        employeeId: request.params.id,
        projectId,
        siteAssignment: siteAssignment ?? null,
        validFrom,
        validTo: validTo ?? null,
        createdBy: callerUserId,
      });
      reply.code(201);
      return { allocation };
    },
  );

  app.get<{ Params: { id: string }; Querystring: { at?: string } }>(
    "/employees/:id/project-allocations",
    { preHandler: options.requirePermission("employee.directory.manage") },
    async (request) => {
      const tenantId = (request as AuthenticatedRequest).authTenantId as string;
      const atIso = request.query.at ?? new Date().toISOString();
      const allocations = await listActiveProjectAllocations(
        options.getRepository(),
        tenantId,
        request.params.id,
        atIso,
      );
      return { allocations };
    },
  );
}
