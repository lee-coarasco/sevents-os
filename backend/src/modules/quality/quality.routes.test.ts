import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeQualityRepository } from "../../test/fakeQualityRepository.js";

describe("M19: Quality, Inspection & NCR routes", () => {
  let app: FastifyInstance;
  let authRepo: FakeAuthorityRepository;
  let qualityRepo: FakeQualityRepository;

  const tenantA = "tenant-a-111";
  const userA = "user-a-111";
  const tokenA = "token-a-valid";

  const tenantB = "tenant-b-222";
  const userB = "user-b-222";
  const tokenB = "token-b-valid";

  const permissions = [
    "quality.itp.manage",
    "quality.inspection.manage",
    "quality.inspection.signoff",
    "quality.ncr.manage",
    "quality.ncr.close",
  ];

  beforeEach(async () => {
    authRepo = new FakeAuthorityRepository();
    qualityRepo = new FakeQualityRepository();

    // Setup sessions & permissions for Tenant A
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
    qualityRepo.addSession(tokenA, userA, tenantA);

    // Setup sessions & permissions for Tenant B
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
    qualityRepo.addSession(tokenB, userB, tenantB);

    app = buildApp({
      getAuthorityRepository: () => authRepo,
      getQualityRepository: () => qualityRepo,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("creates and retrieves an Inspection and Test Plan (ITP) with items", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/projects/proj-101/quality/plans",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        planNumber: "ITP-CIV-001",
        title: "Substructure Concrete Pouring & Curing ITP",
        tradeDiscipline: "civil",
        applicableSpecifications: "BS EN 206 & Project Spec §03300",
        items: [
          {
            itemSequence: 1,
            activityName: "Rebar Placement & Cover Verification",
            acceptanceCriteria: "Tolerance within +/- 5mm as per Bar Bending Schedule",
            pointType: "hold_point",
            referenceStandard: "BS 8666",
            verifyingDocument: "Rebar Inspection Checksheet",
          },
          {
            itemSequence: 2,
            activityName: "Formwork Alignment & Cleanliness",
            acceptanceCriteria: "Cleaned, shutter oiled, dimensions verified",
            pointType: "witness_point",
            referenceStandard: "CIRIA Guide",
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.plan.plan_number).toBe("ITP-CIV-001");
    expect(body.plan.items.length).toBe(2);
    expect(body.plan.items[0].point_type).toBe("hold_point");

    // List plans for project
    const listRes = await app.inject({
      method: "GET",
      url: "/projects/proj-101/quality/plans",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().plans.length).toBe(1);

    // Approve plan
    const approveRes = await app.inject({
      method: "PATCH",
      url: `/quality/plans/${body.plan.id}/status`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { status: "approved" },
    });
    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().plan.status).toBe("approved");
  });

  it("creates a Work Inspection Request (WIR), completes checklist, and approves inspection", async () => {
    // 1. Create WIR
    const createRes = await app.inject({
      method: "POST",
      url: "/projects/proj-101/quality/wirs",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        wirNumber: "WIR-CIV-042",
        title: "Foundation Slab Grid B2-B6 Pre-Pour Inspection",
        tradeDiscipline: "civil",
        locationOrGrid: "Tower A, Grid B2-B6 Level B1",
        contractorRepresentative: "Eng. Ahmed (Civil Contractor)",
        checklist: [
          { itemSequence: 1, checkpointDescription: "Vapour barrier membrane overlap sealed" },
          { itemSequence: 2, checkpointDescription: "Bottom rebar spacing and chair supports checked" },
          { itemSequence: 3, checkpointDescription: "MEP stub-outs and sleeves coordinated" },
        ],
      },
    });

    expect(createRes.statusCode).toBe(201);
    const wir = createRes.json().wir;
    expect(wir.wir_number).toBe("WIR-CIV-042");
    expect(wir.checklist.length).toBe(3);

    // 2. Sign off WIR with conditional approval
    const signOffRes = await app.inject({
      method: "POST",
      url: `/quality/wirs/${wir.id}/sign-off`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        status: "conditionally_approved",
        inspectorName: "Senior QA/QC Inspector - Robert",
        inspectorRemarks: "Approved to pour subject to clearing minor debris at sleeve B4 before pump arrival",
        checklistUpdates: [
          { id: wir.checklist[0].id, result: "pass" },
          { id: wir.checklist[1].id, result: "pass" },
          { id: wir.checklist[2].id, result: "pass", comments: "Clear sleeve opening verified" },
        ],
      },
    });

    expect(signOffRes.statusCode).toBe(200);
    const updated = signOffRes.json().wir;
    expect(updated.status).toBe("conditionally_approved");
    expect(updated.inspector_name).toBe("Senior QA/QC Inspector - Robert");
    expect(updated.checklist[0].result).toBe("pass");
  });

  it("handles WIR rejection with automatic linked NCR creation", async () => {
    // 1. Create WIR
    const createRes = await app.inject({
      method: "POST",
      url: "/projects/proj-101/quality/wirs",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        wirNumber: "WIR-MEP-015",
        title: "Chilled Water Pipe Pressure Testing",
        tradeDiscipline: "mep",
        locationOrGrid: "Plant Room Level 2",
        contractorRepresentative: "MEP Tech Lead Tariq",
      },
    });
    const wir = createRes.json().wir;

    // 2. Reject and request auto NCR creation
    const signOffRes = await app.inject({
      method: "POST",
      url: `/quality/wirs/${wir.id}/sign-off`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        status: "rejected",
        inspectorName: "Lead MEP Quality Inspector",
        inspectorRemarks: "Pressure test failed at 12 bar: flange weld pinhole leakage identified",
        autoCreateNcr: true,
      },
    });

    expect(signOffRes.statusCode).toBe(200);
    const body = signOffRes.json();
    expect(body.wir.status).toBe("rejected");
    expect(body.created_ncr).toBeDefined();
    expect(body.created_ncr.wir_id).toBe(wir.id);
    expect(body.created_ncr.severity).toBe("major");
    expect(body.created_ncr.status).toBe("open");
  });

  it("manages full NCR lifecycle: issue, CAPA submission, and verification closure", async () => {
    // 1. Issue NCR
    const ncrRes = await app.inject({
      method: "POST",
      url: "/projects/proj-101/quality/ncrs",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        ncrNumber: "NCR-STR-008",
        title: "Honeycomb voiding in Column C3 after shutter stripping",
        tradeDiscipline: "structural",
        locationOrGrid: "Grid C3 Ground Floor",
        severity: "major",
        issue_description: "Severe honeycombing and exposed aggregate observed over 400x300mm area",
        rootCauseCategory: "workmanship",
        issuedBy: "QHSE Lead Engineer",
        issuedTo: "Concrete Subcontractor",
        targetClosureDate: "2026-10-25",
        containmentAction: "No further load applied on beam above until structural repair approved",
      },
    });

    expect(ncrRes.statusCode).toBe(201);
    const ncr = ncrRes.json().ncr;
    expect(ncr.ncr_number).toBe("NCR-STR-008");
    expect(ncr.status).toBe("open");

    // 2. Submit CAPA
    const capaRes = await app.inject({
      method: "POST",
      url: `/quality/ncrs/${ncr.id}/capa`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        containmentAction: "Propped and tagged do not load",
        correctiveActionPlan: "Chipping to sound concrete, application of Sika bonding agent and high-strength non-shrink repair mortar",
        preventiveActionPlan: "Retrain vibrating needle operators on congested rebar placement protocols",
      },
    });

    expect(capaRes.statusCode).toBe(200);
    expect(capaRes.json().ncr.status).toBe("capa_submitted");
    expect(capaRes.json().ncr.corrective_action_plan).toContain("repair mortar");

    // 3. Verify and Close NCR
    const closeRes = await app.inject({
      method: "POST",
      url: `/quality/ncrs/${ncr.id}/close`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        closedBy: "Consultant Resident Engineer",
        closureRemarks: "Visual inspection and rebound hammer test passed. Repaired area certified.",
      },
    });

    expect(closeRes.statusCode).toBe(200);
    expect(closeRes.json().ncr.status).toBe("verified_closed");
    expect(closeRes.json().ncr.closed_by).toBe("Consultant Resident Engineer");
  });

  it("enforces multi-tenant isolation across Quality data", async () => {
    // Tenant A creates an ITP
    const itpRes = await app.inject({
      method: "POST",
      url: "/projects/proj-101/quality/plans",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        planNumber: "ITP-A-001",
        title: "Tenant A Waterproofing Plan",
        tradeDiscipline: "finishes",
      },
    });
    const planA = itpRes.json().plan;

    // Tenant B tries to get Tenant A's ITP
    const getRes = await app.inject({
      method: "GET",
      url: `/quality/plans/${planA.id}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(getRes.statusCode).toBe(404);

    // Tenant B listing plans for the same project returns empty list for Tenant B
    const listRes = await app.inject({
      method: "GET",
      url: "/projects/proj-101/quality/plans",
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().plans.length).toBe(0);
  });
});
