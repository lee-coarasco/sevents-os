import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { AuthenticatedRequest } from "../authority/guard.js";
import type { AuditRepository } from "./repository.js";
import { InvalidAuditFilterError, listAuditLog } from "./service.js";

export interface AuditRouteOptions {
  getRepository: () => AuditRepository;
  requirePermission: (permissionKey: string) => preHandlerHookHandler;
}

export async function auditRoutes(app: FastifyInstance, options: AuditRouteOptions) {
  app.get<{
    Querystring: {
      entityType?: string;
      actorId?: string;
      from?: string;
      to?: string;
      limit?: string;
      offset?: string;
    };
  }>(
    "/audit/log",
    { preHandler: options.requirePermission("audit.log.view") },
    async (request, reply) => {
      const tenantId = (request as AuthenticatedRequest).authTenantId as string;
      const query = request.query ?? {};
      try {
        const page = await listAuditLog(options.getRepository(), tenantId, {
          entityType: query.entityType,
          actorId: query.actorId,
          from: query.from,
          to: query.to,
          limit: query.limit !== undefined ? Number(query.limit) : undefined,
          offset: query.offset !== undefined ? Number(query.offset) : undefined,
        });
        return page;
      } catch (error) {
        if (error instanceof InvalidAuditFilterError) {
          reply.code(400);
          return { error: error.message };
        }
        throw error;
      }
    },
  );
}
