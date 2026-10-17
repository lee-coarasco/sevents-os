import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { AuthenticatedRequest } from "../authority/guard.js";
import type { CatalogueRepository } from "./repository.js";
import { InvalidDispositionError, WorkItemNotFoundError, getWorkItem, listWorkItems, updateWorkItem } from "./service.js";
import type { UpdateWorkItemInput } from "./service.js";
import type { Disposition, PaginatedWorkItems, WorkItemStatus } from "./types.js";

export interface CatalogueRouteOptions {
  getRepository: () => CatalogueRepository;
  /** Gated on catalogue.workitem.manage — same shared authority guard every other module uses. */
  requirePermission: (permissionKey: string) => preHandlerHookHandler;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export async function catalogueRoutes(app: FastifyInstance, options: CatalogueRouteOptions) {
  app.addHook("preHandler", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return reply.send({ error: "missing bearer token" });
    }
  });

  app.get<{
    Querystring: {
      department?: string;
      canonicalRoleId?: string;
      disposition?: string;
      status?: string;
      riskTier?: string;
      missingData?: string;
      sourceSerial?: string;
      search?: string;
      excludeRetired?: string;
      page?: string;
      pageSize?: string;
    };
  }>(
    "/catalogue/work-items",
    { preHandler: options.requirePermission("catalogue.workitem.manage") },
    async (request): Promise<PaginatedWorkItems> => {
      const q = request.query ?? {};
      const token = bearerToken(request.headers.authorization) as string;
      const page = Math.max(1, q.page ? parseInt(q.page, 10) : 1);
      const pageSize = Math.min(200, Math.max(10, q.pageSize ? parseInt(q.pageSize, 10) : 50));
      const allItems = await listWorkItems(options.getRepository(), token, {
        department: q.department,
        canonicalRoleId: q.canonicalRoleId,
        disposition: q.disposition as Disposition | undefined,
        status: q.status as WorkItemStatus | undefined,
        riskTier: q.riskTier,
        missingData: q.missingData === "true",
        sourceSerial: q.sourceSerial ? Number(q.sourceSerial) : undefined,
        search: q.search,
        excludeRetired: q.excludeRetired === "true",
      });
      const total = allItems.length;
      const start = (page - 1) * pageSize;
      const items = allItems.slice(start, start + pageSize);
      return { items, total, page, pageSize };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/catalogue/work-items/:id",
    { preHandler: options.requirePermission("catalogue.workitem.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      const detail = await getWorkItem(options.getRepository(), token, request.params.id);
      if (!detail) {
        reply.code(404);
        return { error: "not found" };
      }
      return { workItem: detail };
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateWorkItemInput }>(
    "/catalogue/work-items/:id",
    { preHandler: options.requirePermission("catalogue.workitem.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      try {
        const updated = await updateWorkItem(
          options.getRepository(),
          token,
          request.params.id,
          request.body ?? {},
          callerUserId,
        );
        return { workItem: updated };
      } catch (error) {
        if (error instanceof InvalidDispositionError) {
          reply.code(400);
          return { error: error.message };
        }
        if (error instanceof WorkItemNotFoundError) {
          reply.code(404);
          return { error: error.message };
        }
        throw error;
      }
    },
  );
}
