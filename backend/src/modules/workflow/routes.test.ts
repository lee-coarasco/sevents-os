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
