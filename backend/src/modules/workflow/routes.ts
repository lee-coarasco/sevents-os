import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import type { AuthorityRepository } from "../authority/repository.js";
import type { AuthenticatedRequest } from "../authority/guard.js";
import type { WorkflowRepository } from "./repository.js";
import {
  ApprovalDecisionAlreadyRevokedError,
  ApprovalDecisionNotFoundError,
  ApprovalLimitExceededError,
  ApprovalLimitFieldsMissingError,
  DefinitionNotApprovedError,
  DefinitionNotDraftError,
  DefinitionNotUnderReviewError,
  IncompleteGateError,
  InstanceNotFoundError,
  InstanceNotPausedError,
  InstanceNotRunningError,
  InvalidNodeTypeError,
  MigrationAlreadyFinalError,
  MigrationNotApprovedError,
  MigrationNotFoundError,
  MigrationNotPreviewedError,
  MigrationVersionMismatchError,
  MissingApprovalReasonError,
  MissingBlockReasonError,
  MissingRevocationReasonError,
  NoStartNodeError,
  NotAnApprovalStepError,
  NotAnEligibleApproverError,
  RollbackTargetNotPublishedError,
  SegregationOfDutiesViolationError,
  SlaDefinitionNotFoundError,
  StepInstanceNotActionableError,
  StepInstanceNotFoundError,
  UnregisteredServiceError,
  VersionNotDraftError,
  VersionNotFoundError,
  VersionNotValidatedError,
  WorkflowNotFoundError,
  addConditionToVersion,
  addNodeToVersion,
  addTransitionToVersion,
  deleteConditionFromVersion,
  deleteNodeFromVersion,
  deleteTransitionFromVersion,
  updateNodeConfig,
  updateWorkflowDefinitionMeta,
  addTaskComment,
  approveMigration,
  attachTaskEvidence,
  blockedQueue,
  cancelInstance,
  cancelMigration,
  clearTaskBlocked,
  completedQueue,
  completeStepInstance,
  createDraftVersion,
  createEscalationRung,
  createMigration,
  createSlaDefinition,
  createWorkflowDefinition,
  CrossTenantError,
  decideApprovalStep,
  delegateTask,
  dueSoonQueue,
  evaluateStepSla,
  executeMigration,
  getApprovalDetail,
  getTaskDetail,
  getVersionGraph,
  getWorkflowDefinition,
  getWorkflowInstance,
  getWorkflowMigration,
  listEscalationRungs,
  listMigrationInstanceResults,
  listSlaDefinitions,
  listVersions,
  listWorkflowDefinitions,
  myWorkQueue,
  overdueQueue,
  pauseInstance,
  previewMigration,
  publishVersion,
  reassignTask,
  recordApproval,
  revokeApprovalDecision,
  resumeInstance,
  rollbackToVersion,
  setTaskBlocked,
  simulateVersion,
  startWorkflowInstance,
  submitForApproval,
  teamWorkQueue,
  validateVersion,
  waitingApprovalQueue,
} from "./service.js";
import type { AddConditionToVersionInput, AddNodeToVersionInput, AddTransitionToVersionInput, CompleteStepInstanceOptions, UpdateWorkflowDefinitionMetaInput } from "./service.js";
import { normalizeApprovalChainConfig } from "./approvals.js";
import type { ApprovalChainDecision, ApprovalDecision, DefinitionStatus, EscalationActionType, SimulationTestCase } from "./types.js";

export interface WorkflowRouteOptions {
  getRepository: () => WorkflowRepository;
  /** workflow.definition.manage for authoring, workflow.definition.publish for approve/publish/rollback. */
  requirePermission: (permissionKey: string) => preHandlerHookHandler;
  /** Ticket 0066 (M08): approval decisions check against modules/authority's approval_limits/segregation-of-duties, so these routes need an AuthorityRepository alongside their own WorkflowRepository. */
  getAuthorityRepository: () => AuthorityRepository;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

function handleServiceError(error: unknown, reply: { code: (n: number) => void }): { error: string } {
  if (
    error instanceof WorkflowNotFoundError ||
    error instanceof VersionNotFoundError
  ) {
    reply.code(404);
    return { error: error.message };
  }
  if (
    error instanceof InstanceNotFoundError ||
    error instanceof StepInstanceNotFoundError ||
    error instanceof MigrationNotFoundError ||
    error instanceof ApprovalDecisionNotFoundError ||
    error instanceof SlaDefinitionNotFoundError
  ) {
    reply.code(404);
    return { error: error.message };
  }
  if (
    error instanceof InvalidNodeTypeError ||
    error instanceof VersionNotDraftError ||
    error instanceof DefinitionNotDraftError ||
    error instanceof DefinitionNotUnderReviewError ||
    error instanceof DefinitionNotApprovedError ||
    error instanceof RollbackTargetNotPublishedError ||
    error instanceof VersionNotValidatedError ||
    error instanceof NoStartNodeError ||
    error instanceof InstanceNotRunningError ||
    error instanceof InstanceNotPausedError ||
    error instanceof StepInstanceNotActionableError ||
    error instanceof IncompleteGateError ||
    error instanceof UnregisteredServiceError ||
    error instanceof MigrationVersionMismatchError ||
    error instanceof MigrationNotPreviewedError ||
    error instanceof MigrationAlreadyFinalError ||
    error instanceof MigrationNotApprovedError ||
    error instanceof MissingBlockReasonError ||
    error instanceof NotAnApprovalStepError ||
    error instanceof MissingApprovalReasonError ||
    error instanceof ApprovalLimitFieldsMissingError ||
    error instanceof MissingRevocationReasonError ||
    error instanceof ApprovalDecisionAlreadyRevokedError
  ) {
    reply.code(400);
    return { error: error.message };
  }
  if (
    error instanceof CrossTenantError ||
    error instanceof NotAnEligibleApproverError ||
    error instanceof SegregationOfDutiesViolationError ||
    error instanceof ApprovalLimitExceededError
  ) {
    reply.code(403);
    return { error: error.message };
  }
  throw error;
}

/**
 * Ticket 0072 (M07c): reassign/delegate allow a step's own assignee
 * without the admin-wide `workflow.instance.act` permission (same
 * "is this your own row" shape used throughout the codebase). Falls
 * through to the ordinary permission-gated preHandler for everyone
 * else, including when the step doesn't exist (the route handler's own
 * requireStepInstance call turns that into a 404 for whoever does hold
 * the permission).
 */
function requireActOrOwnTask(
  getRepository: () => WorkflowRepository,
  requirePermission: (permissionKey: string) => preHandlerHookHandler,
): preHandlerHookHandler {
  return async (request, reply) => {
    const { stepInstanceId } = request.params as { stepInstanceId: string };
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return reply.send({ error: "missing bearer token" });
    }
    const repo = getRepository();
    const step = await repo.getStepInstance(token, stepInstanceId);
    if (step) {
      const callerUserId = await repo.resolveCallerUserId(token);
      if (callerUserId && step.assigned_to === callerUserId) {
        (request as AuthenticatedRequest).authUserId = callerUserId;
        return;
      }
    }
    // requirePermission's real implementation (modules/authority/guard.ts) is a plain
    // 2-arg async function; the preHandlerHookHandler type just describes Fastify's
    // callback-style hook shape, which it's never actually called as here.
    const permissionCheck = requirePermission("workflow.instance.act") as unknown as (
      req: FastifyRequest,
      rep: FastifyReply,
    ) => Promise<unknown>;
    return permissionCheck(request, reply);
  };
}

/**
 * Ticket 0066 (M08): decide/revoke-adjacent routes allow a step's
 * current assignee (legacy single-approver shape) or anyone named in
 * the node's `approverUserIds` chain config (FR-APP-001's multi-
 * approver case — `assigned_to` only ever points at one of them) to
 * act without the admin-wide `workflow.instance.act` permission.
 * `decideApprovalStep` itself still enforces the precise "is it your
 * turn" eligibility (sequential ordering, already-decided) — this gate
 * is intentionally coarser, same division of labour as
 * requireActOrOwnTask/the service layer it wraps.
 */
function requireApproverOrAct(
  getRepository: () => WorkflowRepository,
  requirePermission: (permissionKey: string) => preHandlerHookHandler,
): preHandlerHookHandler {
  return async (request, reply) => {
    const { stepInstanceId } = request.params as { stepInstanceId: string };
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return reply.send({ error: "missing bearer token" });
    }
    const repo = getRepository();
    const step = await repo.getStepInstance(token, stepInstanceId);
    if (step) {
      const callerUserId = await repo.resolveCallerUserId(token);
      if (callerUserId) {
        if (step.assigned_to === callerUserId) {
          (request as AuthenticatedRequest).authUserId = callerUserId;
          return;
        }
        const instance = await repo.getInstance(token, step.workflow_instance_id);
        const graph = instance ? await repo.getVersionGraph(token, instance.workflow_version_id) : null;
        const node = graph?.nodes.find((n) => n.id === step.node_id) ?? null;
        const chainConfig = node ? normalizeApprovalChainConfig(node) : null;
        if (chainConfig?.approverUserIds.includes(callerUserId)) {
          (request as AuthenticatedRequest).authUserId = callerUserId;
          return;
        }
      }
    }
    const permissionCheck = requirePermission("workflow.instance.act") as unknown as (
      req: FastifyRequest,
      rep: FastifyReply,
    ) => Promise<unknown>;
    return permissionCheck(request, reply);
  };
}

export async function workflowRoutes(app: FastifyInstance, options: WorkflowRouteOptions) {
  app.addHook("preHandler", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return reply.send({ error: "missing bearer token" });
    }
  });

  // Permission-light lookup for any authenticated user whose module doesn't
  // hold `workflow.definition.manage` (estimators, document controllers,
  // bid/no-bid approvers, etc.) but still needs a definitionId to drive
  // their own submit-for-approval action. Only published definitions,
  // and only the fields needed to render a picker — no draft content.
  app.get<{ Querystring: { capabilityKey?: string } }>(
    "/workflow/definitions/published",
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const definitions = await listWorkflowDefinitions(options.getRepository(), token, {
        status: "published",
        capabilityKey: request.query.capabilityKey,
      });
      return {
        definitions: definitions.map((d) => ({ id: d.id, key: d.key, name: d.name, capability_key: d.capability_key })),
      };
    },
  );

  app.get<{ Querystring: { status?: string; key?: string } }>(
    "/workflow/definitions",
    { preHandler: options.requirePermission("workflow.definition.manage") },
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const q = request.query ?? {};
      const definitions = await listWorkflowDefinitions(options.getRepository(), token, {
        status: q.status as DefinitionStatus | undefined,
        key: q.key,
      });
      return { definitions };
    },
  );

  app.post<{ Body: { key: string; name: string; description?: string | null; capabilityKey?: string | null } }>(
    "/workflow/definitions",
    { preHandler: options.requirePermission("workflow.definition.manage") },
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      const result = await createWorkflowDefinition(options.getRepository(), token, request.body, callerUserId);
      return result;
    },
  );

  app.get<{ Params: { id: string } }>(
    "/workflow/definitions/:id",
    { preHandler: options.requirePermission("workflow.definition.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      const definition = await getWorkflowDefinition(options.getRepository(), token, request.params.id);
      if (!definition) {
        reply.code(404);
        return { error: "not found" };
      }
      return { definition };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/workflow/definitions/:id/versions",
    { preHandler: options.requirePermission("workflow.definition.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const versions = await listVersions(options.getRepository(), token, request.params.id);
        return { versions };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { copyFromVersionId?: string } }>(
    "/workflow/definitions/:id/versions",
    { preHandler: options.requirePermission("workflow.definition.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      try {
        const version = await createDraftVersion(
          options.getRepository(),
          token,
          request.params.id,
          callerUserId,
          request.body?.copyFromVersionId,
        );
        return { version };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.get<{ Params: { versionId: string } }>(
    "/workflow/versions/:versionId/graph",
    { preHandler: options.requirePermission("workflow.definition.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const graph = await getVersionGraph(options.getRepository(), token, request.params.versionId);
        return { graph };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.post<{ Params: { versionId: string }; Body: AddNodeToVersionInput }>(
    "/workflow/versions/:versionId/nodes",
    { preHandler: options.requirePermission("workflow.definition.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const node = await addNodeToVersion(options.getRepository(), token, request.params.versionId, request.body);
        return { node };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.post<{ Params: { versionId: string }; Body: AddTransitionToVersionInput }>(
    "/workflow/versions/:versionId/transitions",
    { preHandler: options.requirePermission("workflow.definition.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const transition = await addTransitionToVersion(options.getRepository(), token, request.params.versionId, request.body);
        return { transition };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.post<{ Params: { versionId: string }; Body: AddConditionToVersionInput }>(
    "/workflow/versions/:versionId/conditions",
    { preHandler: options.requirePermission("workflow.definition.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const condition = await addConditionToVersion(options.getRepository(), token, request.params.versionId, request.body);
        return { condition };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.patch<{ Params: { versionId: string; nodeId: string }; Body: { config: Record<string, unknown> } }>(
    "/workflow/versions/:versionId/nodes/:nodeId",
    { preHandler: options.requirePermission("workflow.definition.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const node = await updateNodeConfig(options.getRepository(), token, request.params.versionId, request.params.nodeId, request.body.config ?? {});
        return { node };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.delete<{ Params: { versionId: string; nodeId: string } }>(
    "/workflow/versions/:versionId/nodes/:nodeId",
    { preHandler: options.requirePermission("workflow.definition.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        await deleteNodeFromVersion(options.getRepository(), token, request.params.versionId, request.params.nodeId);
        reply.code(204);
        return reply.send();
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.delete<{ Params: { versionId: string; transitionId: string } }>(
    "/workflow/versions/:versionId/transitions/:transitionId",
    { preHandler: options.requirePermission("workflow.definition.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        await deleteTransitionFromVersion(options.getRepository(), token, request.params.versionId, request.params.transitionId);
        reply.code(204);
        return reply.send();
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.delete<{ Params: { versionId: string; conditionId: string } }>(
    "/workflow/versions/:versionId/conditions/:conditionId",
    { preHandler: options.requirePermission("workflow.definition.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        await deleteConditionFromVersion(options.getRepository(), token, request.params.versionId, request.params.conditionId);
        reply.code(204);
        return reply.send();
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateWorkflowDefinitionMetaInput }>(
    "/workflow/definitions/:id",
    { preHandler: options.requirePermission("workflow.definition.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      try {
        const definition = await updateWorkflowDefinitionMeta(options.getRepository(), token, request.params.id, request.body ?? {}, callerUserId);
        return { definition };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { versionId: string } }>(
    "/workflow/definitions/:id/submit",
    { preHandler: options.requirePermission("workflow.definition.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      try {
        const definition = await submitForApproval(options.getRepository(), token, request.params.id, request.body.versionId, callerUserId);
        return { definition };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { versionId: string; decision: ApprovalDecision; comment?: string | null } }>(
    "/workflow/definitions/:id/approve",
    { preHandler: options.requirePermission("workflow.definition.publish") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      try {
        const definition = await recordApproval(
          options.getRepository(),
          token,
          request.params.id,
          request.body.versionId,
          callerUserId,
          request.body.decision,
          request.body.comment ?? null,
        );
        return { definition };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { versionId: string; effectiveFrom?: string } }>(
    "/workflow/definitions/:id/publish",
    { preHandler: options.requirePermission("workflow.definition.publish") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      try {
        const version = await publishVersion(
          options.getRepository(),
          token,
          request.params.id,
          request.body.versionId,
          callerUserId,
          request.body.effectiveFrom,
        );
        return { version };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { toVersion: number; reason?: string | null } }>(
    "/workflow/definitions/:id/rollback",
    { preHandler: options.requirePermission("workflow.definition.publish") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      try {
        const version = await rollbackToVersion(
          options.getRepository(),
          token,
          request.params.id,
          request.body.toVersion,
          callerUserId,
          request.body.reason ?? null,
        );
        return { version };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.post<{ Params: { versionId: string } }>(
    "/workflow/versions/:versionId/validate",
    { preHandler: options.requirePermission("workflow.definition.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      try {
        const run = await validateVersion(options.getRepository(), token, request.params.versionId, callerUserId);
        return { run };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.post<{ Params: { versionId: string }; Body: { testCases: SimulationTestCase[] } }>(
    "/workflow/versions/:versionId/simulate",
    { preHandler: options.requirePermission("workflow.definition.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      try {
        const run = await simulateVersion(
          options.getRepository(),
          token,
          request.params.versionId,
          request.body.testCases ?? [],
          callerUserId,
        );
        return { run };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  // ---------------------------------------------------------------------
  // Runtime / instance engine (ticket 0062, M06c)
  // ---------------------------------------------------------------------

  app.post<{ Body: { definitionId: string; context?: Record<string, unknown> } }>(
    "/workflow/instances",
    { preHandler: options.requirePermission("workflow.instance.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      try {
        const result = await startWorkflowInstance(
          options.getRepository(),
          token,
          request.body.definitionId,
          callerUserId,
          request.body.context ?? {},
        );
        return result;
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/workflow/instances/:id",
    { preHandler: options.requirePermission("workflow.instance.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const result = await getWorkflowInstance(options.getRepository(), token, request.params.id);
        return result;
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/workflow/instances/:id/pause",
    { preHandler: options.requirePermission("workflow.instance.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const instance = await pauseInstance(options.getRepository(), token, request.params.id);
        return { instance };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/workflow/instances/:id/resume",
    { preHandler: options.requirePermission("workflow.instance.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const instance = await resumeInstance(options.getRepository(), token, request.params.id);
        return { instance };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { reason?: string | null } }>(
    "/workflow/instances/:id/cancel",
    { preHandler: options.requirePermission("workflow.instance.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const instance = await cancelInstance(options.getRepository(), token, request.params.id, request.body?.reason ?? null);
        return { instance };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.post<{ Params: { id: string; stepId: string }; Body: CompleteStepInstanceOptions }>(
    "/workflow/instances/:id/steps/:stepId/complete",
    { preHandler: options.requirePermission("workflow.instance.act") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const result = await completeStepInstance(options.getRepository(), token, request.params.stepId, request.body ?? {});
        return result;
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  // ---------------------------------------------------------------------
  // Task metadata, blocking, comments & evidence (ticket 0070, M07a)
  // ---------------------------------------------------------------------

  app.post<{ Params: { stepId: string }; Body: { reason: string } }>(
    "/workflow/steps/:stepId/block",
    { preHandler: options.requirePermission("workflow.instance.act") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const stepInstance = await setTaskBlocked(
          options.getRepository(),
          token,
          request.params.stepId,
          request.body?.reason ?? "",
        );
        return { stepInstance };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.post<{ Params: { stepId: string } }>(
    "/workflow/steps/:stepId/unblock",
    { preHandler: options.requirePermission("workflow.instance.act") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const stepInstance = await clearTaskBlocked(options.getRepository(), token, request.params.stepId);
        return { stepInstance };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.post<{ Params: { stepId: string }; Body: { body: string } }>(
    "/workflow/steps/:stepId/comments",
    { preHandler: options.requirePermission("workflow.instance.act") },
    async (request, reply) => {
      const { body } = request.body ?? ({} as never);
      if (!body) {
        reply.code(400);
        return { error: "body is required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      try {
        const comment = await addTaskComment(options.getRepository(), token, request.params.stepId, callerUserId, body);
        reply.code(201);
        return { comment };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.post<{ Params: { stepId: string }; Body: { fileObjectId: string } }>(
    "/workflow/steps/:stepId/evidence",
    { preHandler: options.requirePermission("workflow.instance.act") },
    async (request, reply) => {
      const { fileObjectId } = request.body ?? ({} as never);
      if (!fileObjectId) {
        reply.code(400);
        return { error: "fileObjectId is required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      try {
        await attachTaskEvidence(options.getRepository(), token, request.params.stepId, fileObjectId);
        reply.code(201);
        return { ok: true };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  // ---------------------------------------------------------------------
  // Task detail — comments + events for the <ActivityThread> (ticket 0145)
  // ---------------------------------------------------------------------

  app.get<{ Params: { stepInstanceId: string } }>(
    "/tasks/:stepInstanceId",
    { preHandler: requireActOrOwnTask(options.getRepository, options.requirePermission) },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const detail = await getTaskDetail(options.getRepository(), token, request.params.stepInstanceId);
        return { detail };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  // ---------------------------------------------------------------------
  // Task reassignment & delegation, audited (ticket 0072, M07c)
  // ---------------------------------------------------------------------

  app.post<{ Params: { stepInstanceId: string }; Body: { newAssigneeUserId: string; reason?: string | null } }>(
    "/tasks/:stepInstanceId/reassign",
    { preHandler: requireActOrOwnTask(options.getRepository, options.requirePermission) },
    async (request, reply) => {
      const { newAssigneeUserId } = request.body ?? ({} as never);
      if (!newAssigneeUserId) {
        reply.code(400);
        return { error: "newAssigneeUserId is required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const stepInstance = await reassignTask(
          options.getRepository(),
          token,
          request.params.stepInstanceId,
          newAssigneeUserId,
          request.body?.reason ?? null,
        );
        return { stepInstance };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.post<{ Params: { stepInstanceId: string }; Body: { delegateUserId: string; reason?: string | null } }>(
    "/tasks/:stepInstanceId/delegate",
    { preHandler: requireActOrOwnTask(options.getRepository, options.requirePermission) },
    async (request, reply) => {
      const { delegateUserId } = request.body ?? ({} as never);
      if (!delegateUserId) {
        reply.code(400);
        return { error: "delegateUserId is required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const stepInstance = await delegateTask(
          options.getRepository(),
          token,
          request.params.stepInstanceId,
          delegateUserId,
          request.body?.reason ?? null,
        );
        return { stepInstance };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  // ---------------------------------------------------------------------
  // My Work / Team Work queue views (ticket 0071, M07b)
  // ---------------------------------------------------------------------

  // Self-service only — no permission required, same "is this your own
  // row" exemption used for GET /employees/me.
  app.get("/tasks/my-work", async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const items = await myWorkQueue(options.getRepository(), token);
      return { items };
    } catch (error) {
      return handleServiceError(error, reply);
    }
  });

  app.get(
    "/tasks/team-work",
    { preHandler: options.requirePermission("workflow.task.view_team") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const items = await teamWorkQueue(options.getRepository(), token);
        return { items };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.get<{ Querystring: { hours?: string } }>(
    "/tasks/due-soon",
    { preHandler: options.requirePermission("workflow.task.view_team") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      const hours = request.query.hours !== undefined ? Number(request.query.hours) : undefined;
      try {
        const items = await dueSoonQueue(options.getRepository(), token, hours);
        return { items };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.get(
    "/tasks/overdue",
    { preHandler: options.requirePermission("workflow.task.view_team") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const items = await overdueQueue(options.getRepository(), token);
        return { items };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.get(
    "/tasks/blocked",
    { preHandler: options.requirePermission("workflow.task.view_team") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const items = await blockedQueue(options.getRepository(), token);
        return { items };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.get(
    "/tasks/waiting-approval",
    { preHandler: options.requirePermission("workflow.task.view_team") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const items = await waitingApprovalQueue(options.getRepository(), token);
        return { items };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.get<{ Querystring: { from?: string; to?: string } }>(
    "/tasks/completed",
    { preHandler: options.requirePermission("workflow.task.view_team") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const items = await completedQueue(options.getRepository(), token, {
          from: request.query.from,
          to: request.query.to,
        });
        return { items };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  // ---------------------------------------------------------------------
  // Migration of active instances to a newer version (ticket 0063, M06d)
  // ---------------------------------------------------------------------

  app.post<{ Body: { fromVersionId: string; toVersionId: string } }>(
    "/workflow/migrations",
    { preHandler: options.requirePermission("workflow.definition.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      try {
        const migration = await createMigration(
          options.getRepository(),
          token,
          request.body.fromVersionId,
          request.body.toVersionId,
          callerUserId,
        );
        return { migration };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/workflow/migrations/:id",
    { preHandler: options.requirePermission("workflow.definition.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const migration = await getWorkflowMigration(options.getRepository(), token, request.params.id);
        return { migration };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/workflow/migrations/:id/results",
    { preHandler: options.requirePermission("workflow.definition.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const results = await listMigrationInstanceResults(options.getRepository(), token, request.params.id);
        return { results };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/workflow/migrations/:id/preview",
    { preHandler: options.requirePermission("workflow.definition.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const migration = await previewMigration(options.getRepository(), token, request.params.id);
        return { migration };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/workflow/migrations/:id/cancel",
    { preHandler: options.requirePermission("workflow.definition.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const migration = await cancelMigration(options.getRepository(), token, request.params.id);
        return { migration };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/workflow/migrations/:id/approve",
    { preHandler: options.requirePermission("workflow.definition.publish") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      try {
        const migration = await approveMigration(options.getRepository(), token, request.params.id, callerUserId);
        return { migration };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/workflow/migrations/:id/execute",
    { preHandler: options.requirePermission("workflow.definition.publish") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      try {
        const result = await executeMigration(options.getRepository(), token, request.params.id, callerUserId);
        return result;
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  // ---------------------------------------------------------------------
  // Approvals & delegation (ticket 0066, M08)
  // ---------------------------------------------------------------------

  app.get<{ Params: { stepInstanceId: string } }>(
    "/approvals/:stepInstanceId",
    { preHandler: requireApproverOrAct(options.getRepository, options.requirePermission) },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const detail = await getApprovalDetail(
          options.getRepository(),
          options.getAuthorityRepository(),
          token,
          request.params.stepInstanceId,
        );
        return { detail };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.post<{ Params: { stepInstanceId: string }; Body: { decision: ApprovalChainDecision; reason?: string | null } }>(
    "/approvals/:stepInstanceId/decide",
    { preHandler: requireApproverOrAct(options.getRepository, options.requirePermission) },
    async (request, reply) => {
      const { decision } = request.body ?? ({} as never);
      if (!decision) {
        reply.code(400);
        return { error: "decision is required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      if (!callerUserId) {
        reply.code(401);
        return { error: "missing bearer token" };
      }
      try {
        const result = await decideApprovalStep(
          options.getRepository(),
          options.getAuthorityRepository(),
          token,
          request.params.stepInstanceId,
          callerUserId,
          decision,
          request.body?.reason ?? null,
        );
        return result;
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  app.post<{ Params: { decisionId: string }; Body: { reason: string } }>(
    "/approvals/decisions/:decisionId/revoke",
    { preHandler: options.requirePermission("workflow.approval.revoke") },
    async (request, reply) => {
      const { reason } = request.body ?? ({} as never);
      if (!reason) {
        reply.code(400);
        return { error: "reason is required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      try {
        const decision = await revokeApprovalDecision(options.getRepository(), token, request.params.decisionId, callerUserId ?? "", reason);
        return { decision };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );

  // ---------------------------------------------------------------------
  // SLA timers & escalation ladders (ticket 0081, M31a)
  // ---------------------------------------------------------------------

  app.post<{
    Body: { key: string; name: string; warningThresholdSeconds: number; breachThresholdSeconds: number };
  }>(
    "/workflow/sla-definitions",
    { preHandler: options.requirePermission("workflow.sla.manage") },
    async (request, reply) => {
      const body = request.body ?? ({} as never);
      if (!body.key || !body.name || !body.warningThresholdSeconds || !body.breachThresholdSeconds) {
        reply.code(400);
        return { error: "key, name, warningThresholdSeconds and breachThresholdSeconds are required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      const slaDefinition = await createSlaDefinition(options.getRepository(), token, {
        key: body.key,
        name: body.name,
        warningThresholdSeconds: body.warningThresholdSeconds,
        breachThresholdSeconds: body.breachThresholdSeconds,
        createdBy: callerUserId,
      });
      reply.code(201);
      return { slaDefinition };
    },
  );

  app.get(
    "/workflow/sla-definitions",
    { preHandler: options.requirePermission("workflow.sla.manage") },
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const slaDefinitions = await listSlaDefinitions(options.getRepository(), token);
      return { slaDefinitions };
    },
  );

  app.post<{
    Params: { slaDefinitionId: string };
    Body: { rungOrder: number; delayAfterBreachSeconds: number; actionType: EscalationActionType; actionRoleId?: string };
  }>(
    "/workflow/sla-definitions/:slaDefinitionId/rungs",
    { preHandler: options.requirePermission("workflow.sla.manage") },
    async (request, reply) => {
      const body = request.body ?? ({} as never);
      if (!body.rungOrder || body.delayAfterBreachSeconds === undefined || !body.actionType) {
        reply.code(400);
        return { error: "rungOrder, delayAfterBreachSeconds and actionType are required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const rung = await createEscalationRung(options.getRepository(), token, {
        slaDefinitionId: request.params.slaDefinitionId,
        rungOrder: body.rungOrder,
        delayAfterBreachSeconds: body.delayAfterBreachSeconds,
        actionType: body.actionType,
        actionRoleId: body.actionRoleId ?? null,
      });
      reply.code(201);
      return { rung };
    },
  );

  app.get<{ Params: { slaDefinitionId: string } }>(
    "/workflow/sla-definitions/:slaDefinitionId/rungs",
    { preHandler: options.requirePermission("workflow.sla.manage") },
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const rungs = await listEscalationRungs(options.getRepository(), token, request.params.slaDefinitionId);
      return { rungs };
    },
  );

  // GET is the evaluation: same "read re-checks and applies the
  // outcome exactly once" shape as the baseline-change-request poll
  // (ticket 0075) — see evaluateStepSla's own doc comment.
  app.get<{ Params: { stepId: string } }>(
    "/workflow/steps/:stepId/sla-state",
    { preHandler: options.requirePermission("workflow.instance.act") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const state = await evaluateStepSla(options.getRepository(), token, request.params.stepId);
        return { state };
      } catch (error) {
        return handleServiceError(error, reply);
      }
    },
  );
}
