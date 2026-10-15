import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { FakeIdentityRepository } from "../../test/fakeIdentityRepository.js";

function appWithFakeRepo() {
  const repo = new FakeIdentityRepository();
  const app = buildApp({ getIdentityRepository: () => repo });
  return { app, repo };
}

describe("POST /identity/invite", () => {
  it("201s and returns the new pending user", async () => {
    const { app } = appWithFakeRepo();

    const response = await app.inject({
      method: "POST",
      url: "/identity/invite",
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
      payload: {},
    });

    expect(response.statusCode).toBe(400);
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
      payload: { email: "bye@sevents.test" },
    });
    const userId = inviteResponse.json().user.id;

    const response = await app.inject({
      method: "POST",
      url: "/identity/deactivate",
      payload: { userId },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().user.status).toBe("deactivated");
    expect(repo.users.has(userId)).toBe(true);
  });
});
