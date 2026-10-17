import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { EngineeringRepository } from "./repository.js";
import type { MasterDataRepository } from "../masterdata/repository.js";
import {
  NotFoundError,
  DraftOnlyError,
  listDesignBriefs,
  getDesignBrief,
  createDesignBrief,
  updateDesignBrief,
  deleteDesignBrief,
  listRfis,
  getRfi,
  createRfi,
  updateRfi,
  listIFCRegister,
  listAsBuilt,
  createAsBuilt,
  updateAsBuilt,
} from "./service.js";
import type { RfiStatus } from "./types.js";

export interface EngineeringRouteOptions {
  getRepository: () => EngineeringRepository;
  getMasterDataRepository: () => MasterDataRepository;
  requirePermission: (permissionKey: string) => preHandlerHookHandler;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

const RFI_STATUSES: RfiStatus[] = ["open", "responded", "closed", "cancelled"];

export async function engineeringRoutes(app: FastifyInstance, options: EngineeringRouteOptions) {
  app.addHook("preHandler", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return reply.send({ error: "missing bearer token" });
    }
  });

  const briefGuard = { preHandler: options.requirePermission("engineering.design_brief.manage") };
  const rfiGuard = { preHandler: options.requirePermission("engineering.rfi.manage") };
  const asBuiltGuard = { preHandler: options.requirePermission("engineering.as_built.manage") };

  // ---- Design briefs ---------------------------------------------------

  app.get<{ Params: { projectId: string } }>(
    "/projects/:projectId/design-briefs",
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const briefs = await listDesignBriefs(
        options.getRepository(),
        token,
        request.params.projectId,
      );
      return { designBriefs: briefs };
    },
  );

  app.post<{
    Params: { projectId: string };
    Body: {
      title: string;
      discipline?: string;
      scopeDescription?: string;
      referenceDocumentIds?: string[];
    };
  }>("/projects/:projectId/design-briefs", briefGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    if (!body.title) {
      reply.code(400);
      return { error: "title is required" };
    }
    const token = bearerToken(request.headers.authorization) as string;
    const brief = await createDesignBrief(options.getRepository(), token, {
      project_id: request.params.projectId,
      title: body.title,
      discipline: body.discipline ?? null,
      scope_description: body.scopeDescription ?? null,
      reference_document_ids: body.referenceDocumentIds ?? [],
      created_by: null,
    });
    reply.code(201);
    return { designBrief: brief };
  });

  app.get<{ Params: { id: string } }>("/design-briefs/:id", async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const brief = await getDesignBrief(options.getRepository(), token, request.params.id);
      return { designBrief: brief };
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      throw err;
    }
  });

  app.patch<{
    Params: { id: string };
    Body: {
      title?: string;
      discipline?: string | null;
      scopeDescription?: string | null;
      status?: string;
      referenceDocumentIds?: string[];
      issuedBy?: string | null;
      issuedAt?: string | null;
    };
  }>("/design-briefs/:id", briefGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const brief = await updateDesignBrief(options.getRepository(), token, request.params.id, {
        title: body.title,
        discipline: body.discipline,
        scope_description: body.scopeDescription,
        status: body.status as "draft" | "issued" | "superseded" | undefined,
        reference_document_ids: body.referenceDocumentIds,
        issued_by: body.issuedBy,
        issued_at: body.issuedAt,
      });
      return { designBrief: brief };
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      throw err;
    }
  });

  app.delete<{ Params: { id: string } }>("/design-briefs/:id", briefGuard, async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      await deleteDesignBrief(options.getRepository(), token, request.params.id);
      reply.code(204);
      return;
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      if (err instanceof DraftOnlyError) {
        reply.code(409);
        return { error: err.message };
      }
      throw err;
    }
  });

  // ---- RFIs ------------------------------------------------------------

  app.get<{ Params: { projectId: string }; Querystring: { status?: string } }>(
    "/projects/:projectId/rfis",
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const status =
        request.query.status && RFI_STATUSES.includes(request.query.status as RfiStatus)
          ? (request.query.status as RfiStatus)
          : undefined;
      const rfis = await listRfis(options.getRepository(), token, request.params.projectId, status);
      return { rfis };
    },
  );

  app.post<{
    Params: { projectId: string };
    Body: {
      subject: string;
      description?: string;
      addressedToUserId?: string;
      addressedToContactId?: string;
      dateRaised?: string;
      dateRequired?: string;
      referenceDocumentIds?: string[];
      raisedBy?: string;
    };
  }>("/projects/:projectId/rfis", rfiGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    if (!body.subject) {
      reply.code(400);
      return { error: "subject is required" };
    }
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const rfi = await createRfi(
        options.getRepository(),
        options.getMasterDataRepository(),
        token,
        request.params.projectId,
        {
          subject: body.subject,
          description: body.description ?? null,
          raised_by: body.raisedBy ?? null,
          addressed_to_user_id: body.addressedToUserId ?? null,
          addressed_to_contact_id: body.addressedToContactId ?? null,
          date_raised: body.dateRaised,
          date_required: body.dateRequired ?? null,
          reference_document_ids: body.referenceDocumentIds ?? [],
        },
      );
      reply.code(201);
      return { rfi };
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Could not create RFI" };
    }
  });

  app.get<{ Params: { id: string } }>("/rfis/:id", async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const rfi = await getRfi(options.getRepository(), token, request.params.id);
      return { rfi };
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      throw err;
    }
  });

  app.patch<{
    Params: { id: string };
    Body: {
      subject?: string;
      description?: string | null;
      addressedToUserId?: string | null;
      addressedToContactId?: string | null;
      dateRequired?: string | null;
      dateResponded?: string | null;
      response?: string | null;
      status?: string;
      referenceDocumentIds?: string[];
    };
  }>("/rfis/:id", rfiGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const rfi = await updateRfi(options.getRepository(), token, request.params.id, {
        subject: body.subject,
        description: body.description,
        addressed_to_user_id: body.addressedToUserId,
        addressed_to_contact_id: body.addressedToContactId,
        date_required: body.dateRequired,
        date_responded: body.dateResponded,
        response: body.response,
        status: body.status as RfiStatus | undefined,
        reference_document_ids: body.referenceDocumentIds,
      });
      return { rfi };
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      throw err;
    }
  });

  // ---- IFC register (read-only) ----------------------------------------

  app.get<{ Params: { projectId: string } }>(
    "/projects/:projectId/ifc-register",
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const rows = await listIFCRegister(options.getRepository(), token, request.params.projectId);
      return { ifcRegister: rows };
    },
  );

  // ---- As-built records ------------------------------------------------

  app.get<{ Params: { projectId: string } }>(
    "/projects/:projectId/as-built",
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const records = await listAsBuilt(
        options.getRepository(),
        token,
        request.params.projectId,
      );
      return { asBuiltRecords: records };
    },
  );

  app.post<{
    Params: { projectId: string };
    Body: {
      documentId: string;
      originalRevisionId?: string;
      asBuiltRevisionId?: string;
      notes?: string;
    };
  }>("/projects/:projectId/as-built", asBuiltGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    if (!body.documentId) {
      reply.code(400);
      return { error: "documentId is required" };
    }
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const record = await createAsBuilt(options.getRepository(), token, {
        project_id: request.params.projectId,
        document_id: body.documentId,
        original_revision_id: body.originalRevisionId ?? null,
        as_built_revision_id: body.asBuiltRevisionId ?? null,
        notes: body.notes ?? null,
      });
      reply.code(201);
      return { asBuiltRecord: record };
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Could not create as-built record" };
    }
  });

  app.patch<{
    Params: { id: string };
    Body: {
      originalRevisionId?: string | null;
      asBuiltRevisionId?: string | null;
      confirmedBy?: string | null;
      confirmedAt?: string | null;
      notes?: string | null;
    };
  }>("/as-built/:id", asBuiltGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const record = await updateAsBuilt(options.getRepository(), token, request.params.id, {
        original_revision_id: body.originalRevisionId,
        as_built_revision_id: body.asBuiltRevisionId,
        confirmed_by: body.confirmedBy,
        confirmed_at: body.confirmedAt,
        notes: body.notes,
      });
      return { asBuiltRecord: record };
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      throw err;
    }
  });
}
