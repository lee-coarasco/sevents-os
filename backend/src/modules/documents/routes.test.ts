import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeDocumentsRepository } from "../../test/fakeDocumentsRepository.js";

const ADMIN_TOKEN = "admin-token";
const ADMIN_USER = "admin-user";
const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const PLAIN_TOKEN = "plain-token";
const PLAIN_USER = "plain-user";
const OTHER_TENANT_TOKEN = "other-tenant-token";
const OTHER_TENANT_USER = "other-tenant-user";

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
  authorityRepo.grantPermission("role.platform_administrator", "documents.register.manage");

  const documentsRepo = new FakeDocumentsRepository();
  documentsRepo.addSession(ADMIN_TOKEN, ADMIN_USER, TENANT_A);
  documentsRepo.addSession(PLAIN_TOKEN, PLAIN_USER, TENANT_A);
  documentsRepo.addSession(OTHER_TENANT_TOKEN, OTHER_TENANT_USER, TENANT_B);

  const app = buildApp({
    getAuthorityRepository: () => authorityRepo,
    getDocumentsRepository: () => documentsRepo,
  });
  return { app, documentsRepo };
}

describe("POST /documents", () => {
  it("201s for a caller with documents.register.manage", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({
      method: "POST",
      url: "/documents",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { documentType: "drawing", title: "Ground Floor Plan", documentNumber: "DWG-001" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().document.title).toBe("Ground Floor Plan");
    expect(response.json().document.document_number).toBe("DWG-001");
  });

  it("403s without documents.register.manage", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({
      method: "POST",
      url: "/documents",
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { documentType: "drawing", title: "Should not be created" },
    });

    expect(response.statusCode).toBe(403);
  });

  it("401s with no bearer token", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({
      method: "POST",
      url: "/documents",
      payload: { documentType: "drawing", title: "No token" },
    });

    expect(response.statusCode).toBe(401);
  });

  it("400s without documentType or title", async () => {
    const { app } = appWithFakeRepos();

    const response = await app.inject({
      method: "POST",
      url: "/documents",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });
});

describe("GET /documents and /documents/:id", () => {
  it("lists documents without requiring documents.register.manage — reads are open to any authenticated user", async () => {
    const { app } = appWithFakeRepos();
    await app.inject({
      method: "POST",
      url: "/documents",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { documentType: "drawing", title: "Site layout" },
    });

    const response = await app.inject({
      method: "GET",
      url: "/documents",
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().documents).toHaveLength(1);
  });

  it("tenant-isolates the document register", async () => {
    const { app } = appWithFakeRepos();
    await app.inject({
      method: "POST",
      url: "/documents",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { documentType: "drawing", title: "Tenant A doc" },
    });

    const otherTenant = await app.inject({
      method: "GET",
      url: "/documents",
      headers: { authorization: `Bearer ${OTHER_TENANT_TOKEN}` },
    });
    expect(otherTenant.json().documents).toHaveLength(0);
  });

  it("401s with no bearer token", async () => {
    const { app } = appWithFakeRepos();
    const response = await app.inject({ method: "GET", url: "/documents" });
    expect(response.statusCode).toBe(401);
  });

  it("gets a single document by id, 404s for another tenant's document", async () => {
    const { app } = appWithFakeRepos();
    const created = await app.inject({
      method: "POST",
      url: "/documents",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { documentType: "drawing", title: "Doc" },
    });
    const documentId = created.json().document.id;

    const sameTenant = await app.inject({
      method: "GET",
      url: `/documents/${documentId}`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
    });
    expect(sameTenant.statusCode).toBe(200);

    const otherTenant = await app.inject({
      method: "GET",
      url: `/documents/${documentId}`,
      headers: { authorization: `Bearer ${OTHER_TENANT_TOKEN}` },
    });
    expect(otherTenant.statusCode).toBe(404);
  });
});

describe("PATCH /documents/:id", () => {
  it("edits metadata for a caller with documents.register.manage, 403s without it", async () => {
    const { app } = appWithFakeRepos();
    const created = await app.inject({
      method: "POST",
      url: "/documents",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { documentType: "drawing", title: "Original" },
    });
    const documentId = created.json().document.id;

    const forbidden = await app.inject({
      method: "PATCH",
      url: `/documents/${documentId}`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { title: "Should be forbidden" },
    });
    expect(forbidden.statusCode).toBe(403);

    const allowed = await app.inject({
      method: "PATCH",
      url: `/documents/${documentId}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { title: "Updated title" },
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().document.title).toBe("Updated title");
  });
});

describe("POST /documents/:id/revisions — FR-DOC-002 auto-supersede", () => {
  it("201s for a caller with documents.register.manage, 403s without it", async () => {
    const { app } = appWithFakeRepos();
    const created = await app.inject({
      method: "POST",
      url: "/documents",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { documentType: "drawing", title: "Doc" },
    });
    const documentId = created.json().document.id;

    const forbidden = await app.inject({
      method: "POST",
      url: `/documents/${documentId}/revisions`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { revisionCode: "A" },
    });
    expect(forbidden.statusCode).toBe(403);

    const response = await app.inject({
      method: "POST",
      url: `/documents/${documentId}/revisions`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { revisionCode: "A" },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().revision.revision_code).toBe("A");
    expect(response.json().revision.status).toBe("draft");
  });

  it("400s without revisionCode", async () => {
    const { app } = appWithFakeRepos();
    const created = await app.inject({
      method: "POST",
      url: "/documents",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { documentType: "drawing", title: "Doc" },
    });
    const documentId = created.json().document.id;

    const response = await app.inject({
      method: "POST",
      url: `/documents/${documentId}/revisions`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {},
    });
    expect(response.statusCode).toBe(400);
  });

  it("supersedes the approved revision when a new one is created, in the same call", async () => {
    const { app } = appWithFakeRepos();
    const created = await app.inject({
      method: "POST",
      url: "/documents",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { documentType: "drawing", title: "Doc" },
    });
    const documentId = created.json().document.id;

    const revisionAResponse = await app.inject({
      method: "POST",
      url: `/documents/${documentId}/revisions`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { revisionCode: "A" },
    });
    const revisionAId = revisionAResponse.json().revision.id;

    await app.inject({
      method: "PATCH",
      url: `/documents/revisions/${revisionAId}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { status: "approved" },
    });

    const revisionBResponse = await app.inject({
      method: "POST",
      url: `/documents/${documentId}/revisions`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { revisionCode: "B" },
    });
    const revisionBId = revisionBResponse.json().revision.id;

    const revisionAAfter = await app.inject({
      method: "GET",
      url: `/documents/revisions/${revisionAId}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(revisionAAfter.json().revision.status).toBe("superseded");
    expect(revisionAAfter.json().revision.superseded_by_revision_id).toBe(revisionBId);

    const documentAfter = await app.inject({
      method: "GET",
      url: `/documents/${documentId}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(documentAfter.json().document.current_revision_id).toBe(revisionBId);
  });
});

describe("GET /documents/:id/revisions — default excludes superseded/rejected", () => {
  it("excludes superseded/rejected by default; includeSuperseded=true returns them", async () => {
    const { app } = appWithFakeRepos();
    const created = await app.inject({
      method: "POST",
      url: "/documents",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { documentType: "drawing", title: "Doc" },
    });
    const documentId = created.json().document.id;

    const revisionAResponse = await app.inject({
      method: "POST",
      url: `/documents/${documentId}/revisions`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { revisionCode: "A" },
    });
    const revisionAId = revisionAResponse.json().revision.id;
    await app.inject({
      method: "PATCH",
      url: `/documents/revisions/${revisionAId}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { status: "approved" },
    });
    await app.inject({
      method: "POST",
      url: `/documents/${documentId}/revisions`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { revisionCode: "B" },
    });

    const defaultView = await app.inject({
      method: "GET",
      url: `/documents/${documentId}/revisions`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
    });
    expect(defaultView.statusCode).toBe(200);
    expect(defaultView.json().revisions.map((r: { revision_code: string }) => r.revision_code)).toEqual(["B"]);

    const includeSuperseded = await app.inject({
      method: "GET",
      url: `/documents/${documentId}/revisions?includeSuperseded=true`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
    });
    expect(includeSuperseded.json().revisions).toHaveLength(2);
  });
});

describe("GET /documents/:id/revisions/history", () => {
  it("returns the full ordered (oldest-to-newest) revision list regardless of status", async () => {
    const { app } = appWithFakeRepos();
    const created = await app.inject({
      method: "POST",
      url: "/documents",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { documentType: "drawing", title: "Doc" },
    });
    const documentId = created.json().document.id;

    const revisionAResponse = await app.inject({
      method: "POST",
      url: `/documents/${documentId}/revisions`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { revisionCode: "A" },
    });
    const revisionAId = revisionAResponse.json().revision.id;
    await app.inject({
      method: "PATCH",
      url: `/documents/revisions/${revisionAId}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { status: "approved" },
    });
    await app.inject({
      method: "POST",
      url: `/documents/${documentId}/revisions`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { revisionCode: "B" },
    });

    const history = await app.inject({
      method: "GET",
      url: `/documents/${documentId}/revisions/history`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
    });
    expect(history.statusCode).toBe(200);
    expect(history.json().revisions.map((r: { revision_code: string }) => r.revision_code)).toEqual(["A", "B"]);
    expect(history.json().revisions[0].status).toBe("superseded");
  });

  it("401s with no bearer token", async () => {
    const { app } = appWithFakeRepos();
    const response = await app.inject({ method: "GET", url: "/documents/some-id/revisions/history" });
    expect(response.statusCode).toBe(401);
  });
});

describe("PATCH /documents/revisions/:revisionId", () => {
  it("403s without documents.register.manage", async () => {
    const { app } = appWithFakeRepos();
    const created = await app.inject({
      method: "POST",
      url: "/documents",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { documentType: "drawing", title: "Doc" },
    });
    const documentId = created.json().document.id;
    const revisionResponse = await app.inject({
      method: "POST",
      url: `/documents/${documentId}/revisions`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { revisionCode: "A" },
    });
    const revisionId = revisionResponse.json().revision.id;

    const response = await app.inject({
      method: "PATCH",
      url: `/documents/revisions/${revisionId}`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { status: "under_review" },
    });
    expect(response.statusCode).toBe(403);
  });

  it("404s updating another tenant's revision", async () => {
    const { app } = appWithFakeRepos();
    const created = await app.inject({
      method: "POST",
      url: "/documents",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { documentType: "drawing", title: "Doc" },
    });
    const documentId = created.json().document.id;
    const revisionResponse = await app.inject({
      method: "POST",
      url: `/documents/${documentId}/revisions`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { revisionCode: "A" },
    });
    const revisionId = revisionResponse.json().revision.id;

    const response = await app.inject({
      method: "PATCH",
      url: `/documents/revisions/${revisionId}`,
      headers: { authorization: `Bearer ${OTHER_TENANT_TOKEN}` },
      payload: { status: "under_review" },
    });
    expect(response.statusCode).toBe(404);
  });
});
