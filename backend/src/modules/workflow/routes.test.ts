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
