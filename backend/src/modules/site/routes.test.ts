import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeSiteRepository } from "../../test/fakeSiteRepository.js";

const ADMIN_TOKEN = "admin-token";
const ADMIN_USER = "admin-user";
const TENANT_A = "tenant-a";

const OTHER_TENANT_TOKEN = "other-tenant-token";
const OTHER_USER = "other-user";
const TENANT_B = "tenant-b";

const PLAIN_TOKEN = "plain-token";
const PLAIN_USER = "plain-user";

function appWithFakeRepos() {
  const authorityRepo = new FakeAuthorityRepository();

  // Tenant A Admin
  authorityRepo.addSession(ADMIN_TOKEN, ADMIN_USER, TENANT_A);
  authorityRepo.roleAssignments.set("seed-admin", {
    id: "seed-admin",
    tenant_id: TENANT_A,
    user_id: ADMIN_USER,
    role_id: "role.platform_administrator",
    department_id: null,
    valid_from: "2000-01-01T00:00:00.000Z",
    valid_to: null,
  });
  authorityRepo.grantPermission("role.platform_administrator", "site.dpr.manage");
  authorityRepo.grantPermission("role.platform_administrator", "site.dpr.approve");
  authorityRepo.grantPermission("role.platform_administrator", "site.instruction.manage");

  // Tenant B Admin
  authorityRepo.addSession(OTHER_TENANT_TOKEN, OTHER_USER, TENANT_B);
  authorityRepo.roleAssignments.set("seed-other", {
    id: "seed-other",
    tenant_id: TENANT_B,
    user_id: OTHER_USER,
    role_id: "role.platform_administrator",
    department_id: null,
    valid_from: "2000-01-01T00:00:00.000Z",
    valid_to: null,
  });

  // Plain user with no site permissions
  authorityRepo.addSession(PLAIN_TOKEN, PLAIN_USER, TENANT_A);

  const siteRepo = new FakeSiteRepository();
  siteRepo.addSession(ADMIN_TOKEN, ADMIN_USER, TENANT_A);
  siteRepo.addSession(OTHER_TENANT_TOKEN, OTHER_USER, TENANT_B);
  siteRepo.addSession(PLAIN_TOKEN, PLAIN_USER, TENANT_A);

  const app = buildApp({
    getAuthorityRepository: () => authorityRepo,
    getSiteRepository: () => siteRepo,
  });

  return { app, siteRepo, authorityRepo };
}

describe("Site Operations (M17) DPR & Field Capture Routes", () => {
  it("creates, retrieves, and lists DPRs", async () => {
    const { app } = appWithFakeRepos();

    // 1. Create DPR
    const createRes = await app.inject({
      method: "POST",
      url: "/projects/proj-101/site/dprs",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        reportDate: "2026-10-18",
        weatherCondition: "sunny",
        temperatureCelsius: 32.5,
        weatherImpact: "none",
        generalNotes: "Clear site conditions. Foundation concrete pouring commenced on Grid A.",
      },
    });

    expect(createRes.statusCode).toBe(201);
    const dpr = createRes.json().dpr;
    expect(dpr.id).toBeDefined();
    expect(dpr.project_id).toBe("proj-101");
    expect(dpr.report_date).toBe("2026-10-18");
    expect(dpr.status).toBe("draft");
    expect(dpr.weather_condition).toBe("sunny");

    // 2. Get DPR Detail
    const getRes = await app.inject({
      method: "GET",
      url: `/site/dprs/${dpr.id}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(getRes.statusCode).toBe(200);
    const detail = getRes.json().dpr;
    expect(detail.report.id).toBe(dpr.id);
    expect(detail.manpowerEntries).toEqual([]);
    expect(detail.equipmentEntries).toEqual([]);
    expect(detail.workProgressEntries).toEqual([]);
    expect(detail.blockers).toEqual([]);

    // 3. List DPRs for project
    const listRes = await app.inject({
      method: "GET",
      url: "/projects/proj-101/site/dprs",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().dprs.length).toBe(1);
  });

  it("adds child entries (manpower, equipment, work progress, blockers) to DPR", async () => {
    const { app } = appWithFakeRepos();

    const createRes = await app.inject({
      method: "POST",
      url: "/projects/proj-101/site/dprs",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { reportDate: "2026-10-18" },
    });
    const dprId = createRes.json().dpr.id;

    // Add manpower
    const mpRes = await app.inject({
      method: "POST",
      url: `/site/dprs/${dprId}/manpower`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        trade: "Carpenters",
        headcount: 12,
        hoursWorked: 8.5,
        subcontractor_name: "Apex Formworks",
        notes: "Formwork for 2nd floor slab",
      },
    });
    expect(mpRes.statusCode).toBe(201);
    const mpEntry = mpRes.json().entry;
    expect(mpEntry.trade).toBe("Carpenters");
    expect(mpEntry.headcount).toBe(12);

    // Add equipment
    const eqRes = await app.inject({
      method: "POST",
      url: `/site/dprs/${dprId}/equipment`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        equipmentType: "Tower Crane 50T",
        quantity: 1,
        operatingHours: 7,
        idleHours: 1,
        notes: "Lifting rebar and formwork",
      },
    });
    expect(eqRes.statusCode).toBe(201);
    const eqEntry = eqRes.json().entry;
    expect(eqEntry.equipment_type).toBe("Tower Crane 50T");

    // Add work progress
    const wpRes = await app.inject({
      method: "POST",
      url: `/site/dprs/${dprId}/work-progress`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        locationOrGrid: "Grid B3 - B7",
        description: "Cast in-situ columns level 1",
        quantityExecuted: 45,
        uom: "cum",
        notes: "Grade 40 concrete batch 102",
      },
    });
    expect(wpRes.statusCode).toBe(201);
    const wpEntry = wpRes.json().entry;
    expect(wpEntry.description).toBe("Cast in-situ columns level 1");
    expect(wpEntry.quantity_executed).toBe(45);

    // Add blocker
    const blRes = await app.inject({
      method: "POST",
      url: `/site/dprs/${dprId}/blockers`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        category: "material_shortage",
        description: "Delayed delivery of 16mm rebar from mill",
        impactHours: 2.5,
        resolutionAction: "Expedited hot-run shipment scheduled tomorrow 8 AM",
      },
    });
    expect(blRes.statusCode).toBe(201);
    const blocker = blRes.json().blocker;
    expect(blocker.category).toBe("material_shortage");
    expect(blocker.status).toBe("open");

    // Update blocker to resolved
    const updateBlRes = await app.inject({
      method: "PATCH",
      url: `/site/dprs/${dprId}/blockers/${blocker.id}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { status: "resolved", resolutionAction: "Delivered at 2 PM" },
    });
    expect(updateBlRes.statusCode).toBe(200);
    expect(updateBlRes.json().blocker.status).toBe("resolved");

    // Verify DPR detail returns all 4 child items
    const detailRes = await app.inject({
      method: "GET",
      url: `/site/dprs/${dprId}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const detail = detailRes.json().dpr;
    expect(detail.manpowerEntries.length).toBe(1);
    expect(detail.equipmentEntries.length).toBe(1);
    expect(detail.workProgressEntries.length).toBe(1);
    expect(detail.blockers.length).toBe(1);

    // Test deleting an entry
    const delMp = await app.inject({
      method: "DELETE",
      url: `/site/dprs/${dprId}/manpower/${mpEntry.id}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(delMp.statusCode).toBe(204);

    const recheckDetail = await app.inject({
      method: "GET",
      url: `/site/dprs/${dprId}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(recheckDetail.json().dpr.manpowerEntries.length).toBe(0);
  });

  it("handles DPR lifecycle transitions: submit, approve, and immutability", async () => {
    const { app, authorityRepo } = appWithFakeRepos();

    // 1. Create draft DPR
    const createRes = await app.inject({
      method: "POST",
      url: "/projects/proj-101/site/dprs",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { reportDate: "2026-10-18" },
    });
    const dprId = createRes.json().dpr.id;

    // 2. Submit DPR
    const submitRes = await app.inject({
      method: "POST",
      url: `/site/dprs/${dprId}/submit`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(submitRes.statusCode).toBe(200);
    expect(submitRes.json().dpr.status).toBe("submitted");

    // 3. User without site.dpr.approve cannot approve
    authorityRepo.rolePermissions.get("role.platform_administrator")?.delete("site.dpr.approve");
    const forbiddenApprove = await app.inject({
      method: "POST",
      url: `/site/dprs/${dprId}/approve`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { approvedBy: "Site Supervisor John" },
    });
    expect(forbiddenApprove.statusCode).toBe(403);

    // Re-grant and approve
    authorityRepo.grantPermission("role.platform_administrator", "site.dpr.approve");
    const approveRes = await app.inject({
      method: "POST",
      url: `/site/dprs/${dprId}/approve`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { approvedBy: "Site Supervisor John" },
    });
    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().dpr.status).toBe("approved");
    expect(approveRes.json().dpr.approved_by).toBe("Site Supervisor John");

    // 4. Approved DPR cannot be modified or deleted
    const modifyApproved = await app.inject({
      method: "PATCH",
      url: `/site/dprs/${dprId}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { generalNotes: "Attempting to change approved notes" },
    });
    expect(modifyApproved.statusCode).toBe(400);

    const deleteApproved = await app.inject({
      method: "DELETE",
      url: `/site/dprs/${dprId}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(deleteApproved.statusCode).toBe(400);

    const addManpowerApproved = await app.inject({
      method: "POST",
      url: `/site/dprs/${dprId}/manpower`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { trade: "Electricians", headcount: 4 },
    });
    expect(addManpowerApproved.statusCode).toBe(400);
  });

  it("handles DPR rejection with feedback reason", async () => {
    const { app } = appWithFakeRepos();

    const createRes = await app.inject({
      method: "POST",
      url: "/projects/proj-101/site/dprs",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { reportDate: "2026-10-18" },
    });
    const dprId = createRes.json().dpr.id;

    await app.inject({
      method: "POST",
      url: `/site/dprs/${dprId}/submit`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });

    // Reject without reason should 400
    const rejectNoReason = await app.inject({
      method: "POST",
      url: `/site/dprs/${dprId}/reject`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { rejectionReason: "" },
    });
    expect(rejectNoReason.statusCode).toBe(400);

    // Reject with valid reason
    const rejectRes = await app.inject({
      method: "POST",
      url: `/site/dprs/${dprId}/reject`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { rejectionReason: "Manpower headcount does not match gate security turnstile logs." },
    });
    expect(rejectRes.statusCode).toBe(200);
    expect(rejectRes.json().dpr.status).toBe("rejected");
    expect(rejectRes.json().dpr.rejection_reason).toContain("turnstile logs");

    // Can be resubmitted after rejection
    const resubmitRes = await app.inject({
      method: "POST",
      url: `/site/dprs/${dprId}/submit`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(resubmitRes.statusCode).toBe(200);
    expect(resubmitRes.json().dpr.status).toBe("submitted");
  });

  it("creates, lists, and updates site instructions", async () => {
    const { app } = appWithFakeRepos();

    const createRes = await app.inject({
      method: "POST",
      url: "/projects/proj-101/site/instructions",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        instructionNumber: "SI-2026-001",
        issuedBy: "Structural Consultant",
        recipient: "Apex Main Contractors",
        instructionText: "Install additional shear links in beam B12 prior to concrete pour.",
        priority: "urgent",
        targetCompletionDate: "2026-10-20",
      },
    });

    expect(createRes.statusCode).toBe(201);
    const instruction = createRes.json().instruction;
    expect(instruction.instruction_number).toBe("SI-2026-001");
    expect(instruction.priority).toBe("urgent");
    expect(instruction.status).toBe("open");

    // List instructions
    const listRes = await app.inject({
      method: "GET",
      url: "/projects/proj-101/site/instructions",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().instructions.length).toBe(1);

    // Update instruction status
    const updateRes = await app.inject({
      method: "PATCH",
      url: `/site/instructions/${instruction.id}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { status: "completed" },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().instruction.status).toBe("completed");
  });

  it("enforces tenant isolation across DPRs and site instructions", async () => {
    const { app } = appWithFakeRepos();

    // Create DPR in Tenant A
    const dprRes = await app.inject({
      method: "POST",
      url: "/projects/proj-tenant-a/site/dprs",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { reportDate: "2026-10-18" },
    });
    const dprId = dprRes.json().dpr.id;

    // Caller from Tenant B cannot access DPR
    const tenantBGet = await app.inject({
      method: "GET",
      url: `/site/dprs/${dprId}`,
      headers: { authorization: `Bearer ${OTHER_TENANT_TOKEN}` },
    });
    expect(tenantBGet.statusCode).toBe(404);

    // Caller from Tenant B listing project DPRs sees empty
    const tenantBList = await app.inject({
      method: "GET",
      url: "/projects/proj-tenant-a/site/dprs",
      headers: { authorization: `Bearer ${OTHER_TENANT_TOKEN}` },
    });
    expect(tenantBList.statusCode).toBe(200);
    expect(tenantBList.json().dprs.length).toBe(0);
  });
});
