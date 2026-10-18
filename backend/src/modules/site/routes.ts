import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { SiteRepository } from "./repository.js";
import {
  InvalidStateError,
  NotFoundError,
  ValidationError,
  addBlocker,
  addEquipmentEntry,
  addManpowerEntry,
  addWorkProgressEntry,
  approveDpr,
  createDpr,
  createSiteInstruction,
  deleteDpr,
  getDprDetail,
  getSiteInstruction,
  listDprs,
  listSiteInstructions,
  rejectDpr,
  removeBlocker,
  removeEquipmentEntry,
  removeManpowerEntry,
  removeWorkProgressEntry,
  submitDpr,
  updateBlocker,
  updateDpr,
  updateSiteInstruction,
} from "./service.js";
import type {
  BlockerCategory,
  BlockerStatus,
  DprStatus,
  SiteInstructionPriority,
  SiteInstructionStatus,
  WeatherCondition,
  WeatherImpact,
} from "./types.js";

export interface SiteRouteOptions {
  getRepository: () => SiteRepository;
  requirePermission: (permissionKey: string) => preHandlerHookHandler;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export async function siteRoutes(app: FastifyInstance, options: SiteRouteOptions) {
  app.addHook("preHandler", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return reply.send({ error: "missing bearer token" });
    }
  });

  const dprManageGuard = { preHandler: options.requirePermission("site.dpr.manage") };
  const dprApproveGuard = { preHandler: options.requirePermission("site.dpr.approve") };
  const instructionManageGuard = { preHandler: options.requirePermission("site.instruction.manage") };

  // =========================================================================
  // DPR CRUD & Lifecycle
  // =========================================================================

  // List DPRs for a project
  app.get<{
    Params: { projectId: string };
    Querystring: { status?: DprStatus; fromDate?: string; toDate?: string };
  }>("/projects/:projectId/site/dprs", async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const dprs = await listDprs(options.getRepository(), token, request.params.projectId, request.query);
    return { dprs };
  });

  // Create DPR
  app.post<{
    Params: { projectId: string };
    Body: {
      reportDate: string;
      weatherCondition?: WeatherCondition;
      temperatureCelsius?: number | null;
      weatherImpact?: WeatherImpact | null;
      generalNotes?: string | null;
      siteEngineerId?: string | null;
      supervisorId?: string | null;
    };
  }>("/projects/:projectId/site/dprs", dprManageGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const dpr = await createDpr(options.getRepository(), token, {
        project_id: request.params.projectId,
        report_date: body.reportDate,
        weather_condition: body.weatherCondition,
        temperature_celsius: body.temperatureCelsius,
        weather_impact: body.weatherImpact,
        general_notes: body.generalNotes,
        site_engineer_id: body.siteEngineerId,
        supervisor_id: body.supervisorId,
      });
      reply.code(201);
      return { dpr };
    } catch (err) {
      if (err instanceof ValidationError) {
        reply.code(400);
        return { error: err.message };
      }
      throw err;
    }
  });

  // Get DPR Detail (with child arrays)
  app.get<{ Params: { dprId: string } }>("/site/dprs/:dprId", async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const detail = await getDprDetail(options.getRepository(), token, request.params.dprId);
      return { dpr: detail };
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      throw err;
    }
  });

  // Update DPR Header / Notes / Weather
  app.patch<{
    Params: { dprId: string };
    Body: {
      weatherCondition?: WeatherCondition;
      temperatureCelsius?: number | null;
      weatherImpact?: WeatherImpact | null;
      generalNotes?: string | null;
      siteEngineerId?: string | null;
      supervisorId?: string | null;
    };
  }>("/site/dprs/:dprId", dprManageGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const dpr = await updateDpr(options.getRepository(), token, request.params.dprId, {
        weather_condition: body.weatherCondition,
        temperature_celsius: body.temperatureCelsius,
        weather_impact: body.weatherImpact,
        general_notes: body.generalNotes,
        site_engineer_id: body.siteEngineerId,
        supervisor_id: body.supervisorId,
      });
      return { dpr };
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      if (err instanceof InvalidStateError || err instanceof ValidationError) {
        reply.code(400);
        return { error: err.message };
      }
      throw err;
    }
  });

  // Delete DPR (draft only)
  app.delete<{ Params: { dprId: string } }>("/site/dprs/:dprId", dprManageGuard, async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      await deleteDpr(options.getRepository(), token, request.params.dprId);
      reply.code(204);
      return;
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      if (err instanceof InvalidStateError) {
        reply.code(400);
        return { error: err.message };
      }
      throw err;
    }
  });

  // Submit DPR
  app.post<{ Params: { dprId: string } }>("/site/dprs/:dprId/submit", dprManageGuard, async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const dpr = await submitDpr(options.getRepository(), token, request.params.dprId);
      return { dpr };
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      if (err instanceof InvalidStateError) {
        reply.code(400);
        return { error: err.message };
      }
      throw err;
    }
  });

  // Approve DPR
  app.post<{
    Params: { dprId: string };
    Body?: { approvedBy?: string };
  }>("/site/dprs/:dprId/approve", dprApproveGuard, async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const approvedBy = request.body?.approvedBy || "supervisor";
      const dpr = await approveDpr(options.getRepository(), token, request.params.dprId, approvedBy);
      return { dpr };
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      if (err instanceof InvalidStateError) {
        reply.code(400);
        return { error: err.message };
      }
      throw err;
    }
  });

  // Reject DPR
  app.post<{
    Params: { dprId: string };
    Body: { rejectionReason: string };
  }>("/site/dprs/:dprId/reject", dprApproveGuard, async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const dpr = await rejectDpr(
        options.getRepository(),
        token,
        request.params.dprId,
        request.body?.rejectionReason,
      );
      return { dpr };
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      if (err instanceof InvalidStateError || err instanceof ValidationError) {
        reply.code(400);
        return { error: err.message };
      }
      throw err;
    }
  });

  // =========================================================================
  // DPR Manpower Entries
  // =========================================================================

  app.post<{
    Params: { dprId: string };
    Body: {
      trade: string;
      headcount: number;
      hoursWorked?: number;
      subcontractorName?: string | null;
      notes?: string | null;
    };
  }>("/site/dprs/:dprId/manpower", dprManageGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const entry = await addManpowerEntry(options.getRepository(), token, {
        dpr_id: request.params.dprId,
        trade: body.trade,
        headcount: body.headcount,
        hours_worked: body.hoursWorked,
        subcontractor_name: body.subcontractorName,
        notes: body.notes,
      });
      reply.code(201);
      return { entry };
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      if (err instanceof InvalidStateError || err instanceof ValidationError) {
        reply.code(400);
        return { error: err.message };
      }
      throw err;
    }
  });

  app.delete<{
    Params: { dprId: string; entryId: string };
  }>("/site/dprs/:dprId/manpower/:entryId", dprManageGuard, async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      await removeManpowerEntry(
        options.getRepository(),
        token,
        request.params.dprId,
        request.params.entryId,
      );
      reply.code(204);
      return;
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      if (err instanceof InvalidStateError) {
        reply.code(400);
        return { error: err.message };
      }
      throw err;
    }
  });

  // =========================================================================
  // DPR Equipment Entries
  // =========================================================================

  app.post<{
    Params: { dprId: string };
    Body: {
      equipmentType: string;
      quantity?: number;
      operatingHours?: number;
      idleHours?: number;
      notes?: string | null;
    };
  }>("/site/dprs/:dprId/equipment", dprManageGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const entry = await addEquipmentEntry(options.getRepository(), token, {
        dpr_id: request.params.dprId,
        equipment_type: body.equipmentType,
        quantity: body.quantity,
        operating_hours: body.operatingHours,
        idle_hours: body.idleHours,
        notes: body.notes,
      });
      reply.code(201);
      return { entry };
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      if (err instanceof InvalidStateError || err instanceof ValidationError) {
        reply.code(400);
        return { error: err.message };
      }
      throw err;
    }
  });

  app.delete<{
    Params: { dprId: string; entryId: string };
  }>("/site/dprs/:dprId/equipment/:entryId", dprManageGuard, async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      await removeEquipmentEntry(
        options.getRepository(),
        token,
        request.params.dprId,
        request.params.entryId,
      );
      reply.code(204);
      return;
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      if (err instanceof InvalidStateError) {
        reply.code(400);
        return { error: err.message };
      }
      throw err;
    }
  });

  // =========================================================================
  // DPR Work Progress Entries
  // =========================================================================

  app.post<{
    Params: { dprId: string };
    Body: {
      scheduleActivityId?: string | null;
      locationOrGrid?: string | null;
      description: string;
      quantityExecuted?: number | null;
      uom?: string | null;
      notes?: string | null;
    };
  }>("/site/dprs/:dprId/work-progress", dprManageGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const entry = await addWorkProgressEntry(options.getRepository(), token, {
        dpr_id: request.params.dprId,
        schedule_activity_id: body.scheduleActivityId,
        location_or_grid: body.locationOrGrid,
        description: body.description,
        quantity_executed: body.quantityExecuted,
        uom: body.uom,
        notes: body.notes,
      });
      reply.code(201);
      return { entry };
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      if (err instanceof InvalidStateError || err instanceof ValidationError) {
        reply.code(400);
        return { error: err.message };
      }
      throw err;
    }
  });

  app.delete<{
    Params: { dprId: string; entryId: string };
  }>("/site/dprs/:dprId/work-progress/:entryId", dprManageGuard, async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      await removeWorkProgressEntry(
        options.getRepository(),
        token,
        request.params.dprId,
        request.params.entryId,
      );
      reply.code(204);
      return;
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      if (err instanceof InvalidStateError) {
        reply.code(400);
        return { error: err.message };
      }
      throw err;
    }
  });

  // =========================================================================
  // DPR Blockers
  // =========================================================================

  app.post<{
    Params: { dprId: string };
    Body: {
      category: BlockerCategory;
      description: string;
      impactHours?: number;
      resolutionAction?: string | null;
      status?: BlockerStatus;
    };
  }>("/site/dprs/:dprId/blockers", dprManageGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const blocker = await addBlocker(options.getRepository(), token, {
        dpr_id: request.params.dprId,
        category: body.category,
        description: body.description,
        impact_hours: body.impactHours,
        resolution_action: body.resolutionAction,
        status: body.status,
      });
      reply.code(201);
      return { blocker };
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      if (err instanceof InvalidStateError || err instanceof ValidationError) {
        reply.code(400);
        return { error: err.message };
      }
      throw err;
    }
  });

  app.patch<{
    Params: { dprId: string; blockerId: string };
    Body: {
      category?: BlockerCategory;
      description?: string;
      impactHours?: number;
      resolutionAction?: string | null;
      status?: BlockerStatus;
    };
  }>("/site/dprs/:dprId/blockers/:blockerId", dprManageGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const blocker = await updateBlocker(options.getRepository(), token, request.params.blockerId, {
        category: body.category,
        description: body.description,
        impact_hours: body.impactHours,
        resolution_action: body.resolutionAction,
        status: body.status,
      });
      return { blocker };
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      throw err;
    }
  });

  app.delete<{
    Params: { dprId: string; blockerId: string };
  }>("/site/dprs/:dprId/blockers/:blockerId", dprManageGuard, async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      await removeBlocker(
        options.getRepository(),
        token,
        request.params.dprId,
        request.params.blockerId,
      );
      reply.code(204);
      return;
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      if (err instanceof InvalidStateError) {
        reply.code(400);
        return { error: err.message };
      }
      throw err;
    }
  });

  // =========================================================================
  // Site Instructions
  // =========================================================================

  app.get<{
    Params: { projectId: string };
    Querystring: { status?: SiteInstructionStatus; priority?: SiteInstructionPriority };
  }>("/projects/:projectId/site/instructions", async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const instructions = await listSiteInstructions(
      options.getRepository(),
      token,
      request.params.projectId,
      request.query,
    );
    return { instructions };
  });

  app.post<{
    Params: { projectId: string };
    Body: {
      dprId?: string | null;
      instructionNumber: string;
      issuedBy: string;
      recipient: string;
      instructionText: string;
      priority?: SiteInstructionPriority;
      status?: SiteInstructionStatus;
      targetCompletionDate?: string | null;
    };
  }>("/projects/:projectId/site/instructions", instructionManageGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const instruction = await createSiteInstruction(options.getRepository(), token, {
        project_id: request.params.projectId,
        dpr_id: body.dprId,
        instruction_number: body.instructionNumber,
        issued_by: body.issuedBy,
        recipient: body.recipient,
        instruction_text: body.instructionText,
        priority: body.priority,
        status: body.status,
        target_completion_date: body.targetCompletionDate,
      });
      reply.code(201);
      return { instruction };
    } catch (err) {
      if (err instanceof ValidationError) {
        reply.code(400);
        return { error: err.message };
      }
      throw err;
    }
  });

  app.get<{ Params: { instructionId: string } }>("/site/instructions/:instructionId", async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const instruction = await getSiteInstruction(options.getRepository(), token, request.params.instructionId);
      return { instruction };
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      throw err;
    }
  });

  app.patch<{
    Params: { instructionId: string };
    Body: {
      instructionText?: string;
      priority?: SiteInstructionPriority;
      status?: SiteInstructionStatus;
      targetCompletionDate?: string | null;
    };
  }>("/site/instructions/:instructionId", instructionManageGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const instruction = await updateSiteInstruction(options.getRepository(), token, request.params.instructionId, {
        instruction_text: body.instructionText,
        priority: body.priority,
        status: body.status,
        target_completion_date: body.targetCompletionDate,
      });
      return { instruction };
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      throw err;
    }
  });
}
