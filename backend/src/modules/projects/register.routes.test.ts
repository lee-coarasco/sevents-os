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

describe("Register routes (ticket 0076, M09d)", () => {
  it("POST .../register: 201 with tenancy.project.manage, 403 without it, 400 without kind/title", async () => {
    const { app } = appWithFakeRepos();
    const projectId = await createProjectHttp(app);

    const denied = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/register`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { kind: "issue", title: "Site access blocked" },
    });
    expect(denied.statusCode).toBe(403);

    const missingFields = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/register`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { kind: "issue" },
    });
    expect(missingFields.statusCode).toBe(400);

    const created = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/register`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { kind: "issue", title: "Site access blocked" },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().entry.status).toBe("open");
  });

  it("GET .../register filters by kind and status", async () => {
    const { app } = appWithFakeRepos();
    const projectId = await createProjectHttp(app);

    await app.inject({
      method: "POST",
      url: `/projects/${projectId}/register`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { kind: "issue", title: "Site access blocked" },
    });
    const riskResponse = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/register`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { kind: "risk", title: "Weather delay", likelihood: "medium", impact: "high" },
    });
    const riskId = riskResponse.json().entry.id;

    await app.inject({
      method: "PATCH",
      url: `/projects/${projectId}/register/${riskId}`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { status: "resolved", resolutionNote: "Mitigated with schedule buffer" },
    });

    const all = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/register`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });
    expect(all.json().entries).toHaveLength(2);

    const risksOnly = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/register?kind=risk`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });
    expect(risksOnly.json().entries).toHaveLength(1);
    expect(risksOnly.json().entries[0].kind).toBe("risk");

    const resolvedOnly = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/register?status=resolved`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
    });
    expect(resolvedOnly.json().entries).toHaveLength(1);
    expect(resolvedOnly.json().entries[0].resolution_note).toBe("Mitigated with schedule buffer");
  });

  it("PATCH .../register/:entryId: 403 without tenancy.project.manage, 404 for an unknown entry", async () => {
    const { app } = appWithFakeRepos();
    const projectId = await createProjectHttp(app);
    const created = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/register`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { kind: "decision", title: "Use precast panels" },
    });
    const entryId = created.json().entry.id;

    const denied = await app.inject({
      method: "PATCH",
      url: `/projects/${projectId}/register/${entryId}`,
      headers: { authorization: `Bearer ${PLAIN_TOKEN}` },
      payload: { status: "closed" },
    });
    expect(denied.statusCode).toBe(403);

    const notFound = await app.inject({
      method: "PATCH",
      url: `/projects/${projectId}/register/does-not-exist`,
      headers: { authorization: `Bearer ${MANAGER_TOKEN}` },
      payload: { status: "closed" },
    });
    expect(notFound.statusCode).toBe(404);
  });
});
