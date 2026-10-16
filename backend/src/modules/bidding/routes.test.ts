import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeBiddingRepository } from "../../test/fakeBiddingRepository.js";
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
const ESTIMATE_ID = "estimate-1";
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

  const biddingRepo = new FakeBiddingRepository();
  biddingRepo.addSession(ADMIN_TOKEN, TENANT_A);
  biddingRepo.addSession(PLAIN_TOKEN, TENANT_A);
  biddingRepo.addSession(OTHER_TENANT_TOKEN, TENANT_B);

  const workflowRepo = new FakeWorkflowRepository();

  const app = buildApp({
    getAuthorityRepository: () => authorityRepo,
    getBiddingRepository: () => biddingRepo,
    getWorkflowRepository: () => workflowRepo,
  });
  return { app, biddingRepo, workflowRepo };
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

describe("POST /estimates/:id/bid-decisions", () => {
  it("201s for a caller with tendering.document.manage, 403s without it, 401s with no token", async () => {
    const { app } = appWithFakeRepos();

    const created = await app.inject({
      method: "POST",
      url: `/estimates/${ESTIMATE_ID}/bid-decisions`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { recommendation: "bid" },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().decision.status).toBe("draft");
    expect(created.json().decision.recommendation).toBe("bid");

    const badBody = await app.inject({
      method: "POST",
      url: `/estimates/${ESTIMATE_ID}/bid-decisions`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { recommendation: "maybe" },
    });
    expect(badBody.statusCode).toBe(400);

    const forbidden = await app.inject({
      method: "POST",
      url: `/estimates/${ESTIMATE_ID}/bid-decisions`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { recommendation: "bid" },
    });
    expect(forbidden.statusCode).toBe(403);

    const noToken = await app.inject({
      method: "POST",
      url: `/estimates/${ESTIMATE_ID}/bid-decisions`,
      payload: { recommendation: "bid" },
    });
    expect(noToken.statusCode).toBe(401);
  });
});

describe("GET /estimates/:id/bid-decisions", () => {
  it("lists decisions, tenant-isolated", async () => {
    const { app } = appWithFakeRepos();
    await app.inject({
      method: "POST",
      url: `/estimates/${ESTIMATE_ID}/bid-decisions`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { recommendation: "bid" },
    });

    const sameTenant = await app.inject({
      method: "GET",
      url: `/estimates/${ESTIMATE_ID}/bid-decisions`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(sameTenant.json().decisions).toHaveLength(1);

    const otherTenant = await app.inject({
      method: "GET",
      url: `/estimates/${ESTIMATE_ID}/bid-decisions`,
      headers: { authorization: `Bearer ${OTHER_TENANT_TOKEN}` },
    });
    expect(otherTenant.json().decisions).toHaveLength(0);
  });
});

describe("bid/no-bid criteria scores", () => {
  it("adds and lists criteria scores, 404s a cross-tenant decision", async () => {
    const { app } = appWithFakeRepos();
    const createResponse = await app.inject({
      method: "POST",
      url: `/estimates/${ESTIMATE_ID}/bid-decisions`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { recommendation: "bid" },
    });
    const decisionId = createResponse.json().decision.id;

    const scoreResponse = await app.inject({
      method: "POST",
      url: `/bid-decisions/${decisionId}/criteria`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { criterion: "financial_viability", score: 4, rationale: "healthy margin" },
    });
    expect(scoreResponse.statusCode).toBe(201);
    expect(scoreResponse.json().score.score).toBe(4);

    const missingFields = await app.inject({
      method: "POST",
      url: `/bid-decisions/${decisionId}/criteria`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { criterion: "financial_viability" },
    });
    expect(missingFields.statusCode).toBe(400);

    const listed = await app.inject({
      method: "GET",
      url: `/bid-decisions/${decisionId}/criteria`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(listed.json().scores).toHaveLength(1);

    const crossTenant = await app.inject({
      method: "GET",
      url: `/bid-decisions/${decisionId}`,
      headers: { authorization: `Bearer ${OTHER_TENANT_TOKEN}` },
    });
    expect(crossTenant.statusCode).toBe(404);
  });
});

describe("FR-BID-001: propose -> approve/conditions, then a proposal submission over HTTP", () => {
  it("full propose -> approved_with_conditions -> submission flow", async () => {
    const { app, workflowRepo } = appWithFakeRepos();
    const createResponse = await app.inject({
      method: "POST",
      url: `/estimates/${ESTIMATE_ID}/bid-decisions`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { recommendation: "bid" },
    });
    const decisionId = createResponse.json().decision.id;
    await app.inject({
      method: "POST",
      url: `/bid-decisions/${decisionId}/criteria`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { criterion: "risk_exposure", score: 3, rationale: "manageable with mitigation" },
    });

    const definition = await publishApprovalWorkflow(workflowRepo, "bid-route-conditions");

    const denied = await app.inject({
      method: "POST",
      url: `/bid-decisions/${decisionId}/submit-for-approval`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { definitionId: definition.id },
    });
    expect(denied.statusCode).toBe(403);

    const submitted = await app.inject({
      method: "POST",
      url: `/bid-decisions/${decisionId}/submit-for-approval`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { definitionId: definition.id },
    });
    expect(submitted.statusCode).toBe(200);
    expect(submitted.json().decision.status).toBe("pending_approval");
    const workflowInstanceId = submitted.json().decision.workflow_instance_id;

    const [step] = await workflowRepo.listStepInstances(ADMIN_TOKEN, workflowInstanceId);
    const authorityRepo = new FakeAuthorityRepository();
    await decideApprovalStep(
      workflowRepo,
      authorityRepo,
      ADMIN_TOKEN,
      step!.id,
      APPROVER,
      "approved_with_conditions",
      "subject to a revised delivery date",
    );

    const resolved = await app.inject({
      method: "GET",
      url: `/bid-decisions/${decisionId}/approval-status`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(resolved.json().decision.status).toBe("approved_with_conditions");
    expect(resolved.json().decision.conditions).toBe("subject to a revised delivery date");

    const submissionDenied = await app.inject({
      method: "POST",
      url: `/bid-decisions/${decisionId}/submissions`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { submittedTo: "Client Co.", submittedAt: "2026-10-21T00:00:00.000Z" },
    });
    expect(submissionDenied.statusCode).toBe(403);

    const submission = await app.inject({
      method: "POST",
      url: `/bid-decisions/${decisionId}/submissions`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        submittedTo: "Client Co.",
        submittedAt: "2026-10-21T00:00:00.000Z",
        evidenceReference: "https://files.example/final-proposal.pdf",
      },
    });
    expect(submission.statusCode).toBe(201);
    expect(submission.json().submission.submitted_to).toBe("Client Co.");

    const submissions = await app.inject({
      method: "GET",
      url: `/bid-decisions/${decisionId}/submissions`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(submissions.json().submissions).toHaveLength(1);
  });

  it("propose -> reject over HTTP: no submission record can be created", async () => {
    const { app, workflowRepo } = appWithFakeRepos();
    const createResponse = await app.inject({
      method: "POST",
      url: `/estimates/${ESTIMATE_ID}/bid-decisions`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { recommendation: "bid" },
    });
    const decisionId = createResponse.json().decision.id;
    await app.inject({
      method: "POST",
      url: `/bid-decisions/${decisionId}/criteria`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { criterion: "financial_viability", score: 1, rationale: "thin margin" },
    });
    const definition = await publishApprovalWorkflow(workflowRepo, "bid-route-reject");

    const submitted = await app.inject({
      method: "POST",
      url: `/bid-decisions/${decisionId}/submit-for-approval`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { definitionId: definition.id },
    });
    const workflowInstanceId = submitted.json().decision.workflow_instance_id;
    const [step] = await workflowRepo.listStepInstances(ADMIN_TOKEN, workflowInstanceId);
    const authorityRepo = new FakeAuthorityRepository();
    await decideApprovalStep(workflowRepo, authorityRepo, ADMIN_TOKEN, step!.id, APPROVER, "rejected", "margin too thin");

    const resolved = await app.inject({
      method: "GET",
      url: `/bid-decisions/${decisionId}/approval-status`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(resolved.json().decision.status).toBe("rejected");

    const submissionAttempt = await app.inject({
      method: "POST",
      url: `/bid-decisions/${decisionId}/submissions`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { submittedTo: "Client Co.", submittedAt: "2026-10-21T00:00:00.000Z" },
    });
    expect(submissionAttempt.statusCode).toBe(409);
  });
});
