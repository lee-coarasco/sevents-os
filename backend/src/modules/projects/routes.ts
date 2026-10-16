import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { AuthenticatedRequest } from "../authority/guard.js";
import type { WorkflowRepository } from "../workflow/repository.js";
import type { ProjectsRepository } from "./repository.js";
import {
  DuplicateInitialBaselineError,
  MissingBaselineChangeReasonError,
  NoCurrentBaselineError,
  NotFoundError,
  addScheduleActivityDependency,
  createMilestone,
  createProject,
  createProjectType,
  createScheduleActivity,
  createWBSNode,
  createRegisterEntry,
  getBaseline,
  getProject,
  listBaselineChangeRequests,
  listBaselines,
  listMilestones,
  listProgressEntries,
  listProjectTypes,
  listProjects,
  listRegisterEntries,
  listScheduleActivities,
  listScheduleActivityDependencies,
  listWBSNodes,
  proposeBaselineChange,
  recordProgressEntry,
  removeScheduleActivityDependency,
  resolveBaselineChangeRequest,
  setInitialBaseline,
  updateMilestone,
  updateProject,
  updateRegisterEntry,
  updateScheduleActivity,
  updateWBSNode,
} from "./service.js";
import type { RegisterEntryKind, RegisterEntryStatus } from "./types.js";

export interface ProjectsRouteOptions {
  getRepository: () => ProjectsRepository;
  getWorkflowRepository: () => WorkflowRepository;
  /** Reuses tenancy.project.manage (ticket 0056) — project setup is project administration, not a new actor class. */
  requirePermission: (permissionKey: string) => preHandlerHookHandler;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export async function projectsRoutes(app: FastifyInstance, options: ProjectsRouteOptions) {
  app.addHook("preHandler", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return reply.send({ error: "missing bearer token" });
    }
  });

  app.post<{
    Body: {
      companyId: string;
      name: string;
      code?: string;
      clientName?: string;
      location?: string;
      projectTypeId?: string;
      contractReference?: string;
      contractValue?: number;
      contractCurrency?: string;
      projectManagerId?: string;
      baselineStartDate?: string;
      baselineEndDate?: string;
      budgetAmount?: number;
      budgetCurrency?: string;
    };
  }>(
    "/projects",
    { preHandler: options.requirePermission("tenancy.project.manage") },
    async (request, reply) => {
      const body = request.body ?? ({} as never);
      if (!body.companyId || !body.name) {
        reply.code(400);
        return { error: "companyId and name are required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const project = await createProject(options.getRepository(), token, {
        company_id: body.companyId,
        name: body.name,
        code: body.code ?? null,
        client_name: body.clientName ?? null,
        location: body.location ?? null,
        project_type_id: body.projectTypeId ?? null,
        contract_reference: body.contractReference ?? null,
        contract_value: body.contractValue ?? null,
        contract_currency: body.contractCurrency ?? null,
        project_manager_id: body.projectManagerId ?? null,
        baseline_start_date: body.baselineStartDate ?? null,
        baseline_end_date: body.baselineEndDate ?? null,
        budget_amount: body.budgetAmount ?? null,
        budget_currency: body.budgetCurrency ?? null,
      });
      reply.code(201);
      return { project };
    },
  );

  app.get("/projects", async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const projects = await listProjects(options.getRepository(), token);
    return { projects };
  });

  app.get<{ Params: { id: string } }>(
    "/projects/:id",
    { preHandler: options.requirePermission("tenancy.project.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const project = await getProject(options.getRepository(), token, request.params.id);
        return { project };
      } catch (error) {
        if (error instanceof NotFoundError) {
          reply.code(404);
          return { error: error.message };
        }
        throw error;
      }
    },
  );

  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      code?: string | null;
      status?: "active" | "on_hold" | "closed";
      clientName?: string | null;
      location?: string | null;
      projectTypeId?: string | null;
      contractReference?: string | null;
      contractValue?: number | null;
      contractCurrency?: string | null;
      projectManagerId?: string | null;
      baselineStartDate?: string | null;
      baselineEndDate?: string | null;
      budgetAmount?: number | null;
      budgetCurrency?: string | null;
    };
  }>(
    "/projects/:id",
    { preHandler: options.requirePermission("tenancy.project.manage") },
    async (request, reply) => {
      const body = request.body ?? {};
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const project = await updateProject(options.getRepository(), token, request.params.id, {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.code !== undefined ? { code: body.code } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.clientName !== undefined ? { client_name: body.clientName } : {}),
          ...(body.location !== undefined ? { location: body.location } : {}),
          ...(body.projectTypeId !== undefined ? { project_type_id: body.projectTypeId } : {}),
          ...(body.contractReference !== undefined ? { contract_reference: body.contractReference } : {}),
          ...(body.contractValue !== undefined ? { contract_value: body.contractValue } : {}),
          ...(body.contractCurrency !== undefined ? { contract_currency: body.contractCurrency } : {}),
          ...(body.projectManagerId !== undefined ? { project_manager_id: body.projectManagerId } : {}),
          ...(body.baselineStartDate !== undefined ? { baseline_start_date: body.baselineStartDate } : {}),
          ...(body.baselineEndDate !== undefined ? { baseline_end_date: body.baselineEndDate } : {}),
          ...(body.budgetAmount !== undefined ? { budget_amount: body.budgetAmount } : {}),
          ...(body.budgetCurrency !== undefined ? { budget_currency: body.budgetCurrency } : {}),
        });
        return { project };
      } catch (error) {
        if (error instanceof NotFoundError) {
          reply.code(404);
          return { error: error.message };
        }
        throw error;
      }
    },
  );

  app.post<{ Body: { name: string; code?: string } }>(
    "/project-types",
    { preHandler: options.requirePermission("tenancy.project.manage") },
    async (request, reply) => {
      const { name, code } = request.body ?? ({} as never);
      if (!name) {
        reply.code(400);
        return { error: "name is required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const projectType = await createProjectType(options.getRepository(), token, {
        name,
        code: code ?? null,
      });
      reply.code(201);
      return { projectType };
    },
  );

  app.get("/project-types", async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const projectTypes = await listProjectTypes(options.getRepository(), token);
    return { projectTypes };
  });

  app.post<{
    Params: { projectId: string };
    Body: { parentWbsNodeId?: string; code: string; name: string; sequence?: number; costCodeId?: string };
  }>(
    "/projects/:projectId/wbs-nodes",
    { preHandler: options.requirePermission("tenancy.project.manage") },
    async (request, reply) => {
      const body = request.body ?? ({} as never);
      if (!body.code || !body.name) {
        reply.code(400);
        return { error: "code and name are required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const wbsNode = await createWBSNode(options.getRepository(), token, {
        project_id: request.params.projectId,
        parent_wbs_node_id: body.parentWbsNodeId ?? null,
        code: body.code,
        name: body.name,
        sequence: body.sequence,
        cost_code_id: body.costCodeId ?? null,
      });
      reply.code(201);
      return { wbsNode };
    },
  );

  app.get<{ Params: { projectId: string } }>(
    "/projects/:projectId/wbs-nodes",
    { preHandler: options.requirePermission("tenancy.project.manage") },
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const wbsNodes = await listWBSNodes(options.getRepository(), token, request.params.projectId);
      return { wbsNodes };
    },
  );

  app.patch<{
    Params: { wbsNodeId: string };
    Body: { name?: string; sequence?: number; parentWbsNodeId?: string | null; costCodeId?: string | null };
  }>(
    "/wbs-nodes/:wbsNodeId",
    { preHandler: options.requirePermission("tenancy.project.manage") },
    async (request, reply) => {
      const body = request.body ?? {};
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const wbsNode = await updateWBSNode(options.getRepository(), token, request.params.wbsNodeId, {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.sequence !== undefined ? { sequence: body.sequence } : {}),
          ...(body.parentWbsNodeId !== undefined ? { parent_wbs_node_id: body.parentWbsNodeId } : {}),
          ...(body.costCodeId !== undefined ? { cost_code_id: body.costCodeId } : {}),
        });
        return { wbsNode };
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
    Params: { projectId: string };
    Body: { wbsNodeId?: string; name: string; targetDate: string };
  }>(
    "/projects/:projectId/milestones",
    { preHandler: options.requirePermission("tenancy.project.manage") },
    async (request, reply) => {
      const body = request.body ?? ({} as never);
      if (!body.name || !body.targetDate) {
        reply.code(400);
        return { error: "name and targetDate are required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const milestone = await createMilestone(options.getRepository(), token, {
        project_id: request.params.projectId,
        wbs_node_id: body.wbsNodeId ?? null,
        name: body.name,
        target_date: body.targetDate,
      });
      reply.code(201);
      return { milestone };
    },
  );

  app.get<{ Params: { projectId: string } }>(
    "/projects/:projectId/milestones",
    { preHandler: options.requirePermission("tenancy.project.manage") },
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const milestones = await listMilestones(options.getRepository(), token, request.params.projectId);
      return { milestones };
    },
  );

  app.patch<{
    Params: { milestoneId: string };
    Body: { name?: string; targetDate?: string; actualDate?: string | null; status?: "pending" | "achieved" | "missed" };
  }>(
    "/milestones/:milestoneId",
    { preHandler: options.requirePermission("tenancy.project.manage") },
    async (request, reply) => {
      const body = request.body ?? {};
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const milestone = await updateMilestone(options.getRepository(), token, request.params.milestoneId, {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.targetDate !== undefined ? { target_date: body.targetDate } : {}),
          ...(body.actualDate !== undefined ? { actual_date: body.actualDate } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
        });
        return { milestone };
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
    Params: { projectId: string };
    Body: { wbsNodeId?: string; name: string; plannedStart?: string; plannedEnd?: string };
  }>(
    "/projects/:projectId/schedule-activities",
    { preHandler: options.requirePermission("tenancy.project.manage") },
    async (request, reply) => {
      const body = request.body ?? ({} as never);
      if (!body.name) {
        reply.code(400);
        return { error: "name is required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const scheduleActivity = await createScheduleActivity(options.getRepository(), token, {
        project_id: request.params.projectId,
        wbs_node_id: body.wbsNodeId ?? null,
        name: body.name,
        planned_start: body.plannedStart ?? null,
        planned_end: body.plannedEnd ?? null,
      });
      reply.code(201);
      return { scheduleActivity };
    },
  );

  app.get<{ Params: { projectId: string } }>(
    "/projects/:projectId/schedule-activities",
    { preHandler: options.requirePermission("tenancy.project.manage") },
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const scheduleActivities = await listScheduleActivities(
        options.getRepository(),
        token,
        request.params.projectId,
      );
      return { scheduleActivities };
    },
  );

  app.patch<{
    Params: { activityId: string };
    Body: {
      name?: string;
      plannedStart?: string | null;
      plannedEnd?: string | null;
      actualStart?: string | null;
      actualEnd?: string | null;
      percentComplete?: number;
    };
  }>(
    "/schedule-activities/:activityId",
    { preHandler: options.requirePermission("tenancy.project.manage") },
    async (request, reply) => {
      const body = request.body ?? {};
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const scheduleActivity = await updateScheduleActivity(
          options.getRepository(),
          token,
          request.params.activityId,
          {
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.plannedStart !== undefined ? { planned_start: body.plannedStart } : {}),
            ...(body.plannedEnd !== undefined ? { planned_end: body.plannedEnd } : {}),
            ...(body.actualStart !== undefined ? { actual_start: body.actualStart } : {}),
            ...(body.actualEnd !== undefined ? { actual_end: body.actualEnd } : {}),
            ...(body.percentComplete !== undefined ? { percent_complete: body.percentComplete } : {}),
          },
        );
        return { scheduleActivity };
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
    Params: { activityId: string };
    Body: { dependsOnActivityId: string; dependencyType?: "finish_to_start" | "start_to_start" | "finish_to_finish" | "start_to_finish" };
  }>(
    "/schedule-activities/:activityId/dependencies",
    { preHandler: options.requirePermission("tenancy.project.manage") },
    async (request, reply) => {
      const { dependsOnActivityId, dependencyType } = request.body ?? ({} as never);
      if (!dependsOnActivityId) {
        reply.code(400);
        return { error: "dependsOnActivityId is required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const dependency = await addScheduleActivityDependency(options.getRepository(), token, {
        activity_id: request.params.activityId,
        depends_on_activity_id: dependsOnActivityId,
        dependency_type: dependencyType,
      });
      reply.code(201);
      return { dependency };
    },
  );

  app.get<{ Params: { activityId: string } }>(
    "/schedule-activities/:activityId/dependencies",
    { preHandler: options.requirePermission("tenancy.project.manage") },
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const dependencies = await listScheduleActivityDependencies(
        options.getRepository(),
        token,
        request.params.activityId,
      );
      return { dependencies };
    },
  );

  app.delete<{ Params: { activityId: string; dependsOnActivityId: string } }>(
    "/schedule-activities/:activityId/dependencies/:dependsOnActivityId",
    { preHandler: options.requirePermission("tenancy.project.manage") },
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      await removeScheduleActivityDependency(
        options.getRepository(),
        token,
        request.params.activityId,
        request.params.dependsOnActivityId,
      );
      return { ok: true };
    },
  );

  app.post<{ Params: { activityId: string }; Body: { percentComplete: number; note?: string } }>(
    "/schedule-activities/:activityId/progress",
    { preHandler: options.requirePermission("project.progress.record") },
    async (request, reply) => {
      const { percentComplete, note } = request.body ?? ({} as never);
      if (percentComplete === undefined || percentComplete === null) {
        reply.code(400);
        return { error: "percentComplete is required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      const progressEntry = await recordProgressEntry(options.getRepository(), token, {
        schedule_activity_id: request.params.activityId,
        recorded_by: callerUserId,
        percent_complete: percentComplete,
        note: note ?? null,
      });
      reply.code(201);
      return { progressEntry };
    },
  );

  app.get<{ Params: { activityId: string } }>(
    "/schedule-activities/:activityId/progress",
    { preHandler: options.requirePermission("project.progress.record") },
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const progressEntries = await listProgressEntries(options.getRepository(), token, request.params.activityId);
      return { progressEntries };
    },
  );

  // -------------------------------------------------------------------
  // Baseline snapshots & baseline-change control (ticket 0075, M09c)
  // -------------------------------------------------------------------

  app.post<{ Params: { projectId: string } }>(
    "/projects/:projectId/baselines",
    { preHandler: options.requirePermission("project.baseline.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      try {
        const baseline = await setInitialBaseline(options.getRepository(), token, request.params.projectId, callerUserId);
        reply.code(201);
        return { baseline };
      } catch (error) {
        if (error instanceof DuplicateInitialBaselineError) {
          reply.code(409);
          return { error: error.message };
        }
        throw error;
      }
    },
  );

  app.get<{ Params: { projectId: string } }>(
    "/projects/:projectId/baselines",
    { preHandler: options.requirePermission("project.baseline.manage") },
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const baselines = await listBaselines(options.getRepository(), token, request.params.projectId);
      return { baselines };
    },
  );

  app.get<{ Params: { baselineId: string } }>(
    "/baselines/:baselineId",
    { preHandler: options.requirePermission("project.baseline.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const baseline = await getBaseline(options.getRepository(), token, request.params.baselineId);
        return { baseline };
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
    Params: { projectId: string };
    Body: { definitionId: string; proposedSnapshot: Record<string, unknown>; reason: string; impactAnalysis: string };
  }>(
    "/projects/:projectId/baseline-change-requests",
    { preHandler: options.requirePermission("project.baseline.manage") },
    async (request, reply) => {
      const body = request.body ?? ({} as never);
      if (!body.definitionId || !body.proposedSnapshot || !body.reason || !body.impactAnalysis) {
        reply.code(400);
        return { error: "definitionId, proposedSnapshot, reason and impactAnalysis are required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      try {
        const changeRequest = await proposeBaselineChange(options.getRepository(), options.getWorkflowRepository(), token, {
          projectId: request.params.projectId,
          definitionId: body.definitionId,
          proposedSnapshot: body.proposedSnapshot,
          reason: body.reason,
          impactAnalysis: body.impactAnalysis,
          submittedBy: callerUserId,
        });
        reply.code(201);
        return { changeRequest };
      } catch (error) {
        if (error instanceof NoCurrentBaselineError || error instanceof MissingBaselineChangeReasonError) {
          reply.code(400);
          return { error: error.message };
        }
        throw error;
      }
    },
  );

  app.get<{ Params: { projectId: string } }>(
    "/projects/:projectId/baseline-change-requests",
    { preHandler: options.requirePermission("project.baseline.manage") },
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const changeRequests = await listBaselineChangeRequests(options.getRepository(), token, request.params.projectId);
      return { changeRequests };
    },
  );

  // GET is the poll: each read re-checks the linked workflow instance
  // and applies the outcome exactly once (resolveBaselineChangeRequest
  // is idempotent once status leaves 'pending').
  app.get<{ Params: { requestId: string } }>(
    "/baseline-change-requests/:requestId",
    { preHandler: options.requirePermission("project.baseline.manage") },
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const changeRequest = await resolveBaselineChangeRequest(
          options.getRepository(),
          options.getWorkflowRepository(),
          token,
          request.params.requestId,
        );
        return { changeRequest };
      } catch (error) {
        if (error instanceof NotFoundError) {
          reply.code(404);
          return { error: error.message };
        }
        throw error;
      }
    },
  );

  // -------------------------------------------------------------------
  // Issue/risk/decision/assumption/dependency/change-request register
  // (ticket 0076, M09d)
  // -------------------------------------------------------------------

  app.post<{
    Params: { projectId: string };
    Body: {
      kind: RegisterEntryKind;
      title: string;
      description?: string;
      ownerId?: string;
      dueDate?: string;
      likelihood?: string;
      impact?: string;
    };
  }>(
    "/projects/:projectId/register",
    { preHandler: options.requirePermission("tenancy.project.manage") },
    async (request, reply) => {
      const body = request.body ?? ({} as never);
      if (!body.kind || !body.title) {
        reply.code(400);
        return { error: "kind and title are required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      const entry = await createRegisterEntry(options.getRepository(), token, {
        projectId: request.params.projectId,
        kind: body.kind,
        title: body.title,
        description: body.description ?? null,
        ownerId: body.ownerId ?? null,
        dueDate: body.dueDate ?? null,
        raisedBy: callerUserId,
        likelihood: body.likelihood ?? null,
        impact: body.impact ?? null,
      });
      reply.code(201);
      return { entry };
    },
  );

  app.get<{ Params: { projectId: string }; Querystring: { kind?: RegisterEntryKind; status?: RegisterEntryStatus } }>(
    "/projects/:projectId/register",
    { preHandler: options.requirePermission("tenancy.project.manage") },
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const entries = await listRegisterEntries(options.getRepository(), token, request.params.projectId, {
        kind: request.query.kind,
        status: request.query.status,
      });
      return { entries };
    },
  );

  app.patch<{
    Params: { projectId: string; entryId: string };
    Body: {
      title?: string;
      description?: string | null;
      status?: "open" | "in_progress" | "resolved" | "closed";
      ownerId?: string | null;
      dueDate?: string | null;
      resolvedAt?: string | null;
      resolutionNote?: string | null;
      likelihood?: string | null;
      impact?: string | null;
    };
  }>(
    "/projects/:projectId/register/:entryId",
    { preHandler: options.requirePermission("tenancy.project.manage") },
    async (request, reply) => {
      const body = request.body ?? {};
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const entry = await updateRegisterEntry(options.getRepository(), token, request.params.entryId, {
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.ownerId !== undefined ? { owner_id: body.ownerId } : {}),
          ...(body.dueDate !== undefined ? { due_date: body.dueDate } : {}),
          ...(body.resolvedAt !== undefined ? { resolved_at: body.resolvedAt } : {}),
          ...(body.resolutionNote !== undefined ? { resolution_note: body.resolutionNote } : {}),
          ...(body.likelihood !== undefined ? { likelihood: body.likelihood } : {}),
          ...(body.impact !== undefined ? { impact: body.impact } : {}),
        });
        return { entry };
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
