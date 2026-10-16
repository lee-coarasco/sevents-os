import { beforeEach, describe, expect, it } from "vitest";
import { FakeCrmRepository } from "../../test/fakeCrmRepository.js";
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
  listSiteVisits,
  listTenderSubmissions,
  searchClients,
  searchContacts,
  updateOpportunity,
} from "./service.js";

const TOKEN = "caller-token";
const TENANT_ID = "tenant-a";
const OTHER_TOKEN = "other-tenant-token";
const OTHER_TENANT_ID = "tenant-b";

describe("createClient / searchClients", () => {
  let repo: FakeCrmRepository;

  beforeEach(() => {
    repo = new FakeCrmRepository();
    repo.addSession(TOKEN, "user-1", TENANT_ID);
    repo.addSession(OTHER_TOKEN, "user-2", OTHER_TENANT_ID);
  });

  it("creates a client", async () => {
    const client = await createClient(repo, TOKEN, { name: "Acme Construction", created_by: "user-1" });
    expect(client.name).toBe("Acme Construction");
    expect(client.tenant_id).toBe(TENANT_ID);
  });

  it("FR-CRM-002: search surfaces a likely duplicate by name, case-insensitively", async () => {
    await createClient(repo, TOKEN, { name: "Acme Construction LLC", created_by: null });

    const matches = await searchClients(repo, TOKEN, "acme");

    expect(matches).toHaveLength(1);
    expect(matches[0]?.name).toBe("Acme Construction LLC");
  });

  it("search is tenant-isolated: another tenant's client never surfaces as a duplicate", async () => {
    await createClient(repo, OTHER_TOKEN, { name: "Acme Construction LLC", created_by: null });

    const matches = await searchClients(repo, TOKEN, "acme");

    expect(matches).toHaveLength(0);
  });
});

describe("createContact / searchContacts", () => {
  let repo: FakeCrmRepository;
  let clientId: string;

  beforeEach(async () => {
    repo = new FakeCrmRepository();
    repo.addSession(TOKEN, "user-1", TENANT_ID);
    const client = await createClient(repo, TOKEN, { name: "Acme", created_by: null });
    clientId = client.id;
  });

  it("creates a contact under a client", async () => {
    const contact = await createContact(repo, TOKEN, { client_id: clientId, name: "Jane Doe", email: "jane@acme.test" });
    expect(contact.client_id).toBe(clientId);
    expect(contact.email).toBe("jane@acme.test");
  });

  it("FR-CRM-002: search surfaces a likely duplicate by email", async () => {
    await createContact(repo, TOKEN, { client_id: clientId, name: "Jane Doe", email: "jane@acme.test" });

    const matches = await searchContacts(repo, TOKEN, "jane@acme.test");

    expect(matches).toHaveLength(1);
  });

  it("FR-CRM-002: search surfaces a likely duplicate by phone", async () => {
    await createContact(repo, TOKEN, { client_id: clientId, name: "Jane Doe", phone: "+971500000000" });

    const matches = await searchContacts(repo, TOKEN, "971500000000");

    expect(matches).toHaveLength(1);
  });
});

describe("createOpportunity / getOpportunity / updateOpportunity", () => {
  let repo: FakeCrmRepository;
  let clientId: string;

  beforeEach(async () => {
    repo = new FakeCrmRepository();
    repo.addSession(TOKEN, "user-1", TENANT_ID);
    repo.addSession(OTHER_TOKEN, "user-2", OTHER_TENANT_ID);
    const client = await createClient(repo, TOKEN, { name: "Acme", created_by: null });
    clientId = client.id;
  });

  it("FR-CRM-001: creates an opportunity with every required field as a real column, defaulting to the lead stage", async () => {
    const opportunity = await createOpportunity(repo, TOKEN, {
      client_id: clientId,
      title: "New warehouse build",
      source: "referral",
      owner_id: "user-1",
      expected_value: 500000,
      probability: 20,
      next_action: "Schedule site visit",
      due_date: "2026-11-01",
      created_by: "user-1",
    });

    expect(opportunity.stage).toBe("lead");
    expect(opportunity.source).toBe("referral");
    expect(opportunity.owner_id).toBe("user-1");
    expect(opportunity.expected_value).toBe(500000);
    expect(opportunity.probability).toBe(20);
    expect(opportunity.next_action).toBe("Schedule site visit");
    expect(opportunity.due_date).toBe("2026-11-01");
  });

  it("advances stage via update without touching other fields", async () => {
    const opportunity = await createOpportunity(repo, TOKEN, {
      client_id: clientId,
      title: "New warehouse build",
      source: "referral",
      owner_id: "user-1",
      created_by: null,
    });

    const updated = await updateOpportunity(repo, TOKEN, opportunity.id, { stage: "qualified" });

    expect(updated.stage).toBe("qualified");
    expect(updated.title).toBe("New warehouse build");
  });

  it("throws NotFoundError for an opportunity in another tenant", async () => {
    const opportunity = await createOpportunity(repo, TOKEN, {
      client_id: clientId,
      title: "New warehouse build",
      source: "referral",
      owner_id: "user-1",
      created_by: null,
    });

    await expect(getOpportunity(repo, OTHER_TOKEN, opportunity.id)).rejects.toThrow(NotFoundError);
  });
});

describe("site visits, tender submissions and client communications (M10b)", () => {
  let repo: FakeCrmRepository;
  let clientId: string;
  let opportunityId: string;

  beforeEach(async () => {
    repo = new FakeCrmRepository();
    repo.addSession(TOKEN, "user-1", TENANT_ID);
    repo.addSession(OTHER_TOKEN, "user-2", OTHER_TENANT_ID);
    const client = await createClient(repo, TOKEN, { name: "Acme", created_by: null });
    clientId = client.id;
    const opportunity = await createOpportunity(repo, TOKEN, {
      client_id: clientId,
      title: "New warehouse build",
      source: "referral",
      owner_id: "user-1",
      created_by: null,
    });
    opportunityId = opportunity.id;
  });

  it("logs a site visit against an opportunity and lists it back", async () => {
    await createSiteVisit(repo, TOKEN, {
      opportunity_id: opportunityId,
      visited_by: "user-1",
      visit_date: "2026-11-05",
      notes: "Site is accessible, no major obstructions.",
    });

    const visits = await listSiteVisits(repo, TOKEN, opportunityId);

    expect(visits).toHaveLength(1);
    expect(visits[0]?.visit_date).toBe("2026-11-05");
  });

  it("FR-CRM-003: tracks a tender deadline and its submission evidence", async () => {
    await createTenderSubmission(repo, TOKEN, {
      opportunity_id: opportunityId,
      deadline_date: "2026-12-01",
      submitted_at: "2026-11-30T10:00:00.000Z",
      evidence_reference: "Submitted via portal ref #TND-2026-004",
      notes: null,
      created_by: "user-1",
    });

    const submissions = await listTenderSubmissions(repo, TOKEN, opportunityId);

    expect(submissions).toHaveLength(1);
    expect(submissions[0]?.deadline_date).toBe("2026-12-01");
    expect(submissions[0]?.evidence_reference).toContain("TND-2026-004");
  });

  it("supports more than one tender submission per opportunity (e.g. a resubmission)", async () => {
    await createTenderSubmission(repo, TOKEN, {
      opportunity_id: opportunityId,
      deadline_date: "2026-12-01",
      created_by: null,
    });
    await createTenderSubmission(repo, TOKEN, {
      opportunity_id: opportunityId,
      deadline_date: "2026-12-10",
      created_by: null,
    });

    const submissions = await listTenderSubmissions(repo, TOKEN, opportunityId);

    expect(submissions).toHaveLength(2);
  });

  it("logs a client communication (a log, not a messaging feature) and lists it by client", async () => {
    await createClientCommunication(repo, TOKEN, {
      client_id: clientId,
      opportunity_id: opportunityId,
      channel: "phone",
      summary: "Discussed revised timeline.",
      logged_by: "user-1",
    });

    const communications = await listClientCommunications(repo, TOKEN, { clientId });

    expect(communications).toHaveLength(1);
    expect(communications[0]?.channel).toBe("phone");
  });

  it("tenant-isolates site visits, tender submissions and communications", async () => {
    await createSiteVisit(repo, TOKEN, { opportunity_id: opportunityId, visited_by: "user-1", visit_date: "2026-11-05" });
    await createTenderSubmission(repo, TOKEN, { opportunity_id: opportunityId, deadline_date: "2026-12-01", created_by: null });
    await createClientCommunication(repo, TOKEN, {
      client_id: clientId,
      channel: "email",
      summary: "Sent proposal.",
      logged_by: "user-1",
    });

    expect(await listSiteVisits(repo, OTHER_TOKEN, opportunityId)).toHaveLength(0);
    expect(await listTenderSubmissions(repo, OTHER_TOKEN, opportunityId)).toHaveLength(0);
    expect(await listClientCommunications(repo, OTHER_TOKEN, { clientId })).toHaveLength(0);
  });
});
