import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeMasterDataRepository } from "../../test/fakeMasterDataRepository.js";

const ADMIN_TOKEN = "admin-token";
const ADMIN_USER = "admin-user";
const TENANT_A = "tenant-a";
const PLAIN_TOKEN = "plain-token";
const PLAIN_USER = "plain-user";

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
  authorityRepo.grantPermission("role.platform_administrator", "master-data.manage");

  const masterDataRepo = new FakeMasterDataRepository();
  masterDataRepo.addSession(ADMIN_TOKEN, TENANT_A);
  masterDataRepo.addSession(PLAIN_TOKEN, TENANT_A);

  const app = buildApp({
    getAuthorityRepository: () => authorityRepo,
    getMasterDataRepository: () => masterDataRepo,
  });
  return { app, masterDataRepo };
}

describe("POST /master-data/uom", () => {
  it("201s for a caller with master-data.manage", async () => {
    const { app } = appWithFakeRepos();
    const response = await app.inject({
      method: "POST",
      url: "/master-data/uom",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { code: "m²", description: "Square metre" },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().uom.code).toBe("m²");
  });

  it("403s without master-data.manage", async () => {
    const { app } = appWithFakeRepos();
    const response = await app.inject({
      method: "POST",
      url: "/master-data/uom",
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { code: "m²" },
    });
    expect(response.statusCode).toBe(403);
  });
});

describe("GET /master-data/uom", () => {
  it("is readable by any authenticated caller, no permission required", async () => {
    const { app } = appWithFakeRepos();
    await app.inject({
      method: "POST",
      url: "/master-data/uom",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { code: "kg" },
    });

    const response = await app.inject({
      method: "GET",
      url: "/master-data/uom",
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().uom).toHaveLength(1);
  });
});

describe("cost code archive", () => {
  it("409s with the referencing count when an estimate line still uses the code", async () => {
    const { app, masterDataRepo } = appWithFakeRepos();
    const create = await app.inject({
      method: "POST",
      url: "/master-data/cost-codes",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { code: "L100", category: "labour" },
    });
    const costCodeId = create.json().costCode.id;
    masterDataRepo.estimateLineCostCodeRefs.set(costCodeId, 2);

    const response = await app.inject({
      method: "POST",
      url: `/master-data/cost-codes/${costCodeId}/archive`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().referencingCount).toBe(2);
  });
});

describe("numbering schemes", () => {
  it("previews without consuming, then issues sequential numbers", async () => {
    const { app } = appWithFakeRepos();
    const create = await app.inject({
      method: "POST",
      url: "/master-data/numbering-schemes",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { entity_type: "po", prefix: "PO-", padding: 4 },
    });
    const schemeId = create.json().numberingScheme.id;

    const preview = await app.inject({
      method: "GET",
      url: `/master-data/numbering-schemes/${schemeId}/preview`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(preview.json().formatted).toBe("PO-0001");

    const first = await app.inject({
      method: "POST",
      url: `/master-data/numbering-schemes/${schemeId}/next`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const second = await app.inject({
      method: "POST",
      url: `/master-data/numbering-schemes/${schemeId}/next`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(first.json().formatted).toBe("PO-0001");
    expect(second.json().formatted).toBe("PO-0002");
  });

  it("403s issuing a number without master-data.manage", async () => {
    const { app } = appWithFakeRepos();
    const create = await app.inject({
      method: "POST",
      url: "/master-data/numbering-schemes",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { entity_type: "rfi" },
    });
    const schemeId = create.json().numberingScheme.id;

    const response = await app.inject({
      method: "POST",
      url: `/master-data/numbering-schemes/${schemeId}/next`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
    });
    expect(response.statusCode).toBe(403);
  });
});
