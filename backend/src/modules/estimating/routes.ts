import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { AuthenticatedRequest } from "../authority/guard.js";
import type { WorkflowRepository } from "../workflow/repository.js";
import type { EstimatingRepository } from "./repository.js";
import type { CostCategory } from "./types.js";
import {
  EstimateLockedError,
  EstimateNotDraftError,
  NotFoundError,
  addEstimateLine,
  createEstimateVersion,
  createNextEstimateVersionFrom,
  getEstimate,
  listEstimateLines,
  listEstimateVersions,
  removeEstimateLine,
  resolveEstimateApproval,
  submitEstimateForApproval,
  updateEstimateFields,
} from "./service.js";

export interface EstimatingRouteOptions {
  getRepository: () => EstimatingRepository;
  getWorkflowRepository: () => WorkflowRepository;
  requirePermission: (permissionKey: string) => preHandlerHookHandler;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

/**
 * Gated on `tendering.document.manage` throughout — this module reuses
 * ticket 0096's permission rather than minting a new one (same M11
 * module, same named-owner cluster: Estimator/Commercial/Technical/
 * Finance). See DECISIONS.md.
 */
export async function estimatingRoutes(app: FastifyInstance, options: EstimatingRouteOptions) {
  app.addHook("preHandler", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return reply.send({ error: "missing bearer token" });
    }
  });

  const guard = { preHandler: options.requirePermission("tendering.document.manage") };

  app.post<{
    Params: { id: string };
    Body: {
      assumptions?: string;
      inclusions?: string;
      exclusions?: string;
      taxes?: number;
      overheads?: number;
      contingency?: number;
      margin?: number;
    };
  }>("/tendering/tender-submissions/:id/estimates", guard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
    const estimate = await createEstimateVersion(options.getRepository(), token, {
      tenderSubmissionId: request.params.id,
      assumptions: body.assumptions ?? null,
      inclusions: body.inclusions ?? null,
      exclusions: body.exclusions ?? null,
      taxes: body.taxes,
      overheads: body.overheads,
      contingency: body.contingency,
      margin: body.margin,
      createdBy: callerUserId,
    });
    reply.code(201);
    return { estimate };
  });

  app.get<{ Params: { id: string } }>("/tendering/tender-submissions/:id/estimates", guard, async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    let estimates = await listEstimateVersions(options.getRepository(), token, request.params.id);

    // Automatically resolve any estimates currently pending approval
    const pending = estimates.filter((e) => e.status === "pending_approval" && e.workflow_instance_id);
    if (pending.length > 0) {
      await Promise.allSettled(
        pending.map((e) =>
          resolveEstimateApproval(options.getRepository(), options.getWorkflowRepository(), token, e.id)
        )
      );
      estimates = await listEstimateVersions(options.getRepository(), token, request.params.id);
    }

    return { estimates };
  });

  app.get<{ Params: { estimateId: string } }>("/estimates/:estimateId", guard, async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      let estimate = await getEstimate(options.getRepository(), token, request.params.estimateId);
      if (estimate && estimate.status === "pending_approval" && estimate.workflow_instance_id) {
        estimate = await resolveEstimateApproval(options.getRepository(), options.getWorkflowRepository(), token, estimate.id).catch(() => estimate);
      }
      return { estimate };
    } catch (error) {
      if (error instanceof NotFoundError) {
        reply.code(404);
        return { error: error.message };
      }
      throw error;
    }
  });

  app.patch<{
    Params: { estimateId: string };
    Body: {
      assumptions?: string | null;
      inclusions?: string | null;
      exclusions?: string | null;
      taxes?: number;
      overheads?: number;
      contingency?: number;
      margin?: number;
    };
  }>("/estimates/:estimateId", guard, async (request, reply) => {
    const body = request.body ?? {};
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const estimate = await updateEstimateFields(options.getRepository(), token, request.params.estimateId, body);
      return { estimate };
    } catch (error) {
      if (error instanceof NotFoundError) {
        reply.code(404);
        return { error: error.message };
      }
      if (error instanceof EstimateLockedError || error instanceof EstimateNotDraftError) {
        reply.code(409);
        return { error: error.message };
      }
      throw error;
    }
  });

  // FR-EST-003: the only legal way to change an approved (or
  // otherwise locked) estimate — copies the prior version's fields and
  // lines forward into a brand new draft version.
  app.post<{ Params: { estimateId: string } }>(
    "/estimates/:estimateId/new-version",
    guard,
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      try {
        const estimate = await createNextEstimateVersionFrom(
          options.getRepository(),
          token,
          request.params.estimateId,
          callerUserId,
        );
        reply.code(201);
        return { estimate };
      } catch (error) {
        if (error instanceof NotFoundError) {
          reply.code(404);
          return { error: error.message };
        }
        throw error;
      }
    },
  );

  app.post<{
    Params: { estimateId: string };
    Body: { item: string; quantity: number; unit: string; rate: number; costCategory: CostCategory; source?: string; confidence?: number };
  }>("/estimates/:estimateId/lines", guard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    if (!body.item || body.quantity === undefined || !body.unit || body.rate === undefined || !body.costCategory) {
      reply.code(400);
      return { error: "item, quantity, unit, rate and costCategory are required" };
    }
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const line = await addEstimateLine(options.getRepository(), token, request.params.estimateId, {
        item: body.item,
        quantity: body.quantity,
        unit: body.unit,
        rate: body.rate,
        costCategory: body.costCategory,
        source: body.source as never,
        confidence: body.confidence ?? null,
      });
      reply.code(201);
      return { line };
    } catch (error) {
      if (error instanceof NotFoundError) {
        reply.code(404);
        return { error: error.message };
      }
      if (error instanceof EstimateLockedError || error instanceof EstimateNotDraftError) {
        reply.code(409);
        return { error: error.message };
      }
      throw error;
    }
  });

  app.get<{ Params: { estimateId: string } }>("/estimates/:estimateId/lines", guard, async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const lines = await listEstimateLines(options.getRepository(), token, request.params.estimateId);
    return { lines };
  });

  app.delete<{ Params: { estimateId: string; lineId: string } }>(
    "/estimates/:estimateId/lines/:lineId",
    guard,
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        await removeEstimateLine(options.getRepository(), token, request.params.estimateId, request.params.lineId);
        reply.code(204);
        return null;
      } catch (error) {
        if (error instanceof NotFoundError) {
          reply.code(404);
          return { error: error.message };
        }
        if (error instanceof EstimateLockedError || error instanceof EstimateNotDraftError) {
          reply.code(409);
          return { error: error.message };
        }
        throw error;
      }
    },
  );

  // FR-EST-003: submit this draft version for approval via the
  // request_approval workflow seam.
  app.post<{
    Params: { estimateId: string };
    Body: { definitionId: string };
  }>("/estimates/:estimateId/submit-for-approval", guard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    if (!body.definitionId) {
      reply.code(400);
      return { error: "definitionId is required" };
    }
    const token = bearerToken(request.headers.authorization) as string;
    const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
    try {
      const estimate = await submitEstimateForApproval(options.getRepository(), options.getWorkflowRepository(), token, {
        estimateId: request.params.estimateId,
        definitionId: body.definitionId,
        submittedBy: callerUserId,
      });
      return { estimate };
    } catch (error) {
      if (error instanceof NotFoundError) {
        reply.code(404);
        return { error: error.message };
      }
      if (error instanceof EstimateLockedError || error instanceof EstimateNotDraftError) {
        reply.code(409);
        return { error: error.message };
      }
      throw error;
    }
  });

  // GET is the poll: each read re-checks the linked workflow instance
  // and applies the outcome exactly once (resolveEstimateApproval is
  // idempotent once status leaves 'pending_approval'), same convention
  // as ticket 0075's GET /baseline-change-requests/:requestId.
  app.get<{ Params: { estimateId: string } }>(
    "/estimates/:estimateId/approval-status",
    guard,
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const estimate = await resolveEstimateApproval(options.getRepository(), options.getWorkflowRepository(), token, request.params.estimateId);
        return { estimate };
      } catch (error) {
        if (error instanceof NotFoundError) {
          reply.code(404);
          return { error: error.message };
        }
        throw error;
      }
    },
  );
}
