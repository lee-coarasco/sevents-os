import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { ProjectsRepository } from "./repository.js";
import {
  NotFoundError,
  createProject,
  createProjectType,
  getProject,
  listProjectTypes,
  listProjects,
  updateProject,
} from "./service.js";

export interface ProjectsRouteOptions {
  getRepository: () => ProjectsRepository;
  /** Reuses tenancy.project.manage (ticket 0056) — project setup is project administration, not a new actor class. */
  requirePermission: (permissionKey: string) => preHandlerHookHandler;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export async function projectsRoutes(app: FastifyInstance, options: ProjectsRouteOptions) {
  app.addHook("preHandler", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return reply.send({ error: "missing bearer token" });
    }
  });

  app.post<{
    Body: {
      companyId: string;
      name: string;
      code?: string;
      clientName?: string;
      location?: string;
      projectTypeId?: string;
      contractReference?: string;
      contractValue?: number;
      contractCurrency?: string;
      projectManagerId?: string;
      baselineStartDate?: string;
      baselineEndDate?: string;
      budgetAmount?: number;
      budgetCurrency?: string;
    };
  }>(
    "/projects",
    { preHandler: options.requirePermission("tenancy.project.manage") },
    async (request, reply) => {
      const body = request.body ?? ({} as never);
      if (!body.companyId || !body.name) {
        reply.code(400);
        return { error: "companyId and name are required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const project = await createProject(options.getRepository(), token, {
        company_id: body.companyId,
        name: body.name,
        code: body.code ?? null,
        client_name: body.clientName ?? null,
        location: body.location ?? null,
        project_type_id: body.projectTypeId ?? null,
        contract_reference: body.contractReference ?? null,
        contract_value: body.contractValue ?? null,
        contract_currency: body.contractCurrency ?? null,
        project_manager_id: body.projectManagerId ?? null,
        baseline_start_date: body.baselineStartDate ?? null,
        baseline_end_date: body.baselineEndDate ?? null,
        budget_amount: body.budgetAmount ?? null,
        budget_currency: body.budgetCurrency ?? null,
      });
      reply.code(201);
      return { project };
    },
  );

  app.get("/projects", async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const projects = await listProjects(options.getRepository(), token);
    return { projects };
  });

  app.get<{ Params: { id: string } }>(
    "/projects/:id",
    { preHandler: options.requirePermission("tenancy.project.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const project = await getProject(options.getRepository(), token, request.params.id);
        return { project };
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
      name?: string;
      code?: string | null;
      status?: "active" | "on_hold" | "closed";
      clientName?: string | null;
      location?: string | null;
      projectTypeId?: string | null;
      contractReference?: string | null;
      contractValue?: number | null;
      contractCurrency?: string | null;
      projectManagerId?: string | null;
      baselineStartDate?: string | null;
      baselineEndDate?: string | null;
      budgetAmount?: number | null;
      budgetCurrency?: string | null;
    };
  }>(
    "/projects/:id",
    { preHandler: options.requirePermission("tenancy.project.manage") },
    async (request, reply) => {
      const body = request.body ?? {};
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const project = await updateProject(options.getRepository(), token, request.params.id, {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.code !== undefined ? { code: body.code } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.clientName !== undefined ? { client_name: body.clientName } : {}),
          ...(body.location !== undefined ? { location: body.location } : {}),
          ...(body.projectTypeId !== undefined ? { project_type_id: body.projectTypeId } : {}),
          ...(body.contractReference !== undefined ? { contract_reference: body.contractReference } : {}),
          ...(body.contractValue !== undefined ? { contract_value: body.contractValue } : {}),
          ...(body.contractCurrency !== undefined ? { contract_currency: body.contractCurrency } : {}),
          ...(body.projectManagerId !== undefined ? { project_manager_id: body.projectManagerId } : {}),
          ...(body.baselineStartDate !== undefined ? { baseline_start_date: body.baselineStartDate } : {}),
          ...(body.baselineEndDate !== undefined ? { baseline_end_date: body.baselineEndDate } : {}),
          ...(body.budgetAmount !== undefined ? { budget_amount: body.budgetAmount } : {}),
          ...(body.budgetCurrency !== undefined ? { budget_currency: body.budgetCurrency } : {}),
        });
        return { project };
      } catch (error) {
        if (error instanceof NotFoundError) {
          reply.code(404);
          return { error: error.message };
        }
        throw error;
      }
    },
  );

  app.post<{ Body: { name: string; code?: string } }>(
    "/project-types",
    { preHandler: options.requirePermission("tenancy.project.manage") },
    async (request, reply) => {
      const { name, code } = request.body ?? ({} as never);
      if (!name) {
        reply.code(400);
        return { error: "name is required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const projectType = await createProjectType(options.getRepository(), token, {
        name,
        code: code ?? null,
      });
      reply.code(201);
      return { projectType };
    },
  );

  app.get("/project-types", async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const projectTypes = await listProjectTypes(options.getRepository(), token);
    return { projectTypes };
  });
}
