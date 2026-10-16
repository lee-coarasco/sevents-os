import type {
  CreateClientCommunicationInput,
  CreateClientInput,
  CreateContactInput,
  CreateOpportunityInput,
  CreateSiteVisitInput,
  CreateTenderSubmissionInput,
  CrmRepository,
  ListOpportunitiesFilter,
  UpdateClientInput,
  UpdateContactInput,
  UpdateOpportunityInput,
} from "./repository.js";
import {
  HANDOVER_ITEM_KEYS,
  type Client,
  type ClientCommunication,
  type Contact,
  type HandoverItemKey,
  type Opportunity,
  type OpportunityHandoverChecklistItem,
  type OpportunityHandoverException,
  type SiteVisit,
  type TenderSubmission,
} from "./types.js";
import { computePipelineForecast, type ForecastGroupBy, type PipelineForecast } from "./forecast.js";
import type { WorkflowRepository } from "../workflow/repository.js";
import { getWorkflowInstance, startWorkflowInstance } from "../workflow/service.js";

export class NotFoundError extends Error {
  constructor(message = "not found") {
    super(message);
  }
}

/** FR-CRM-004: handover (and its exception path) only make sense once an opportunity has actually been won. */
export class OpportunityNotWonError extends Error {}

/** Same non-blank-reason convention as ticket 0075/0080's approval-gated requests. */
export class MissingHandoverExceptionReasonError extends Error {}

/** FR-CRM-004: raised by completeHandover when the checklist is incomplete and no approved exception is on file. */
export class HandoverChecklistIncompleteError extends Error {}

export async function createClient(repo: CrmRepository, accessToken: string, input: CreateClientInput): Promise<Client> {
  return repo.createClient(accessToken, input);
}

/** FR-CRM-002: surfaces likely duplicates by name for a human to resolve — never auto-merges. */
export async function searchClients(repo: CrmRepository, accessToken: string, search?: string): Promise<Client[]> {
  return repo.searchClients(accessToken, search);
}

export async function updateClient(
  repo: CrmRepository,
  accessToken: string,
  clientId: string,
  input: UpdateClientInput,
): Promise<Client> {
  const updated = await repo.updateClient(accessToken, clientId, input);
  if (!updated) throw new NotFoundError();
  return updated;
}

export async function createContact(
  repo: CrmRepository,
  accessToken: string,
  input: CreateContactInput,
): Promise<Contact> {
  return repo.createContact(accessToken, input);
}

export async function updateContact(
  repo: CrmRepository,
  accessToken: string,
  contactId: string,
  input: UpdateContactInput,
): Promise<Contact> {
  const updated = await repo.updateContact(accessToken, contactId, input);
  if (!updated) throw new NotFoundError();
  return updated;
}

export async function listContactsForClient(
  repo: CrmRepository,
  accessToken: string,
  clientId: string,
): Promise<Contact[]> {
  return repo.listContactsForClient(accessToken, clientId);
}

/** FR-CRM-002: surfaces likely duplicates by name/email/phone for a human to resolve — never auto-merges. */
export async function searchContacts(repo: CrmRepository, accessToken: string, search?: string): Promise<Contact[]> {
  return repo.searchContacts(accessToken, search);
}

export async function createOpportunity(
  repo: CrmRepository,
  accessToken: string,
  input: CreateOpportunityInput,
): Promise<Opportunity> {
  return repo.createOpportunity(accessToken, input);
}

export async function getOpportunity(repo: CrmRepository, accessToken: string, opportunityId: string): Promise<Opportunity> {
  const opportunity = await repo.getOpportunity(accessToken, opportunityId);
  if (!opportunity) throw new NotFoundError();
  return opportunity;
}

export async function listOpportunities(
  repo: CrmRepository,
  accessToken: string,
  filter?: ListOpportunitiesFilter,
): Promise<Opportunity[]> {
  return repo.listOpportunities(accessToken, filter);
}

export async function updateOpportunity(
  repo: CrmRepository,
  accessToken: string,
  opportunityId: string,
  input: UpdateOpportunityInput,
): Promise<Opportunity> {
  const updated = await repo.updateOpportunity(accessToken, opportunityId, input);
  if (!updated) throw new NotFoundError();
  return updated;
}

export async function createSiteVisit(
  repo: CrmRepository,
  accessToken: string,
  input: CreateSiteVisitInput,
): Promise<SiteVisit> {
  return repo.createSiteVisit(accessToken, input);
}

export async function listSiteVisits(
  repo: CrmRepository,
  accessToken: string,
  opportunityId: string,
): Promise<SiteVisit[]> {
  return repo.listSiteVisits(accessToken, opportunityId);
}

export async function createTenderSubmission(
  repo: CrmRepository,
  accessToken: string,
  input: CreateTenderSubmissionInput,
): Promise<TenderSubmission> {
  return repo.createTenderSubmission(accessToken, input);
}

export async function listTenderSubmissions(
  repo: CrmRepository,
  accessToken: string,
  opportunityId: string,
): Promise<TenderSubmission[]> {
  return repo.listTenderSubmissions(accessToken, opportunityId);
}

export async function createClientCommunication(
  repo: CrmRepository,
  accessToken: string,
  input: CreateClientCommunicationInput,
): Promise<ClientCommunication> {
  return repo.createClientCommunication(accessToken, input);
}

export async function listClientCommunications(
  repo: CrmRepository,
  accessToken: string,
  filter: { clientId?: string; opportunityId?: string },
): Promise<ClientCommunication[]> {
  return repo.listClientCommunications(accessToken, filter);
}

// ---------------------------------------------------------------------------
// Pipeline forecast & won-opportunity handover checklist (ticket 0092, M10c)
// ---------------------------------------------------------------------------

export async function getPipelineForecast(
  repo: CrmRepository,
  accessToken: string,
  groupBy: ForecastGroupBy,
): Promise<PipelineForecast> {
  const opportunities = await repo.listOpportunities(accessToken);
  return computePipelineForecast(opportunities, groupBy);
}

/**
 * FR-CRM-004: ensures all four fixed checklist items exist for this
 * opportunity, creating any missing ones as `pending` — same
 * read-materializes-missing-rows shape as ticket 0077's
 * listCloseoutChecklist, including the same "check the opportunity is
 * visible to the caller first" fail-closed guard for a cross-tenant id.
 */
export async function listHandoverChecklist(
  repo: CrmRepository,
  accessToken: string,
  opportunityId: string,
): Promise<OpportunityHandoverChecklistItem[]> {
  await getOpportunity(repo, accessToken, opportunityId);
  const existing = await repo.listHandoverChecklistItems(accessToken, opportunityId);
  const existingKeys = new Set(existing.map((i) => i.item_key));
  const missing = HANDOVER_ITEM_KEYS.filter((key) => !existingKeys.has(key));
  const created = await Promise.all(
    missing.map((item_key) => repo.createHandoverChecklistItem(accessToken, { opportunity_id: opportunityId, item_key })),
  );
  return [...existing, ...created].sort(
    (a, b) => HANDOVER_ITEM_KEYS.indexOf(a.item_key) - HANDOVER_ITEM_KEYS.indexOf(b.item_key),
  );
}

export async function completeHandoverItem(
  repo: CrmRepository,
  accessToken: string,
  opportunityId: string,
  itemKey: HandoverItemKey,
  completedBy: string | null,
): Promise<OpportunityHandoverChecklistItem> {
  await getOpportunity(repo, accessToken, opportunityId);
  const existing = await repo.listHandoverChecklistItems(accessToken, opportunityId);
  const current = existing.find((i) => i.item_key === itemKey);
  const now = new Date().toISOString();
  if (!current) {
    return repo.createHandoverChecklistItem(accessToken, {
      opportunity_id: opportunityId,
      item_key: itemKey,
      status: "complete",
      completed_by: completedBy,
      completed_at: now,
    });
  }
  const updated = await repo.updateHandoverChecklistItem(accessToken, current.id, {
    status: "complete",
    completed_by: completedBy,
    completed_at: now,
  });
  if (!updated) throw new NotFoundError();
  return updated;
}

export interface RequestHandoverExceptionInput {
  opportunityId: string;
  reason: string;
  requestedBy: string | null;
  /** Caller names an already-published request_approval workflow definition — same explicit convention as ticket 0075/0080. */
  definitionId: string;
}

/** Starting an exception request never lets handover proceed by itself — only completeHandover, once the linked instance approves it, does. */
export async function requestHandoverException(
  repo: CrmRepository,
  workflowRepo: WorkflowRepository,
  accessToken: string,
  input: RequestHandoverExceptionInput,
): Promise<OpportunityHandoverException> {
  const opportunity = await getOpportunity(repo, accessToken, input.opportunityId);
  if (opportunity.stage !== "won") {
    throw new OpportunityNotWonError(`opportunity ${input.opportunityId} is not in the won stage`);
  }
  if (!input.reason.trim()) {
    throw new MissingHandoverExceptionReasonError("a handover exception request requires a non-empty reason");
  }
  const { instance } = await startWorkflowInstance(workflowRepo, accessToken, input.definitionId, input.requestedBy, {
    opportunityId: input.opportunityId,
  });
  return repo.createHandoverException(accessToken, {
    opportunity_id: input.opportunityId,
    reason: input.reason,
    requested_by: input.requestedBy,
    workflow_instance_id: instance.id,
  });
}

export async function listHandoverExceptions(
  repo: CrmRepository,
  accessToken: string,
  opportunityId: string,
): Promise<OpportunityHandoverException[]> {
  return repo.listHandoverExceptions(accessToken, opportunityId);
}

/**
 * The polling half of the seam: no event bus exists in this codebase,
 * so an exception request's outcome is read back on demand from its
 * workflow instance's step instances, same idempotent pattern as
 * ticket 0075's resolveBaselineChangeRequest / ticket 0080's
 * resolveDataRequest.
 */
export async function resolveHandoverException(
  repo: CrmRepository,
  workflowRepo: WorkflowRepository,
  accessToken: string,
  exceptionId: string,
): Promise<OpportunityHandoverException> {
  const exception = await repo.getHandoverException(accessToken, exceptionId);
  if (!exception) throw new NotFoundError();
  if (exception.status !== "pending") return exception;

  const { stepInstances } = await getWorkflowInstance(workflowRepo, accessToken, exception.workflow_instance_id);
  const decidedStep = stepInstances.find((s) => typeof s.output?.decision === "string");
  if (!decidedStep) return exception;

  const decision = decidedStep.output.decision as string;
  const updated = await repo.updateHandoverException(accessToken, exceptionId, {
    status: decision as "approved" | "rejected" | "returned_for_correction",
  });
  return updated!;
}

/**
 * FR-CRM-004: blocks while any checklist item is pending, unless an
 * approved exception is on file for this opportunity — never silently
 * bypassable by a caller skipping the checklist.
 */
export async function completeHandover(
  repo: CrmRepository,
  accessToken: string,
  opportunityId: string,
  completedBy: string | null,
): Promise<Opportunity> {
  const opportunity = await getOpportunity(repo, accessToken, opportunityId);
  if (opportunity.stage !== "won") {
    throw new OpportunityNotWonError(`opportunity ${opportunityId} is not in the won stage`);
  }
  const items = await listHandoverChecklist(repo, accessToken, opportunityId);
  const incomplete = items.filter((i) => i.status !== "complete");
  if (incomplete.length > 0) {
    const exceptions = await repo.listHandoverExceptions(accessToken, opportunityId);
    const hasApprovedException = exceptions.some((e) => e.status === "approved");
    if (!hasApprovedException) {
      throw new HandoverChecklistIncompleteError(
        `handover checklist incomplete: ${incomplete.map((i) => i.item_key).join(", ")}; no approved exception on file`,
      );
    }
  }
  const updated = await repo.updateOpportunity(accessToken, opportunityId, {
    handover_completed_at: new Date().toISOString(),
    handover_completed_by: completedBy,
  });
  if (!updated) throw new NotFoundError();
  return updated;
}
