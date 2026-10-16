import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeIdentityRepository } from "../../test/fakeIdentityRepository.js";

const ADMIN_TOKEN = "admin-token";
const ADMIN_USER_ID = "admin-user";
const TENANT_ID = "tenant-a";

function appWithFakeRepo() {
  const repo = new FakeIdentityRepository();
  const authorityRepo = new FakeAuthorityRepository();
  // ticket 0056: invite/deactivate are gated on identity.user.invite /
  // identity.user.deactivate, held here by a platform-administrator
  // assignment for the admin caller every test below authenticates as.
  authorityRepo.addSession(ADMIN_TOKEN, ADMIN_USER_ID, TENANT_ID);
  authorityRepo.grantPermission("role.platform_administrator", "identity.user.invite");
  authorityRepo.grantPermission("role.platform_administrator", "identity.user.deactivate");
  authorityRepo.roleAssignments.set("seed-admin-assignment", {
    id: "seed-admin-assignment",
    tenant_id: TENANT_ID,
    user_id: ADMIN_USER_ID,
    role_id: "role.platform_administrator",
    department_id: null,
    valid_from: "2000-01-01T00:00:00.000Z",
    valid_to: null,
  });
  const app = buildApp({
    getIdentityRepository: () => repo,
    getAuthorityRepository: () => authorityRepo,
  });
  return { app, repo, authorityRepo };
}

const adminHeaders = { authorization: `Bearer ${ADMIN_TOKEN}` };

describe("POST /identity/invite", () => {
  it("201s and returns the new pending user for an admin caller", async () => {
    const { app } = appWithFakeRepo();

    const response = await app.inject({
      method: "POST",
      url: "/identity/invite",
      headers: adminHeaders,
      payload: { email: "new@sevents.test", displayName: "New Person" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().user).toMatchObject({
      email: "new@sevents.test",
      status: "pending",
    });
  });

  it("400s when email is missing", async () => {
    const { app } = appWithFakeRepo();

    const response = await app.inject({
      method: "POST",
      url: "/identity/invite",
      headers: adminHeaders,
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });

  it("401s with no bearer token", async () => {
    const { app } = appWithFakeRepo();

    const response = await app.inject({
      method: "POST",
      url: "/identity/invite",
      payload: { email: "nope@sevents.test" },
    });

    expect(response.statusCode).toBe(401);
  });

  it("403s for a caller without identity.user.invite", async () => {
    const { app, authorityRepo } = appWithFakeRepo();
    authorityRepo.addSession("no-permission-token", "plain-user", TENANT_ID);

    const response = await app.inject({
      method: "POST",
      url: "/identity/invite",
      headers: { authorization: "Bearer no-permission-token" },
      payload: { email: "nope@sevents.test" },
    });

    expect(response.statusCode).toBe(403);
  });
});

describe("GET /admin/users", () => {
  it("401s with no bearer token", async () => {
    const { app } = appWithFakeRepo();

    const response = await app.inject({ method: "GET", url: "/admin/users" });

    expect(response.statusCode).toBe(401);
  });

  it("200s with the tenant's user directory for any valid session", async () => {
    const { app, repo } = appWithFakeRepo();
    const inviteResponse = await app.inject({
      method: "POST",
      url: "/identity/invite",
      headers: adminHeaders,
      payload: { email: "pick-me@sevents.test", displayName: "Pick Me" },
    });
    repo.addSession("valid-token", inviteResponse.json().user.id);

    const response = await app.inject({
      method: "GET",
      url: "/admin/users",
      headers: { authorization: "Bearer valid-token" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().users).toEqual(
      expect.arrayContaining([expect.objectContaining({ email: "pick-me@sevents.test" })]),
    );
  });
});

describe("GET /identity/audit-log", () => {
  it("401s with no bearer token", async () => {
    const { app } = appWithFakeRepo();

    const response = await app.inject({ method: "GET", url: "/identity/audit-log" });

    expect(response.statusCode).toBe(401);
  });

  it("401s with an unrecognized bearer token", async () => {
    const { app } = appWithFakeRepo();

    const response = await app.inject({
      method: "GET",
      url: "/identity/audit-log",
      headers: { authorization: "Bearer not-a-real-session" },
    });

    expect(response.statusCode).toBe(401);
  });

  it("200s with the caller's own entries for a valid session", async () => {
    const { app, repo } = appWithFakeRepo();
    const inviteResponse = await app.inject({
      method: "POST",
      url: "/identity/invite",
      headers: adminHeaders,
      payload: { email: "self@sevents.test" },
    });
    const userId = inviteResponse.json().user.id;
    repo.addSession("valid-token", userId);

    const response = await app.inject({
      method: "GET",
      url: "/identity/audit-log",
      headers: { authorization: "Bearer valid-token" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().entries.length).toBeGreaterThan(0);
  });
});

describe("POST /identity/sign-in and /identity/sign-out", () => {
  it("signs in with the right password and signs out afterwards", async () => {
    const { app, repo } = appWithFakeRepo();
    const inviteResponse = await app.inject({
      method: "POST",
      url: "/identity/invite",
      headers: adminHeaders,
      payload: { email: "flow@sevents.test" },
    });
    const userId = inviteResponse.json().user.id;
    repo.setPassword(userId, "correct-password");

    const signInResponse = await app.inject({
      method: "POST",
      url: "/identity/sign-in",
      payload: { email: "flow@sevents.test", password: "correct-password" },
    });
    expect(signInResponse.statusCode).toBe(200);
    const { accessToken } = signInResponse.json().session;

    const signOutResponse = await app.inject({
      method: "POST",
      url: "/identity/sign-out",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(signOutResponse.statusCode).toBe(200);
  });

  it("401s sign-in with the wrong password", async () => {
    const { app } = appWithFakeRepo();
    await app.inject({
      method: "POST",
      url: "/identity/invite",
      headers: adminHeaders,
      payload: { email: "badpw@sevents.test" },
    });

    const response = await app.inject({
      method: "POST",
      url: "/identity/sign-in",
      payload: { email: "badpw@sevents.test", password: "wrong" },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe("POST /identity/deactivate", () => {
  it("deactivates the user and the row still exists afterwards", async () => {
    const { app, repo } = appWithFakeRepo();
    const inviteResponse = await app.inject({
      method: "POST",
      url: "/identity/invite",
      headers: adminHeaders,
      payload: { email: "bye@sevents.test" },
    });
    const userId = inviteResponse.json().user.id;

    const response = await app.inject({
      method: "POST",
      url: "/identity/deactivate",
      headers: adminHeaders,
      payload: { userId },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().user.status).toBe("deactivated");
    expect(repo.users.has(userId)).toBe(true);
  });

  it("403s for a caller without identity.user.deactivate", async () => {
    const { app, repo, authorityRepo } = appWithFakeRepo();
    const inviteResponse = await app.inject({
      method: "POST",
      url: "/identity/invite",
      headers: adminHeaders,
      payload: { email: "stay@sevents.test" },
    });
    const userId = inviteResponse.json().user.id;
    authorityRepo.addSession("no-permission-token", "plain-user", TENANT_ID);

    const response = await app.inject({
      method: "POST",
      url: "/identity/deactivate",
      headers: { authorization: "Bearer no-permission-token" },
      payload: { userId },
    });

    expect(response.statusCode).toBe(403);
    expect(repo.users.get(userId)?.status).toBe("pending");
  });
});
