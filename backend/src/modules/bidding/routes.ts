import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { AuthenticatedRequest } from "../authority/guard.js";
import type { WorkflowRepository } from "../workflow/repository.js";
import type { BiddingRepository } from "./repository.js";
import type { BidCriterion, BidRecommendation } from "./types.js";
import {
  BidDecisionLockedError,
  BidDecisionNotDraftError,
  BidNotApprovedError,
  MissingCriteriaScoresError,
  NotFoundError,
  addCriteriaScore,
  createBidNoBidDecision,
  getBidNoBidDecision,
  listBidNoBidDecisions,
  listBidSubmissions,
  listCriteriaScores,
  recordBidSubmission,
  removeCriteriaScore,
  resolveBidNoBidApproval,
  submitBidNoBidForApproval,
  updateBidNoBidRecommendation,
} from "./service.js";

export interface BiddingRouteOptions {
  getRepository: () => BiddingRepository;
  getWorkflowRepository: () => WorkflowRepository;
  requirePermission: (permissionKey: string) => preHandlerHookHandler;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

/**
 * Gated on `tendering.document.manage` throughout — same reuse chain
 * as tickets 0096/0097 (same M11 module, same named-owner cluster:
 * Estimator/Commercial/Technical/Finance). The actual approval
 * sign-off goes through the existing generic `/approvals/:stepInstanceId/decide`
 * route (ticket 0066), not a route defined here.
 */
export async function biddingRoutes(app: FastifyInstance, options: BiddingRouteOptions) {
  app.addHook("preHandler", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return reply.send({ error: "missing bearer token" });
    }
  });

  const guard = { preHandler: options.requirePermission("tendering.document.manage") };

  function handleError(error: unknown, reply: { code: (c: number) => void }) {
    if (error instanceof NotFoundError) {
      reply.code(404);
      return { error: error.message };
    }
    if (
      error instanceof BidDecisionLockedError ||
      error instanceof BidDecisionNotDraftError ||
      error instanceof MissingCriteriaScoresError ||
      error instanceof BidNotApprovedError
    ) {
      reply.code(409);
      return { error: error.message };
    }
    throw error;
  }

  app.post<{ Params: { id: string }; Body: { recommendation: BidRecommendation } }>(
    "/estimates/:id/bid-decisions",
    guard,
    async (request, reply) => {
      const body = request.body ?? ({} as never);
      if (body.recommendation !== "bid" && body.recommendation !== "no_bid") {
        reply.code(400);
        return { error: "recommendation must be 'bid' or 'no_bid'" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      const decision = await createBidNoBidDecision(options.getRepository(), token, {
        estimateId: request.params.id,
        recommendation: body.recommendation,
        createdBy: callerUserId,
      });
      reply.code(201);
      return { decision };
    },
  );

  app.get<{ Params: { id: string } }>("/estimates/:id/bid-decisions", guard, async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    let decisions = await listBidNoBidDecisions(options.getRepository(), token, request.params.id);

    const pending = decisions.filter((d) => d.status === "pending_approval" && d.workflow_instance_id);
    if (pending.length > 0) {
      await Promise.allSettled(
        pending.map((d) =>
          resolveBidNoBidApproval(options.getRepository(), options.getWorkflowRepository(), token, d.id)
        )
      );
      decisions = await listBidNoBidDecisions(options.getRepository(), token, request.params.id);
    }

    return { decisions };
  });

  app.get<{ Params: { decisionId: string } }>("/bid-decisions/:decisionId", guard, async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      let decision = await getBidNoBidDecision(options.getRepository(), token, request.params.decisionId);
      if (decision && decision.status === "pending_approval" && decision.workflow_instance_id) {
        decision = await resolveBidNoBidApproval(options.getRepository(), options.getWorkflowRepository(), token, decision.id).catch(() => decision);
      }
      return { decision };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  app.patch<{ Params: { decisionId: string }; Body: { recommendation: BidRecommendation } }>(
    "/bid-decisions/:decisionId",
    guard,
    async (request, reply) => {
      const body = request.body ?? ({} as never);
      if (body.recommendation !== "bid" && body.recommendation !== "no_bid") {
        reply.code(400);
        return { error: "recommendation must be 'bid' or 'no_bid'" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const decision = await updateBidNoBidRecommendation(options.getRepository(), token, request.params.decisionId, body.recommendation);
        return { decision };
      } catch (error) {
        return handleError(error, reply);
      }
    },
  );

  app.post<{ Params: { decisionId: string }; Body: { criterion: BidCriterion; score: number; rationale: string } }>(
    "/bid-decisions/:decisionId/criteria",
    guard,
    async (request, reply) => {
      const body = request.body ?? ({} as never);
      if (!body.criterion || body.score === undefined || !body.rationale) {
        reply.code(400);
        return { error: "criterion, score and rationale are required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const score = await addCriteriaScore(options.getRepository(), token, request.params.decisionId, {
          criterion: body.criterion,
          score: body.score,
          rationale: body.rationale,
        });
        reply.code(201);
        return { score };
      } catch (error) {
        return handleError(error, reply);
      }
    },
  );

  app.get<{ Params: { decisionId: string } }>("/bid-decisions/:decisionId/criteria", guard, async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const scores = await listCriteriaScores(options.getRepository(), token, request.params.decisionId);
    return { scores };
  });

  app.delete<{ Params: { decisionId: string; scoreId: string } }>(
    "/bid-decisions/:decisionId/criteria/:scoreId",
    guard,
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        await removeCriteriaScore(options.getRepository(), token, request.params.decisionId, request.params.scoreId);
        reply.code(204);
        return null;
      } catch (error) {
        return handleError(error, reply);
      }
    },
  );

  app.post<{ Params: { decisionId: string }; Body: { definitionId: string } }>(
    "/bid-decisions/:decisionId/submit-for-approval",
    guard,
    async (request, reply) => {
      const body = request.body ?? ({} as never);
      if (!body.definitionId) {
        reply.code(400);
        return { error: "definitionId is required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      try {
        const decision = await submitBidNoBidForApproval(options.getRepository(), options.getWorkflowRepository(), token, {
          decisionId: request.params.decisionId,
          definitionId: body.definitionId,
          submittedBy: callerUserId,
        });
        return { decision };
      } catch (error) {
        return handleError(error, reply);
      }
    },
  );

  // GET is the poll: each read re-checks the linked workflow instance
  // and applies the outcome exactly once, same convention as ticket
  // 0097's GET /estimates/:estimateId/approval-status.
  app.get<{ Params: { decisionId: string } }>(
    "/bid-decisions/:decisionId/approval-status",
    guard,
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const decision = await resolveBidNoBidApproval(options.getRepository(), options.getWorkflowRepository(), token, request.params.decisionId);
        return { decision };
      } catch (error) {
        return handleError(error, reply);
      }
    },
  );

  app.post<{
    Params: { decisionId: string };
    Body: { submittedTo: string; submittedAt: string; evidenceReference?: string | null };
  }>("/bid-decisions/:decisionId/submissions", guard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    if (!body.submittedTo || !body.submittedAt) {
      reply.code(400);
      return { error: "submittedTo and submittedAt are required" };
    }
    const token = bearerToken(request.headers.authorization) as string;
    const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
    try {
      const submission = await recordBidSubmission(options.getRepository(), token, {
        decisionId: request.params.decisionId,
        submittedTo: body.submittedTo,
        submittedAt: body.submittedAt,
        evidenceReference: body.evidenceReference ?? null,
        submittedBy: callerUserId,
      });
      reply.code(201);
      return { submission };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  app.get<{ Params: { decisionId: string } }>("/bid-decisions/:decisionId/submissions", guard, async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const submissions = await listBidSubmissions(options.getRepository(), token, request.params.decisionId);
    return { submissions };
  });
}
