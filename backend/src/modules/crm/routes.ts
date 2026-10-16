import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { AuthenticatedRequest } from "../authority/guard.js";
import type { WorkflowRepository } from "../workflow/repository.js";
import type { CrmRepository } from "./repository.js";
import { HANDOVER_ITEM_KEYS, type HandoverItemKey, type OpportunityStage } from "./types.js";
import type { ForecastGroupBy } from "./forecast.js";
import { FORECAST_GROUP_BY_VALUES } from "./forecast.js";
import {
  HandoverChecklistIncompleteError,
  MissingHandoverExceptionReasonError,
  NotFoundError,
  OpportunityNotWonError,
  completeHandover,
  completeHandoverItem,
  createClient,
  createClientCommunication,
  createContact,
  createOpportunity,
  createSiteVisit,
  createTenderSubmission,
  getOpportunity,
  getPipelineForecast,
  listClientCommunications,
  listContactsForClient,
  listHandoverChecklist,
  listHandoverExceptions,
  listOpportunities,
  listSiteVisits,
  listTenderSubmissions,
  requestHandoverException,
  resolveHandoverException,
  searchClients,
  searchContacts,
  updateClient,
  updateContact,
  updateOpportunity,
} from "./service.js";

export interface CrmRouteOptions {
  getRepository: () => CrmRepository;
  getWorkflowRepository: () => WorkflowRepository;
  requirePermission: (permissionKey: string) => preHandlerHookHandler;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export async function crmRoutes(app: FastifyInstance, options: CrmRouteOptions) {
  app.addHook("preHandler", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return reply.send({ error: "missing bearer token" });
    }
  });

  const guard = { preHandler: options.requirePermission("crm.lead.manage") };

  app.post<{
    Body: { name: string; tradeLicenseNumber?: string; registrationCountry?: string };
  }>("/crm/clients", guard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    if (!body.name) {
      reply.code(400);
      return { error: "name is required" };
    }
    const token = bearerToken(request.headers.authorization) as string;
    const client = await createClient(options.getRepository(), token, {
      name: body.name,
      trade_license_number: body.tradeLicenseNumber ?? null,
      registration_country: body.registrationCountry ?? null,
      created_by: null,
    });
    reply.code(201);
    return { client };
  });

  app.get<{ Querystring: { search?: string } }>("/crm/clients", guard, async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const clients = await searchClients(options.getRepository(), token, request.query.search);
    return { clients };
  });

  app.patch<{
    Params: { id: string };
    Body: { name?: string; tradeLicenseNumber?: string | null; registrationCountry?: string | null };
  }>("/crm/clients/:id", guard, async (request, reply) => {
    const body = request.body ?? {};
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const client = await updateClient(options.getRepository(), token, request.params.id, {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.tradeLicenseNumber !== undefined ? { trade_license_number: body.tradeLicenseNumber } : {}),
        ...(body.registrationCountry !== undefined ? { registration_country: body.registrationCountry } : {}),
      });
      return { client };
    } catch (error) {
      if (error instanceof NotFoundError) {
        reply.code(404);
        return { error: error.message };
      }
      throw error;
    }
  });

  app.post<{
    Params: { id: string };
    Body: { name: string; title?: string; email?: string; phone?: string; isPrimary?: boolean };
  }>("/crm/clients/:id/contacts", guard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    if (!body.name) {
      reply.code(400);
      return { error: "name is required" };
    }
    const token = bearerToken(request.headers.authorization) as string;
    const contact = await createContact(options.getRepository(), token, {
      client_id: request.params.id,
      name: body.name,
      title: body.title ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      is_primary: body.isPrimary ?? false,
    });
    reply.code(201);
    return { contact };
  });

  app.get<{ Params: { id: string } }>("/crm/clients/:id/contacts", guard, async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const contacts = await listContactsForClient(options.getRepository(), token, request.params.id);
    return { contacts };
  });

  app.patch<{
    Params: { contactId: string };
    Body: { name?: string; title?: string | null; email?: string | null; phone?: string | null; isPrimary?: boolean };
  }>("/crm/contacts/:contactId", guard, async (request, reply) => {
    const body = request.body ?? {};
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const contact = await updateContact(options.getRepository(), token, request.params.contactId, {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.isPrimary !== undefined ? { is_primary: body.isPrimary } : {}),
      });
      return { contact };
    } catch (error) {
      if (error instanceof NotFoundError) {
        reply.code(404);
        return { error: error.message };
      }
      throw error;
    }
  });

  // FR-CRM-002: duplicate detection — surfaces likely matches by
  // name/email/phone for a human to resolve before creating a new
  // client/contact. Registered under /crm/contacts (not nested under a
  // client) because a duplicate check has no client yet.
  app.get<{ Querystring: { search?: string } }>("/crm/contacts", guard, async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const contacts = await searchContacts(options.getRepository(), token, request.query.search);
    return { contacts };
  });

  app.post<{
    Body: {
      clientId: string;
      title: string;
      source: string;
      ownerId: string;
      expectedValue?: number;
      probability?: number;
      nextAction?: string;
      dueDate?: string;
    };
  }>("/crm/opportunities", guard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    if (!body.clientId || !body.title || !body.source || !body.ownerId) {
      reply.code(400);
      return { error: "clientId, title, source and ownerId are required" };
    }
    const token = bearerToken(request.headers.authorization) as string;
    const opportunity = await createOpportunity(options.getRepository(), token, {
      client_id: body.clientId,
      title: body.title,
      source: body.source,
      owner_id: body.ownerId,
      expected_value: body.expectedValue ?? null,
      probability: body.probability ?? null,
      next_action: body.nextAction ?? null,
      due_date: body.dueDate ?? null,
      created_by: null,
    });
    reply.code(201);
    return { opportunity };
  });

  app.get<{ Querystring: { clientId?: string; stage?: OpportunityStage } }>(
    "/crm/opportunities",
    guard,
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const opportunities = await listOpportunities(options.getRepository(), token, {
        clientId: request.query.clientId,
        stage: request.query.stage,
      });
      return { opportunities };
    },
  );

  app.get<{ Params: { id: string } }>("/crm/opportunities/:id", guard, async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const opportunity = await getOpportunity(options.getRepository(), token, request.params.id);
      return { opportunity };
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
      stage?: OpportunityStage;
      ownerId?: string;
      expectedValue?: number | null;
      probability?: number | null;
      nextAction?: string | null;
      dueDate?: string | null;
    };
  }>("/crm/opportunities/:id", guard, async (request, reply) => {
    const body = request.body ?? {};
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const opportunity = await updateOpportunity(options.getRepository(), token, request.params.id, {
        ...(body.stage !== undefined ? { stage: body.stage } : {}),
        ...(body.ownerId !== undefined ? { owner_id: body.ownerId } : {}),
        ...(body.expectedValue !== undefined ? { expected_value: body.expectedValue } : {}),
        ...(body.probability !== undefined ? { probability: body.probability } : {}),
        ...(body.nextAction !== undefined ? { next_action: body.nextAction } : {}),
        ...(body.dueDate !== undefined ? { due_date: body.dueDate } : {}),
      });
      return { opportunity };
    } catch (error) {
      if (error instanceof NotFoundError) {
        reply.code(404);
        return { error: error.message };
      }
      throw error;
    }
  });

  app.post<{
    Params: { id: string };
    Body: { visitedBy: string; visitDate: string; notes?: string };
  }>("/crm/opportunities/:id/site-visits", guard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    if (!body.visitedBy || !body.visitDate) {
      reply.code(400);
      return { error: "visitedBy and visitDate are required" };
    }
    const token = bearerToken(request.headers.authorization) as string;
    const siteVisit = await createSiteVisit(options.getRepository(), token, {
      opportunity_id: request.params.id,
      visited_by: body.visitedBy,
      visit_date: body.visitDate,
      notes: body.notes ?? null,
    });
    reply.code(201);
    return { siteVisit };
  });

  app.get<{ Params: { id: string } }>("/crm/opportunities/:id/site-visits", guard, async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const siteVisits = await listSiteVisits(options.getRepository(), token, request.params.id);
    return { siteVisits };
  });

  // FR-CRM-003: tender deadlines and submission evidence.
  app.post<{
    Params: { id: string };
    Body: { deadlineDate: string; submittedAt?: string; evidenceReference?: string; notes?: string };
  }>("/crm/opportunities/:id/tender-submissions", guard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    if (!body.deadlineDate) {
      reply.code(400);
      return { error: "deadlineDate is required" };
    }
    const token = bearerToken(request.headers.authorization) as string;
    const tenderSubmission = await createTenderSubmission(options.getRepository(), token, {
      opportunity_id: request.params.id,
      deadline_date: body.deadlineDate,
      submitted_at: body.submittedAt ?? null,
      evidence_reference: body.evidenceReference ?? null,
      notes: body.notes ?? null,
      created_by: null,
    });
    reply.code(201);
    return { tenderSubmission };
  });

  app.get<{ Params: { id: string } }>("/crm/opportunities/:id/tender-submissions", guard, async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const tenderSubmissions = await listTenderSubmissions(options.getRepository(), token, request.params.id);
    return { tenderSubmissions };
  });

  // Log only — no send/receive. See ticket 0082 for this project's one
  // outbound-delivery mechanism, which this does not use.
  app.post<{
    Body: { clientId: string; opportunityId?: string; channel: string; summary: string; occurredAt?: string };
  }>("/crm/client-communications", guard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    if (!body.clientId || !body.channel || !body.summary) {
      reply.code(400);
      return { error: "clientId, channel and summary are required" };
    }
    const token = bearerToken(request.headers.authorization) as string;
    const loggedBy = (request as AuthenticatedRequest).authUserId as string;
    const clientCommunication = await createClientCommunication(options.getRepository(), token, {
      client_id: body.clientId,
      opportunity_id: body.opportunityId ?? null,
      channel: body.channel,
      summary: body.summary,
      logged_by: loggedBy,
      occurred_at: body.occurredAt,
    });
    reply.code(201);
    return { clientCommunication };
  });

  app.get<{ Querystring: { clientId?: string; opportunityId?: string } }>(
    "/crm/client-communications",
    guard,
    async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const clientCommunications = await listClientCommunications(options.getRepository(), token, {
        clientId: request.query.clientId,
        opportunityId: request.query.opportunityId,
      });
      return { clientCommunications };
    },
  );

  // -------------------------------------------------------------------
  // Pipeline forecast & won-opportunity handover checklist (ticket 0092, M10c)
  // -------------------------------------------------------------------

  app.get<{ Querystring: { groupBy?: string } }>("/crm/pipeline/forecast", guard, async (request, reply) => {
    const groupBy = (request.query.groupBy ?? "stage") as ForecastGroupBy;
    if (!FORECAST_GROUP_BY_VALUES.includes(groupBy)) {
      reply.code(400);
      return { error: `groupBy must be one of ${FORECAST_GROUP_BY_VALUES.join(", ")}` };
    }
    const token = bearerToken(request.headers.authorization) as string;
    const forecast = await getPipelineForecast(options.getRepository(), token, groupBy);
    return { forecast };
  });

  app.get<{ Params: { id: string } }>("/crm/opportunities/:id/handover-checklist", guard, async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const items = await listHandoverChecklist(options.getRepository(), token, request.params.id);
      return { items };
    } catch (error) {
      if (error instanceof NotFoundError) {
        reply.code(404);
        return { error: error.message };
      }
      throw error;
    }
  });

  app.post<{ Params: { id: string; itemKey: string } }>(
    "/crm/opportunities/:id/handover-checklist/:itemKey/complete",
    guard,
    async (request, reply) => {
      if (!(HANDOVER_ITEM_KEYS as readonly string[]).includes(request.params.itemKey)) {
        reply.code(400);
        return { error: `itemKey must be one of ${HANDOVER_ITEM_KEYS.join(", ")}` };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
      try {
        const item = await completeHandoverItem(
          options.getRepository(),
          token,
          request.params.id,
          request.params.itemKey as HandoverItemKey,
          callerUserId,
        );
        return { item };
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
    Params: { id: string };
    Body: { reason: string; definitionId: string };
  }>("/crm/opportunities/:id/handover-exceptions", guard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    if (!body.reason || !body.definitionId) {
      reply.code(400);
      return { error: "reason and definitionId are required" };
    }
    const token = bearerToken(request.headers.authorization) as string;
    const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
    try {
      const exception = await requestHandoverException(options.getRepository(), options.getWorkflowRepository(), token, {
        opportunityId: request.params.id,
        reason: body.reason,
        definitionId: body.definitionId,
        requestedBy: callerUserId,
      });
      reply.code(201);
      return { exception };
    } catch (error) {
      if (error instanceof OpportunityNotWonError || error instanceof MissingHandoverExceptionReasonError) {
        reply.code(400);
        return { error: error.message };
      }
      if (error instanceof NotFoundError) {
        reply.code(404);
        return { error: error.message };
      }
      throw error;
    }
  });

  app.get<{ Params: { id: string } }>("/crm/opportunities/:id/handover-exceptions", guard, async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const exceptions = await listHandoverExceptions(options.getRepository(), token, request.params.id);
    return { exceptions };
  });

  // GET is the poll: each read re-checks the linked workflow instance
  // and applies the outcome exactly once (resolveHandoverException is
  // idempotent once status leaves 'pending').
  app.get<{ Params: { exceptionId: string } }>(
    "/crm/handover-exceptions/:exceptionId",
    guard,
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const exception = await resolveHandoverException(
          options.getRepository(),
          options.getWorkflowRepository(),
          token,
          request.params.exceptionId,
        );
        return { exception };
      } catch (error) {
        if (error instanceof NotFoundError) {
          reply.code(404);
          return { error: error.message };
        }
        throw error;
      }
    },
  );

  app.post<{ Params: { id: string } }>("/crm/opportunities/:id/handover/complete", guard, async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    const callerUserId = (request as AuthenticatedRequest).authUserId ?? null;
    try {
      const opportunity = await completeHandover(options.getRepository(), token, request.params.id, callerUserId);
      return { opportunity };
    } catch (error) {
      if (error instanceof OpportunityNotWonError || error instanceof HandoverChecklistIncompleteError) {
        reply.code(409);
        return { error: error.message };
      }
      if (error instanceof NotFoundError) {
        reply.code(404);
        return { error: error.message };
      }
      throw error;
    }
  });
}
