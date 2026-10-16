import type {
  CreateClientCommunicationInput,
  CreateClientInput,
  CreateContactInput,
  CreateOpportunityInput,
  CreateSiteVisitInput,
  CreateTenderSubmissionInput,
  CrmRepository,
  ListOpportunitiesFilter,
  UpdateOpportunityInput,
} from "./repository.js";
import type { Client, ClientCommunication, Contact, Opportunity, SiteVisit, TenderSubmission } from "./types.js";

export class NotFoundError extends Error {
  constructor(message = "not found") {
    super(message);
  }
}

export async function createClient(repo: CrmRepository, accessToken: string, input: CreateClientInput): Promise<Client> {
  return repo.createClient(accessToken, input);
}

/** FR-CRM-002: surfaces likely duplicates by name for a human to resolve — never auto-merges. */
export async function searchClients(repo: CrmRepository, accessToken: string, search?: string): Promise<Client[]> {
  return repo.searchClients(accessToken, search);
}

export async function createContact(
  repo: CrmRepository,
  accessToken: string,
  input: CreateContactInput,
): Promise<Contact> {
  return repo.createContact(accessToken, input);
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
