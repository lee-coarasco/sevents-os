import { beforeEach, describe, expect, it } from "vitest";
import { FakeProjectsRepository } from "../../test/fakeProjectsRepository.js";
import { NotFoundError, createProject, getProject, listProjects, updateProject } from "./service.js";

describe("projects service", () => {
  let repo: FakeProjectsRepository;
  const tokenA = "token-tenant-a";
  const tokenB = "token-tenant-b";

  beforeEach(() => {
    repo = new FakeProjectsRepository();
    repo.addSession(tokenA, "tenant-a");
    repo.addSession(tokenB, "tenant-b");
  });

  it("creates a project with the full FR-PROJ-002 setup fields", async () => {
    const project = await createProject(repo, tokenA, {
      company_id: "company-1",
      name: "A Tower",
      client_name: "Acme Developer",
      location: "Dubai, UAE",
      project_manager_id: "user-1",
      baseline_start_date: "2026-11-01",
      baseline_end_date: "2027-11-01",
      budget_amount: 1_000_000,
      budget_currency: "AED",
    });

    expect(project.tenant_id).toBe("tenant-a");
    expect(project.status).toBe("active");
    expect(project.client_name).toBe("Acme Developer");
    expect(project.budget_amount).toBe(1_000_000);
  });

  it("extended-field CRUD: update changes only the fields supplied", async () => {
    const project = await createProject(repo, tokenA, { company_id: "company-1", name: "A Tower" });

    const updated = await updateProject(repo, tokenA, project.id, {
      budget_amount: 2_000_000,
      budget_currency: "AED",
    });

    expect(updated.budget_amount).toBe(2_000_000);
    expect(updated.name).toBe("A Tower");
  });

  it("tenant isolation: a project created under tenant A is invisible to tenant B", async () => {
    const project = await createProject(repo, tokenA, { company_id: "company-1", name: "A Tower" });

    await expect(getProject(repo, tokenB, project.id)).rejects.toBeInstanceOf(NotFoundError);
    const listB = await listProjects(repo, tokenB);
    expect(listB).toHaveLength(0);
  });

  it("tenant isolation: updating another tenant's project 404s instead of succeeding", async () => {
    const project = await createProject(repo, tokenA, { company_id: "company-1", name: "A Tower" });

    await expect(updateProject(repo, tokenB, project.id, { name: "Hijacked" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("getProject throws NotFoundError for a nonexistent id", async () => {
    await expect(getProject(repo, tokenA, "no-such-project")).rejects.toBeInstanceOf(NotFoundError);
  });
});
