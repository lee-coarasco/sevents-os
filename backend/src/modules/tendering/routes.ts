import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { AuthenticatedRequest } from "../authority/guard.js";
import type { TenderingRepository } from "./repository.js";
import {
  NotFoundError,
  createTenderClarification,
  createTenderDocument,
  listTenderClarifications,
  listTenderDocuments,
  resolveTenderClarification,
  updateTenderClarification,
} from "./service.js";

export interface TenderingRouteOptions {
  getRepository: () => TenderingRepository;
  requirePermission: (permissionKey: string) => preHandlerHookHandler;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export async function tenderingRoutes(app: FastifyInstance, options: TenderingRouteOptions) {
  app.addHook("preHandler", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return reply.send({ error: "missing bearer token" });
    }
  });

  const guard = { preHandler: options.requirePermission("tendering.document.manage") };

  // Tender document register (drawings, BOQ, specifications, addenda).
  app.post<{
    Params: { id: string };
    Body: {
      documentType: string;
      title: string;
      documentNumber?: string;
      revision?: string;
      receivedDate?: string;
      storageReference?: string;
    };
  }>("/tendering/tender-submissions/:id/documents", guard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    if (!body.documentType || !body.title) {
      reply.code(400);
      return { error: "documentType and title are required" };
    }
    const token = bearerToken(request.headers.authorization) as string;
    const document = await createTenderDocument(options.getRepository(), token, {
      tender_submission_id: request.params.id,
      document_type: body.documentType,
      title: body.title,
      document_number: body.documentNumber ?? null,
      revision: body.revision ?? null,
      received_date: body.receivedDate ?? null,
      storage_reference: body.storageReference ?? null,
      created_by: null,
    });
    reply.code(201);
    return { document };
  });

  app.get<{ Params: { id: string } }>("/tendering/tender-submissions/:id/documents", guard, async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const documents = await listTenderDocuments(options.getRepository(), token, request.params.id);
    return { documents };
  });

  // Scope matrix / clarification log.
  app.post<{
    Params: { id: string };
    Body: { item: string; response?: string };
  }>("/tendering/tender-submissions/:id/clarifications", guard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    if (!body.item) {
      reply.code(400);
      return { error: "item is required" };
    }
    const token = bearerToken(request.headers.authorization) as string;
    const raisedBy = (request as AuthenticatedRequest).authUserId as string;
    const clarification = await createTenderClarification(options.getRepository(), token, {
      tender_submission_id: request.params.id,
      item: body.item,
      raised_by: raisedBy,
      response: body.response ?? null,
    });
    reply.code(201);
    return { clarification };
  });

  app.get<{ Params: { id: string } }>(
    "/tendering/tender-submissions/:id/clarifications",
    guard,
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const clarifications = await listTenderClarifications(options.getRepository(), token, request.params.id);
      return { clarifications };
    },
  );

  app.post<{
    Params: { clarificationId: string };
    Body: { response: string };
  }>("/tendering/clarifications/:clarificationId/resolve", guard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    if (!body.response) {
      reply.code(400);
      return { error: "response is required" };
    }
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const clarification = await resolveTenderClarification(
        options.getRepository(),
        token,
        request.params.clarificationId,
        body.response,
      );
      return { clarification };
    } catch (error) {
      if (error instanceof NotFoundError) {
        reply.code(404);
        return { error: error.message };
      }
      throw error;
    }
  });

  app.patch<{
    Params: { clarificationId: string };
    Body: { response?: string | null; resolvedAt?: string | null };
  }>("/tendering/clarifications/:clarificationId", guard, async (request, reply) => {
    const body = request.body ?? {};
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const clarification = await updateTenderClarification(options.getRepository(), token, request.params.clarificationId, {
        ...(body.response !== undefined ? { response: body.response } : {}),
        ...(body.resolvedAt !== undefined ? { resolved_at: body.resolvedAt } : {}),
      });
      return { clarification };
    } catch (error) {
      if (error instanceof NotFoundError) {
        reply.code(404);
        return { error: error.message };
      }
      throw error;
    }
  });
}
