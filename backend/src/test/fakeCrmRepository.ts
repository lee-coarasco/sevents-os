import type {
  CreateClientInput,
  CreateContactInput,
  CreateOpportunityInput,
  CrmRepository,
  ListOpportunitiesFilter,
  UpdateOpportunityInput,
} from "../modules/crm/repository.js";
import type { Client, Contact, Opportunity } from "../modules/crm/types.js";

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
}
