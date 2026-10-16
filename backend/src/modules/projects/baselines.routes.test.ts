import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeProjectsRepository } from "../../test/fakeProjectsRepository.js";
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

const MANAGER_TOKEN = "manager-token";
const MANAGER_USER = "manager-user";
const PLAIN_TOKEN = "plain-token";
const PLAIN_USER = "plain-user";
const TENANT_A = "tenant-a";
const APPROVER = "approver-user";

function roleAssignment(id: string, userId: string, roleId: string) {
  return {
    id,
    tenant_id: TENANT_A,
    user_id: userId,
    role_id: roleId,
    department_id: null,
    valid_from: "2000-01-01T00:00:00.000Z",
    valid_to: null,
  };
}

function appWithFakeRepos() {
  const authorityRepo = new FakeAuthorityRepository();
  authorityRepo.addSession(MANAGER_TOKEN, MANAGER_USER, TENANT_A);
  authorityRepo.addSession(PLAIN_TOKEN, PLAIN_USER, TENANT_A);
  authorityRepo.roleAssignments.set("seed-manager", roleAssignment("seed-manager", MANAGER_USER, "role.manager"));
  authorityRepo.roleAssignments.set("seed-plain", roleAssignment("seed-plain", PLAIN_USER, "role.plain"));
  authorityRepo.grantPermission("role.manager", "tenancy.project.manage");
  authorityRepo.grantPermission("role.manager", "project.baseline.manage");

  const projectsRepo = new FakeProjectsRepository();
  projectsRepo.addSession(MANAGER_TOKEN, TENANT_A);
  projectsRepo.addSession(PLAIN_TOKEN, TENANT_A);

  const workflowRepo = new FakeWorkflowRepository();

  const app = buildApp({
    getAuthorityRepository: () => authorityRepo,
    getProjectsRepository: () => projectsRepo,
    getWorkflowRepository: () => workflowRepo,
  });
  return { app, workflowRepo };
}

async function publishApprovalWorkflow(workflowRepo: FakeWorkflowRepository) {
  const { definition, version } = await createWorkflowDefinition(
    workflowRepo,
    MANAGER_TOKEN,
    { key: "baseline-approval-route-test", name: "baseline-approval-route-test" },
    MANAGER_USER,
  );
  const approve = await addNodeToVersion(workflowRepo, MANAGER_TOKEN, version.id, {
    nodeKey: "approve",
    nodeType: "request_approval",
    config: { approverUserIds: [APPROVER] },
  });
  const end = await addNodeToVersion(workflowRepo, MANAGER_TOKEN, version.id, { nodeKey: "end", nodeType: "complete", config: {} });
  await addTransitionToVersion(workflowRepo, MANAGER_TOKEN, version.id, { fromNodeId: approve.id, toNodeId: end.id, orderIndex: 0 });
  await validateVersion(workflowRepo, MANAGER_TOKEN, version.id, MANAGER_USER);
  await submitForApproval(workflowRepo, MANAGER_TOKEN, definition.id, version.id, MANAGER_USER);
  await recordApproval(workflowRepo, MANAGER_TOKEN, definition.id, version.id, APPROVER, "approved", null);
  await publishVersion(workflowRepo, MANAGER_TOKEN, definition.id, version.id, APPROVER);
  return definition;
}

describe("Baseline routes (ticket 0075, M09c)", () => {
  it("POST /projects/:projectId/baselines: 201 with project.baseline.manage, 403 without it", async () => {
    const { app } = appWithFakeRepos();
    const project = await app.inject({
      method: "POST",
      url: "/projects",
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { companyId: "company-1", name: "A Tower", budgetAmount: 500000, budgetCurrency: "AED" },
    });
    const projectId = project.json().project.id;

    const denied = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/baselines`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
    });
    expect(denied.statusCode).toBe(403);

    const created = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/baselines`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().baseline.version).toBe(1);
    expect(created.json().baseline.status).toBe("approved");

    const again = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/baselines`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });
    expect(again.statusCode).toBe(409);
  });

  it("propose -> approve over HTTP: GET on the change request resolves it and supersedes the baseline", async () => {
    const { app, workflowRepo } = appWithFakeRepos();
    const project = await app.inject({
      method: "POST",
      url: "/projects",
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { companyId: "company-1", name: "A Tower", budgetAmount: 500000, budgetCurrency: "AED" },
    });
    const projectId = project.json().project.id;
    await app.inject({
      method: "POST",
      url: `/projects/${projectId}/baselines`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });

    const definition = await publishApprovalWorkflow(workflowRepo);

    const denied = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/baseline-change-requests`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { definitionId: definition.id, proposedSnapshot: { budgetAmount: 600000 }, reason: "r", impactAnalysis: "i" },
    });
    expect(denied.statusCode).toBe(403);

    const missingFields = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/baseline-change-requests`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { definitionId: definition.id, proposedSnapshot: { budgetAmount: 600000 }, reason: "", impactAnalysis: "i" },
    });
    expect(missingFields.statusCode).toBe(400);

    const proposed = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/baseline-change-requests`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: {
        definitionId: definition.id,
        proposedSnapshot: { budgetAmount: 600000 },
        reason: "scope change",
        impactAnalysis: "budget +100k",
      },
    });
    expect(proposed.statusCode).toBe(201);
    const changeRequestId = proposed.json().changeRequest.id;
    const workflowInstanceId = proposed.json().changeRequest.workflow_instance_id;

    const stillPending = await app.inject({
      method: "GET",
      url: `/baseline-change-requests/${changeRequestId}`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });
    expect(stillPending.json().changeRequest.status).toBe("pending");

    const [step] = await workflowRepo.listStepInstances(MANAGER_TOKEN, workflowInstanceId);
    const authorityRepo = new FakeAuthorityRepository();
    await decideApprovalStep(workflowRepo, authorityRepo, MANAGER_TOKEN, step!.id, APPROVER, "approved", null);

    const resolved = await app.inject({
      method: "GET",
      url: `/baseline-change-requests/${changeRequestId}`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });
    expect(resolved.json().changeRequest.status).toBe("approved");

    const baselines = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/baselines`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });
    const versions = baselines.json().baselines;
    expect(versions).toHaveLength(2);
    expect(versions.find((b: { version: number }) => b.version === 1).status).toBe("superseded");
    expect(versions.find((b: { version: number }) => b.version === 2).status).toBe("approved");
  });
});
