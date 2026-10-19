import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeLegalRepository } from "../../test/fakeLegalRepository.js";

describe("M27: Legal, Licences & Regulatory Register routes", () => {
  let app: FastifyInstance;
  let authRepo: FakeAuthorityRepository;
  let legalRepo: FakeLegalRepository;

  const tenantA = "tenant-a-111";
  const userA = "user-a-111";
  const tokenA = "token-a-valid";

  const tenantB = "tenant-b-222";
  const userB = "user-b-222";
  const tokenB = "token-b-valid";

  const permissions = [
    "legal.licence.manage",
    "legal.licence.renew",
    "legal.matter.manage",
    "legal.matter.view_privileged",
    "legal.counsel.manage",
    "legal.compliance.manage",
  ];

  beforeEach(async () => {
    authRepo = new FakeAuthorityRepository();
    legalRepo = new FakeLegalRepository();

    // Tenant A setup
    authRepo.addSession(tokenA, userA, tenantA);
    authRepo.roleAssignments.set("seed-admin-a", {
      id: "seed-admin-a",
      tenant_id: tenantA,
      user_id: userA,
      role_id: "role.platform_administrator",
      department_id: null,
      valid_from: "2000-01-01T00:00:00.000Z",
      valid_to: null,
    });
    permissions.forEach((perm) => authRepo.grantPermission("role.platform_administrator", perm));
    legalRepo.addSession(tokenA, userA, tenantA);

    // Tenant B setup
    authRepo.addSession(tokenB, userB, tenantB);
    authRepo.roleAssignments.set("seed-admin-b", {
      id: "seed-admin-b",
      tenant_id: tenantB,
      user_id: userB,
      role_id: "role.platform_administrator",
      department_id: null,
      valid_from: "2000-01-01T00:00:00.000Z",
      valid_to: null,
    });
    permissions.forEach((perm) => authRepo.grantPermission("role.platform_administrator", perm));
    legalRepo.addSession(tokenB, userB, tenantB);

    app = buildApp({
      getAuthorityRepository: () => authRepo,
      getLegalRepository: () => legalRepo,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  // 1. Licences & Permits Tests
  it("registers a licence and successfully renews its expiry date", async () => {
    const resCreate = await app.inject({
      method: "POST",
      url: "/legal/licences",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        licence_name: "Commercial Building General Contracting Licence",
        licence_number: "CN-2026-98124",
        category: "trade_licence",
        issuing_authority: "Department of Economic Development (DED)",
        issue_date: "2025-11-01",
        expiry_date: "2026-11-01",
        renewal_lead_days: 30,
        responsible_officer: "Legal Counsel Lead",
        renewal_cost: 45000,
        notes: "Main operational commercial licence",
      },
    });

    expect(resCreate.statusCode).toBe(201);
    const licence = resCreate.json().licence;
    expect(licence.licence_number).toBe("CN-2026-98124");
    expect(licence.tenant_id).toBe(tenantA);

    // List in Tenant A
    const resListA = await app.inject({
      method: "GET",
      url: "/legal/licences",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(resListA.statusCode).toBe(200);
    expect(resListA.json().licences).toHaveLength(1);

    // Renew licence
    const resRenew = await app.inject({
      method: "POST",
      url: `/legal/licences/${licence.id}/renew`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        new_expiry_date: "2027-11-01",
        renewal_cost: 48000,
        notes: "Renewed for 2026/2027 fiscal year",
      },
    });
    expect(resRenew.statusCode).toBe(200);
    const renewed = resRenew.json().licence;
    expect(renewed.expiry_date).toBe("2027-11-01");
    expect(renewed.status).toBe("active");
  });

  // 2. Legal Matters & Disputes Tests
  it("logs legal matter and updates proceedings status", async () => {
    const resCreate = await app.inject({
      method: "POST",
      url: "/legal/matters",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        matter_reference: "ARB-2026-003",
        title: "Subcontractor Steel Fabrication Delay Dispute",
        matter_type: "arbitration",
        court_or_tribunal: "DIAC Arbitration Center",
        claim_amount: 1250000,
        currency: "AED",
        opposing_party: "Apex Steel Fabrication LLC",
        risk_level: "high",
        access_class: "privileged_confidential",
        internal_counsel: "CLO Office",
        summary: "Claim for prolongation and disruption costs on Tower Phase 2.",
      },
    });

    expect(resCreate.statusCode).toBe(201);
    const matter = resCreate.json().matter;
    expect(matter.matter_reference).toBe("ARB-2026-003");
    expect(matter.access_class).toBe("privileged_confidential");

    // Advance status to pleadings
    const resPatch = await app.inject({
      method: "PATCH",
      url: `/legal/matters/${matter.id}/status`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { status: "pleadings" },
    });
    expect(resPatch.statusCode).toBe(200);
    expect(resPatch.json().matter.status).toBe("pleadings");
  });

  // 3. External Counsel Tests
  it("registers external law firm retainer and updates billed fees", async () => {
    const resCreate = await app.inject({
      method: "POST",
      url: "/legal/counsel",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        firm_name: "Al Tamimi & Company",
        lead_attorney: "Omar Al-Khatib, Partner",
        email: "omar.k@tamimi.com",
        phone: "+971 4 364 1234",
        specialization: "Construction & Infrastructure Arbitration",
        fee_arrangement: "capped",
        budget_amount: 250000,
        billed_amount: 50000,
        currency: "AED",
        notes: "Retained for DIAC arbitration representation",
      },
    });

    expect(resCreate.statusCode).toBe(201);
    const counsel = resCreate.json().counsel;
    expect(counsel.firm_name).toBe("Al Tamimi & Company");

    // Update billing
    const resPatch = await app.inject({
      method: "PATCH",
      url: `/legal/counsel/${counsel.id}/billing`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { billed_amount: 110000 },
    });
    expect(resPatch.statusCode).toBe(200);
    expect(resPatch.json().counsel.billed_amount).toBe(110000);
  });

  // 4. Compliance Obligations Tests
  it("tracks statutory compliance obligation and completes official filing", async () => {
    const resCreate = await app.inject({
      method: "POST",
      url: "/legal/obligations",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        obligation_name: "Annual Economic Substance Regulations (ESR) Notification",
        regulatory_body: "Ministry of Finance",
        frequency: "annual",
        deadline_date: "2026-12-31",
        compliance_owner: "Senior Corporate Legal Counsel",
        notes: "Relevant activity: Construction & Engineering Headquarter services",
      },
    });

    expect(resCreate.statusCode).toBe(201);
    const obligation = resCreate.json().obligation;
    expect(obligation.status).toBe("pending");

    // File obligation
    const resFile = await app.inject({
      method: "POST",
      url: `/legal/obligations/${obligation.id}/file`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        evidence_reference: "MOF-ESR-REF-992144",
        filing_date: "2026-10-19",
        notes: "Successfully filed and acknowledgment receipt archived.",
      },
    });
    expect(resFile.statusCode).toBe(200);
    const filed = resFile.json().obligation;
    expect(filed.status).toBe("filed");
    expect(filed.evidence_reference).toBe("MOF-ESR-REF-992144");
  });
});
