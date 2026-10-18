import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeSafetyRepository } from "../../test/fakeSafetyRepository.js";

describe("M20: Safety, Incidents & Compliance routes", () => {
  let app: FastifyInstance;
  let authRepo: FakeAuthorityRepository;
  let safetyRepo: FakeSafetyRepository;

  const tenantA = "tenant-a-111";
  const userA = "user-a-111";
  const tokenA = "token-a-valid";

  const tenantB = "tenant-b-222";
  const userB = "user-b-222";
  const tokenB = "token-b-valid";

  const permissions = [
    "safety.ptw.manage",
    "safety.ptw.approve",
    "safety.incident.manage",
    "safety.incident.investigate",
    "safety.hazard.manage",
    "safety.tbt.manage",
  ];

  beforeEach(async () => {
    authRepo = new FakeAuthorityRepository();
    safetyRepo = new FakeSafetyRepository();

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
    safetyRepo.addSession(tokenA, userA, tenantA);

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
    safetyRepo.addSession(tokenB, userB, tenantB);

    app = buildApp({
      getAuthorityRepository: () => authRepo,
      getSafetyRepository: () => safetyRepo,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("manages Permits to Work (PTW) lifecycle and human-controlled authorization", async () => {
    // 1. Create PTW
    const createRes = await app.inject({
      method: "POST",
      url: "/projects/proj-101/safety/permits",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        permitNumber: "PTW-HW-001",
        permitType: "hot_work",
        title: "Structural Steel Welding on Level 12 Transfer Slab",
        locationOrGrid: "Tower A, Grid E4-E8 Level 12",
        startTime: "2026-10-19T08:00:00Z",
        expiryTime: "2026-10-19T18:00:00Z",
        contractorName: "Apex Steel Fabricators",
        supervisorName: "Foreman John",
        precautionsTaken: "Fire blanket deployed, 2x 9kg CO2 fire extinguishers on stand, fire watch posted",
        gasTestRequired: true,
        gasTestResults: "LEL 0%, O2 20.9%, CO 0ppm",
      },
    });

    expect(createRes.statusCode).toBe(201);
    const ptw = createRes.json().permit;
    expect(ptw.permit_number).toBe("PTW-HW-001");
    expect(ptw.status).toBe("pending_approval");
    expect(ptw.gas_test_required).toBe(true);

    // 2. Authorize PTW by Safety Officer
    const authRes = await app.inject({
      method: "POST",
      url: `/safety/permits/${ptw.id}/authorize`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        status: "active",
        safetyOfficerName: "QHSE Manager Salim",
        precautionsTaken: "Verified continuous atmospheric monitoring required",
      },
    });

    expect(authRes.statusCode).toBe(200);
    expect(authRes.json().permit.status).toBe("active");
    expect(authRes.json().permit.safety_officer_name).toBe("QHSE Manager Salim");
  });

  it("manages Incident lifecycle: reporting, root cause investigation, and closure", async () => {
    // 1. Report Incident
    const reportRes = await app.inject({
      method: "POST",
      url: "/projects/proj-101/safety/incidents",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        incidentNumber: "INC-2026-004",
        incidentType: "lost_time_injury",
        severity: "major",
        locationOrGrid: "Basement 2 Laydown Area",
        description: "Rigger slipped during beam offloading and sustained right ankle fracture",
        injuredPersonName: "David Miller",
        injuryDetails: "Right distal fibula fracture",
        lostWorkdays: 14,
        immediateActionTaken: "First aid administered, ambulance dispatched to City Hospital, crane operations paused",
        reportedBy: "Site Supervisor Kareem",
      },
    });

    expect(reportRes.statusCode).toBe(201);
    const inc = reportRes.json().incident;
    expect(inc.incident_number).toBe("INC-2026-004");
    expect(inc.status).toBe("reported");
    expect(inc.lost_workdays).toBe(14);

    // 2. Investigate & Assign CAPA
    const investRes = await app.inject({
      method: "POST",
      url: `/safety/incidents/${inc.id}/investigate`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        investigatedBy: "Corporate HSE Lead",
        rootCauseAnalysis: "Muddy terrain after dewatering pump overflow; inadequate non-slip timber walkways",
        correctivePreventiveAction: "Install anti-skid duckboards and re-route discharge hose away from active laydown",
        lostWorkdays: 21,
      },
    });

    expect(investRes.statusCode).toBe(200);
    expect(investRes.json().incident.status).toBe("capa_assigned");
    expect(investRes.json().incident.lost_workdays).toBe(21);

    // 3. Formally Close Incident
    const closeRes = await app.inject({
      method: "POST",
      url: `/safety/incidents/${inc.id}/close`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        closedBy: "Project Director & HSE Committee",
      },
    });

    expect(closeRes.statusCode).toBe(200);
    expect(closeRes.json().incident.status).toBe("closed");
    expect(closeRes.json().incident.closed_by).toBe("Project Director & HSE Committee");
  });

  it("handles Hazard observation with automatic Stop-Work directive for imminent danger", async () => {
    const hazRes = await app.inject({
      method: "POST",
      url: "/projects/proj-101/safety/hazards",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        observationNumber: "HAZ-089",
        observationType: "unsafe_condition",
        riskLevel: "imminent_danger",
        locationOrGrid: "Core Wall Scaffold Level 15",
        description: "Scaffold toe-boards missing and loose handrails over public accessway below",
        actionRequired: "Evacuate platform immediately and install double guardrails with netting",
        reportedBy: "HSE Inspector Tariq",
        targetRectificationDate: "2026-10-18",
      },
    });

    expect(hazRes.statusCode).toBe(201);
    const hazard = hazRes.json().hazard;
    expect(hazard.observation_number).toBe("HAZ-089");
    expect(hazard.stop_work_issued).toBe(true);
    expect(hazard.status).toBe("open");

    // Rectify hazard
    const rectRes = await app.inject({
      method: "POST",
      url: `/safety/hazards/${hazard.id}/rectify`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        rectificationEvidence: "Double guardrails and safety debris netting installed and inspected by scaffold supervisor",
        status: "rectified",
      },
    });

    expect(rectRes.statusCode).toBe(200);
    expect(rectRes.json().hazard.status).toBe("rectified");
  });

  it("records Toolbox Talks (TBT) and tracks gang attendees", async () => {
    const tbtRes = await app.inject({
      method: "POST",
      url: "/projects/proj-101/safety/toolbox-talks",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        tbtNumber: "TBT-2026-031",
        topic: "Working at Height and 100% Tie-Off Harness Compliance",
        conductedBy: "Safety Officer Bilal",
        tradeDiscipline: "structural",
        attendeeCount: 42,
        keyPointsDiscussed: "Pre-use harness inspection, anchor point ratings (5,000 lbs), dual lanyard usage",
      },
    });

    expect(tbtRes.statusCode).toBe(201);
    const tbt = tbtRes.json().toolboxTalk;
    expect(tbt.tbt_number).toBe("TBT-2026-031");
    expect(tbt.attendee_count).toBe(42);

    const listRes = await app.inject({
      method: "GET",
      url: "/projects/proj-101/safety/toolbox-talks",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().toolboxTalks.length).toBe(1);
  });

  it("enforces multi-tenant isolation across Safety data", async () => {
    // Tenant A creates PTW
    const createRes = await app.inject({
      method: "POST",
      url: "/projects/proj-101/safety/permits",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        permitNumber: "PTW-TENANT-A",
        permitType: "confined_space",
        title: "Stormwater Tank Entry",
        locationOrGrid: "Tank Room B3",
        startTime: "2026-10-19T08:00:00Z",
        expiryTime: "2026-10-19T14:00:00Z",
        contractorName: "Deep Utilities",
        supervisorName: "Samir",
      },
    });
    const ptwA = createRes.json().permit;

    // Tenant B cannot authorize Tenant A's PTW
    const authRes = await app.inject({
      method: "POST",
      url: `/safety/permits/${ptwA.id}/authorize`,
      headers: { authorization: `Bearer ${tokenB}` },
      payload: {
        status: "active",
        safetyOfficerName: "Hacker",
      },
    });
    expect(authRes.statusCode).toBe(400);

    // Tenant B listing permits sees 0
    const listRes = await app.inject({
      method: "GET",
      url: "/projects/proj-101/safety/permits",
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().permits.length).toBe(0);
  });
});
