import { beforeEach, describe, expect, it } from "vitest";
import { FakeCrmRepository } from "../../test/fakeCrmRepository.js";
import { FakeWorkflowRepository } from "../../test/fakeWorkflowRepository.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import {
  addNodeToVersion,
  addTransitionToVersion,
  createWorkflowDefinition,
  decideApprovalStep,
  publishVersion,
  recordApproval,
  submitForApproval,
  validateVersion,
} from "../workflow/service.js";
import type { NodeType } from "../workflow/types.js";
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
  listHandoverChecklist,
  listSiteVisits,
  listTenderSubmissions,
  requestHandoverException,
  resolveHandoverException,
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

describe("pipeline forecast (ticket 0092, M10c)", () => {
  let repo: FakeCrmRepository;
  let clientId: string;

  beforeEach(async () => {
    repo = new FakeCrmRepository();
    repo.addSession(TOKEN, "user-1", TENANT_ID);
    const client = await createClient(repo, TOKEN, { name: "Acme", created_by: null });
    clientId = client.id;
  });

  it("aggregates weighted pipeline value by stage from real opportunity rows", async () => {
    await createOpportunity(repo, TOKEN, {
      client_id: clientId,
      title: "A",
      source: "referral",
      owner_id: "user-1",
      expected_value: 100000,
      probability: 50,
      created_by: null,
    });
    await createOpportunity(repo, TOKEN, {
      client_id: clientId,
      title: "B",
      source: "referral",
      owner_id: "user-1",
      expected_value: 200000,
      probability: 25,
      created_by: null,
    });

    const forecast = await getPipelineForecast(repo, TOKEN, "stage");

    expect(forecast.groups).toHaveLength(1);
    expect(forecast.groups[0]?.opportunityCount).toBe(2);
    expect(forecast.groups[0]?.weightedValue).toBe(100000);
  });
});

describe("won-opportunity handover checklist and exception approval (ticket 0092, M10c)", () => {
  let repo: FakeCrmRepository;
  let workflowRepo: FakeWorkflowRepository;
  let authorityRepo: FakeAuthorityRepository;
  let clientId: string;
  let opportunityId: string;
  const APPROVER = "approver-user";

  async function publishApprovalWorkflow(key: string) {
    const nodes: { key: string; type: NodeType; config?: Record<string, unknown> }[] = [
      { key: "approve", type: "request_approval", config: { approverUserIds: [APPROVER] } },
      { key: "end", type: "complete" },
    ];
    const { definition, version } = await createWorkflowDefinition(workflowRepo, TOKEN, { key, name: key }, "process-owner");
    const nodeIdByKey = new Map<string, string>();
    for (const n of nodes) {
      const node = await addNodeToVersion(workflowRepo, TOKEN, version.id, { nodeKey: n.key, nodeType: n.type, config: n.config ?? {} });
      nodeIdByKey.set(n.key, node.id);
    }
    await addTransitionToVersion(workflowRepo, TOKEN, version.id, {
      fromNodeId: nodeIdByKey.get("approve")!,
      toNodeId: nodeIdByKey.get("end")!,
      orderIndex: 0,
    });
    await validateVersion(workflowRepo, TOKEN, version.id, "process-owner");
    await submitForApproval(workflowRepo, TOKEN, definition.id, version.id, "process-owner");
    await recordApproval(workflowRepo, TOKEN, definition.id, version.id, APPROVER, "approved", null);
    await publishVersion(workflowRepo, TOKEN, definition.id, version.id, APPROVER);
    return definition;
  }

  beforeEach(async () => {
    repo = new FakeCrmRepository();
    repo.addSession(TOKEN, "user-1", TENANT_ID);
    repo.addSession(OTHER_TOKEN, "user-2", OTHER_TENANT_ID);
    workflowRepo = new FakeWorkflowRepository();
    authorityRepo = new FakeAuthorityRepository();
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
    await updateOpportunity(repo, TOKEN, opportunityId, { stage: "won" });
  });

  it("listHandoverChecklist materializes the four fixed items as pending, tenant-isolated", async () => {
    const items = await listHandoverChecklist(repo, TOKEN, opportunityId);
    expect(items).toHaveLength(4);
    expect(items.every((i) => i.status === "pending")).toBe(true);

    await expect(listHandoverChecklist(repo, OTHER_TOKEN, opportunityId)).rejects.toThrow(NotFoundError);
  });

  it("completeHandover rejects an opportunity that is not yet won", async () => {
    const notWon = await createOpportunity(repo, TOKEN, {
      client_id: clientId,
      title: "Not won yet",
      source: "referral",
      owner_id: "user-1",
      created_by: null,
    });

    await expect(completeHandover(repo, TOKEN, notWon.id, "user-1")).rejects.toBeInstanceOf(OpportunityNotWonError);
  });

  it("completeHandover blocks while any checklist item is pending, then succeeds once all are complete", async () => {
    const items = await listHandoverChecklist(repo, TOKEN, opportunityId);

    await expect(completeHandover(repo, TOKEN, opportunityId, "user-1")).rejects.toBeInstanceOf(
      HandoverChecklistIncompleteError,
    );

    for (const item of items) {
      await completeHandoverItem(repo, TOKEN, opportunityId, item.item_key, "user-1");
    }

    const opportunity = await completeHandover(repo, TOKEN, opportunityId, "user-1");
    expect(opportunity.handover_completed_at).not.toBeNull();
    expect(opportunity.handover_completed_by).toBe("user-1");
  });

  it("requestHandoverException rejects a blank reason", async () => {
    const definition = await publishApprovalWorkflow("handover-exception-1");

    await expect(
      requestHandoverException(repo, workflowRepo, TOKEN, {
        opportunityId,
        reason: "   ",
        requestedBy: "user-1",
        definitionId: definition.id,
      }),
    ).rejects.toBeInstanceOf(MissingHandoverExceptionReasonError);
  });

  it("an approved exception lets completeHandover succeed despite incomplete checklist items", async () => {
    const definition = await publishApprovalWorkflow("handover-exception-2");

    const exception = await requestHandoverException(repo, workflowRepo, TOKEN, {
      opportunityId,
      reason: "client needs the site before paperwork finalizes",
      requestedBy: "user-1",
      definitionId: definition.id,
    });
    expect(exception.status).toBe("pending");

    await expect(completeHandover(repo, TOKEN, opportunityId, "user-1")).rejects.toBeInstanceOf(
      HandoverChecklistIncompleteError,
    );

    // Still pending: the approval step hasn't been decided yet.
    const stillPending = await resolveHandoverException(repo, workflowRepo, TOKEN, exception.id);
    expect(stillPending.status).toBe("pending");

    const instance = await workflowRepo.getInstance(TOKEN, exception.workflow_instance_id);
    const [step] = await workflowRepo.listStepInstances(TOKEN, instance!.id);
    await decideApprovalStep(workflowRepo, authorityRepo, TOKEN, step!.id, APPROVER, "approved", null);

    const resolved = await resolveHandoverException(repo, workflowRepo, TOKEN, exception.id);
    expect(resolved.status).toBe("approved");

    const opportunity = await completeHandover(repo, TOKEN, opportunityId, "user-1");
    expect(opportunity.handover_completed_at).not.toBeNull();

    // Idempotent: resolving again does not change the already-approved status.
    const resolvedAgain = await resolveHandoverException(repo, workflowRepo, TOKEN, exception.id);
    expect(resolvedAgain.status).toBe("approved");
  });

  it("a rejected exception leaves the handover blocked", async () => {
    const definition = await publishApprovalWorkflow("handover-exception-3");
    const exception = await requestHandoverException(repo, workflowRepo, TOKEN, {
      opportunityId,
      reason: "client needs the site before paperwork finalizes",
      requestedBy: "user-1",
      definitionId: definition.id,
    });

    const instance = await workflowRepo.getInstance(TOKEN, exception.workflow_instance_id);
    const [step] = await workflowRepo.listStepInstances(TOKEN, instance!.id);
    await decideApprovalStep(workflowRepo, authorityRepo, TOKEN, step!.id, APPROVER, "rejected", "not justified");

    const resolved = await resolveHandoverException(repo, workflowRepo, TOKEN, exception.id);
    expect(resolved.status).toBe("rejected");

    await expect(completeHandover(repo, TOKEN, opportunityId, "user-1")).rejects.toBeInstanceOf(
      HandoverChecklistIncompleteError,
    );
  });
});
