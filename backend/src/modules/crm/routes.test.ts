import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeCrmRepository } from "../../test/fakeCrmRepository.js";
import { FakeWorkflowRepository } from "../../test/fakeWorkflowRepository.js";
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

const ADMIN_TOKEN = "admin-token";
const ADMIN_USER = "admin-user";
const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const PLAIN_TOKEN = "plain-token";
const PLAIN_USER = "plain-user";
const OTHER_TENANT_TOKEN = "other-tenant-token";
const OTHER_TENANT_USER = "other-tenant-user";
const APPROVER = "approver-user";

function appWithFakeRepos() {
  const authorityRepo = new FakeAuthorityRepository();
  authorityRepo.addSession(ADMIN_TOKEN, ADMIN_USER, TENANT_A);
  authorityRepo.addSession(PLAIN_TOKEN, PLAIN_USER, TENANT_A);
  authorityRepo.addSession(OTHER_TENANT_TOKEN, OTHER_TENANT_USER, TENANT_B);
  authorityRepo.roleAssignments.set("seed-a", {
    id: "seed-a",
    tenant_id: TENANT_A,
    user_id: ADMIN_USER,
    role_id: "role.platform_administrator",
    department_id: null,
    valid_from: "2000-01-01T00:00:00.000Z",
    valid_to: null,
  });
  authorityRepo.roleAssignments.set("seed-b", {
    id: "seed-b",
    tenant_id: TENANT_B,
    user_id: OTHER_TENANT_USER,
    role_id: "role.platform_administrator",
    department_id: null,
    valid_from: "2000-01-01T00:00:00.000Z",
    valid_to: null,
  });
  authorityRepo.grantPermission("role.platform_administrator", "crm.lead.manage");

  const crmRepo = new FakeCrmRepository();
  crmRepo.addSession(ADMIN_TOKEN, ADMIN_USER, TENANT_A);
  crmRepo.addSession(PLAIN_TOKEN, PLAIN_USER, TENANT_A);
  crmRepo.addSession(OTHER_TENANT_TOKEN, OTHER_TENANT_USER, TENANT_B);

  const workflowRepo = new FakeWorkflowRepository();

  const app = buildApp({
    getAuthorityRepository: () => authorityRepo,
    getCrmRepository: () => crmRepo,
    getWorkflowRepository: () => workflowRepo,
  });
  return { app, crmRepo, workflowRepo };
}

async function publishApprovalWorkflow(workflowRepo: FakeWorkflowRepository, key: string) {
  const { definition, version } = await createWorkflowDefinition(workflowRepo, ADMIN_TOKEN, { key, name: key }, ADMIN_USER);
  const approve = await addNodeToVersion(workflowRepo, ADMIN_TOKEN, version.id, {
    nodeKey: "approve",
    nodeType: "request_approval",
    config: { approverUserIds: [APPROVER] },
  });
  const end = await addNodeToVersion(workflowRepo, ADMIN_TOKEN, version.id, { nodeKey: "end", nodeType: "complete", config: {} });
  await addTransitionToVersion(workflowRepo, ADMIN_TOKEN, version.id, { fromNodeId: approve.id, toNodeId: end.id, orderIndex: 0 });
  await validateVersion(workflowRepo, ADMIN_TOKEN, version.id, ADMIN_USER);
  await submitForApproval(workflowRepo, ADMIN_TOKEN, definition.id, version.id, ADMIN_USER);
  await recordApproval(workflowRepo, ADMIN_TOKEN, definition.id, version.id, APPROVER, "approved", null);
  await publishVersion(workflowRepo, ADMIN_TOKEN, definition.id, version.id, APPROVER);
  return definition;
}

describe("POST /crm/clients", () => {
  it("201s for a caller with crm.lead.manage", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({
      method: "POST",
      url: "/crm/clients",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { name: "Acme Construction" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().client.name).toBe("Acme Construction");
  });

  it("403s without the permission", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({
      method: "POST",
      url: "/crm/clients",
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { name: "Should not be created" },
    });

    expect(response.statusCode).toBe(403);
  });

  it("401s with no bearer token", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({ method: "POST", url: "/crm/clients", payload: { name: "No token" } });

    expect(response.statusCode).toBe(401);
  });

  it("400s without a name", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({
      method: "POST",
      url: "/crm/clients",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });
});

describe("GET /crm/clients?search=", () => {
  it("surfaces a likely duplicate by name (FR-CRM-002)", async () => {
    const { app } = appWithFakeRepos();
    await app.inject({
      method: "POST",
      url: "/crm/clients",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { name: "Acme Construction LLC" },
    });

    const response = await app.inject({
      method: "GET",
      url: "/crm/clients?search=acme",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().clients).toHaveLength(1);
  });

  it("never surfaces another tenant's client", async () => {
    const { app } = appWithFakeRepos();
    await app.inject({
      method: "POST",
      url: "/crm/clients",
      headers: { authorization: `Bearer ${OTHER_TENANT_TOKEN}` },
      payload: { name: "Acme Construction LLC" },
    });

    const response = await app.inject({
      method: "GET",
      url: "/crm/clients?search=acme",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().clients).toHaveLength(0);
  });
});

describe("opportunity lifecycle", () => {
  it("creates, reads, lists, and advances the stage of an opportunity", async () => {
    const { app } = appWithFakeRepos();
    const clientResponse = await app.inject({
      method: "POST",
      url: "/crm/clients",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { name: "Acme Construction" },
    });
    const clientId = clientResponse.json().client.id;

    const createResponse = await app.inject({
      method: "POST",
      url: "/crm/opportunities",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { clientId, title: "New warehouse build", source: "referral", ownerId: ADMIN_USER },
    });
    expect(createResponse.statusCode).toBe(201);
    const opportunityId = createResponse.json().opportunity.id;
    expect(createResponse.json().opportunity.stage).toBe("lead");

    const getResponse = await app.inject({
      method: "GET",
      url: `/crm/opportunities/${opportunityId}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(getResponse.statusCode).toBe(200);

    const listResponse = await app.inject({
      method: "GET",
      url: `/crm/opportunities?clientId=${clientId}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(listResponse.json().opportunities).toHaveLength(1);

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/crm/opportunities/${opportunityId}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { stage: "qualified" },
    });
    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.json().opportunity.stage).toBe("qualified");
  });

  it("404s reading an opportunity that belongs to another tenant", async () => {
    const { app } = appWithFakeRepos();
    const clientResponse = await app.inject({
      method: "POST",
      url: "/crm/clients",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { name: "Acme Construction" },
    });
    const clientId = clientResponse.json().client.id;
    const createResponse = await app.inject({
      method: "POST",
      url: "/crm/opportunities",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { clientId, title: "New warehouse build", source: "referral", ownerId: ADMIN_USER },
    });
    const opportunityId = createResponse.json().opportunity.id;

    const response = await app.inject({
      method: "GET",
      url: `/crm/opportunities/${opportunityId}`,
      headers: { authorization: `Bearer ${OTHER_TENANT_TOKEN}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it("403s creating an opportunity without crm.lead.manage", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({
      method: "POST",
      url: "/crm/opportunities",
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { clientId: "client-1", title: "x", source: "referral", ownerId: PLAIN_USER },
    });

    expect(response.statusCode).toBe(403);
  });
});

describe("site visits, tender submissions and client communications (M10b)", () => {
  async function createClientAndOpportunity(app: ReturnType<typeof appWithFakeRepos>["app"]) {
    const clientResponse = await app.inject({
      method: "POST",
      url: "/crm/clients",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { name: "Acme Construction" },
    });
    const clientId = clientResponse.json().client.id;
    const opportunityResponse = await app.inject({
      method: "POST",
      url: "/crm/opportunities",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { clientId, title: "New warehouse build", source: "referral", ownerId: ADMIN_USER },
    });
    return { clientId, opportunityId: opportunityResponse.json().opportunity.id };
  }

  it("logs and lists a site visit against an opportunity", async () => {
    const { app } = appWithFakeRepos();
    const { opportunityId } = await createClientAndOpportunity(app);

    const postResponse = await app.inject({
      method: "POST",
      url: `/crm/opportunities/${opportunityId}/site-visits`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { visitedBy: ADMIN_USER, visitDate: "2026-11-05" },
    });
    expect(postResponse.statusCode).toBe(201);

    const getResponse = await app.inject({
      method: "GET",
      url: `/crm/opportunities/${opportunityId}/site-visits`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(getResponse.json().siteVisits).toHaveLength(1);
  });

  it("FR-CRM-003: tracks a tender deadline/submission and 403s without the permission", async () => {
    const { app } = appWithFakeRepos();
    const { opportunityId } = await createClientAndOpportunity(app);

    const postResponse = await app.inject({
      method: "POST",
      url: `/crm/opportunities/${opportunityId}/tender-submissions`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { deadlineDate: "2026-12-01", evidenceReference: "Portal ref #TND-2026-004" },
    });
    expect(postResponse.statusCode).toBe(201);

    const forbidden = await app.inject({
      method: "POST",
      url: `/crm/opportunities/${opportunityId}/tender-submissions`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { deadlineDate: "2026-12-10" },
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it("logs a client communication and lists it by client, scoped to the caller's tenant", async () => {
    const { app } = appWithFakeRepos();
    const { clientId, opportunityId } = await createClientAndOpportunity(app);

    const postResponse = await app.inject({
      method: "POST",
      url: "/crm/client-communications",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { clientId, opportunityId, channel: "phone", summary: "Discussed revised timeline." },
    });
    expect(postResponse.statusCode).toBe(201);

    const listResponse = await app.inject({
      method: "GET",
      url: `/crm/client-communications?clientId=${clientId}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(listResponse.json().clientCommunications).toHaveLength(1);

    const crossTenantResponse = await app.inject({
      method: "GET",
      url: `/crm/client-communications?clientId=${clientId}`,
      headers: { authorization: `Bearer ${OTHER_TENANT_TOKEN}` },
    });
    expect(crossTenantResponse.json().clientCommunications).toHaveLength(0);
  });
});

describe("GET /crm/pipeline/forecast (ticket 0092, M10c)", () => {
  async function createOpportunity(
    app: ReturnType<typeof appWithFakeRepos>["app"],
    overrides: Record<string, unknown> = {},
  ) {
    const clientResponse = await app.inject({
      method: "POST",
      url: "/crm/clients",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { name: "Acme Construction" },
    });
    const clientId = clientResponse.json().client.id;
    const response = await app.inject({
      method: "POST",
      url: "/crm/opportunities",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        clientId,
        title: "New warehouse build",
        source: "referral",
        ownerId: ADMIN_USER,
        expectedValue: 100000,
        probability: 50,
        ...overrides,
      },
    });
    return response.json().opportunity.id as string;
  }

  it("aggregates weighted pipeline value grouped by stage", async () => {
    const { app } = appWithFakeRepos();
    await createOpportunity(app, { expectedValue: 100000, probability: 50 });
    await createOpportunity(app, { expectedValue: 200000, probability: 25 });

    const response = await app.inject({
      method: "GET",
      url: "/crm/pipeline/forecast",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });

    expect(response.statusCode).toBe(200);
    const forecast = response.json().forecast;
    expect(forecast.groupBy).toBe("stage");
    expect(forecast.groups).toHaveLength(1);
    expect(forecast.groups[0].key).toBe("lead");
    expect(forecast.groups[0].opportunityCount).toBe(2);
    expect(forecast.groups[0].totalExpectedValue).toBe(300000);
    expect(forecast.groups[0].weightedValue).toBe(100000);
  });

  it("400s on an invalid groupBy", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({
      method: "GET",
      url: "/crm/pipeline/forecast?groupBy=bogus",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });

    expect(response.statusCode).toBe(400);
  });

  it("403s without crm.lead.manage", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({
      method: "GET",
      url: "/crm/pipeline/forecast",
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
    });

    expect(response.statusCode).toBe(403);
  });
});

describe("won-opportunity handover checklist and exception approval (ticket 0092, M10c)", () => {
  async function createWonOpportunity(app: ReturnType<typeof appWithFakeRepos>["app"]) {
    const clientResponse = await app.inject({
      method: "POST",
      url: "/crm/clients",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { name: "Acme Construction" },
    });
    const clientId = clientResponse.json().client.id;
    const createResponse = await app.inject({
      method: "POST",
      url: "/crm/opportunities",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { clientId, title: "New warehouse build", source: "referral", ownerId: ADMIN_USER },
    });
    const opportunityId = createResponse.json().opportunity.id as string;
    await app.inject({
      method: "PATCH",
      url: `/crm/opportunities/${opportunityId}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { stage: "won" },
    });
    return opportunityId;
  }

  it("GET handover-checklist materializes all four fixed items as pending", async () => {
    const { app } = appWithFakeRepos();
    const opportunityId = await createWonOpportunity(app);

    const response = await app.inject({
      method: "GET",
      url: `/crm/opportunities/${opportunityId}/handover-checklist`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });

    expect(response.statusCode).toBe(200);
    const items = response.json().items;
    expect(items).toHaveLength(4);
    expect(items.every((i: { status: string }) => i.status === "pending")).toBe(true);
  });

  it("blocks completeHandover while any item is pending, then allows it once all four are complete", async () => {
    const { app } = appWithFakeRepos();
    const opportunityId = await createWonOpportunity(app);
    const checklist = await app.inject({
      method: "GET",
      url: `/crm/opportunities/${opportunityId}/handover-checklist`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const itemKeys = checklist.json().items.map((i: { item_key: string }) => i.item_key);

    const blocked = await app.inject({
      method: "POST",
      url: `/crm/opportunities/${opportunityId}/handover/complete`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(blocked.statusCode).toBe(409);

    for (const itemKey of itemKeys) {
      const complete = await app.inject({
        method: "POST",
        url: `/crm/opportunities/${opportunityId}/handover-checklist/${itemKey}/complete`,
        headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      });
      expect(complete.statusCode).toBe(200);
    }

    const completed = await app.inject({
      method: "POST",
      url: `/crm/opportunities/${opportunityId}/handover/complete`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json().opportunity.handover_completed_at).not.toBeNull();
  });

  it("an approved exception lets handover complete despite missing checklist items", async () => {
    const { app, workflowRepo } = appWithFakeRepos();
    const opportunityId = await createWonOpportunity(app);
    const definition = await publishApprovalWorkflow(workflowRepo, "handover-exception-route-test");

    const requestResponse = await app.inject({
      method: "POST",
      url: `/crm/opportunities/${opportunityId}/handover-exceptions`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { reason: "client needs site handed over before paperwork finalizes", definitionId: definition.id },
    });
    expect(requestResponse.statusCode).toBe(201);
    const exceptionId = requestResponse.json().exception.id;

    const stillBlocked = await app.inject({
      method: "POST",
      url: `/crm/opportunities/${opportunityId}/handover/complete`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(stillBlocked.statusCode).toBe(409);

    const instance = await workflowRepo.getInstance(ADMIN_TOKEN, requestResponse.json().exception.workflow_instance_id);
    const [step] = await workflowRepo.listStepInstances(ADMIN_TOKEN, instance!.id);
    const authorityRepo = new FakeAuthorityRepository();
    await decideApprovalStep(workflowRepo, authorityRepo, ADMIN_TOKEN, step!.id, APPROVER, "approved", null);

    const pollResponse = await app.inject({
      method: "GET",
      url: `/crm/handover-exceptions/${exceptionId}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(pollResponse.json().exception.status).toBe("approved");

    const completed = await app.inject({
      method: "POST",
      url: `/crm/opportunities/${opportunityId}/handover/complete`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json().opportunity.handover_completed_at).not.toBeNull();
  });

  it("400s requesting a handover exception for an opportunity that isn't won", async () => {
    const { app, workflowRepo } = appWithFakeRepos();
    const clientResponse = await app.inject({
      method: "POST",
      url: "/crm/clients",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { name: "Acme Construction" },
    });
    const clientId = clientResponse.json().client.id;
    const createResponse = await app.inject({
      method: "POST",
      url: "/crm/opportunities",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { clientId, title: "New warehouse build", source: "referral", ownerId: ADMIN_USER },
    });
    const opportunityId = createResponse.json().opportunity.id;
    const definition = await publishApprovalWorkflow(workflowRepo, "handover-exception-not-won-route-test");

    const response = await app.inject({
      method: "POST",
      url: `/crm/opportunities/${opportunityId}/handover-exceptions`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { reason: "too early", definitionId: definition.id },
    });

    expect(response.statusCode).toBe(400);
  });
});
