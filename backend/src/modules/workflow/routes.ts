import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { AuthenticatedRequest } from "../authority/guard.js";
import type { WorkflowRepository } from "./repository.js";
import {
  DefinitionNotApprovedError,
  DefinitionNotDraftError,
  DefinitionNotUnderReviewError,
  IncompleteGateError,
  InstanceNotFoundError,
  InstanceNotPausedError,
  InstanceNotRunningError,
  InvalidNodeTypeError,
  NoStartNodeError,
  RollbackTargetNotPublishedError,
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
  cancelInstance,
  completeStepInstance,
  createDraftVersion,
  createWorkflowDefinition,
  getVersionGraph,
  getWorkflowDefinition,
  getWorkflowInstance,
  listVersions,
  listWorkflowDefinitions,
  pauseInstance,
  publishVersion,
  recordApproval,
  resumeInstance,
  rollbackToVersion,
  simulateVersion,
  startWorkflowInstance,
  submitForApproval,
  validateVersion,
} from "./service.js";
import type { AddConditionToVersionInput, AddNodeToVersionInput, AddTransitionToVersionInput, CompleteStepInstanceOptions } from "./service.js";
import type { ApprovalDecision, DefinitionStatus, SimulationTestCase } from "./types.js";

export interface WorkflowRouteOptions {
  getRepository: () => WorkflowRepository;
  /** workflow.definition.manage for authoring, workflow.definition.publish for approve/publish/rollback. */
  requirePermission: (permissionKey: string) => preHandlerHookHandler;
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
  if (error instanceof InstanceNotFoundError || error instanceof StepInstanceNotFoundError) {
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
    error instanceof UnregisteredServiceError
  ) {
    reply.code(400);
    return { error: error.message };
  }
  throw error;
}

export async function workflowRoutes(app: FastifyInstance, options: WorkflowRouteOptions) {
  app.addHook("preHandler", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return reply.send({ error: "missing bearer token" });
    }
  });

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
}
