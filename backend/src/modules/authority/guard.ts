import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthorityRepository } from "./repository.js";
import { getEffectivePermissions } from "./service.js";

export interface AuthenticatedRequest extends FastifyRequest {
  authUserId?: string;
  authTenantId?: string;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

/**
 * Fastify preHandler factory: every M01/M02 endpoint this ticket closes
 * the authorization gap on (invite, deactivate, company/branch/project
 * creation) and every new M03 admin endpoint uses this instead of
 * rolling its own "is there a bearer token" check — the actual
 * authorization decision (does this user hold this permission, right
 * now) lives in one place.
 */
export function requirePermission(getRepository: () => AuthorityRepository, permissionKey: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return reply.send({ error: "missing bearer token" });
    }

    const repo = getRepository();
    const context = await repo.resolveCallerContext(token);
    if (!context) {
      reply.code(401);
      return reply.send({ error: "invalid session" });
    }

    const permissions = await getEffectivePermissions(repo, context.userId, context.tenantId);
    if (!permissions.has(permissionKey)) {
      reply.code(403);
      return reply.send({ error: "forbidden" });
    }

    const authedRequest = request as AuthenticatedRequest;
    authedRequest.authUserId = context.userId;
    authedRequest.authTenantId = context.tenantId;
  };
}
