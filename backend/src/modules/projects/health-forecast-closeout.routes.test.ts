import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeProjectsRepository } from "../../test/fakeProjectsRepository.js";

const MANAGER_TOKEN = "manager-token";
const MANAGER_USER = "manager-user";
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
  authorityRepo.addSession(PLAIN_TOKEN, PLAIN_USER, TENANT_A);
  authorityRepo.roleAssignments.set("seed-manager", roleAssignment("seed-manager", MANAGER_USER, "role.manager"));
  authorityRepo.roleAssignments.set("seed-plain", roleAssignment("seed-plain", PLAIN_USER, "role.plain"));
  authorityRepo.grantPermission("role.manager", "tenancy.project.manage");
  authorityRepo.grantPermission("role.manager", "project.closeout.manage");
  authorityRepo.grantPermission("role.manager", "project.baseline.manage");

  const projectsRepo = new FakeProjectsRepository();
  projectsRepo.addSession(MANAGER_TOKEN, TENANT_A);
  projectsRepo.addSession(PLAIN_TOKEN, TENANT_A);

  const app = buildApp({
    getAuthorityRepository: () => authorityRepo,
    getProjectsRepository: () => projectsRepo,
  });
  return { app };
}

async function createProjectHttp(app: ReturnType<typeof appWithFakeRepos>["app"]) {
  const project = await app.inject({
    method: "POST",
    url: "/projects",
    headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    payload: { companyId: "company-1", name: "A Tower" },
  });
  return project.json().project.id as string;
}

describe("Health, forecast & closeout routes (ticket 0077, M09e)", () => {
  it("GET .../health: 403 without tenancy.project.manage, 200 with factors + summary + computed_at and no bare score", async () => {
    const { app } = appWithFakeRepos();
    const projectId = await createProjectHttp(app);

    const denied = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/health`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
    });
    expect(denied.statusCode).toBe(403);

    const ok = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/health`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });
    expect(ok.statusCode).toBe(200);
    const { snapshot } = ok.json();
    expect(snapshot.factors).toBeTypeOf("object");
    expect(snapshot.summary).toBeTypeOf("string");
    expect(snapshot.computed_at).toBeTypeOf("string");
    expect(snapshot).not.toHaveProperty("score");
  });

  it("GET .../forecast: baseline and forecast are distinct top-level fields, never collapsed into one value", async () => {
    const { app } = appWithFakeRepos();
    const projectId = await createProjectHttp(app);

    await app.inject({
      method: "POST",
      url: `/projects/${projectId}/schedule-activities`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { name: "Foundation works", plannedEnd: "2026-06-01" },
    });
    await app.inject({
      method: "POST",
      url: `/projects/${projectId}/baselines`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });

    const response = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/forecast`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    const { forecast } = response.json();
    expect(forecast.baseline.plannedCompletionDate).toBe("2026-06-01");
    expect(forecast.forecast.projectedCompletionDate).toBe("2026-06-01");
    expect(Object.keys(forecast).sort()).toEqual(["baseline", "forecast"]);
  });

  it("GET .../closeout lists exactly the four fixed items; POST .../closeout/:itemKey/complete requires project.closeout.manage and rejects an unknown key", async () => {
    const { app } = appWithFakeRepos();
    const projectId = await createProjectHttp(app);

    const list = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/closeout`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().items).toHaveLength(4);
    expect(list.json().items.every((i: { status: string }) => i.status === "pending")).toBe(true);

    const deniedComplete = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/closeout/final_account/complete`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
    });
    expect(deniedComplete.statusCode).toBe(403);

    const badKey = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/closeout/not_a_real_item/complete`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });
    expect(badKey.statusCode).toBe(400);

    const completed = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/closeout/final_account/complete`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json().item.status).toBe("complete");
    expect(completed.json().item.completed_by).toBe(MANAGER_USER);

    const projectAfter = await app.inject({
      method: "GET",
      url: `/projects/${projectId}`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });
    expect(projectAfter.json().project.status).toBe("active");
  });

  it("GET .../closeout: 404 for a project that does not exist in the caller's tenant", async () => {
    const { app } = appWithFakeRepos();
    const response = await app.inject({
      method: "GET",
      url: "/projects/does-not-exist/closeout",
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });
    expect(response.statusCode).toBe(404);
  });
});
