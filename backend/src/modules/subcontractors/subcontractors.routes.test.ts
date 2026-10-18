import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeSubcontractorRepository } from "../../test/fakeSubcontractorRepository.js";

describe("M16: Subcontractor & Labour Operations routes", () => {
  let app: FastifyInstance;
  let authRepo: FakeAuthorityRepository;
  let subRepo: FakeSubcontractorRepository;

  const tenantA = "tenant-a-111";
  const userA = "user-a-111";
  const tokenA = "token-a-valid";

  const tenantB = "tenant-b-222";
  const userB = "user-b-222";
  const tokenB = "token-b-valid";

  const permissions = [
    "subcontractor.workorder.manage",
    "subcontractor.workorder.view",
    "subcontractor.attendance.manage",
    "subcontractor.claims.manage",
    "subcontractor.claims.certify",
  ];

  beforeEach(async () => {
    authRepo = new FakeAuthorityRepository();
    subRepo = new FakeSubcontractorRepository();

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
    subRepo.addSession(tokenA, userA, tenantA);

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
    subRepo.addSession(tokenB, userB, tenantB);

    app = buildApp({
      getAuthorityRepository: () => authRepo,
      getSubcontractorRepository: () => subRepo,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("creates a subcontractor work order and adds milestones", async () => {
    // 1. Create work order
    const createRes = await app.inject({
      method: "POST",
      url: "/projects/proj-101/subcontractors/work-orders",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        workOrderNumber: "WO-MEP-001",
        title: "HVAC Ductwork & Chilled Water Piping Package",
        tradeDiscipline: "mep",
        contractValue: 450000,
        retentionRatePct: 10.0,
        startDate: "2026-11-01",
        completionDate: "2027-04-30",
        scopeOfWork: "Complete supply and installation of primary AHUs and ducting",
      },
    });

    expect(createRes.statusCode).toBe(201);
    const wo = createRes.json().workOrder;
    expect(wo.work_order_number).toBe("WO-MEP-001");
    expect(wo.contract_value).toBe(450000);
    expect(wo.retention_rate_pct).toBe(10.0);
    expect(wo.status).toBe("draft");

    // 2. Add milestone
    const msRes = await app.inject({
      method: "POST",
      url: `/subcontractors/work-orders/${wo.id}/milestones`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        milestoneName: "Basement 1 & 2 Rough-in",
        amount: 150000,
        plannedDate: "2026-12-15",
      },
    });

    expect(msRes.statusCode).toBe(201);
    const ms = msRes.json().milestone;
    expect(ms.milestone_name).toBe("Basement 1 & 2 Rough-in");
    expect(ms.status).toBe("pending");

    // 3. Get work order with milestones
    const getRes = await app.inject({
      method: "GET",
      url: `/subcontractors/work-orders/${wo.id}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });

    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().workOrder.id).toBe(wo.id);
    expect(getRes.json().milestones.length).toBe(1);

    // 4. Update status to active
    const statusRes = await app.inject({
      method: "PATCH",
      url: `/subcontractors/work-orders/${wo.id}/status`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { status: "active" },
    });

    expect(statusRes.statusCode).toBe(200);
    expect(statusRes.json().workOrder.status).toBe("active");
  });

  it("records daily manpower attendance logs", async () => {
    // 1. Create WO
    const woRes = await app.inject({
      method: "POST",
      url: "/projects/proj-101/subcontractors/work-orders",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        workOrderNumber: "WO-CIV-002",
        title: "Blockwork & Plastering Works",
        tradeDiscipline: "civil",
        contractValue: 180000,
      },
    });
    const woId = woRes.json().workOrder.id;

    // 2. Log attendance
    const logRes = await app.inject({
      method: "POST",
      url: "/projects/proj-101/subcontractors/attendance",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        workOrderId: woId,
        date: "2026-10-18",
        trade: "Masons & Helpers",
        skilledCount: 14,
        unskilledCount: 8,
        totalHours: 8.5,
        supervisorName: "Farhan Qureshi",
        notes: "Blockwork L3 zone B completed",
      },
    });

    expect(logRes.statusCode).toBe(201);
    const log = logRes.json().log;
    expect(log.skilled_count).toBe(14);
    expect(log.unskilled_count).toBe(8);
    expect(log.total_hours).toBe(8.5);

    // 3. List attendance logs
    const listRes = await app.inject({
      method: "GET",
      url: "/projects/proj-101/subcontractors/attendance?date=2026-10-18",
      headers: { authorization: `Bearer ${tokenA}` },
    });

    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().logs.length).toBe(1);
    expect(listRes.json().logs[0].trade).toBe("Masons & Helpers");
  });

  it("records measured work and manages status transitions", async () => {
    const woRes = await app.inject({
      method: "POST",
      url: "/projects/proj-101/subcontractors/work-orders",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        workOrderNumber: "WO-FIN-003",
        title: "Ceramic Tiling Package",
        tradeDiscipline: "finishes",
        contractValue: 220000,
      },
    });
    const woId = woRes.json().workOrder.id;

    // Record measured work
    const mwRes = await app.inject({
      method: "POST",
      url: `/subcontractors/work-orders/${woId}/measured-works`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        measurementDate: "2026-10-18",
        wbsCode: "WBS-FIN-02",
        boqItemReference: "BOQ-09-TILE",
        description: "Floor tiling 600x600 porcelain",
        uom: "SQM",
        quantityMeasured: 350,
        unitRate: 45,
        measuredBy: "Engr. Nader",
      },
    });

    expect(mwRes.statusCode).toBe(201);
    const mw = mwRes.json().measuredWork;
    expect(mw.certified_amount).toBe(15750); // 350 * 45
    expect(mw.status).toBe("draft");

    // Certify measured work
    const certifyRes = await app.inject({
      method: "PATCH",
      url: `/subcontractors/measured-works/${mw.id}/status`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { status: "certified" },
    });

    expect(certifyRes.statusCode).toBe(200);
    expect(certifyRes.json().measuredWork.status).toBe("certified");
  });

  it("creates payment claims with retention deduction and handles certification", async () => {
    // Create WO with 10% retention
    const woRes = await app.inject({
      method: "POST",
      url: "/projects/proj-101/subcontractors/work-orders",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        workOrderNumber: "WO-FAC-004",
        title: "Glazed Curtain Wall Package",
        tradeDiscipline: "facade",
        contractValue: 800000,
        retentionRatePct: 10.0,
      },
    });
    const woId = woRes.json().workOrder.id;

    // Submit payment claim for 100,000 AED
    const claimRes = await app.inject({
      method: "POST",
      url: "/projects/proj-101/subcontractors/payment-claims",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        workOrderId: woId,
        claimNumber: "IPC-FAC-01",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-15",
        claimedAmount: 100000,
        notes: "Interim payment certificate #1 for curtain wall framing",
      },
    });

    expect(claimRes.statusCode).toBe(201);
    const claim = claimRes.json().claim;
    expect(claim.claimed_amount).toBe(100000);
    expect(claim.retention_deducted).toBe(10000); // 10% of 100,000
    expect(claim.net_payable_amount).toBe(90000); // 100,000 - 10,000
    expect(claim.status).toBe("submitted");

    // Certify payment claim with adjusted certified amount (95,000 AED)
    const certifyRes = await app.inject({
      method: "POST",
      url: `/subcontractors/payment-claims/${claim.id}/certify`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        certifiedAmount: 95000,
        notes: "Approved after deducing 5,000 AED for joint sealant punchlist",
      },
    });

    expect(certifyRes.statusCode).toBe(200);
    const certified = certifyRes.json().claim;
    expect(certified.certified_amount).toBe(95000);
    expect(certified.retention_deducted).toBe(9500); // 10% of 95,000
    expect(certified.net_payable_amount).toBe(85500); // 95,000 - 9,500
    expect(certified.status).toBe("certified");
  });

  it("enforces multi-tenant RLS isolation", async () => {
    // Tenant A creates a work order
    const woRes = await app.inject({
      method: "POST",
      url: "/projects/proj-101/subcontractors/work-orders",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        workOrderNumber: "WO-TENANT-A",
        title: "Tenant A Work Order",
        tradeDiscipline: "civil",
        contractValue: 50000,
      },
    });
    const woId = woRes.json().workOrder.id;

    // Tenant B tries to retrieve Tenant A's work order -> 404
    const getResB = await app.inject({
      method: "GET",
      url: `/subcontractors/work-orders/${woId}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(getResB.statusCode).toBe(404);

    // Tenant B listing work orders in proj-101 gets empty list
    const listResB = await app.inject({
      method: "GET",
      url: "/projects/proj-101/subcontractors/work-orders",
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(listResB.statusCode).toBe(200);
    expect(listResB.json().workOrders.length).toBe(0);
  });
});
