import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { TenancyRepository } from "./repository.js";

export interface TenancyRouteOptions {
  getRepository: () => TenancyRepository;
  /** Ticket 0056 (M03): creating a company/branch/project is an admin action, gated on a permission, not just "has a bearer token." */
  requirePermission: (permissionKey: string) => preHandlerHookHandler;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export async function tenancyRoutes(app: FastifyInstance, options: TenancyRouteOptions) {
  app.addHook("preHandler", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return reply.send({ error: "missing bearer token" });
    }
  });

  app.post<{ Body: { legalName: string } }>(
    "/tenancy/companies",
    { preHandler: options.requirePermission("tenancy.company.manage") },
    async (request, reply) => {
      const { legalName, ...rest } = (request.body ?? {}) as { legalName: string };
      if (!legalName) {
        reply.code(400);
        return { error: "legalName is required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const company = await options.getRepository().createCompany(token, {
        legal_name: legalName,
        ...rest,
      });
      reply.code(201);
      return { company };
    },
  );

  app.get("/tenancy/companies", async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const companies = await options.getRepository().listCompanies(token);
    return { companies };
  });

  app.post<{ Body: { companyId: string; name: string; operatingRegion?: string } }>(
    "/tenancy/branches",
    { preHandler: options.requirePermission("tenancy.branch.manage") },
    async (request, reply) => {
      const { companyId, name, operatingRegion } = request.body ?? ({} as never);
      if (!companyId || !name) {
        reply.code(400);
        return { error: "companyId and name are required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const branch = await options.getRepository().createBranch(token, {
        company_id: companyId,
        name,
        operating_region: operatingRegion ?? null,
      });
      reply.code(201);
      return { branch };
    },
  );

  app.post<{ Body: { companyId: string; name: string; code?: string } }>(
    "/tenancy/projects",
    { preHandler: options.requirePermission("tenancy.project.manage") },
    async (request, reply) => {
      const { companyId, name, code } = request.body ?? ({} as never);
      if (!companyId || !name) {
        reply.code(400);
        return { error: "companyId and name are required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const project = await options.getRepository().createProject(token, {
        company_id: companyId,
        name,
        code: code ?? null,
      });
      reply.code(201);
      return { project };
    },
  );

  app.get("/tenancy/projects", async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const projects = await options.getRepository().listProjects(token);
    return { projects };
  });
}
