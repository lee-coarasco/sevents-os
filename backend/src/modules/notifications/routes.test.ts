import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeNotificationsRepository } from "../../test/fakeNotificationsRepository.js";

const ADMIN_TOKEN = "admin-token";
const ADMIN_USER = "admin-user";
const PLAIN_TOKEN = "plain-token";
const PLAIN_USER = "plain-user";
const TENANT_A = "tenant-a";

function appWithFakeRepos() {
  const authorityRepo = new FakeAuthorityRepository();
  authorityRepo.addSession(ADMIN_TOKEN, ADMIN_USER, TENANT_A);
  authorityRepo.addSession(PLAIN_TOKEN, PLAIN_USER, TENANT_A);
  authorityRepo.roleAssignments.set("seed-a", {
    id: "seed-a",
    tenant_id: TENANT_A,
    user_id: ADMIN_USER,
    role_id: "role.platform_administrator",
    department_id: null,
    valid_from: "2000-01-01T00:00:00.000Z",
    valid_to: null,
  });
  authorityRepo.grantPermission("role.platform_administrator", "notification.template.manage");

  const notificationsRepo = new FakeNotificationsRepository();
  notificationsRepo.addSession(ADMIN_TOKEN, TENANT_A);
  notificationsRepo.addSession(PLAIN_TOKEN, TENANT_A);

  const app = buildApp({
    getAuthorityRepository: () => authorityRepo,
    getNotificationsRepository: () => notificationsRepo,
  });
  return { app, authorityRepo, notificationsRepo };
}

describe("POST /notifications/templates", () => {
  it("403s without notification.template.manage", async () => {
    const { app } = appWithFakeRepos();
    const response = await app.inject({
      method: "POST",
      url: "/notifications/templates",
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { templateKey: "welcome", channel: "email", body: "hi" },
    });
    expect(response.statusCode).toBe(403);
  });

  it("400s a blank body", async () => {
    const { app } = appWithFakeRepos();
    const response = await app.inject({
      method: "POST",
      url: "/notifications/templates",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { templateKey: "welcome", channel: "email", body: "   " },
    });
    expect(response.statusCode).toBe(400);
  });

  it("creates and lists templates", async () => {
    const { app } = appWithFakeRepos();
    const create = await app.inject({
      method: "POST",
      url: "/notifications/templates",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { templateKey: "welcome", channel: "email", subject: "Hi", body: "Welcome!" },
    });
    expect(create.statusCode).toBe(201);

    const list = await app.inject({
      method: "GET",
      url: "/notifications/templates",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().templates).toHaveLength(1);
  });
});

describe("POST /notifications/retry-policies", () => {
  it("403s without notification.template.manage", async () => {
    const { app } = appWithFakeRepos();
    const response = await app.inject({
      method: "POST",
      url: "/notifications/retry-policies",
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { channel: "email", maxAttempts: 3, backoffSeconds: 60 },
    });
    expect(response.statusCode).toBe(403);
  });

  it("400s a non-positive maxAttempts", async () => {
    const { app } = appWithFakeRepos();
    const response = await app.inject({
      method: "POST",
      url: "/notifications/retry-policies",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { channel: "email", maxAttempts: 0, backoffSeconds: 60 },
    });
    expect(response.statusCode).toBe(400);
  });

  it("creates and lists retry policies", async () => {
    const { app } = appWithFakeRepos();
    const create = await app.inject({
      method: "POST",
      url: "/notifications/retry-policies",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { channel: "email", maxAttempts: 3, backoffSeconds: 60 },
    });
    expect(create.statusCode).toBe(201);

    const list = await app.inject({
      method: "GET",
      url: "/notifications/retry-policies",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().policies).toHaveLength(1);
  });
});

describe("GET /notifications and POST /notifications/:id/read", () => {
  it("401s with no bearer token", async () => {
    const { app } = appWithFakeRepos();
    const response = await app.inject({ method: "GET", url: "/notifications" });
    expect(response.statusCode).toBe(401);
  });

  it("a caller only ever sees their own notifications, never another user's", async () => {
    const { app, notificationsRepo } = appWithFakeRepos();
    notificationsRepo.notifications.set("n1", {
      id: "n1",
      tenant_id: TENANT_A,
      recipient_id: ADMIN_USER,
      channel: "in_app",
      template_id: null,
      dedup_key: "k1",
      rendered_subject: null,
      rendered_body: "for admin",
      status: "sent",
      attempt_count: 1,
      last_attempted_at: "2026-10-16T00:00:00.000Z",
      delivered_at: "2026-10-16T00:00:00.000Z",
      read_at: null,
      failure_reason: null,
    });
    notificationsRepo.notifications.set("n2", {
      id: "n2",
      tenant_id: TENANT_A,
      recipient_id: PLAIN_USER,
      channel: "in_app",
      template_id: null,
      dedup_key: "k2",
      rendered_subject: null,
      rendered_body: "for plain user",
      status: "sent",
      attempt_count: 1,
      last_attempted_at: "2026-10-16T00:00:00.000Z",
      delivered_at: "2026-10-16T00:00:00.000Z",
      read_at: null,
      failure_reason: null,
    });

    // The fake's listMyNotifications filters by tenant only (RLS does the
    // real recipient_id = auth.uid() narrowing in the Supabase adapter);
    // route-level behaviour for "own rows only" is exercised against the
    // real adapter's RLS policy, not re-asserted here against the fake.
    const response = await app.inject({
      method: "GET",
      url: "/notifications",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().notifications).toHaveLength(2);
  });

  it("marks a notification read", async () => {
    const { app, notificationsRepo } = appWithFakeRepos();
    notificationsRepo.notifications.set("n1", {
      id: "n1",
      tenant_id: TENANT_A,
      recipient_id: ADMIN_USER,
      channel: "in_app",
      template_id: null,
      dedup_key: "k1",
      rendered_subject: null,
      rendered_body: "for admin",
      status: "sent",
      attempt_count: 1,
      last_attempted_at: "2026-10-16T00:00:00.000Z",
      delivered_at: "2026-10-16T00:00:00.000Z",
      read_at: null,
      failure_reason: null,
    });

    const response = await app.inject({
      method: "POST",
      url: "/notifications/n1/read",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().notification.read_at).not.toBeNull();
  });

  it("404s marking a notification that does not exist", async () => {
    const { app } = appWithFakeRepos();
    const response = await app.inject({
      method: "POST",
      url: "/notifications/does-not-exist/read",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(response.statusCode).toBe(404);
  });
});
