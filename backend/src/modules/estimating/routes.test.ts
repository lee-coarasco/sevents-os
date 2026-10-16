import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeEstimatingRepository } from "../../test/fakeEstimatingRepository.js";
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
const TENDER_SUBMISSION_ID = "tender-submission-1";
const APPROVER = "approver-user";

function roleAssignment(id: string, userId: string, tenantId: string) {
  return {
    id,
    tenant_id: tenantId,
    user_id: userId,
    role_id: "role.platform_administrator",
    department_id: null,
    valid_from: "2000-01-01T00:00:00.000Z",
    valid_to: null,
  };
}

function appWithFakeRepos() {
  const authorityRepo = new FakeAuthorityRepository();
  authorityRepo.addSession(ADMIN_TOKEN, ADMIN_USER, TENANT_A);
  authorityRepo.addSession(PLAIN_TOKEN, PLAIN_USER, TENANT_A);
  authorityRepo.addSession(OTHER_TENANT_TOKEN, OTHER_TENANT_USER, TENANT_B);
  authorityRepo.roleAssignments.set("seed-a", roleAssignment("seed-a", ADMIN_USER, TENANT_A));
  authorityRepo.roleAssignments.set("seed-b", roleAssignment("seed-b", OTHER_TENANT_USER, TENANT_B));
  authorityRepo.grantPermission("role.platform_administrator", "tendering.document.manage");

  const estimatingRepo = new FakeEstimatingRepository();
  estimatingRepo.addSession(ADMIN_TOKEN, TENANT_A);
  estimatingRepo.addSession(PLAIN_TOKEN, TENANT_A);
  estimatingRepo.addSession(OTHER_TENANT_TOKEN, TENANT_B);

  const workflowRepo = new FakeWorkflowRepository();

  const app = buildApp({
    getAuthorityRepository: () => authorityRepo,
    getEstimatingRepository: () => estimatingRepo,
    getWorkflowRepository: () => workflowRepo,
  });
  return { app, estimatingRepo, workflowRepo };
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

describe("POST /tendering/tender-submissions/:id/estimates", () => {
  it("201s for a caller with tendering.document.manage, 403s without it, 401s with no token", async () => {
    const { app } = appWithFakeRepos();

    const created = await app.inject({
      method: "POST",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/estimates`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { assumptions: "Standard shift", taxes: 100, margin: 500 },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().estimate.version).toBe(1);
    expect(created.json().estimate.status).toBe("draft");
    expect(created.json().estimate.assumptions).toBe("Standard shift");

    const forbidden = await app.inject({
      method: "POST",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/estimates`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: {},
    });
    expect(forbidden.statusCode).toBe(403);

    const noToken = await app.inject({
      method: "POST",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/estimates`,
      payload: {},
    });
    expect(noToken.statusCode).toBe(401);
  });
});

describe("GET /tendering/tender-submissions/:id/estimates", () => {
  it("lists estimate versions, tenant-isolated", async () => {
    const { app } = appWithFakeRepos();
    await app.inject({
      method: "POST",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/estimates`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {},
    });

    const sameTenant = await app.inject({
      method: "GET",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/estimates`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(sameTenant.json().estimates).toHaveLength(1);

    const otherTenant = await app.inject({
      method: "GET",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/estimates`,
      headers: { authorization: `Bearer ${OTHER_TENANT_TOKEN}` },
    });
    expect(otherTenant.json().estimates).toHaveLength(0);
  });
});

describe("estimate line items", () => {
  it("adds and lists lines, recomputes totals, 404s a cross-tenant estimate", async () => {
    const { app } = appWithFakeRepos();
    const createResponse = await app.inject({
      method: "POST",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/estimates`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {},
    });
    const estimateId = createResponse.json().estimate.id;

    const lineResponse = await app.inject({
      method: "POST",
      url: `/estimates/${estimateId}/lines`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { item: "Blockwork", quantity: 50, unit: "m2", rate: 40, costCategory: "subcontractor" },
    });
    expect(lineResponse.statusCode).toBe(201);
    expect(lineResponse.json().line.line_total).toBe(2000);
    expect(lineResponse.json().line.source).toBe("manual");

    const missingFields = await app.inject({
      method: "POST",
      url: `/estimates/${estimateId}/lines`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { item: "Incomplete" },
    });
    expect(missingFields.statusCode).toBe(400);

    const estimateAfter = await app.inject({
      method: "GET",
      url: `/estimates/${estimateId}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(estimateAfter.json().estimate.subtotal_amount).toBe(2000);

    const crossTenant = await app.inject({
      method: "GET",
      url: `/estimates/${estimateId}`,
      headers: { authorization: `Bearer ${OTHER_TENANT_TOKEN}` },
    });
    expect(crossTenant.statusCode).toBe(404);
  });
});

describe("FR-EST-003: submit for approval, lock on approve, new version required for further edits", () => {
  it("full propose -> approve -> lock -> new-version flow over HTTP", async () => {
    const { app, workflowRepo } = appWithFakeRepos();
    const createResponse = await app.inject({
      method: "POST",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/estimates`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {},
    });
    const estimateId = createResponse.json().estimate.id;
    await app.inject({
      method: "POST",
      url: `/estimates/${estimateId}/lines`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { item: "Steel", quantity: 2, unit: "ton", rate: 2500, costCategory: "material" },
    });

    const definition = await publishApprovalWorkflow(workflowRepo, "estimate-route-approval");

    const denied = await app.inject({
      method: "POST",
      url: `/estimates/${estimateId}/submit-for-approval`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { definitionId: definition.id },
    });
    expect(denied.statusCode).toBe(403);

    const submitted = await app.inject({
      method: "POST",
      url: `/estimates/${estimateId}/submit-for-approval`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { definitionId: definition.id },
    });
    expect(submitted.statusCode).toBe(200);
    expect(submitted.json().estimate.status).toBe("pending_approval");
    const workflowInstanceId = submitted.json().estimate.workflow_instance_id;

    const stillPending = await app.inject({
      method: "GET",
      url: `/estimates/${estimateId}/approval-status`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(stillPending.json().estimate.status).toBe("pending_approval");

    const [step] = await workflowRepo.listStepInstances(ADMIN_TOKEN, workflowInstanceId);
    const authorityRepo = new FakeAuthorityRepository();
    await decideApprovalStep(workflowRepo, authorityRepo, ADMIN_TOKEN, step!.id, APPROVER, "approved", null);

    const resolved = await app.inject({
      method: "GET",
      url: `/estimates/${estimateId}/approval-status`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(resolved.json().estimate.status).toBe("approved");

    // Locked: editing fields or lines in place now fails.
    const blockedEdit = await app.inject({
      method: "PATCH",
      url: `/estimates/${estimateId}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { margin: 9999 },
    });
    expect(blockedEdit.statusCode).toBe(409);

    const blockedLine = await app.inject({
      method: "POST",
      url: `/estimates/${estimateId}/lines`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { item: "Should fail", quantity: 1, unit: "ea", rate: 1, costCategory: "labour" },
    });
    expect(blockedLine.statusCode).toBe(409);

    // The only legal path forward: a new version.
    const newVersion = await app.inject({
      method: "POST",
      url: `/estimates/${estimateId}/new-version`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(newVersion.statusCode).toBe(201);
    expect(newVersion.json().estimate.version).toBe(2);
    expect(newVersion.json().estimate.status).toBe("draft");

    const versions = await app.inject({
      method: "GET",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/estimates`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(versions.json().estimates).toHaveLength(2);
    expect(versions.json().estimates.find((e: { version: number }) => e.version === 1).status).toBe("approved");
    expect(versions.json().estimates.find((e: { version: number }) => e.version === 2).status).toBe("draft");
  });

  it("propose -> reject over HTTP: status updates, no new version", async () => {
    const { app, workflowRepo } = appWithFakeRepos();
    const createResponse = await app.inject({
      method: "POST",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/estimates`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {},
    });
    const estimateId = createResponse.json().estimate.id;
    const definition = await publishApprovalWorkflow(workflowRepo, "estimate-route-reject");

    const submitted = await app.inject({
      method: "POST",
      url: `/estimates/${estimateId}/submit-for-approval`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { definitionId: definition.id },
    });
    const workflowInstanceId = submitted.json().estimate.workflow_instance_id;
    const [step] = await workflowRepo.listStepInstances(ADMIN_TOKEN, workflowInstanceId);
    const authorityRepo = new FakeAuthorityRepository();
    await decideApprovalStep(workflowRepo, authorityRepo, ADMIN_TOKEN, step!.id, APPROVER, "rejected", "margin too thin");

    const resolved = await app.inject({
      method: "GET",
      url: `/estimates/${estimateId}/approval-status`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(resolved.json().estimate.status).toBe("rejected");

    const versions = await app.inject({
      method: "GET",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/estimates`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(versions.json().estimates).toHaveLength(1);
  });
});
