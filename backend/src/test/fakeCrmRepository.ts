import type {
  CreateClientCommunicationInput,
  CreateClientInput,
  CreateContactInput,
  CreateHandoverChecklistItemInput,
  CreateHandoverExceptionInput,
  CreateOpportunityInput,
  CreateSiteVisitInput,
  CreateTenderSubmissionInput,
  CrmRepository,
  ListOpportunitiesFilter,
  UpdateHandoverChecklistItemInput,
  UpdateHandoverExceptionInput,
  UpdateOpportunityInput,
} from "../modules/crm/repository.js";
import type {
  Client,
  ClientCommunication,
  Contact,
  Opportunity,
  OpportunityHandoverChecklistItem,
  OpportunityHandoverException,
  SiteVisit,
  TenderSubmission,
} from "../modules/crm/types.js";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * In-memory stand-in for CrmRepository. Mutating/reads are keyed off an
 * access token's own session (same convention as every other fake
 * repository in this test suite) so "wrong tenant = not found" is
 * actually exercised, not just asserted.
 */
export class FakeCrmRepository implements CrmRepository {
  sessions = new Map<string, { userId: string; tenantId: string }>();
  clients = new Map<string, Client>();
  contacts = new Map<string, Contact>();
  opportunities = new Map<string, Opportunity>();
  siteVisits = new Map<string, SiteVisit>();
  tenderSubmissions = new Map<string, TenderSubmission>();
  clientCommunications = new Map<string, ClientCommunication>();
  handoverChecklistItems = new Map<string, OpportunityHandoverChecklistItem>();
  handoverExceptions = new Map<string, OpportunityHandoverException>();

  addSession(accessToken: string, userId: string, tenantId: string) {
    this.sessions.set(accessToken, { userId, tenantId });
  }

  private contextOf(accessToken: string) {
    const context = this.sessions.get(accessToken);
    if (!context) throw new Error("no caller context for this access token");
    return context;
  }

  async createClient(accessToken: string, input: CreateClientInput) {
    const { tenantId } = this.contextOf(accessToken);
    const now = new Date().toISOString();
    const client: Client = {
      id: nextId("client"),
      tenant_id: tenantId,
      name: input.name,
      trade_license_number: input.trade_license_number ?? null,
      registration_country: input.registration_country ?? null,
      primary_contact_id: null,
      created_by: input.created_by,
      created_at: now,
      updated_at: now,
    };
    this.clients.set(client.id, client);
    return client;
  }

  async getClient(accessToken: string, clientId: string) {
    const { tenantId } = this.contextOf(accessToken);
    const client = this.clients.get(clientId);
    if (!client || client.tenant_id !== tenantId) return null;
    return client;
  }

  async searchClients(accessToken: string, search?: string) {
    const { tenantId } = this.contextOf(accessToken);
    const needle = search?.toLowerCase();
    return [...this.clients.values()].filter(
      (client) => client.tenant_id === tenantId && (!needle || client.name.toLowerCase().includes(needle)),
    );
  }

  async createContact(accessToken: string, input: CreateContactInput) {
    const { tenantId } = this.contextOf(accessToken);
    const now = new Date().toISOString();
    const contact: Contact = {
      id: nextId("contact"),
      tenant_id: tenantId,
      client_id: input.client_id,
      name: input.name,
      title: input.title ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      is_primary: input.is_primary ?? false,
      created_at: now,
      updated_at: now,
    };
    this.contacts.set(contact.id, contact);
    return contact;
  }

  async listContactsForClient(accessToken: string, clientId: string) {
    const { tenantId } = this.contextOf(accessToken);
    return [...this.contacts.values()].filter(
      (contact) => contact.tenant_id === tenantId && contact.client_id === clientId,
    );
  }

  async searchContacts(accessToken: string, search?: string) {
    const { tenantId } = this.contextOf(accessToken);
    const needle = search?.toLowerCase();
    return [...this.contacts.values()].filter((contact) => {
      if (contact.tenant_id !== tenantId) return false;
      if (!needle) return true;
      return (
        contact.name.toLowerCase().includes(needle) ||
        (contact.email?.toLowerCase().includes(needle) ?? false) ||
        (contact.phone?.includes(needle) ?? false)
      );
    });
  }

  async createOpportunity(accessToken: string, input: CreateOpportunityInput) {
    const { tenantId } = this.contextOf(accessToken);
    const now = new Date().toISOString();
    const opportunity: Opportunity = {
      id: nextId("opportunity"),
      tenant_id: tenantId,
      client_id: input.client_id,
      title: input.title,
      source: input.source,
      owner_id: input.owner_id,
      stage: "lead",
      expected_value: input.expected_value ?? null,
      probability: input.probability ?? null,
      next_action: input.next_action ?? null,
      due_date: input.due_date ?? null,
      created_by: input.created_by,
      created_at: now,
      updated_at: now,
      handover_completed_at: null,
      handover_completed_by: null,
    };
    this.opportunities.set(opportunity.id, opportunity);
    return opportunity;
  }

  async getOpportunity(accessToken: string, opportunityId: string) {
    const { tenantId } = this.contextOf(accessToken);
    const opportunity = this.opportunities.get(opportunityId);
    if (!opportunity || opportunity.tenant_id !== tenantId) return null;
    return opportunity;
  }

  async listOpportunities(accessToken: string, filter?: ListOpportunitiesFilter) {
    const { tenantId } = this.contextOf(accessToken);
    return [...this.opportunities.values()].filter((opportunity) => {
      if (opportunity.tenant_id !== tenantId) return false;
      if (filter?.clientId && opportunity.client_id !== filter.clientId) return false;
      if (filter?.stage && opportunity.stage !== filter.stage) return false;
      return true;
    });
  }

  async updateOpportunity(accessToken: string, opportunityId: string, input: UpdateOpportunityInput) {
    const { tenantId } = this.contextOf(accessToken);
    const opportunity = this.opportunities.get(opportunityId);
    if (!opportunity || opportunity.tenant_id !== tenantId) return null;
    const updated: Opportunity = { ...opportunity, ...input, updated_at: new Date().toISOString() };
    this.opportunities.set(opportunityId, updated);
    return updated;
  }

  async createSiteVisit(accessToken: string, input: CreateSiteVisitInput) {
    const { tenantId } = this.contextOf(accessToken);
    const now = new Date().toISOString();
    const siteVisit: SiteVisit = {
      id: nextId("site-visit"),
      tenant_id: tenantId,
      opportunity_id: input.opportunity_id,
      visited_by: input.visited_by,
      visit_date: input.visit_date,
      notes: input.notes ?? null,
      created_at: now,
      updated_at: now,
    };
    this.siteVisits.set(siteVisit.id, siteVisit);
    return siteVisit;
  }

  async listSiteVisits(accessToken: string, opportunityId: string) {
    const { tenantId } = this.contextOf(accessToken);
    return [...this.siteVisits.values()].filter(
      (visit) => visit.tenant_id === tenantId && visit.opportunity_id === opportunityId,
    );
  }

  async createTenderSubmission(accessToken: string, input: CreateTenderSubmissionInput) {
    const { tenantId } = this.contextOf(accessToken);
    const now = new Date().toISOString();
    const tenderSubmission: TenderSubmission = {
      id: nextId("tender-submission"),
      tenant_id: tenantId,
      opportunity_id: input.opportunity_id,
      deadline_date: input.deadline_date,
      submitted_at: input.submitted_at ?? null,
      evidence_reference: input.evidence_reference ?? null,
      notes: input.notes ?? null,
      created_by: input.created_by,
      created_at: now,
      updated_at: now,
    };
    this.tenderSubmissions.set(tenderSubmission.id, tenderSubmission);
    return tenderSubmission;
  }

  async listTenderSubmissions(accessToken: string, opportunityId: string) {
    const { tenantId } = this.contextOf(accessToken);
    return [...this.tenderSubmissions.values()].filter(
      (submission) => submission.tenant_id === tenantId && submission.opportunity_id === opportunityId,
    );
  }

  async createClientCommunication(accessToken: string, input: CreateClientCommunicationInput) {
    const { tenantId } = this.contextOf(accessToken);
    const clientCommunication: ClientCommunication = {
      id: nextId("client-communication"),
      tenant_id: tenantId,
      client_id: input.client_id,
      opportunity_id: input.opportunity_id ?? null,
      channel: input.channel,
      summary: input.summary,
      logged_by: input.logged_by,
      occurred_at: input.occurred_at ?? new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    this.clientCommunications.set(clientCommunication.id, clientCommunication);
    return clientCommunication;
  }

  async listClientCommunications(accessToken: string, filter: { clientId?: string; opportunityId?: string }) {
    const { tenantId } = this.contextOf(accessToken);
    return [...this.clientCommunications.values()].filter((entry) => {
      if (entry.tenant_id !== tenantId) return false;
      if (filter.clientId && entry.client_id !== filter.clientId) return false;
      if (filter.opportunityId && entry.opportunity_id !== filter.opportunityId) return false;
      return true;
    });
  }

  async listHandoverChecklistItems(accessToken: string, opportunityId: string) {
    const { tenantId } = this.contextOf(accessToken);
    return [...this.handoverChecklistItems.values()].filter(
      (item) => item.tenant_id === tenantId && item.opportunity_id === opportunityId,
    );
  }

  async createHandoverChecklistItem(accessToken: string, input: CreateHandoverChecklistItemInput) {
    const { tenantId } = this.contextOf(accessToken);
    const item: OpportunityHandoverChecklistItem = {
      id: nextId("handover-item"),
      tenant_id: tenantId,
      opportunity_id: input.opportunity_id,
      item_key: input.item_key,
      status: input.status ?? "pending",
      completed_by: input.completed_by ?? null,
      completed_at: input.completed_at ?? null,
    };
    this.handoverChecklistItems.set(item.id, item);
    return item;
  }

  async updateHandoverChecklistItem(accessToken: string, itemId: string, input: UpdateHandoverChecklistItemInput) {
    const { tenantId } = this.contextOf(accessToken);
    const item = this.handoverChecklistItems.get(itemId);
    if (!item || item.tenant_id !== tenantId) return null;
    const updated: OpportunityHandoverChecklistItem = { ...item, ...input };
    this.handoverChecklistItems.set(itemId, updated);
    return updated;
  }

  async createHandoverException(accessToken: string, input: CreateHandoverExceptionInput) {
    const { tenantId } = this.contextOf(accessToken);
    const now = new Date().toISOString();
    const exception: OpportunityHandoverException = {
      id: nextId("handover-exception"),
      tenant_id: tenantId,
      opportunity_id: input.opportunity_id,
      reason: input.reason,
      requested_by: input.requested_by,
      workflow_instance_id: input.workflow_instance_id,
      status: "pending",
      created_at: now,
      updated_at: now,
    };
    this.handoverExceptions.set(exception.id, exception);
    return exception;
  }

  async getHandoverException(accessToken: string, exceptionId: string) {
    const { tenantId } = this.contextOf(accessToken);
    const exception = this.handoverExceptions.get(exceptionId);
    if (!exception || exception.tenant_id !== tenantId) return null;
    return exception;
  }

  async listHandoverExceptions(accessToken: string, opportunityId: string) {
    const { tenantId } = this.contextOf(accessToken);
    return [...this.handoverExceptions.values()].filter(
      (exception) => exception.tenant_id === tenantId && exception.opportunity_id === opportunityId,
    );
  }

  async updateHandoverException(accessToken: string, exceptionId: string, input: UpdateHandoverExceptionInput) {
    const { tenantId } = this.contextOf(accessToken);
    const exception = this.handoverExceptions.get(exceptionId);
    if (!exception || exception.tenant_id !== tenantId) return null;
    const updated: OpportunityHandoverException = {
      ...exception,
      ...input,
      updated_at: new Date().toISOString(),
    };
    this.handoverExceptions.set(exceptionId, updated);
    return updated;
  }
}
