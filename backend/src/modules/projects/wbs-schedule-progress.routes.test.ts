import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeProjectsRepository } from "../../test/fakeProjectsRepository.js";

const MANAGER_TOKEN = "manager-token";
const MANAGER_USER = "manager-user";
const RECORDER_TOKEN = "recorder-token";
const RECORDER_USER = "recorder-user";
const PLAIN_TOKEN = "plain-token";
const PLAIN_USER = "plain-user";
const TENANT_A = "tenant-a";

function roleAssignment(id: string, userId: string, roleId: string) {
  return {
    id,
    tenant_id: TENANT_A,
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
  authorityRepo.addSession(RECORDER_TOKEN, RECORDER_USER, TENANT_A);
  authorityRepo.addSession(PLAIN_TOKEN, PLAIN_USER, TENANT_A);
  authorityRepo.roleAssignments.set("seed-manager", roleAssignment("seed-manager", MANAGER_USER, "role.manager"));
  authorityRepo.roleAssignments.set(
    "seed-recorder",
    roleAssignment("seed-recorder", RECORDER_USER, "role.recorder"),
  );
  authorityRepo.grantPermission("role.manager", "tenancy.project.manage");
  authorityRepo.grantPermission("role.recorder", "project.progress.record");

  const projectsRepo = new FakeProjectsRepository();
  projectsRepo.addSession(MANAGER_TOKEN, TENANT_A);
  projectsRepo.addSession(RECORDER_TOKEN, TENANT_A);
  projectsRepo.addSession(PLAIN_TOKEN, TENANT_A);

  const app = buildApp({
    getAuthorityRepository: () => authorityRepo,
    getProjectsRepository: () => projectsRepo,
  });
  return { app };
}

async function createProjectAndActivity(app: ReturnType<typeof appWithFakeRepos>["app"]) {
  const project = await app.inject({
    method: "POST",
    url: "/projects",
    headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    payload: { companyId: "company-1", name: "A Tower" },
  });
  const projectId = project.json().project.id;

  const activity = await app.inject({
    method: "POST",
    url: `/projects/${projectId}/schedule-activities`,
    headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    payload: { name: "Excavation" },
  });
  return { projectId, activityId: activity.json().scheduleActivity.id };
}

describe("WBS/milestone/schedule-activity routes", () => {
  it("201s creating a WBS node with tenancy.project.manage, 403s without it", async () => {
    const { app } = appWithFakeRepos();
    const project = await app.inject({
      method: "POST",
      url: "/projects",
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { companyId: "company-1", name: "A Tower" },
    });
    const projectId = project.json().project.id;

    const ok = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/wbs-nodes`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { code: "1", name: "Substructure" },
    });
    expect(ok.statusCode).toBe(201);

    const forbidden = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/wbs-nodes`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { code: "2", name: "Should not be created" },
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it("milestone CRUD round-trip over HTTP", async () => {
    const { app } = appWithFakeRepos();
    const project = await app.inject({
      method: "POST",
      url: "/projects",
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { companyId: "company-1", name: "A Tower" },
    });
    const projectId = project.json().project.id;

    const created = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/milestones`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { name: "Foundation complete", targetDate: "2026-12-01" },
    });
    expect(created.statusCode).toBe(201);
    const milestoneId = created.json().milestone.id;

    const patched = await app.inject({
      method: "PATCH",
      url: `/milestones/${milestoneId}`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { status: "achieved", actualDate: "2026-11-28" },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().milestone.status).toBe("achieved");

    const listed = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/milestones`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });
    expect(listed.json().milestones).toHaveLength(1);
  });
});

describe("schedule activity dependency routes", () => {
  it("adds, lists and removes a dependency edge over HTTP", async () => {
    const { app } = appWithFakeRepos();
    const { projectId, activityId: upstream } = await createProjectAndActivity(app);
    const downstream = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/schedule-activities`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { name: "Foundation pour" },
    });
    const downstreamId = downstream.json().scheduleActivity.id;

    const added = await app.inject({
      method: "POST",
      url: `/schedule-activities/${downstreamId}/dependencies`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { dependsOnActivityId: upstream },
    });
    expect(added.statusCode).toBe(201);

    const listed = await app.inject({
      method: "GET",
      url: `/schedule-activities/${downstreamId}/dependencies`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });
    expect(listed.json().dependencies).toHaveLength(1);

    const removed = await app.inject({
      method: "DELETE",
      url: `/schedule-activities/${downstreamId}/dependencies/${upstream}`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });
    expect(removed.statusCode).toBe(200);
  });
});

describe("progress entry routes — project.progress.record is a distinct permission from tenancy.project.manage", () => {
  it("201s for a caller with project.progress.record even without tenancy.project.manage", async () => {
    const { app } = appWithFakeRepos();
    const { activityId } = await createProjectAndActivity(app);

    const response = await app.inject({
      method: "POST",
      url: `/schedule-activities/${activityId}/progress`,
      headers: { authorization: `Bearer ${RECORDER_TOKEN}` },
      payload: { percentComplete: 25, note: "rebar fixing" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().progressEntry.percent_complete).toBe(25);
  });

  it("403s for a caller with only tenancy.project.manage (project.progress.record is a distinct permission)", async () => {
    const { app } = appWithFakeRepos();
    const { activityId } = await createProjectAndActivity(app);

    const response = await app.inject({
      method: "POST",
      url: `/schedule-activities/${activityId}/progress`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { percentComplete: 25 },
    });

    expect(response.statusCode).toBe(403);
  });

  it("accumulates multiple progress entries rather than overwriting", async () => {
    const { app } = appWithFakeRepos();
    const { activityId } = await createProjectAndActivity(app);

    await app.inject({
      method: "POST",
      url: `/schedule-activities/${activityId}/progress`,
      headers: { authorization: `Bearer ${RECORDER_TOKEN}` },
      payload: { percentComplete: 20 },
    });
    await app.inject({
      method: "POST",
      url: `/schedule-activities/${activityId}/progress`,
      headers: { authorization: `Bearer ${RECORDER_TOKEN}` },
      payload: { percentComplete: 55 },
    });

    const listed = await app.inject({
      method: "GET",
      url: `/schedule-activities/${activityId}/progress`,
      headers: { authorization: `Bearer ${RECORDER_TOKEN}` },
    });

    expect(listed.json().progressEntries).toHaveLength(2);
  });
});
