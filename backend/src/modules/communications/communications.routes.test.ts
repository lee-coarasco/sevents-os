import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeCommunicationsRepository } from "../../test/fakeCommunicationsRepository.js";

describe("M26: Customer / Stakeholder Communications routes", () => {
  let app: FastifyInstance;
  let authRepo: FakeAuthorityRepository;
  let commsRepo: FakeCommunicationsRepository;

  const tenantA = "tenant-a-111";
  const userA = "user-a-111";
  const tokenA = "token-a-valid";

  const tenantB = "tenant-b-222";
  const userB = "user-b-222";
  const tokenB = "token-b-valid";

  const permissions = [
    "communications.stakeholder.manage",
    "communications.log.manage",
    "communications.minutes.manage",
    "communications.complaint.manage",
    "communications.complaint.resolve",
  ];

  beforeEach(async () => {
    authRepo = new FakeAuthorityRepository();
    commsRepo = new FakeCommunicationsRepository();

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
    commsRepo.addSession(tokenA, userA, tenantA);

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
    commsRepo.addSession(tokenB, userB, tenantB);

    app = buildApp({
      getAuthorityRepository: () => authRepo,
      getCommunicationsRepository: () => commsRepo,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  // 1. Stakeholders Tests
  it("creates, lists, and deletes stakeholders within tenant boundary", async () => {
    const resCreate = await app.inject({
      method: "POST",
      url: "/communications/stakeholders",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        name: "Engr. Al Mansoori",
        organization: "Apex Master Developers",
        stakeholder_type: "client",
        role_title: "Project Director",
        email: "al.mansoori@apex.com",
        phone: "+971 50 123 4567",
        engagement_level: "high",
        notes: "Primary client signatory",
      },
    });

    expect(resCreate.statusCode).toBe(201);
    const body = resCreate.json();
    expect(body.stakeholder.name).toBe("Engr. Al Mansoori");
    expect(body.stakeholder.tenant_id).toBe(tenantA);

    // List in Tenant A
    const resListA = await app.inject({
      method: "GET",
      url: "/communications/stakeholders",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(resListA.statusCode).toBe(200);
    expect(resListA.json().stakeholders).toHaveLength(1);

    // Tenant B should not see Tenant A stakeholder
    const resListB = await app.inject({
      method: "GET",
      url: "/communications/stakeholders",
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(resListB.statusCode).toBe(200);
    expect(resListB.json().stakeholders).toHaveLength(0);

    // Delete in Tenant A
    const resDel = await app.inject({
      method: "DELETE",
      url: `/communications/stakeholders/${body.stakeholder.id}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(resDel.statusCode).toBe(200);
    expect(resDel.json().success).toBe(true);
  });

  // 2. Communication Logs Tests
  it("creates formal communication log and updates its delivery status", async () => {
    const resCreate = await app.inject({
      method: "POST",
      url: "/communications/logs",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        reference_number: "LTR-2026-0042",
        channel: "letter",
        direction: "outbound",
        sender_name: "Contractor Project Lead",
        recipient_name: "Supervising Consultant",
        subject: "Notice of Impending Site Inspection for Foundation Pour",
        summary: "Formal 48-hour notice issued per specification clause 4.2",
        requires_response: true,
        response_due_date: "2026-10-25",
        status: "draft",
      },
    });

    expect(resCreate.statusCode).toBe(201);
    const log = resCreate.json().log;
    expect(log.reference_number).toBe("LTR-2026-0042");
    expect(log.status).toBe("draft");

    // Update status to sent
    const resPatch = await app.inject({
      method: "PATCH",
      url: `/communications/logs/${log.id}/status`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { status: "sent" },
    });
    expect(resPatch.statusCode).toBe(200);
    expect(resPatch.json().log.status).toBe("sent");
  });

  // 3. Meeting Minutes & Action Items Tests
  it("records meeting minutes and updates action item status", async () => {
    const resCreate = await app.inject({
      method: "POST",
      url: "/communications/meeting-minutes",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        meeting_title: "Weekly Site Coordination Meeting #18",
        meeting_type: "site_coordination",
        meeting_date: "2026-10-18",
        location: "Site Office Conference Room A",
        attendees: ["John Doe (PM)", "Sara Smith (Consultant)", "Zack Lee (MEP)"],
        summary: "Reviewed structural steel deliveries and MEP clash coordination on Level 3.",
        action_items: [
          {
            task: "Submit revised MEP penetration drawings",
            assignee: "Zack Lee",
            due_date: "2026-10-22",
            status: "pending",
          },
        ],
        status: "published",
      },
    });

    expect(resCreate.statusCode).toBe(201);
    const minutes = resCreate.json().minutes;
    expect(minutes.meeting_title).toContain("Weekly Site Coordination");
    expect(minutes.action_items).toHaveLength(1);
    const actionId = minutes.action_items[0].id;

    // Toggle action item to completed
    const resActionPatch = await app.inject({
      method: "PATCH",
      url: `/communications/meeting-minutes/${minutes.id}/actions/${actionId}`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { status: "completed" },
    });
    expect(resActionPatch.statusCode).toBe(200);
    expect(resActionPatch.json().minutes.action_items[0].status).toBe("completed");
  });

  // 4. Client Complaints & Resolution Tests
  it("logs client complaint and resolves with corrective action plan", async () => {
    const resCreate = await app.inject({
      method: "POST",
      url: "/communications/complaints",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        client_name: "Apex Properties Group",
        contact_info: "director@apex.com",
        severity: "critical",
        category: "safety",
        description: "Dust suppression and perimeter hoarding issue along public walkway.",
        assigned_to: "HSE Lead Engineer",
      },
    });

    expect(resCreate.statusCode).toBe(201);
    const complaint = resCreate.json().complaint;
    expect(complaint.severity).toBe("critical");
    expect(complaint.status).toBe("received");

    // Resolve complaint
    const resResolve = await app.inject({
      method: "POST",
      url: `/communications/complaints/${complaint.id}/resolve`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        resolutionPlan: "Installed additional water mist cannons and reinforced boundary netting.",
      },
    });
    expect(resResolve.statusCode).toBe(200);
    const resolved = resResolve.json().complaint;
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolution_plan).toContain("water mist cannons");
    expect(resolved.resolved_at).toBeTruthy();
  });
});
