import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { AuthenticatedRequest } from "../authority/guard.js";
import type { DocumentsRepository } from "./repository.js";
import {
  NotFoundError,
  createDocument,
  createDocumentRevision,
  getDocument,
  getDocumentRevision,
  listDocumentRevisionHistory,
  listDocumentRevisions,
  listDocuments,
  updateDocument,
  updateDocumentRevision,
} from "./service.js";
import type { DocumentRevisionStatus } from "./types.js";

export interface DocumentsRouteOptions {
  getRepository: () => DocumentsRepository;
  /** Gates writes only (create document, create revision, edit metadata) — reads stay open to any permitted authenticated user. */
  requirePermission: (permissionKey: string) => preHandlerHookHandler;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export async function documentsRoutes(app: FastifyInstance, options: DocumentsRouteOptions) {
  app.addHook("preHandler", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return reply.send({ error: "missing bearer token" });
    }
  });

  const guard = { preHandler: options.requirePermission("documents.register.manage") };

  // Document register.
  app.post<{
    Body: {
      documentType: string;
      title: string;
      documentNumber?: string;
      projectId?: string;
      discipline?: string;
      accessClass?: string;
      tags?: string[];
      originatorId?: string;
    };
  }>("/documents", guard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    if (!body.documentType || !body.title) {
      reply.code(400);
      return { error: "documentType and title are required" };
    }
    const token = bearerToken(request.headers.authorization) as string;
    const document = await createDocument(options.getRepository(), token, {
      document_type: body.documentType,
      title: body.title,
      document_number: body.documentNumber ?? null,
      project_id: body.projectId ?? null,
      discipline: body.discipline ?? null,
      access_class: body.accessClass ?? null,
      tags: body.tags ?? [],
      originator_id: body.originatorId ?? null,
    });
    reply.code(201);
    return { document };
  });

  app.get<{ Querystring: { projectId?: string } }>("/documents", async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const documents = await listDocuments(options.getRepository(), token, { projectId: request.query.projectId });
    return { documents };
  });

  app.get<{ Params: { id: string } }>("/documents/:id", async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const document = await getDocument(options.getRepository(), token, request.params.id);
      return { document };
    } catch (error) {
      if (error instanceof NotFoundError) {
        reply.code(404);
        return { error: error.message };
      }
      throw error;
    }
  });

  app.patch<{
    Params: { id: string };
    Body: {
      title?: string;
      documentNumber?: string | null;
      projectId?: string | null;
      discipline?: string | null;
      accessClass?: string | null;
      tags?: string[];
      originatorId?: string | null;
    };
  }>("/documents/:id", guard, async (request, reply) => {
    const body = request.body ?? {};
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const document = await updateDocument(options.getRepository(), token, request.params.id, {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.documentNumber !== undefined ? { document_number: body.documentNumber } : {}),
        ...(body.projectId !== undefined ? { project_id: body.projectId } : {}),
        ...(body.discipline !== undefined ? { discipline: body.discipline } : {}),
        ...(body.accessClass !== undefined ? { access_class: body.accessClass } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
        ...(body.originatorId !== undefined ? { originator_id: body.originatorId } : {}),
      });
      return { document };
    } catch (error) {
      if (error instanceof NotFoundError) {
        reply.code(404);
        return { error: error.message };
      }
      throw error;
    }
  });

  // Revisions.
  app.post<{
    Params: { id: string };
    Body: {
      revisionCode: string;
      status?: DocumentRevisionStatus;
      storageReference?: string;
      reviewerId?: string;
      approverId?: string;
    };
  }>("/documents/:id/revisions", guard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    if (!body.revisionCode) {
      reply.code(400);
      return { error: "revisionCode is required" };
    }
    const token = bearerToken(request.headers.authorization) as string;
    const createdBy = (request as AuthenticatedRequest).authUserId ?? null;
    try {
      const revision = await createDocumentRevision(options.getRepository(), token, {
        document_id: request.params.id,
        revision_code: body.revisionCode,
        status: body.status,
        storage_reference: body.storageReference ?? null,
        reviewer_id: body.reviewerId ?? null,
        approver_id: body.approverId ?? null,
        created_by: createdBy,
      });
      reply.code(201);
      return { revision };
    } catch (error) {
      if (error instanceof NotFoundError) {
        reply.code(404);
        return { error: error.message };
      }
      throw error;
    }
  });

  // Default view: excludes superseded/rejected (FR-DOC-002). includeSuperseded=true returns everything.
  app.get<{ Params: { id: string }; Querystring: { includeSuperseded?: string } }>(
    "/documents/:id/revisions",
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const revisions = await listDocumentRevisions(options.getRepository(), token, request.params.id, {
        includeSuperseded: request.query.includeSuperseded === "true",
      });
      return { revisions };
    },
  );

  // Revision history: full ordered (oldest-to-newest) list, every field — raw data for a revision-comparison screen.
  app.get<{ Params: { id: string } }>("/documents/:id/revisions/history", async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const revisions = await listDocumentRevisionHistory(options.getRepository(), token, request.params.id);
    return { revisions };
  });

  app.get<{ Params: { revisionId: string } }>("/documents/revisions/:revisionId", async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const revision = await getDocumentRevision(options.getRepository(), token, request.params.revisionId);
      return { revision };
    } catch (error) {
      if (error instanceof NotFoundError) {
        reply.code(404);
        return { error: error.message };
      }
      throw error;
    }
  });

  app.patch<{
    Params: { revisionId: string };
    Body: {
      status?: DocumentRevisionStatus;
      storageReference?: string | null;
      reviewerId?: string | null;
      approverId?: string | null;
    };
  }>("/documents/revisions/:revisionId", guard, async (request, reply) => {
    const body = request.body ?? {};
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const revision = await updateDocumentRevision(options.getRepository(), token, request.params.revisionId, {
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.storageReference !== undefined ? { storage_reference: body.storageReference } : {}),
        ...(body.reviewerId !== undefined ? { reviewer_id: body.reviewerId } : {}),
        ...(body.approverId !== undefined ? { approver_id: body.approverId } : {}),
      });
      return { revision };
    } catch (error) {
      if (error instanceof NotFoundError) {
        reply.code(404);
        return { error: error.message };
      }
      throw error;
    }
  });
}
