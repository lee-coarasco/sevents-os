import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeProjectsRepository } from "../../test/fakeProjectsRepository.js";

const MANAGER_TOKEN = "manager-token";
const MANAGER_USER = "manager-user";
const OTHER_TOKEN = "other-token";
const OTHER_USER = "other-user";
const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

function roleAssignment(id: string, userId: string, roleId: string, tenantId = TENANT_A) {
  return {
    id,
    tenant_id: tenantId,
    user_id: userId,
    role_id: roleId,
    department_id: null,
    valid_from: "2000-01-01T00:00:00.000Z",
    valid_to: null,
  };
}

function appWithFakeRepos() {
  const authorityRepo = new FakeAuthorityRepository();
  authorityRepo.addSession(MANAGER_TOKEN, MANAGER_USER, TENANT_A);
  authorityRepo.addSession(OTHER_TOKEN, OTHER_USER, TENANT_B);
  authorityRepo.roleAssignments.set("seed-manager", roleAssignment("seed-manager", MANAGER_USER, "role.manager", TENANT_A));
  authorityRepo.roleAssignments.set("seed-other", roleAssignment("seed-other", OTHER_USER, "role.manager", TENANT_B));
  authorityRepo.grantPermission("role.manager", "tenancy.project.manage");
  authorityRepo.grantPermission("role.manager", "project.progress.record");
  authorityRepo.grantPermission("role.manager", "project.baseline.manage");

  const projectsRepo = new FakeProjectsRepository();
  projectsRepo.addSession(MANAGER_TOKEN, TENANT_A);
  projectsRepo.addSession(OTHER_TOKEN, TENANT_B);

  const app = buildApp({
    getAuthorityRepository: () => authorityRepo,
    getProjectsRepository: () => projectsRepo,
  });
  return { app, projectsRepo };
}

describe("M18: Schedule, Progress & Resource Planning Routes", () => {
  it("computes Gantt schedule with critical path, total float, and baseline comparison", async () => {
    const { app } = appWithFakeRepos();

    // Create project
    const projRes = await app.inject({
      method: "POST",
      url: "/projects",
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { companyId: "c-1", name: "Metro Tower Project" },
    });
    const projectId = projRes.json().project.id;

    // Create 3 activities: Foundation -> Structure -> Fitout
    const a1Res = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/schedule-activities`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { name: "Foundation", plannedStart: "2026-11-01", plannedEnd: "2026-11-10" },
    });
    const act1 = a1Res.json().scheduleActivity;

    const a2Res = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/schedule-activities`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { name: "Structure", plannedStart: "2026-11-11", plannedEnd: "2026-11-25" },
    });
    const act2 = a2Res.json().scheduleActivity;

    const a3Res = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/schedule-activities`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { name: "Fitout", plannedStart: "2026-11-26", plannedEnd: "2026-12-10" },
    });
    const act3 = a3Res.json().scheduleActivity;

    // Add dependencies: act1 -> act2 -> act3
    await app.inject({
      method: "POST",
      url: `/schedule-activities/${act2.id}/dependencies`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { dependsOnActivityId: act1.id },
    });
    await app.inject({
      method: "POST",
      url: `/schedule-activities/${act3.id}/dependencies`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { dependsOnActivityId: act2.id },
    });

    // Record initial baseline
    await app.inject({
      method: "POST",
      url: `/projects/${projectId}/baselines`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });

    // Fetch Gantt
    const ganttRes = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/schedule/gantt`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });
    expect(ganttRes.statusCode).toBe(200);
    const schedule = ganttRes.json().schedule;
    expect(schedule.project_id).toBe(projectId);
    expect(schedule.total_activities).toBe(3);
    expect(schedule.baseline_version).toBe(1);
    expect(schedule.critical_path).toEqual([act1.id, act2.id, act3.id]);

    const gAct1 = schedule.activities.find((a: any) => a.id === act1.id);
    expect(gAct1).toBeDefined();
    expect(gAct1.is_critical).toBe(true);
    expect(gAct1.total_float_days).toBe(0);
    expect(gAct1.baseline_start).toBe("2026-11-01");
    expect(gAct1.baseline_end).toBe("2026-11-10");
  });

  it("creates, retrieves, and updates lookahead plans and activities", async () => {
    const { app } = appWithFakeRepos();

    const projRes = await app.inject({
      method: "POST",
      url: "/projects",
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { companyId: "c-1", name: "Lookahead Test Project" },
    });
    const projectId = projRes.json().project.id;

    // Create 2-week lookahead plan
    const planRes = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/lookahead-plans`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: {
        title: "Sprint 1 Site Works (2-Week Lookahead)",
        periodStart: "2026-11-01",
        periodEnd: "2026-11-14",
        timeframeWeeks: 2,
      },
    });
    expect(planRes.statusCode).toBe(201);
    const plan = planRes.json().lookaheadPlan;
    expect(plan.title).toBe("Sprint 1 Site Works (2-Week Lookahead)");
    expect(plan.timeframe_weeks).toBe(2);

    // List lookahead plans
    const listRes = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/lookahead-plans`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().lookaheadPlans).toHaveLength(1);

    // Add activity to lookahead plan
    const actRes = await app.inject({
      method: "POST",
      url: `/lookahead-plans/${plan.id}/activities`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: {
        customActivityName: "Site hoarding installation",
        plannedAction: "Erect boundary fences along north perimeter",
        targetDate: "2026-11-05",
      },
    });
    expect(actRes.statusCode).toBe(201);
    const act = actRes.json().lookaheadActivity;
    expect(act.status).toBe("planned");
    expect(act.planned_action).toBe("Erect boundary fences along north perimeter");

    // Fetch detail
    const detailRes = await app.inject({
      method: "GET",
      url: `/lookahead-plans/${plan.id}`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });
    expect(detailRes.statusCode).toBe(200);
    expect(detailRes.json().activities).toHaveLength(1);

    // Update activity status to in_progress
    const updateRes = await app.inject({
      method: "PATCH",
      url: `/lookahead-activities/${act.id}`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { status: "in_progress", notes: "Post holes dug" },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().lookaheadActivity.status).toBe("in_progress");
    expect(updateRes.json().lookaheadActivity.notes).toBe("Post holes dug");
  });

  it("logs schedule delays and aggregates schedule variance analysis", async () => {
    const { app } = appWithFakeRepos();

    const projRes = await app.inject({
      method: "POST",
      url: "/projects",
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { companyId: "c-1", name: "Variance Test Project" },
    });
    const projectId = projRes.json().project.id;

    const actRes = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/schedule-activities`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { name: "Excavation", plannedStart: "2026-11-01", plannedEnd: "2026-11-08" },
    });
    const activityId = actRes.json().scheduleActivity.id;

    // Log delay
    const delayRes = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/delays`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: {
        scheduleActivityId: activityId,
        delayDays: 5,
        reasonCategory: "weather",
        description: "Heavy rainfall flooded the pit for 4 days",
        mitigationPlan: "Deploy 2 additional sump pumps and work on Saturday",
      },
    });
    expect(delayRes.statusCode).toBe(201);
    expect(delayRes.json().delayRecord.delay_days).toBe(5);
    expect(delayRes.json().delayRecord.reason_category).toBe("weather");

    // List delays
    const listDelaysRes = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/delays`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });
    expect(listDelaysRes.statusCode).toBe(200);
    expect(listDelaysRes.json().delayRecords).toHaveLength(1);

    // Get schedule variance summary
    const varianceRes = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/schedule/variance`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });
    expect(varianceRes.statusCode).toBe(200);
    const variance = varianceRes.json().variance;
    expect(variance.total_delay_days).toBe(5);
    expect(variance.delayed_activities_count).toBe(1);
    expect(variance.delays_by_category.weather).toBe(5);
    expect(variance.delays_by_category.client).toBe(0);
  });

  it("enforces tenant isolation across schedule and lookahead operations", async () => {
    const { app } = appWithFakeRepos();

    // Tenant A creates project
    const projRes = await app.inject({
      method: "POST",
      url: "/projects",
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { companyId: "c-1", name: "Tenant A Project" },
    });
    const projectId = projRes.json().project.id;

    // Tenant B attempts to read Gantt of Tenant A
    const ganttRes = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/schedule/gantt`,
      headers: { authorization: `Bearer ${OTHER_TOKEN}` },
    });
    expect(ganttRes.statusCode).toBe(404);

    // Tenant B attempts to create lookahead in Tenant A's project
    const lookaheadRes = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/lookahead-plans`,
      headers: { authorization: `Bearer ${OTHER_TOKEN}` },
      payload: { title: "Illegal Plan", periodStart: "2026-11-01", periodEnd: "2026-11-14" },
    });
    expect(lookaheadRes.statusCode).toBe(404);
  });
});
