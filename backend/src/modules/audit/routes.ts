import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { AuthenticatedRequest } from "../authority/guard.js";
import type { AuditRepository } from "./repository.js";
import type { IdentityRepository } from "../identity/repository.js";
import type { WorkflowRepository } from "../workflow/repository.js";
import {
  DataRequestNotFoundError,
  InvalidAuditFilterError,
  InvalidRetentionPeriodError,
  LegalHoldAlreadyReleasedError,
  LegalHoldNotFoundError,
  MissingDataRequestReasonError,
  MissingLegalHoldReasonError,
  UnsupportedDataRequestEntityTypeError,
  createRetentionPolicy,
  listAuditLog,
  listDataRequests,
  listLegalHolds,
  listRetentionPolicies,
  placeLegalHold,
  releaseLegalHold,
  requestDataAction,
  resolveDataRequest,
} from "./service.js";

export interface AuditRouteOptions {
  getRepository: () => AuditRepository;
  getWorkflowRepository: () => WorkflowRepository;
  getIdentityRepository: () => IdentityRepository;
  requirePermission: (permissionKey: string) => preHandlerHookHandler;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
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

  app.post<{ Body: { entityType: string; retentionDays: number } }>(
    "/audit/retention-policies",
    { preHandler: options.requirePermission("audit.retention.manage") },
    async (request, reply) => {
      const { entityType, retentionDays } = request.body ?? ({} as never);
      if (!entityType || typeof retentionDays !== "number") {
        reply.code(400);
        return { error: "entityType and retentionDays are required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      try {
        const policy = await createRetentionPolicy(options.getRepository(), token, callerUserId, {
          entityType,
          retentionDays,
        });
        reply.code(201);
        return { policy };
      } catch (error) {
        if (error instanceof InvalidRetentionPeriodError) {
          reply.code(400);
          return { error: error.message };
        }
        throw error;
      }
    },
  );

  app.get(
    "/audit/retention-policies",
    { preHandler: options.requirePermission("audit.retention.manage") },
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const policies = await listRetentionPolicies(options.getRepository(), token);
      return { policies };
    },
  );

  app.post<{ Body: { entityType: string; entityId?: string; reason: string } }>(
    "/audit/legal-holds",
    { preHandler: options.requirePermission("audit.retention.manage") },
    async (request, reply) => {
      const { entityType, entityId, reason } = request.body ?? ({} as never);
      if (!entityType || !reason) {
        reply.code(400);
        return { error: "entityType and reason are required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      try {
        const legalHold = await placeLegalHold(options.getRepository(), token, callerUserId, {
          entityType,
          entityId: entityId ?? null,
          reason,
        });
        reply.code(201);
        return { legalHold };
      } catch (error) {
        if (error instanceof MissingLegalHoldReasonError) {
          reply.code(400);
          return { error: error.message };
        }
        throw error;
      }
    },
  );

  app.get(
    "/audit/legal-holds",
    { preHandler: options.requirePermission("audit.retention.manage") },
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const legalHolds = await listLegalHolds(options.getRepository(), token);
      return { legalHolds };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/audit/legal-holds/:id/release",
    { preHandler: options.requirePermission("audit.retention.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      try {
        const legalHold = await releaseLegalHold(options.getRepository(), token, request.params.id, callerUserId);
        return { legalHold };
      } catch (error) {
        if (error instanceof LegalHoldNotFoundError) {
          reply.code(404);
          return { error: error.message };
        }
        if (error instanceof LegalHoldAlreadyReleasedError) {
          reply.code(409);
          return { error: error.message };
        }
        throw error;
      }
    },
  );

  app.post<{
    Body: { requestType: "export" | "deletion"; entityType: string; entityId: string; reason: string; definitionId: string };
  }>(
    "/data-requests",
    { preHandler: options.requirePermission("data.request.manage") },
    async (request, reply) => {
      const { requestType, entityType, entityId, reason, definitionId } = request.body ?? ({} as never);
      if (!requestType || !entityType || !entityId || !reason || !definitionId) {
        reply.code(400);
        return { error: "requestType, entityType, entityId, reason and definitionId are required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      try {
        const dataRequest = await requestDataAction(options.getRepository(), options.getWorkflowRepository(), token, {
          requestType,
          entityType,
          entityId,
          reason,
          requestedBy: callerUserId,
          definitionId,
        });
        reply.code(201);
        return { dataRequest };
      } catch (error) {
        if (error instanceof MissingDataRequestReasonError || error instanceof UnsupportedDataRequestEntityTypeError) {
          reply.code(400);
          return { error: error.message };
        }
        throw error;
      }
    },
  );

  app.get(
    "/data-requests",
    { preHandler: options.requirePermission("data.request.manage") },
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const dataRequests = await listDataRequests(options.getRepository(), token);
      return { dataRequests };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/data-requests/:id",
    { preHandler: options.requirePermission("data.request.manage") },
    async (request, reply) => {
      const tenantId = (request as AuthenticatedRequest).authTenantId as string;
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const dataRequest = await resolveDataRequest(
          options.getRepository(),
          options.getWorkflowRepository(),
          options.getIdentityRepository(),
          token,
          tenantId,
          request.params.id,
        );
        return { dataRequest };
      } catch (error) {
        if (error instanceof DataRequestNotFoundError) {
          reply.code(404);
          return { error: error.message };
        }
        throw error;
      }
    },
  );
}
