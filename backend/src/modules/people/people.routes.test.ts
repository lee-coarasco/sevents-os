import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakePeopleRepository } from "../../test/fakePeopleRepository.js";

describe("M24: People, Recruitment & Performance routes", () => {
  let app: FastifyInstance;
  let authRepo: FakeAuthorityRepository;
  let peopleRepo: FakePeopleRepository;

  const tenantA = "tenant-a-111";
  const userA = "user-a-111";
  const tokenA = "token-a-valid";

  const tenantB = "tenant-b-222";
  const userB = "user-b-222";
  const tokenB = "token-b-valid";

  const permissions = [
    "people.manpower.manage",
    "people.manpower.approve",
    "people.recruitment.manage",
    "people.competency.manage",
    "people.appraisal.manage",
  ];

  beforeEach(async () => {
    authRepo = new FakeAuthorityRepository();
    peopleRepo = new FakePeopleRepository();

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
    peopleRepo.addSession(tokenA, userA, tenantA);

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
    peopleRepo.addSession(tokenB, userB, tenantB);

    app = buildApp({
      getAuthorityRepository: () => authRepo,
      getPeopleRepository: () => peopleRepo,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("creates and approves a manpower mobilization request with tenant isolation", async () => {
    // 1. Create manpower request
    const createRes = await app.inject({
      method: "POST",
      url: "/people/manpower-requests",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        project_id: "proj-skyline",
        request_number: "MPR-2026-001",
        role_title: "Senior Site Structural Engineer",
        quantity_required: 2,
        skill_level: "senior",
        required_date: "2026-11-01",
        notes: "Needed for foundation casting phase",
      },
    });

    expect(createRes.statusCode).toBe(201);
    const mprId = createRes.json().request.id;
    expect(createRes.json().request.status).toBe("draft");
    expect(createRes.json().request.quantity_required).toBe(2);

    // Tenant A sees it
    const listA = await app.inject({
      method: "GET",
      url: "/people/manpower-requests",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(listA.statusCode).toBe(200);
    expect(listA.json().requests).toHaveLength(1);

    // Tenant B sees nothing
    const listB = await app.inject({
      method: "GET",
      url: "/people/manpower-requests",
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(listB.statusCode).toBe(200);
    expect(listB.json().requests).toHaveLength(0);

    // 2. Approve manpower request
    const approveRes = await app.inject({
      method: "POST",
      url: `/people/manpower-requests/${mprId}/approve`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { approved_by: userA },
    });
    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().request.status).toBe("approved");
    expect(approveRes.json().request.approved_by).toBe(userA);
  });

  it("manages recruitment candidate pipeline and stages", async () => {
    // 1. Create candidate
    const createRes = await app.inject({
      method: "POST",
      url: "/people/candidates",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        candidate_name: "Tariq Mansoor",
        email: "tariq.mansoor@example.com",
        phone: "+971 50 123 4567",
        position_applied: "Senior Site Structural Engineer",
        current_company: "Arabtec Construction",
        years_experience: 8.5,
        rating: 4,
      },
    });

    expect(createRes.statusCode).toBe(201);
    const candidateId = createRes.json().candidate.id;
    expect(createRes.json().candidate.stage).toBe("applied");

    // 2. Advance to interview
    const stageRes = await app.inject({
      method: "POST",
      url: `/people/candidates/${candidateId}/stage`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { stage: "interview", rating: 5, notes: "Excellent technical interview" },
    });
    expect(stageRes.statusCode).toBe(200);
    expect(stageRes.json().candidate.stage).toBe("interview");
    expect(stageRes.json().candidate.rating).toBe(5);

    // 3. List candidates
    const listRes = await app.inject({
      method: "GET",
      url: "/people/candidates",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().candidates).toHaveLength(1);
    expect(listRes.json().candidates[0].candidate_name).toBe("Tariq Mansoor");
  });

  it("evaluates site competency certificates with automatic validity calculation", async () => {
    const today = new Date();
    const expiredDate = new Date(today.getTime() - 10 * 86400000).toISOString().split("T")[0]!;
    const expiringSoonDate = new Date(today.getTime() + 15 * 86400000).toISOString().split("T")[0]!;
    const validDate = new Date(today.getTime() + 180 * 86400000).toISOString().split("T")[0]!;

    // 1. Expired cert
    const expRes = await app.inject({
      method: "POST",
      url: "/people/competencies",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        employee_name: "Ahmed Al-Hashimi",
        trade: "crane_operator",
        certification_name: "Tower Crane Operator Level 3",
        certifying_body: "Dubai Municipality / DAC",
        issue_date: "2024-01-01",
        expiry_date: expiredDate,
      },
    });
    expect(expRes.statusCode).toBe(201);
    expect(expRes.json().competency.status).toBe("expired");

    // 2. Expiring soon cert (within 30 days)
    const soonRes = await app.inject({
      method: "POST",
      url: "/people/competencies",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        employee_name: "Ramesh Kumar",
        trade: "scaffolder",
        certification_name: "Working at Height & Fall Arrest",
        certifying_body: "PASMA / IPAF",
        issue_date: "2024-05-01",
        expiry_date: expiringSoonDate,
      },
    });
    expect(soonRes.statusCode).toBe(201);
    expect(soonRes.json().competency.status).toBe("expiring_soon");

    // 3. Valid cert
    const validRes = await app.inject({
      method: "POST",
      url: "/people/competencies",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        employee_name: "Carlos Rivera",
        trade: "safety_marshall",
        certification_name: "NEBOSH International General Certificate",
        certifying_body: "NEBOSH UK",
        issue_date: "2025-01-01",
        expiry_date: validDate,
      },
    });
    expect(validRes.statusCode).toBe(201);
    expect(validRes.json().competency.status).toBe("valid");

    // 4. List competencies
    const listRes = await app.inject({
      method: "GET",
      url: "/people/competencies",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().competencies).toHaveLength(3);
  });

  it("creates and completes employee performance appraisals", async () => {
    // 1. Create appraisal
    const createRes = await app.inject({
      method: "POST",
      url: "/people/appraisals",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        employee_name: "Fatima Al-Nuaimi",
        review_period: "2026-H1",
        appraiser_name: "Chief Human Resources Officer",
        score: 4.8,
        strengths: "Exceptional site safety leadership, zero lost time incidents",
        growth_areas: "Cross-training on advanced MEP systems",
        goals: "Obtain Lead Auditor ISO 45001 certification",
      },
    });

    expect(createRes.statusCode).toBe(201);
    const appraisalId = createRes.json().appraisal.id;
    expect(createRes.json().appraisal.status).toBe("draft");

    // 2. Complete appraisal
    const completeRes = await app.inject({
      method: "POST",
      url: `/people/appraisals/${appraisalId}/complete`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.json().appraisal.status).toBe("completed");

    // 3. List appraisals
    const listRes = await app.inject({
      method: "GET",
      url: "/people/appraisals",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().appraisals).toHaveLength(1);
    expect(listRes.json().appraisals[0].score).toBe(4.8);
  });
});
