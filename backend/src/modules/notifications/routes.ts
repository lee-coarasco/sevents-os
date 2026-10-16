import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { NotificationsRepository } from "./repository.js";
import {
  InvalidRetryPolicyError,
  MissingTemplateBodyError,
  NotificationNotFoundError,
  createTemplate,
  listMyNotifications,
  listRetryPolicies,
  listTemplates,
  markNotificationRead,
  upsertRetryPolicy,
} from "./service.js";

export interface NotificationsRouteOptions {
  getRepository: () => NotificationsRepository;
  requirePermission: (permissionKey: string) => preHandlerHookHandler;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export async function notificationsRoutes(app: FastifyInstance, options: NotificationsRouteOptions) {
  app.post<{ Body: { templateKey: string; channel: "in_app" | "email"; subject?: string; body: string } }>(
    "/notifications/templates",
    { preHandler: options.requirePermission("notification.template.manage") },
    async (request, reply) => {
      const { templateKey, channel, subject, body } = request.body ?? ({} as never);
      if (!templateKey || !channel || !body) {
        reply.code(400);
        return { error: "templateKey, channel and body are required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const template = await createTemplate(options.getRepository(), token, {
          templateKey,
          channel,
          subject: subject ?? null,
          body,
        });
        reply.code(201);
        return { template };
      } catch (error) {
        if (error instanceof MissingTemplateBodyError) {
          reply.code(400);
          return { error: error.message };
        }
        throw error;
      }
    },
  );

  app.get(
    "/notifications/templates",
    { preHandler: options.requirePermission("notification.template.manage") },
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const templates = await listTemplates(options.getRepository(), token);
      return { templates };
    },
  );

  app.post<{ Body: { channel: "in_app" | "email"; maxAttempts: number; backoffSeconds: number } }>(
    "/notifications/retry-policies",
    { preHandler: options.requirePermission("notification.template.manage") },
    async (request, reply) => {
      const { channel, maxAttempts, backoffSeconds } = request.body ?? ({} as never);
      if (!channel || typeof maxAttempts !== "number" || typeof backoffSeconds !== "number") {
        reply.code(400);
        return { error: "channel, maxAttempts and backoffSeconds are required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const policy = await upsertRetryPolicy(options.getRepository(), token, {
          channel,
          maxAttempts,
          backoffSeconds,
        });
        reply.code(201);
        return { policy };
      } catch (error) {
        if (error instanceof InvalidRetryPolicyError) {
          reply.code(400);
          return { error: error.message };
        }
        throw error;
      }
    },
  );

  app.get(
    "/notifications/retry-policies",
    { preHandler: options.requirePermission("notification.template.manage") },
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const policies = await listRetryPolicies(options.getRepository(), token);
      return { policies };
    },
  );

  // Self-service: the RLS policy on `notifications` (recipient_id =
  // auth.uid()) is what actually enforces "never another user's
  // notifications" — same "own row, no extra permission" precedent as
  // GET /identity/audit-log and GET /authority/effective-permissions.
  app.get("/notifications", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return { error: "missing bearer token" };
    }
    const notifications = await listMyNotifications(options.getRepository(), token);
    return { notifications };
  });

  app.post<{ Params: { id: string } }>("/notifications/:id/read", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return { error: "missing bearer token" };
    }
    try {
      const notification = await markNotificationRead(options.getRepository(), token, request.params.id);
      return { notification };
    } catch (error) {
      if (error instanceof NotificationNotFoundError) {
        reply.code(404);
        return { error: error.message };
      }
      throw error;
    }
  });
}
