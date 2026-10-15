import type { FastifyInstance } from "fastify";
import type { IdentityRepository } from "./repository.js";
import {
  UnauthorizedError,
  acceptInvite,
  deactivateUser,
  enrollMfa,
  getOwnAuditLog,
  inviteUser,
  signIn,
  signOut,
  verifyMfa,
} from "./service.js";

export interface IdentityRouteOptions {
  getRepository: () => IdentityRepository;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export async function identityRoutes(app: FastifyInstance, options: IdentityRouteOptions) {
  app.post<{ Body: { email: string; displayName?: string } }>(
    "/identity/invite",
    async (request, reply) => {
      const { email, displayName } = request.body ?? ({} as { email: string });
      if (!email) {
        reply.code(400);
        return { error: "email is required" };
      }
      const user = await inviteUser(options.getRepository(), email, displayName, null);
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
