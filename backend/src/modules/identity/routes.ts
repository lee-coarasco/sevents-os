import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { AuthenticatedRequest } from "../authority/guard.js";
import type { IdentityRepository } from "./repository.js";
import {
  UnauthorizedError,
  acceptInvite,
  deactivateUser,
  enrollMfa,
  getOwnAuditLog,
  inviteUser,
  listUsers,
  sendPasswordReset,
  signIn,
  signOut,
  updateUser,
  verifyMfa,
} from "./service.js";

export interface IdentityRouteOptions {
  getRepository: () => IdentityRepository;
  /**
   * Ticket 0056 (M03) closes the "any role/permission check beyond is
   * this your own row" gap ticket 0054 deliberately left open — invite
   * and deactivate are admin operations, not self-service, so they're
   * gated on a permission from the authority module rather than a
   * bare "has a bearer token" check.
   */
  requirePermission: (permissionKey: string) => preHandlerHookHandler;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export async function identityRoutes(app: FastifyInstance, options: IdentityRouteOptions) {
  app.post<{ Body: { email: string; displayName?: string } }>(
    "/identity/invite",
    { preHandler: options.requirePermission("identity.user.invite") },
    async (request, reply) => {
      const { email, displayName } = request.body ?? ({} as { email: string });
      if (!email) {
        reply.code(400);
        return { error: "email is required" };
      }
      const invitedBy = (request as AuthenticatedRequest).authUserId ?? null;
      const user = await inviteUser(options.getRepository(), email, displayName, invitedBy);
      reply.code(201);
      return { user };
    },
  );

  app.post<{ Body: { email: string; password: string } }>(
    "/identity/sign-in",
    async (request, reply) => {
      const { email, password } = request.body ?? ({} as { email: string; password: string });
      if (!email || !password) {
        reply.code(400);
        return { error: "email and password are required" };
      }
      try {
        const result = await signIn(options.getRepository(), email, password);
        return {
          session: { accessToken: result.accessToken, refreshToken: result.refreshToken },
        };
      } catch (error) {
        reply.code(401);
        return { error: (error as Error).message };
      }
    },
  );

  app.post("/identity/sign-out", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return { error: "missing bearer token" };
    }
    await signOut(options.getRepository(), token);
    return { ok: true };
  });

  app.post("/identity/accept-invite", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return { error: "missing bearer token" };
    }
    try {
      const repo = options.getRepository();
      const userId = await repo.getUserIdFromAccessToken(token);
      if (!userId) {
        reply.code(401);
        return { error: "invalid session" };
      }
      const user = await acceptInvite(repo, userId);
      return { user };
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        reply.code(401);
        return { error: error.message };
      }
      throw error;
    }
  });

  app.post<{ Body: { userId: string } }>(
    "/identity/deactivate",
    { preHandler: options.requirePermission("identity.user.deactivate") },
    async (request, reply) => {
      const { userId } = request.body ?? ({} as { userId: string });
      if (!userId) {
        reply.code(400);
        return { error: "userId is required" };
      }
      const user = await deactivateUser(options.getRepository(), userId);
      return { user };
    },
  );

  // Ticket 0108: GET /admin/users moved to the dedicated admin/users module (ticket 0149)
  // which returns richer data (role_id, role_label). UserPicker continues to call that endpoint.

  app.patch<{ Params: { id: string }; Body: { displayName?: string | null } }>(
    "/admin/users/:id",
    { preHandler: options.requirePermission("identity.user.invite") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization);
      if (!token) { reply.code(401); return { error: "missing bearer token" }; }
      try {
        const user = await updateUser(options.getRepository(), request.params.id, request.body ?? {});
        return { user };
      } catch (error) {
        if (error instanceof UnauthorizedError) { reply.code(401); return { error: error.message }; }
        throw error;
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/admin/users/:id/reset-password",
    { preHandler: options.requirePermission("identity.user.invite") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization);
      if (!token) { reply.code(401); return { error: "missing bearer token" }; }
      try {
        await sendPasswordReset(options.getRepository(), request.params.id);
        return { ok: true };
      } catch (error) {
        if (error instanceof UnauthorizedError) { reply.code(401); return { error: error.message }; }
        throw error;
      }
    },
  );

  app.get("/identity/audit-log", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return { error: "missing bearer token" };
    }
    try {
      const entries = await getOwnAuditLog(options.getRepository(), token);
      return { entries };
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        reply.code(401);
        return { error: error.message };
      }
      throw error;
    }
  });

  app.post("/identity/mfa/enroll", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return { error: "missing bearer token" };
    }
    try {
      const factor = await enrollMfa(options.getRepository(), token);
      return { factor };
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        reply.code(401);
        return { error: error.message };
      }
      throw error;
    }
  });

  app.post<{ Body: { factorId: string; challengeId: string; code: string } }>(
    "/identity/mfa/verify",
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization);
      if (!token) {
        reply.code(401);
        return { error: "missing bearer token" };
      }
      try {
        const result = await verifyMfa(options.getRepository(), token, request.body);
        return { result };
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          reply.code(401);
          return { error: error.message };
        }
        reply.code(400);
        return { error: (error as Error).message };
      }
    },
  );
}
