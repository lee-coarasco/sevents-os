import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { AuthenticatedRequest } from "../authority/guard.js";
import type { CrmRepository } from "./repository.js";
import type { OpportunityStage } from "./types.js";
import {
  NotFoundError,
  createClient,
  createClientCommunication,
  createContact,
  createOpportunity,
  createSiteVisit,
  createTenderSubmission,
  getOpportunity,
  listClientCommunications,
  listContactsForClient,
  listOpportunities,
  listSiteVisits,
  listTenderSubmissions,
  searchClients,
  searchContacts,
  updateOpportunity,
} from "./service.js";

export interface CrmRouteOptions {
  getRepository: () => CrmRepository;
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
}
