import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeCatalogueRepository } from "../../test/fakeCatalogueRepository.js";
import { importCatalogue } from "./service.js";
import type { DispositionRow, RawCatalogueRow } from "./types.js";

const TOKEN = "admin-token";
const USER_ID = "admin-user";
const TENANT_ID = "tenant-a";

const RAW_ROW: RawCatalogueRow = {
  "S.No.": 1,
  Department: "Company / Leadership",
  "Work Item Name": "Approve the company vision",
  "Who is Responsible": "Chairman",
  Description: "A description.",
  Trigger: "Trigger text.",
  Action: "Action text.",
  "Output/Evidence": "Output text.",
  "Control/Handoff": "Handoff text.",
  "Continuity/Escalation": "Escalation text.",
  Timing: "Timing text.",
};

const DISPOSITION_ROW: DispositionRow = {
  s_no: 1,
  department: "Company / Leadership",
  who_is_responsible: "Chairman",
  canonical_role_id: "role.chairman",
  disposition: "Configure approval/decision",
  ticket_id: "32",
  review_needed: "",
};

async function appWithFakeRepos() {
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
  authorityRepo.grantPermission("role.platform_administrator", "catalogue.workitem.manage");

  const catalogueRepo = new FakeCatalogueRepository();
  catalogueRepo.roleDepartmentClusters.set("role.chairman", "Company / Leadership");
  await importCatalogue(catalogueRepo, [RAW_ROW], [DISPOSITION_ROW], {
    sourceFileName: "f.xlsx",
    sourceFileChecksum: "abc",
    importedBy: USER_ID,
  });
  const [workItem] = [...catalogueRepo.definitionsById.values()];

  const app = buildApp({
    getAuthorityRepository: () => authorityRepo,
    getCatalogueRepository: () => catalogueRepo,
  });
  return { app, authorityRepo, catalogueRepo, workItemId: workItem!.id };
}

describe("GET /catalogue/work-items", () => {
  it("200s with the imported work item for a caller with catalogue.workitem.manage", async () => {
    const { app } = await appWithFakeRepos();
    const response = await app.inject({
      method: "GET",
      url: "/catalogue/work-items",
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().items).toHaveLength(1);
    expect(response.json().total).toBe(1);
  });

  it("403s without the permission", async () => {
    const { app, authorityRepo } = await appWithFakeRepos();
    authorityRepo.addSession("plain-token", "plain-user", TENANT_ID);
    const response = await app.inject({
      method: "GET",
      url: "/catalogue/work-items",
      headers: { authorization: "Bearer plain-token" },
    });
    expect(response.statusCode).toBe(403);
  });

  it("401s without a bearer token", async () => {
    const { app } = await appWithFakeRepos();
    const response = await app.inject({ method: "GET", url: "/catalogue/work-items" });
    expect(response.statusCode).toBe(401);
  });
});

describe("GET /catalogue/work-items/:id", () => {
  it("200s with the full detail including source provenance", async () => {
    const { app, workItemId } = await appWithFakeRepos();
    const response = await app.inject({
      method: "GET",
      url: `/catalogue/work-items/${workItemId}`,
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().workItem.source.who_is_responsible).toBe("Chairman");
  });

  it("404s for an unknown id", async () => {
    const { app } = await appWithFakeRepos();
    const response = await app.inject({
      method: "GET",
      url: "/catalogue/work-items/does-not-exist",
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(response.statusCode).toBe(404);
  });
});

describe("PATCH /catalogue/work-items/:id", () => {
  it("200s and bumps the version on a valid edit", async () => {
    const { app, workItemId } = await appWithFakeRepos();
    const response = await app.inject({
      method: "PATCH",
      url: `/catalogue/work-items/${workItemId}`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { risk_tier: "high" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().workItem.risk_tier).toBe("high");
    expect(response.json().workItem.current_version).toBe(2);
  });

  it("400s on an invalid disposition value", async () => {
    const { app, workItemId } = await appWithFakeRepos();
    const response = await app.inject({
      method: "PATCH",
      url: `/catalogue/work-items/${workItemId}`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { disposition: "Not a real value" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("403s without catalogue.workitem.manage", async () => {
    const { app, authorityRepo, workItemId } = await appWithFakeRepos();
    authorityRepo.addSession("plain-token", "plain-user", TENANT_ID);
    const response = await app.inject({
      method: "PATCH",
      url: `/catalogue/work-items/${workItemId}`,
      headers: { authorization: "Bearer plain-token" },
      payload: { risk_tier: "high" },
    });
    expect(response.statusCode).toBe(403);
  });
});
