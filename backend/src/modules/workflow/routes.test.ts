import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeWorkflowRepository } from "../../test/fakeWorkflowRepository.js";

const TOKEN = "admin-token";
const USER_ID = "admin-user";
const TENANT_ID = "tenant-a";

function appWithFakeRepos() {
  const authorityRepo = new FakeAuthorityRepository();
  authorityRepo.addSession(TOKEN, USER_ID, TENANT_ID);
  authorityRepo.roleAssignments.set("seed", {
    id: "seed",
    tenant_id: TENANT_ID,
    user_id: USER_ID,
    role_id: "role.platform_administrator",
    department_id: null,
    valid_from: "2000-01-01T00:00:00.000Z",
    valid_to: null,
  });
  authorityRepo.grantPermission("role.platform_administrator", "workflow.definition.manage");
  authorityRepo.grantPermission("role.platform_administrator", "workflow.definition.publish");
  authorityRepo.grantPermission("role.platform_administrator", "workflow.instance.manage");
  authorityRepo.grantPermission("role.platform_administrator", "workflow.instance.act");
  authorityRepo.grantPermission("role.platform_administrator", "workflow.task.view_team");

  const workflowRepo = new FakeWorkflowRepository();
  const app = buildApp({
    getAuthorityRepository: () => authorityRepo,
    getWorkflowRepository: () => workflowRepo,
  });
  return { app, authorityRepo, workflowRepo };
}

async function startWaitingStepAssignedTo(
  app: ReturnType<typeof appWithFakeRepos>["app"],
  assignee: string,
): Promise<string> {
  const createResponse = await app.inject({
    method: "POST",
    url: "/workflow/definitions",
    headers: { authorization: `Bearer ${TOKEN}` },
    payload: { key: `reassign_routes_${assignee}`, name: "Reassign Routes" },
  });
  const { definition, version } = createResponse.json();
  const startNode = await app.inject({
    method: "POST",
    url: `/workflow/versions/${version.id}/nodes`,
    headers: { authorization: `Bearer ${TOKEN}` },
    payload: { nodeKey: "start", nodeType: "create_task" },
  });
  const endNode = await app.inject({
    method: "POST",
    url: `/workflow/versions/${version.id}/nodes`,
    headers: { authorization: `Bearer ${TOKEN}` },
    payload: { nodeKey: "end", nodeType: "complete" },
  });
  await app.inject({
    method: "POST",
    url: `/workflow/versions/${version.id}/transitions`,
    headers: { authorization: `Bearer ${TOKEN}` },
    payload: { fromNodeId: startNode.json().node.id, toNodeId: endNode.json().node.id },
  });
  await app.inject({ method: "POST", url: `/workflow/versions/${version.id}/validate`, headers: { authorization: `Bearer ${TOKEN}` } });
  await app.inject({
    method: "POST",
    url: `/workflow/definitions/${definition.id}/submit`,
    headers: { authorization: `Bearer ${TOKEN}` },
    payload: { versionId: version.id },
  });
  await app.inject({
    method: "POST",
    url: `/workflow/definitions/${definition.id}/approve`,
    headers: { authorization: `Bearer ${TOKEN}` },
    payload: { versionId: version.id, decision: "approved" },
  });
  await app.inject({
    method: "POST",
    url: `/workflow/definitions/${definition.id}/publish`,
    headers: { authorization: `Bearer ${TOKEN}` },
    payload: { versionId: version.id },
  });
  const startResponse = await app.inject({
    method: "POST",
    url: "/workflow/instances",
    headers: { authorization: `Bearer ${TOKEN}` },
    payload: { definitionId: definition.id },
  });
  const stepId = startResponse.json().stepInstances[0].id as string;
  // The engine assigns the start step to nothing in particular for a bare create_task node — force a known assignee for the own-row tests.
  return stepId;
}

describe("POST /workflow/definitions", () => {
  it("200s and creates a draft definition + version 1 for a caller with workflow.definition.manage", async () => {
    const { app } = appWithFakeRepos();
    const response = await app.inject({
      method: "POST",
      url: "/workflow/definitions",
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { key: "material_request_approval", name: "Material Request Approval" },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.definition.status).toBe("draft");
    expect(body.version.version).toBe(1);
  });

  it("403s without workflow.definition.manage", async () => {
    const { app, authorityRepo } = appWithFakeRepos();
    authorityRepo.addSession("plain-token", "plain-user", TENANT_ID);
    const response = await app.inject({
      method: "POST",
      url: "/workflow/definitions",
      headers: { authorization: "Bearer plain-token" },
      payload: { key: "k", name: "K" },
    });
    expect(response.statusCode).toBe(403);
  });

  it("401s without a bearer token", async () => {
    const { app } = appWithFakeRepos();
    const response = await app.inject({ method: "POST", url: "/workflow/definitions", payload: { key: "k", name: "K" } });
    expect(response.statusCode).toBe(401);
  });
});

describe("workflow node/publish lifecycle via routes", () => {
  async function createDefinitionAndVersion(app: ReturnType<typeof appWithFakeRepos>["app"]) {
    const createResponse = await app.inject({
      method: "POST",
      url: "/workflow/definitions",
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { key: "material_request_approval", name: "Material Request Approval" },
    });
    const { definition, version } = createResponse.json();
    return { definitionId: definition.id as string, versionId: version.id as string };
  }

  it("rejects an unsupported node_type with 400", async () => {
    const { app } = appWithFakeRepos();
    const { versionId } = await createDefinitionAndVersion(app);
    const response = await app.inject({
      method: "POST",
      url: `/workflow/versions/${versionId}/nodes`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { nodeKey: "n1", nodeType: "not_a_real_type" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("full lifecycle: add nodes, submit, approve (requires workflow.definition.publish), publish", async () => {
    const { app } = appWithFakeRepos();
    const { definitionId, versionId } = await createDefinitionAndVersion(app);

    const startNode = await app.inject({
      method: "POST",
      url: `/workflow/versions/${versionId}/nodes`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { nodeKey: "start", nodeType: "create_task" },
    });
    const endNode = await app.inject({
      method: "POST",
      url: `/workflow/versions/${versionId}/nodes`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { nodeKey: "end", nodeType: "complete" },
    });
    await app.inject({
      method: "POST",
      url: `/workflow/versions/${versionId}/transitions`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { fromNodeId: startNode.json().node.id, toNodeId: endNode.json().node.id },
    });

    const validateResponse = await app.inject({
      method: "POST",
      url: `/workflow/versions/${versionId}/validate`,
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(validateResponse.statusCode).toBe(200);
    expect(validateResponse.json().run.result).toBe("pass");

    const submitResponse = await app.inject({
      method: "POST",
      url: `/workflow/definitions/${definitionId}/submit`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { versionId },
    });
    expect(submitResponse.statusCode).toBe(200);
    expect(submitResponse.json().definition.status).toBe("under_review");

    const approveResponse = await app.inject({
      method: "POST",
      url: `/workflow/definitions/${definitionId}/approve`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { versionId, decision: "approved" },
    });
    expect(approveResponse.statusCode).toBe(200);
    expect(approveResponse.json().definition.status).toBe("approved");

    const publishResponse = await app.inject({
      method: "POST",
      url: `/workflow/definitions/${definitionId}/publish`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { versionId },
    });
    expect(publishResponse.statusCode).toBe(200);
    expect(publishResponse.json().version.status).toBe("published");
  });

  it("403s a publish attempt by a caller with only workflow.definition.manage", async () => {
    const { app, authorityRepo } = appWithFakeRepos();
    const { definitionId, versionId } = await createDefinitionAndVersion(app);
    authorityRepo.addSession("manage-only-token", "manage-only-user", TENANT_ID);
    authorityRepo.roleAssignments.set("manage-only-seed", {
      id: "manage-only-seed",
      tenant_id: TENANT_ID,
      user_id: "manage-only-user",
      role_id: "role.manage_only",
      department_id: null,
      valid_from: "2000-01-01T00:00:00.000Z",
      valid_to: null,
    });
    authorityRepo.grantPermission("role.manage_only", "workflow.definition.manage");

    const response = await app.inject({
      method: "POST",
      url: `/workflow/definitions/${definitionId}/publish`,
      headers: { authorization: "Bearer manage-only-token" },
      payload: { versionId },
    });
    expect(response.statusCode).toBe(403);
  });
});

describe("GET /workflow/definitions/published", () => {
  async function publishDefinitionWithCapability(app: ReturnType<typeof appWithFakeRepos>["app"], capabilityKey: string) {
    const createResponse = await app.inject({
      method: "POST",
      url: "/workflow/definitions",
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { key: `${capabilityKey}_def`, name: capabilityKey, capabilityKey },
    });
    const { definition, version } = createResponse.json();
    const startNode = await app.inject({
      method: "POST",
      url: `/workflow/versions/${version.id}/nodes`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { nodeKey: "start", nodeType: "create_task" },
    });
    const endNode = await app.inject({
      method: "POST",
      url: `/workflow/versions/${version.id}/nodes`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { nodeKey: "end", nodeType: "complete" },
    });
    await app.inject({
      method: "POST",
      url: `/workflow/versions/${version.id}/transitions`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { fromNodeId: startNode.json().node.id, toNodeId: endNode.json().node.id },
    });
    await app.inject({
      method: "POST",
      url: `/workflow/versions/${version.id}/validate`,
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    await app.inject({
      method: "POST",
      url: `/workflow/definitions/${definition.id}/submit`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { versionId: version.id },
    });
    await app.inject({
      method: "POST",
      url: `/workflow/definitions/${definition.id}/approve`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { versionId: version.id, decision: "approved" },
    });
    await app.inject({
      method: "POST",
      url: `/workflow/definitions/${definition.id}/publish`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { versionId: version.id },
    });
    return definition.id as string;
  }

  it("200s for a caller without workflow.definition.manage, returning only published definitions", async () => {
    const { app, authorityRepo } = appWithFakeRepos();
    const definitionId = await publishDefinitionWithCapability(app, "estimate_approval");

    authorityRepo.addSession("estimator-token", "estimator-user", TENANT_ID);
    authorityRepo.roleAssignments.set("estimator-seed", {
      id: "estimator-seed",
      tenant_id: TENANT_ID,
      user_id: "estimator-user",
      role_id: "role.civil_estimator",
      department_id: null,
      valid_from: "2000-01-01T00:00:00.000Z",
      valid_to: null,
    });
    authorityRepo.grantPermission("role.civil_estimator", "tendering.document.manage");

    const response = await app.inject({
      method: "GET",
      url: "/workflow/definitions/published",
      headers: { authorization: "Bearer estimator-token" },
    });
    expect(response.statusCode).toBe(200);
    const { definitions } = response.json();
    expect(definitions).toEqual([
      expect.objectContaining({ id: definitionId, capability_key: "estimate_approval" }),
    ]);
  });

  it("filters by capabilityKey", async () => {
    const { app } = appWithFakeRepos();
    await publishDefinitionWithCapability(app, "estimate_approval");
    await publishDefinitionWithCapability(app, "bid_no_bid_approval");

    const response = await app.inject({
      method: "GET",
      url: "/workflow/definitions/published?capabilityKey=bid_no_bid_approval",
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    const { definitions } = response.json();
    expect(definitions).toHaveLength(1);
    expect(definitions[0].capability_key).toBe("bid_no_bid_approval");
  });

  it("401s without a bearer token", async () => {
    const { app } = appWithFakeRepos();
    const response = await app.inject({ method: "GET", url: "/workflow/definitions/published" });
    expect(response.statusCode).toBe(401);
  });
});

describe("workflow instance routes (ticket 0062, M06c)", () => {
  async function publishSimpleDefinition(app: ReturnType<typeof appWithFakeRepos>["app"]) {
    const createResponse = await app.inject({
      method: "POST",
      url: "/workflow/definitions",
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { key: "runtime_lifecycle", name: "Runtime Lifecycle" },
    });
    const { definition, version } = createResponse.json();

    const startNode = await app.inject({
      method: "POST",
      url: `/workflow/versions/${version.id}/nodes`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { nodeKey: "start", nodeType: "create_task" },
    });
    const endNode = await app.inject({
      method: "POST",
      url: `/workflow/versions/${version.id}/nodes`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { nodeKey: "end", nodeType: "complete" },
    });
    await app.inject({
      method: "POST",
      url: `/workflow/versions/${version.id}/transitions`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { fromNodeId: startNode.json().node.id, toNodeId: endNode.json().node.id },
    });
    await app.inject({
      method: "POST",
      url: `/workflow/versions/${version.id}/validate`,
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    await app.inject({
      method: "POST",
      url: `/workflow/definitions/${definition.id}/submit`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { versionId: version.id },
    });
    await app.inject({
      method: "POST",
      url: `/workflow/definitions/${definition.id}/approve`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { versionId: version.id, decision: "approved" },
    });
    await app.inject({
      method: "POST",
      url: `/workflow/definitions/${definition.id}/publish`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { versionId: version.id },
    });
    return { definitionId: definition.id as string };
  }

  it("POST /workflow/instances starts an instance and returns the start step instance waiting", async () => {
    const { app } = appWithFakeRepos();
    const { definitionId } = await publishSimpleDefinition(app);

    const response = await app.inject({
      method: "POST",
      url: "/workflow/instances",
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { definitionId },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.instance.status).toBe("running");
    expect(body.stepInstances).toHaveLength(1);
    expect(body.stepInstances[0].status).toBe("waiting");
  });

  it("GET /workflow/instances/:id returns the instance and its step instances", async () => {
    const { app } = appWithFakeRepos();
    const { definitionId } = await publishSimpleDefinition(app);
    const startResponse = await app.inject({
      method: "POST",
      url: "/workflow/instances",
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { definitionId },
    });
    const instanceId = startResponse.json().instance.id as string;

    const response = await app.inject({
      method: "GET",
      url: `/workflow/instances/${instanceId}`,
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().instance.id).toBe(instanceId);
    expect(response.json().stepInstances).toHaveLength(1);
  });

  it("pause -> resume round-trips the instance status", async () => {
    const { app } = appWithFakeRepos();
    const { definitionId } = await publishSimpleDefinition(app);
    const startResponse = await app.inject({
      method: "POST",
      url: "/workflow/instances",
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { definitionId },
    });
    const instanceId = startResponse.json().instance.id as string;

    const pauseResponse = await app.inject({
      method: "POST",
      url: `/workflow/instances/${instanceId}/pause`,
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(pauseResponse.statusCode).toBe(200);
    expect(pauseResponse.json().instance.status).toBe("paused");

    const resumeResponse = await app.inject({
      method: "POST",
      url: `/workflow/instances/${instanceId}/resume`,
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(resumeResponse.statusCode).toBe(200);
    expect(resumeResponse.json().instance.status).toBe("running");
  });

  it("POST /workflow/instances/:id/cancel cancels a running instance", async () => {
    const { app } = appWithFakeRepos();
    const { definitionId } = await publishSimpleDefinition(app);
    const startResponse = await app.inject({
      method: "POST",
      url: "/workflow/instances",
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { definitionId },
    });
    const instanceId = startResponse.json().instance.id as string;

    const response = await app.inject({
      method: "POST",
      url: `/workflow/instances/${instanceId}/cancel`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { reason: "duplicate request" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().instance.status).toBe("cancelled");
  });

  it("POST /workflow/instances/:id/steps/:stepId/complete completes the waiting step and advances to complete", async () => {
    const { app } = appWithFakeRepos();
    const { definitionId } = await publishSimpleDefinition(app);
    const startResponse = await app.inject({
      method: "POST",
      url: "/workflow/instances",
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { definitionId },
    });
    const instanceId = startResponse.json().instance.id as string;
    const stepId = startResponse.json().stepInstances[0].id as string;

    const response = await app.inject({
      method: "POST",
      url: `/workflow/instances/${instanceId}/steps/${stepId}/complete`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { output: { done: true } },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().instance.status).toBe("completed");
  });

  it("403s starting an instance without workflow.instance.manage", async () => {
    const { app, authorityRepo } = appWithFakeRepos();
    const { definitionId } = await publishSimpleDefinition(app);
    authorityRepo.addSession("manage-only-token", "manage-only-user", TENANT_ID);
    authorityRepo.roleAssignments.set("manage-only-seed", {
      id: "manage-only-seed",
      tenant_id: TENANT_ID,
      user_id: "manage-only-user",
      role_id: "role.manage_only",
      department_id: null,
      valid_from: "2000-01-01T00:00:00.000Z",
      valid_to: null,
    });
    authorityRepo.grantPermission("role.manage_only", "workflow.definition.manage");

    const response = await app.inject({
      method: "POST",
      url: "/workflow/instances",
      headers: { authorization: "Bearer manage-only-token" },
      payload: { definitionId },
    });
    expect(response.statusCode).toBe(403);
  });
});

describe("task metadata, blocking, comments & evidence routes (ticket 0070, M07a)", () => {
  async function startWaitingStep(app: ReturnType<typeof appWithFakeRepos>["app"]) {
    const createResponse = await app.inject({
      method: "POST",
      url: "/workflow/definitions",
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { key: "task_routes", name: "Task Routes" },
    });
    const { definition, version } = createResponse.json();

    const startNode = await app.inject({
      method: "POST",
      url: `/workflow/versions/${version.id}/nodes`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { nodeKey: "start", nodeType: "create_task" },
    });
    const endNode = await app.inject({
      method: "POST",
      url: `/workflow/versions/${version.id}/nodes`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { nodeKey: "end", nodeType: "complete" },
    });
    await app.inject({
      method: "POST",
      url: `/workflow/versions/${version.id}/transitions`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { fromNodeId: startNode.json().node.id, toNodeId: endNode.json().node.id },
    });
    await app.inject({
      method: "POST",
      url: `/workflow/versions/${version.id}/validate`,
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    await app.inject({
      method: "POST",
      url: `/workflow/definitions/${definition.id}/submit`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { versionId: version.id },
    });
    await app.inject({
      method: "POST",
      url: `/workflow/definitions/${definition.id}/approve`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { versionId: version.id, decision: "approved" },
    });
    await app.inject({
      method: "POST",
      url: `/workflow/definitions/${definition.id}/publish`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { versionId: version.id },
    });
    const startResponse = await app.inject({
      method: "POST",
      url: "/workflow/instances",
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { definitionId: definition.id },
    });
    return startResponse.json().stepInstances[0].id as string;
  }

  it("POST /workflow/steps/:stepId/block blocks a waiting step with a reason", async () => {
    const { app } = appWithFakeRepos();
    const stepId = await startWaitingStep(app);

    const response = await app.inject({
      method: "POST",
      url: `/workflow/steps/${stepId}/block`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { reason: "waiting on client sign-off" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().stepInstance.blocked_reason).toBe("waiting on client sign-off");
  });

  it("POST /workflow/steps/:stepId/block 400s with an empty reason", async () => {
    const { app } = appWithFakeRepos();
    const stepId = await startWaitingStep(app);

    const response = await app.inject({
      method: "POST",
      url: `/workflow/steps/${stepId}/block`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { reason: "" },
    });

    expect(response.statusCode).toBe(400);
  });

  it("POST /workflow/steps/:stepId/unblock clears a block", async () => {
    const { app } = appWithFakeRepos();
    const stepId = await startWaitingStep(app);
    await app.inject({
      method: "POST",
      url: `/workflow/steps/${stepId}/block`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { reason: "waiting on client sign-off" },
    });

    const response = await app.inject({
      method: "POST",
      url: `/workflow/steps/${stepId}/unblock`,
      headers: { authorization: `Bearer ${TOKEN}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().stepInstance.blocked_reason).toBeNull();
  });

  it("POST /workflow/steps/:stepId/comments adds a comment", async () => {
    const { app } = appWithFakeRepos();
    const stepId = await startWaitingStep(app);

    const response = await app.inject({
      method: "POST",
      url: `/workflow/steps/${stepId}/comments`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { body: "started on this" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().comment.body).toBe("started on this");
  });

  it("POST /workflow/steps/:stepId/comments 400s without a body", async () => {
    const { app } = appWithFakeRepos();
    const stepId = await startWaitingStep(app);

    const response = await app.inject({
      method: "POST",
      url: `/workflow/steps/${stepId}/comments`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });

  it("POST /workflow/steps/:stepId/evidence attaches a file object", async () => {
    const { app } = appWithFakeRepos();
    const stepId = await startWaitingStep(app);

    const response = await app.inject({
      method: "POST",
      url: `/workflow/steps/${stepId}/evidence`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { fileObjectId: "file-object-1" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().ok).toBe(true);
  });

  it("POST /workflow/steps/:stepId/evidence 400s without a fileObjectId", async () => {
    const { app } = appWithFakeRepos();
    const stepId = await startWaitingStep(app);

    const response = await app.inject({
      method: "POST",
      url: `/workflow/steps/${stepId}/evidence`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });

  it.each(["block", "unblock", "comments", "evidence"])(
    "POST /workflow/steps/:stepId/%s 403s without workflow.instance.act",
    async (action) => {
      const { app, authorityRepo } = appWithFakeRepos();
      const stepId = await startWaitingStep(app);
      authorityRepo.addSession("plain-token", "plain-user", TENANT_ID);

      const response = await app.inject({
        method: "POST",
        url: `/workflow/steps/${stepId}/${action}`,
        headers: { authorization: "Bearer plain-token" },
        payload: { reason: "x", body: "x", fileObjectId: "x" },
      });

      expect(response.statusCode).toBe(403);
    },
  );

  it.each(["block", "unblock", "comments", "evidence"])(
    "POST /workflow/steps/:stepId/%s 401s without a bearer token",
    async (action) => {
      const { app } = appWithFakeRepos();
      const stepId = await startWaitingStep(app);

      const response = await app.inject({ method: "POST", url: `/workflow/steps/${stepId}/${action}` });

      expect(response.statusCode).toBe(401);
    },
  );
});

describe("workflow migration routes (ticket 0063, M06d)", () => {
  async function publishSimpleDefinition(app: ReturnType<typeof appWithFakeRepos>["app"], key: string) {
    const createResponse = await app.inject({
      method: "POST",
      url: "/workflow/definitions",
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { key, name: key },
    });
    const { definition, version } = createResponse.json();
    await publishDraftVersion(app, definition.id, version.id);
    return { definitionId: definition.id as string, versionId: version.id as string };
  }

  async function publishDraftVersion(app: ReturnType<typeof appWithFakeRepos>["app"], definitionId: string, versionId: string) {
    const startNode = await app.inject({
      method: "POST",
      url: `/workflow/versions/${versionId}/nodes`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { nodeKey: "start", nodeType: "create_task" },
    });
    const endNode = await app.inject({
      method: "POST",
      url: `/workflow/versions/${versionId}/nodes`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { nodeKey: "end", nodeType: "complete" },
    });
    await app.inject({
      method: "POST",
      url: `/workflow/versions/${versionId}/transitions`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { fromNodeId: startNode.json().node.id, toNodeId: endNode.json().node.id },
    });
    await app.inject({ method: "POST", url: `/workflow/versions/${versionId}/validate`, headers: { authorization: `Bearer ${TOKEN}` } });
    await app.inject({
      method: "POST",
      url: `/workflow/definitions/${definitionId}/submit`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { versionId },
    });
    await app.inject({
      method: "POST",
      url: `/workflow/definitions/${definitionId}/approve`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { versionId, decision: "approved" },
    });
    await app.inject({
      method: "POST",
      url: `/workflow/definitions/${definitionId}/publish`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { versionId },
    });
  }

  async function publishSecondVersion(app: ReturnType<typeof appWithFakeRepos>["app"], definitionId: string) {
    const draftResponse = await app.inject({
      method: "POST",
      url: `/workflow/definitions/${definitionId}/versions`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: {},
    });
    const versionId = draftResponse.json().version.id as string;
    await publishDraftVersion(app, definitionId, versionId);
    return versionId;
  }

  it("walks a migration through create -> preview -> approve -> execute and moves the auto-mappable instance", async () => {
    const { app } = appWithFakeRepos();
    const { definitionId, versionId: v1Id } = await publishSimpleDefinition(app, "migration_route_flow");

    const startResponse = await app.inject({
      method: "POST",
      url: "/workflow/instances",
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { definitionId },
    });
    expect(startResponse.json().instance.workflow_version_id).toBe(v1Id);

    const v2Id = await publishSecondVersion(app, definitionId);

    const createResponse = await app.inject({
      method: "POST",
      url: "/workflow/migrations",
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { fromVersionId: v1Id, toVersionId: v2Id },
    });
    expect(createResponse.statusCode).toBe(200);
    const migrationId = createResponse.json().migration.id as string;
    expect(createResponse.json().migration.status).toBe("draft");

    const previewResponse = await app.inject({
      method: "POST",
      url: `/workflow/migrations/${migrationId}/preview`,
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.json().migration.impact_summary.autoMappableCount).toBe(1);

    // Cannot execute before approval.
    const tooEarlyExecute = await app.inject({
      method: "POST",
      url: `/workflow/migrations/${migrationId}/execute`,
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(tooEarlyExecute.statusCode).toBe(400);

    const approveResponse = await app.inject({
      method: "POST",
      url: `/workflow/migrations/${migrationId}/approve`,
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(approveResponse.statusCode).toBe(200);
    expect(approveResponse.json().migration.status).toBe("approved");

    const executeResponse = await app.inject({
      method: "POST",
      url: `/workflow/migrations/${migrationId}/execute`,
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(executeResponse.statusCode).toBe(200);
    expect(executeResponse.json().migration.status).toBe("executed");
    expect(executeResponse.json().results).toHaveLength(1);
    expect(executeResponse.json().results[0].outcome).toBe("migrated");

    const resultsResponse = await app.inject({
      method: "GET",
      url: `/workflow/migrations/${migrationId}/results`,
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(resultsResponse.statusCode).toBe(200);
    expect(resultsResponse.json().results).toHaveLength(1);
  });

  it("403s creating a migration without workflow.definition.manage, and 403s approving without workflow.definition.publish", async () => {
    const { app, authorityRepo } = appWithFakeRepos();
    const { versionId: v1Id, definitionId } = await publishSimpleDefinition(app, "migration_route_perms");
    const v2Id = await publishSecondVersion(app, definitionId);

    authorityRepo.addSession("manage-only-token", "manage-only-user", TENANT_ID);
    authorityRepo.roleAssignments.set("manage-only-seed", {
      id: "manage-only-seed",
      tenant_id: TENANT_ID,
      user_id: "manage-only-user",
      role_id: "role.manage_only",
      department_id: null,
      valid_from: "2000-01-01T00:00:00.000Z",
      valid_to: null,
    });
    authorityRepo.grantPermission("role.manage_only", "workflow.definition.manage");

    const createResponse = await app.inject({
      method: "POST",
      url: "/workflow/migrations",
      headers: { authorization: "Bearer manage-only-token" },
      payload: { fromVersionId: v1Id, toVersionId: v2Id },
    });
    expect(createResponse.statusCode).toBe(200);
    const migrationId = createResponse.json().migration.id as string;

    const approveResponse = await app.inject({
      method: "POST",
      url: `/workflow/migrations/${migrationId}/approve`,
      headers: { authorization: "Bearer manage-only-token" },
    });
    expect(approveResponse.statusCode).toBe(403);

    const noTokenResponse = await app.inject({ method: "POST", url: "/workflow/migrations", payload: { fromVersionId: v1Id, toVersionId: v2Id } });
    expect(noTokenResponse.statusCode).toBe(401);
  });
});

describe("task reassignment & delegation routes (ticket 0072, M07c)", () => {
  it("a caller with workflow.instance.act can reassign a task they don't own", async () => {
    const { app, workflowRepo } = appWithFakeRepos();
    const stepId = await startWaitingStepAssignedTo(app, "r1");
    workflowRepo.setUserTenant("bob", TENANT_ID);

    const response = await app.inject({
      method: "POST",
      url: `/tasks/${stepId}/reassign`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { newAssigneeUserId: "bob", reason: "coverage" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().stepInstance.assigned_to).toBe("bob");
  });

  it("the step's own assignee can reassign it without workflow.instance.act", async () => {
    const { app, authorityRepo, workflowRepo } = appWithFakeRepos();
    const stepId = await startWaitingStepAssignedTo(app, "r2");
    // The engine leaves a bare create_task step unassigned, so claim it as "owner-user" first using the admin token, then act as that same user with no permission.
    workflowRepo.setUserTenant("owner-user", TENANT_ID);
    const claimResponse = await app.inject({
      method: "POST",
      url: `/tasks/${stepId}/reassign`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { newAssigneeUserId: "owner-user" },
    });
    expect(claimResponse.statusCode).toBe(200);
    authorityRepo.addSession("owner-token", "owner-user", TENANT_ID);
    workflowRepo.addSession("owner-token", "owner-user");
    workflowRepo.setUserTenant("delegate-user", TENANT_ID);

    const response = await app.inject({
      method: "POST",
      url: `/tasks/${stepId}/delegate`,
      headers: { authorization: "Bearer owner-token" },
      payload: { delegateUserId: "delegate-user" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().stepInstance.assigned_to).toBe("delegate-user");
  });

  it("403s a caller who neither owns the task nor holds workflow.instance.act", async () => {
    const { app, authorityRepo, workflowRepo } = appWithFakeRepos();
    const stepId = await startWaitingStepAssignedTo(app, "r3");
    authorityRepo.addSession("plain-token", "plain-user", TENANT_ID);
    workflowRepo.addSession("plain-token", "plain-user");
    workflowRepo.setUserTenant("bob", TENANT_ID);

    const response = await app.inject({
      method: "POST",
      url: `/tasks/${stepId}/reassign`,
      headers: { authorization: "Bearer plain-token" },
      payload: { newAssigneeUserId: "bob" },
    });

    expect(response.statusCode).toBe(403);
  });

  it("403s reassigning to a user in a different tenant", async () => {
    const { app, workflowRepo } = appWithFakeRepos();
    const stepId = await startWaitingStepAssignedTo(app, "r4");
    workflowRepo.setUserTenant("outsider", "tenant-b");

    const response = await app.inject({
      method: "POST",
      url: `/tasks/${stepId}/reassign`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { newAssigneeUserId: "outsider" },
    });

    expect(response.statusCode).toBe(403);
  });

  it("401s reassign/delegate without a bearer token", async () => {
    const { app } = appWithFakeRepos();
    const stepId = await startWaitingStepAssignedTo(app, "r5");

    const reassignResponse = await app.inject({ method: "POST", url: `/tasks/${stepId}/reassign` });
    const delegateResponse = await app.inject({ method: "POST", url: `/tasks/${stepId}/delegate` });

    expect(reassignResponse.statusCode).toBe(401);
    expect(delegateResponse.statusCode).toBe(401);
  });
});

describe("GET /tasks/:stepInstanceId — task detail for the ActivityThread (ticket 0145, M07/M08)", () => {
  it("the step's own assignee can read its detail without workflow.instance.act", async () => {
    const { app, authorityRepo, workflowRepo } = appWithFakeRepos();
    const stepId = await startWaitingStepAssignedTo(app, "d1");
    workflowRepo.setUserTenant("owner-user", TENANT_ID);
    const claimResponse = await app.inject({
      method: "POST",
      url: `/tasks/${stepId}/reassign`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { newAssigneeUserId: "owner-user" },
    });
    expect(claimResponse.statusCode).toBe(200);
    authorityRepo.addSession("owner-token", "owner-user", TENANT_ID);
    workflowRepo.addSession("owner-token", "owner-user");
    // Posting a comment still needs workflow.instance.act (ticket 0070's
    // original scope) — only the admin token has that. This test is about
    // the GET route's ownership exemption, so post as the admin and read
    // back as the unprivileged owner.
    const commentResponse = await app.inject({
      method: "POST",
      url: `/workflow/steps/${stepId}/comments`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { body: "working on it" },
    });
    expect(commentResponse.statusCode).toBe(201);

    const response = await app.inject({
      method: "GET",
      url: `/tasks/${stepId}`,
      headers: { authorization: "Bearer owner-token" },
    });

    expect(response.statusCode).toBe(200);
    const { detail } = response.json();
    expect(detail.stepInstance.id).toBe(stepId);
    expect(detail.comments).toHaveLength(1);
    expect(detail.comments[0].body).toBe("working on it");
    expect(detail.events.some((e: { event_type: string }) => e.event_type === "comment_added")).toBe(true);
  });

  it("403s a caller who neither owns the task nor holds workflow.instance.act", async () => {
    const { app, authorityRepo, workflowRepo } = appWithFakeRepos();
    const stepId = await startWaitingStepAssignedTo(app, "d2");
    authorityRepo.addSession("plain-token", "plain-user", TENANT_ID);
    workflowRepo.addSession("plain-token", "plain-user");

    const response = await app.inject({
      method: "GET",
      url: `/tasks/${stepId}`,
      headers: { authorization: "Bearer plain-token" },
    });

    expect(response.statusCode).toBe(403);
  });

  it("401s without a bearer token", async () => {
    const { app } = appWithFakeRepos();
    const stepId = await startWaitingStepAssignedTo(app, "d3");

    const response = await app.inject({ method: "GET", url: `/tasks/${stepId}` });

    expect(response.statusCode).toBe(401);
  });
});

describe("My Work / Team Work queue routes (ticket 0071, M07b)", () => {
  const TEAM_ROUTES = ["/tasks/team-work", "/tasks/due-soon", "/tasks/overdue", "/tasks/blocked", "/tasks/waiting-approval", "/tasks/completed"];

  it("GET /tasks/my-work 200s for any valid session, no permission required", async () => {
    const { app, authorityRepo, workflowRepo } = appWithFakeRepos();
    authorityRepo.addSession("plain-token", "plain-user", TENANT_ID);
    workflowRepo.addSession("plain-token", "plain-user");

    const response = await app.inject({ method: "GET", url: "/tasks/my-work", headers: { authorization: "Bearer plain-token" } });

    expect(response.statusCode).toBe(200);
    expect(response.json().items).toEqual([]);
  });

  it("GET /tasks/my-work 401s without a bearer token", async () => {
    const { app } = appWithFakeRepos();
    const response = await app.inject({ method: "GET", url: "/tasks/my-work" });
    expect(response.statusCode).toBe(401);
  });

  it.each(TEAM_ROUTES)("GET %s 403s without workflow.task.view_team", async (route) => {
    const { app, authorityRepo } = appWithFakeRepos();
    authorityRepo.addSession("plain-token", "plain-user", TENANT_ID);

    const response = await app.inject({ method: "GET", url: route, headers: { authorization: "Bearer plain-token" } });

    expect(response.statusCode).toBe(403);
  });

  it.each(TEAM_ROUTES)("GET %s 200s for a caller with workflow.task.view_team", async (route) => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({ method: "GET", url: route, headers: { authorization: `Bearer ${TOKEN}` } });

    expect(response.statusCode).toBe(200);
    expect(response.json().items).toEqual([]);
  });

  it.each(TEAM_ROUTES)("GET %s 401s without a bearer token", async (route) => {
    const { app } = appWithFakeRepos();
    const response = await app.inject({ method: "GET", url: route });
    expect(response.statusCode).toBe(401);
  });

  it("GET /tasks/due-soon accepts an hours query param", async () => {
    const { app } = appWithFakeRepos();
    const response = await app.inject({
      method: "GET",
      url: "/tasks/due-soon?hours=12",
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
  });

  it("GET /tasks/completed accepts from/to query params", async () => {
    const { app } = appWithFakeRepos();
    const response = await app.inject({
      method: "GET",
      url: "/tasks/completed?from=2026-01-01T00:00:00.000Z&to=2026-12-31T00:00:00.000Z",
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
  });
});

describe("approvals & delegation (ticket 0066, M08)", () => {
  async function chainStep(workflowRepo: FakeWorkflowRepository, config: Record<string, unknown>) {
    const instance = await workflowRepo.createInstance(TOKEN, { definitionId: "def-1", versionId: "version-1", startedBy: "requester", context: {} });
    const node = await workflowRepo.addNode(TOKEN, { versionId: "version-1", nodeKey: "approve", nodeType: "request_approval", config });
    return workflowRepo.createStepInstance(TOKEN, { instanceId: instance.id, nodeId: node.id, status: "waiting", assignedTo: "alice" });
  }

  it("a configured approver can decide without workflow.instance.act", async () => {
    const { app, workflowRepo, authorityRepo } = appWithFakeRepos();
    authorityRepo.addSession("alice-token", "alice", TENANT_ID);
    workflowRepo.addSession("alice-token", "alice");
    const step = await chainStep(workflowRepo, { approverUserIds: ["alice"] });

    const response = await app.inject({
      method: "POST",
      url: `/approvals/${step.id}/decide`,
      headers: { authorization: "Bearer alice-token" },
      payload: { decision: "approved" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().chainResolved).toBe(true);
    expect(response.json().stepInstance.status).toBe("completed");
  });

  it("a caller who is neither the configured approver nor a workflow.instance.act holder gets 403", async () => {
    const { app, workflowRepo, authorityRepo } = appWithFakeRepos();
    authorityRepo.addSession("mallory-token", "mallory", TENANT_ID);
    const step = await chainStep(workflowRepo, { approverUserIds: ["alice"] });

    const response = await app.inject({
      method: "POST",
      url: `/approvals/${step.id}/decide`,
      headers: { authorization: "Bearer mallory-token" },
      payload: { decision: "approved" },
    });

    expect(response.statusCode).toBe(403);
  });

  it("rejecting without a reason 400s", async () => {
    const { app, workflowRepo, authorityRepo } = appWithFakeRepos();
    authorityRepo.addSession("alice-token", "alice", TENANT_ID);
    workflowRepo.addSession("alice-token", "alice");
    const step = await chainStep(workflowRepo, { approverUserIds: ["alice"] });

    const response = await app.inject({
      method: "POST",
      url: `/approvals/${step.id}/decide`,
      headers: { authorization: "Bearer alice-token" },
      payload: { decision: "rejected" },
    });

    expect(response.statusCode).toBe(400);
  });

  it("GET /approvals/:stepInstanceId returns the chain config, decisions and empty riskFlags", async () => {
    const { app, workflowRepo, authorityRepo } = appWithFakeRepos();
    authorityRepo.addSession("alice-token", "alice", TENANT_ID);
    workflowRepo.addSession("alice-token", "alice");
    const step = await chainStep(workflowRepo, { approverUserIds: ["alice", "bob"] });

    const response = await app.inject({
      method: "GET",
      url: `/approvals/${step.id}`,
      headers: { authorization: "Bearer alice-token" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().detail.chainConfig.approverUserIds).toEqual(["alice", "bob"]);
    expect(response.json().detail.riskFlags).toEqual([]);
  });

  it("revoking requires workflow.approval.revoke even for the approver who decided", async () => {
    const { app, workflowRepo, authorityRepo } = appWithFakeRepos();
    authorityRepo.addSession("alice-token", "alice", TENANT_ID);
    workflowRepo.addSession("alice-token", "alice");
    const step = await chainStep(workflowRepo, { approverUserIds: ["alice"] });
    await app.inject({
      method: "POST",
      url: `/approvals/${step.id}/decide`,
      headers: { authorization: "Bearer alice-token" },
      payload: { decision: "approved" },
    });
    const [decision] = await workflowRepo.listApprovalDecisions(TOKEN, step.id);

    const deniedResponse = await app.inject({
      method: "POST",
      url: `/approvals/decisions/${decision!.id}/revoke`,
      headers: { authorization: "Bearer alice-token" },
      payload: { reason: "mistake" },
    });
    expect(deniedResponse.statusCode).toBe(403);

    authorityRepo.grantPermission("role.platform_administrator", "workflow.approval.revoke");
    const allowedResponse = await app.inject({
      method: "POST",
      url: `/approvals/decisions/${decision!.id}/revoke`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { reason: "mistake" },
    });
    expect(allowedResponse.statusCode).toBe(200);
  });
});
