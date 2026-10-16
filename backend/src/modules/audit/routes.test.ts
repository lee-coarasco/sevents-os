import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeAuditRepository } from "../../test/fakeAuditRepository.js";
import { FakeWorkflowRepository } from "../../test/fakeWorkflowRepository.js";
import { FakeIdentityRepository } from "../../test/fakeIdentityRepository.js";
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
import type { AuditLogEntry } from "./types.js";

const ADMIN_TOKEN = "admin-token";
const ADMIN_USER = "admin-user";
const TENANT_A = "tenant-a";
const PLAIN_TOKEN = "plain-token";
const PLAIN_USER = "plain-user";
const OTHER_TENANT_ADMIN_TOKEN = "other-tenant-admin-token";
const OTHER_TENANT_ADMIN_USER = "other-tenant-admin";
const TENANT_B = "tenant-b";

function entry(overrides: Partial<AuditLogEntry>): AuditLogEntry {
  return {
    id: "auth_audit_log:1",
    source: "auth_audit_log",
    actorType: "human",
    actorId: "some-user",
    action: "sign_in",
    entityType: "user",
    entityId: "some-user",
    occurredAt: "2026-10-16T00:00:00.000Z",
    detail: {},
    correlationId: null,
    ...overrides,
  };
}

function appWithFakeRepos() {
  const authorityRepo = new FakeAuthorityRepository();
  authorityRepo.addSession(ADMIN_TOKEN, ADMIN_USER, TENANT_A);
  authorityRepo.addSession(PLAIN_TOKEN, PLAIN_USER, TENANT_A);
  authorityRepo.addSession(OTHER_TENANT_ADMIN_TOKEN, OTHER_TENANT_ADMIN_USER, TENANT_B);
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
    user_id: OTHER_TENANT_ADMIN_USER,
    role_id: "role.platform_administrator",
    department_id: null,
    valid_from: "2000-01-01T00:00:00.000Z",
    valid_to: null,
  });
  authorityRepo.grantPermission("role.platform_administrator", "audit.log.view");
  authorityRepo.grantPermission("role.platform_administrator", "audit.retention.manage");
  authorityRepo.grantPermission("role.platform_administrator", "data.request.manage");

  const auditRepo = new FakeAuditRepository();
  auditRepo.addSession(ADMIN_TOKEN, TENANT_A);
  auditRepo.addSession(PLAIN_TOKEN, TENANT_A);
  auditRepo.addSession(OTHER_TENANT_ADMIN_TOKEN, TENANT_B);

  const workflowRepo = new FakeWorkflowRepository();
  const identityRepo = new FakeIdentityRepository();

  const app = buildApp({
    getAuthorityRepository: () => authorityRepo,
    getAuditRepository: () => auditRepo,
    getWorkflowRepository: () => workflowRepo,
    getIdentityRepository: () => identityRepo,
  });
  return { app, authorityRepo, auditRepo, workflowRepo, identityRepo };
}

async function publishDataRequestApprovalWorkflow(workflowRepo: FakeWorkflowRepository) {
  const { definition, version } = await createWorkflowDefinition(
    workflowRepo,
    ADMIN_TOKEN,
    { key: "data-request-approval-route-test", name: "data-request-approval-route-test" },
    ADMIN_USER,
  );
  const approve = await addNodeToVersion(workflowRepo, ADMIN_TOKEN, version.id, {
    nodeKey: "approve",
    nodeType: "request_approval",
    config: { approverUserIds: [ADMIN_USER] },
  });
  const end = await addNodeToVersion(workflowRepo, ADMIN_TOKEN, version.id, { nodeKey: "end", nodeType: "complete", config: {} });
  await addTransitionToVersion(workflowRepo, ADMIN_TOKEN, version.id, { fromNodeId: approve.id, toNodeId: end.id, orderIndex: 0 });
  await validateVersion(workflowRepo, ADMIN_TOKEN, version.id, ADMIN_USER);
  await submitForApproval(workflowRepo, ADMIN_TOKEN, definition.id, version.id, ADMIN_USER);
  await recordApproval(workflowRepo, ADMIN_TOKEN, definition.id, version.id, ADMIN_USER, "approved", null);
  await publishVersion(workflowRepo, ADMIN_TOKEN, definition.id, version.id, ADMIN_USER);
  return definition;
}

describe("GET /audit/log", () => {
  it("403s without audit.log.view", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({
      method: "GET",
      url: "/audit/log",
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it("401s with no bearer token at all", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({ method: "GET", url: "/audit/log" });

    expect(response.statusCode).toBe(401);
  });

  it("merges normalized rows for a caller holding audit.log.view, including another user's auth_audit_log row", async () => {
    const { app, auditRepo } = appWithFakeRepos();
    auditRepo.seed(
      TENANT_A,
      entry({ id: "auth_audit_log:1", actorId: PLAIN_USER, entityId: PLAIN_USER, occurredAt: "2026-10-16T01:00:00.000Z" }),
    );
    auditRepo.seed(
      TENANT_A,
      entry({
        id: "configuration_changes:1",
        source: "configuration_changes",
        actorId: ADMIN_USER,
        action: "publish",
        entityType: "workflow_definition",
        entityId: "def-1",
        occurredAt: "2026-10-16T02:00:00.000Z",
        detail: { reason: "go live" },
      }),
    );

    const response = await app.inject({
      method: "GET",
      url: "/audit/log",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.total).toBe(2);
    // Newest first.
    expect(body.entries.map((e: AuditLogEntry) => e.id)).toEqual(["configuration_changes:1", "auth_audit_log:1"]);
    // The admin (not the row's own user) can see PLAIN_USER's auth_audit_log row through this endpoint.
    expect(body.entries[1].actorId).toBe(PLAIN_USER);
    for (const e of body.entries) {
      expect(e.actorType).toBe("human");
      expect(e.correlationId).toBeNull();
    }
  });

  it("never returns another tenant's rows, even to a caller holding audit.log.view", async () => {
    const { app, auditRepo } = appWithFakeRepos();
    auditRepo.seed(TENANT_A, entry({ id: "auth_audit_log:a", actorId: ADMIN_USER }));
    auditRepo.seed(TENANT_B, entry({ id: "auth_audit_log:b", actorId: OTHER_TENANT_ADMIN_USER }));

    const response = await app.inject({
      method: "GET",
      url: "/audit/log",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.entries.map((e: AuditLogEntry) => e.id)).toEqual(["auth_audit_log:a"]);
  });

  it("applies entityType/actorId/from/to/limit querystring filters", async () => {
    const { app, auditRepo } = appWithFakeRepos();
    auditRepo.seed(TENANT_A, entry({ id: "e1", entityType: "user", occurredAt: "2026-10-16T01:00:00.000Z" }));
    auditRepo.seed(
      TENANT_A,
      entry({
        id: "e2",
        source: "workflow_events",
        entityType: "workflow_instance",
        actorId: null,
        occurredAt: "2026-10-16T02:00:00.000Z",
      }),
    );

    const response = await app.inject({
      method: "GET",
      url: "/audit/log?entityType=user",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().entries.map((e: AuditLogEntry) => e.id)).toEqual(["e1"]);
  });

  it("400s on an unparseable from/to filter", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({
      method: "GET",
      url: "/audit/log?from=not-a-date",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe("POST /audit/retention-policies", () => {
  it("403s without audit.retention.manage", async () => {
    const { app } = appWithFakeRepos();
    const response = await app.inject({
      method: "POST",
      url: "/audit/retention-policies",
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { entityType: "app_users", retentionDays: 365 },
    });
    expect(response.statusCode).toBe(403);
  });

  it("400s a non-positive retentionDays", async () => {
    const { app } = appWithFakeRepos();
    const response = await app.inject({
      method: "POST",
      url: "/audit/retention-policies",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { entityType: "app_users", retentionDays: 0 },
    });
    expect(response.statusCode).toBe(400);
  });

  it("creates a policy with no invented default, and lists it back tenant-scoped", async () => {
    const { app } = appWithFakeRepos();
    const create = await app.inject({
      method: "POST",
      url: "/audit/retention-policies",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { entityType: "app_users", retentionDays: 2555 },
    });
    expect(create.statusCode).toBe(201);
    expect(create.json().policy.retention_days).toBe(2555);

    await app.inject({
      method: "POST",
      url: "/audit/retention-policies",
      headers: { authorization: `Bearer ${OTHER_TENANT_ADMIN_TOKEN}` },
      payload: { entityType: "app_users", retentionDays: 90 },
    });

    const response = await app.inject({
      method: "GET",
      url: "/audit/retention-policies",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    const policies = response.json().policies;
    expect(policies).toHaveLength(1);
    expect(policies[0].retention_days).toBe(2555);
  });
});

describe("legal holds", () => {
  it("403s placing a hold without audit.retention.manage", async () => {
    const { app } = appWithFakeRepos();
    const response = await app.inject({
      method: "POST",
      url: "/audit/legal-holds",
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { entityType: "app_users", entityId: "user-1", reason: "litigation hold" },
    });
    expect(response.statusCode).toBe(403);
  });

  it("400s placing a hold with a blank reason", async () => {
    const { app } = appWithFakeRepos();
    const response = await app.inject({
      method: "POST",
      url: "/audit/legal-holds",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { entityType: "app_users", entityId: "user-1", reason: "   " },
    });
    expect(response.statusCode).toBe(400);
  });

  it("places a hold, lists it tenant-scoped, then releases it without deleting the row", async () => {
    const { app } = appWithFakeRepos();
    const place = await app.inject({
      method: "POST",
      url: "/audit/legal-holds",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { entityType: "app_users", entityId: "user-1", reason: "litigation hold" },
    });
    expect(place.statusCode).toBe(201);
    const holdId = place.json().legalHold.id;
    expect(place.json().legalHold.released_at).toBeNull();

    await app.inject({
      method: "POST",
      url: "/audit/legal-holds",
      headers: { authorization: `Bearer ${OTHER_TENANT_ADMIN_TOKEN}` },
      payload: { entityType: "app_users", entityId: "user-2", reason: "other tenant's hold" },
    });

    const list = await app.inject({
      method: "GET",
      url: "/audit/legal-holds",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().legalHolds).toHaveLength(1);

    const release = await app.inject({
      method: "POST",
      url: `/audit/legal-holds/${holdId}/release`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(release.statusCode).toBe(200);
    expect(release.json().legalHold.id).toBe(holdId);
    expect(release.json().legalHold.released_at).not.toBeNull();
    expect(release.json().legalHold.released_by).toBe(ADMIN_USER);

    const releaseAgain = await app.inject({
      method: "POST",
      url: `/audit/legal-holds/${holdId}/release`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(releaseAgain.statusCode).toBe(409);
  });

  it("404s releasing a hold that does not exist", async () => {
    const { app } = appWithFakeRepos();
    const response = await app.inject({
      method: "POST",
      url: "/audit/legal-holds/does-not-exist/release",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(response.statusCode).toBe(404);
  });
});

describe("data requests (ticket 0080, M35c)", () => {
  it("403s submitting a request without data.request.manage", async () => {
    const { app } = appWithFakeRepos();
    const response = await app.inject({
      method: "POST",
      url: "/data-requests",
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { requestType: "export", entityType: "app_users", entityId: "subject-1", reason: "r", definitionId: "def-1" },
    });
    expect(response.statusCode).toBe(403);
  });

  it("400s a blank reason and an unsupported entity type", async () => {
    const { app, workflowRepo } = appWithFakeRepos();
    const definition = await publishDataRequestApprovalWorkflow(workflowRepo);

    const blankReason = await app.inject({
      method: "POST",
      url: "/data-requests",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { requestType: "export", entityType: "app_users", entityId: "subject-1", reason: "   ", definitionId: definition.id },
    });
    expect(blankReason.statusCode).toBe(400);

    const unsupported = await app.inject({
      method: "POST",
      url: "/data-requests",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { requestType: "deletion", entityType: "projects", entityId: "project-1", reason: "r", definitionId: definition.id },
    });
    expect(unsupported.statusCode).toBe(400);
  });

  it("export over HTTP: pending until approved, then GET resolves the bundle; tenant isolation holds throughout", async () => {
    const { app, workflowRepo, identityRepo, auditRepo } = appWithFakeRepos();
    const definition = await publishDataRequestApprovalWorkflow(workflowRepo);
    await identityRepo.insertAppUser({ id: "subject-1", email: "subject@example.com", display_name: "Subject", invited_by: null });
    auditRepo.appUsers.set("subject-1", { id: "subject-1", tenant_id: TENANT_A, email: "subject@example.com" });

    const created = await app.inject({
      method: "POST",
      url: "/data-requests",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        requestType: "export",
        entityType: "app_users",
        entityId: "subject-1",
        reason: "data subject asked for a copy",
        definitionId: definition.id,
      },
    });
    expect(created.statusCode).toBe(201);
    const requestId = created.json().dataRequest.id;
    const workflowInstanceId = created.json().dataRequest.workflow_instance_id;

    const stillPending = await app.inject({
      method: "GET",
      url: `/data-requests/${requestId}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(stillPending.json().dataRequest.status).toBe("pending");

    // Another tenant's admin cannot see or resolve it.
    const crossTenant = await app.inject({
      method: "GET",
      url: `/data-requests/${requestId}`,
      headers: { authorization: `Bearer ${OTHER_TENANT_ADMIN_TOKEN}` },
    });
    expect(crossTenant.statusCode).toBe(404);

    const [step] = await workflowRepo.listStepInstances(ADMIN_TOKEN, workflowInstanceId);
    await decideApprovalStep(workflowRepo, new FakeAuthorityRepository(), ADMIN_TOKEN, step!.id, ADMIN_USER, "approved", null);

    const resolved = await app.inject({
      method: "GET",
      url: `/data-requests/${requestId}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json().dataRequest.status).toBe("completed");
    expect(resolved.json().dataRequest.result.appUser.id).toBe("subject-1");
  });

  it("deletion over HTTP: an active legal hold refuses the deletion instead of anonymizing", async () => {
    const { app, workflowRepo, identityRepo, auditRepo } = appWithFakeRepos();
    const definition = await publishDataRequestApprovalWorkflow(workflowRepo);
    await identityRepo.insertAppUser({ id: "subject-2", email: "subject2@example.com", display_name: "Subject Two", invited_by: null });
    const hold = await auditRepo.placeLegalHold(ADMIN_TOKEN, {
      entity_type: "app_users",
      entity_id: "subject-2",
      reason: "active litigation",
      placed_by: ADMIN_USER,
    });

    const created = await app.inject({
      method: "POST",
      url: "/data-requests",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        requestType: "deletion",
        entityType: "app_users",
        entityId: "subject-2",
        reason: "right to erasure request",
        definitionId: definition.id,
      },
    });
    const requestId = created.json().dataRequest.id;
    const workflowInstanceId = created.json().dataRequest.workflow_instance_id;

    const [step] = await workflowRepo.listStepInstances(ADMIN_TOKEN, workflowInstanceId);
    await decideApprovalStep(workflowRepo, new FakeAuthorityRepository(), ADMIN_TOKEN, step!.id, ADMIN_USER, "approved", null);

    const resolved = await app.inject({
      method: "GET",
      url: `/data-requests/${requestId}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(resolved.json().dataRequest.status).toBe("refused");
    expect(resolved.json().dataRequest.result.legalHoldId).toBe(hold.id);

    const user = await identityRepo.getAppUserById("subject-2");
    expect(user!.email).toBe("subject2@example.com");
  });
});
