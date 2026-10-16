import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeTenderingRepository } from "../../test/fakeTenderingRepository.js";

const ADMIN_TOKEN = "admin-token";
const ADMIN_USER = "admin-user";
const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const PLAIN_TOKEN = "plain-token";
const PLAIN_USER = "plain-user";
const OTHER_TENANT_TOKEN = "other-tenant-token";
const OTHER_TENANT_USER = "other-tenant-user";
const TENDER_SUBMISSION_ID = "tender-submission-1";

function appWithFakeRepos() {
  const authorityRepo = new FakeAuthorityRepository();
  authorityRepo.addSession(ADMIN_TOKEN, ADMIN_USER, TENANT_A);
  authorityRepo.addSession(PLAIN_TOKEN, PLAIN_USER, TENANT_A);
  authorityRepo.addSession(OTHER_TENANT_TOKEN, OTHER_TENANT_USER, TENANT_B);
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
    user_id: OTHER_TENANT_USER,
    role_id: "role.platform_administrator",
    department_id: null,
    valid_from: "2000-01-01T00:00:00.000Z",
    valid_to: null,
  });
  authorityRepo.grantPermission("role.platform_administrator", "tendering.document.manage");

  const tenderingRepo = new FakeTenderingRepository();
  tenderingRepo.addSession(ADMIN_TOKEN, ADMIN_USER, TENANT_A);
  tenderingRepo.addSession(PLAIN_TOKEN, PLAIN_USER, TENANT_A);
  tenderingRepo.addSession(OTHER_TENANT_TOKEN, OTHER_TENANT_USER, TENANT_B);

  const app = buildApp({
    getAuthorityRepository: () => authorityRepo,
    getTenderingRepository: () => tenderingRepo,
  });
  return { app, tenderingRepo };
}

describe("POST /tendering/tender-submissions/:id/documents", () => {
  it("201s for a caller with tendering.document.manage", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({
      method: "POST",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/documents`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { documentType: "boq", title: "Bill of Quantities", revision: "Rev A" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().document.title).toBe("Bill of Quantities");
    expect(response.json().document.revision).toBe("Rev A");
  });

  it("403s without tendering.document.manage", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({
      method: "POST",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/documents`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { documentType: "boq", title: "Should not be created" },
    });

    expect(response.statusCode).toBe(403);
  });

  it("401s with no bearer token", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({
      method: "POST",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/documents`,
      payload: { documentType: "boq", title: "No token" },
    });

    expect(response.statusCode).toBe(401);
  });

  it("400s without documentType or title", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({
      method: "POST",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/documents`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });
});

describe("GET /tendering/tender-submissions/:id/documents", () => {
  it("lists documents for a tender submission, tenant-isolated", async () => {
    const { app } = appWithFakeRepos();
    await app.inject({
      method: "POST",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/documents`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { documentType: "drawing", title: "Site layout" },
    });

    const sameTenant = await app.inject({
      method: "GET",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/documents`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(sameTenant.statusCode).toBe(200);
    expect(sameTenant.json().documents).toHaveLength(1);

    const otherTenant = await app.inject({
      method: "GET",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/documents`,
      headers: { authorization: `Bearer ${OTHER_TENANT_TOKEN}` },
    });
    expect(otherTenant.statusCode).toBe(200);
    expect(otherTenant.json().documents).toHaveLength(0);
  });

  it("403s without tendering.document.manage", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({
      method: "GET",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/documents`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
    });

    expect(response.statusCode).toBe(403);
  });
});

describe("scope matrix / clarification log routes", () => {
  it("raises and lists a clarification, 403s without the permission", async () => {
    const { app } = appWithFakeRepos();

    const postResponse = await app.inject({
      method: "POST",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/clarifications`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { item: "Drawing set contradicts BOQ quantities" },
    });
    expect(postResponse.statusCode).toBe(201);
    expect(postResponse.json().clarification.raised_by).toBe(ADMIN_USER);
    expect(postResponse.json().clarification.resolved_at).toBeNull();

    const forbidden = await app.inject({
      method: "POST",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/clarifications`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { item: "Should be forbidden" },
    });
    expect(forbidden.statusCode).toBe(403);

    const listResponse = await app.inject({
      method: "GET",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/clarifications`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(listResponse.json().clarifications).toHaveLength(1);
  });

  it("never surfaces another tenant's clarification log", async () => {
    const { app } = appWithFakeRepos();
    await app.inject({
      method: "POST",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/clarifications`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { item: "Tenant A's clarification" },
    });

    const response = await app.inject({
      method: "GET",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/clarifications`,
      headers: { authorization: `Bearer ${OTHER_TENANT_TOKEN}` },
    });

    expect(response.json().clarifications).toHaveLength(0);
  });

  it("resolves a clarification with a response, and 404s resolving another tenant's", async () => {
    const { app } = appWithFakeRepos();
    const createResponse = await app.inject({
      method: "POST",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/clarifications`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { item: "Missing structural drawing" },
    });
    const clarificationId = createResponse.json().clarification.id;

    const crossTenantResolve = await app.inject({
      method: "POST",
      url: `/tendering/clarifications/${clarificationId}/resolve`,
      headers: { authorization: `Bearer ${OTHER_TENANT_TOKEN}` },
      payload: { response: "n/a" },
    });
    expect(crossTenantResolve.statusCode).toBe(404);

    const resolveResponse = await app.inject({
      method: "POST",
      url: `/tendering/clarifications/${clarificationId}/resolve`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { response: "Drawing issued as Addendum 2" },
    });
    expect(resolveResponse.statusCode).toBe(200);
    expect(resolveResponse.json().clarification.response).toBe("Drawing issued as Addendum 2");
    expect(resolveResponse.json().clarification.resolved_at).not.toBeNull();
  });

  it("403s resolving a clarification without tendering.document.manage", async () => {
    const { app } = appWithFakeRepos();
    const createResponse = await app.inject({
      method: "POST",
      url: `/tendering/tender-submissions/${TENDER_SUBMISSION_ID}/clarifications`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { item: "Query needing resolution" },
    });
    const clarificationId = createResponse.json().clarification.id;

    const response = await app.inject({
      method: "POST",
      url: `/tendering/clarifications/${clarificationId}/resolve`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { response: "Should be forbidden" },
    });

    expect(response.statusCode).toBe(403);
  });
});
