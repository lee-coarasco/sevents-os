import { beforeEach, describe, expect, it } from "vitest";
import { FakeProjectsRepository } from "../../test/fakeProjectsRepository.js";
import {
  NotFoundError,
  addScheduleActivityDependency,
  createMilestone,
  createProject,
  createScheduleActivity,
  createWBSNode,
  listMilestones,
  listProgressEntries,
  listScheduleActivities,
  listScheduleActivityDependencies,
  listWBSNodes,
  recordProgressEntry,
  removeScheduleActivityDependency,
  updateMilestone,
  updateScheduleActivity,
  updateWBSNode,
} from "./service.js";

describe("M09b: WBS, milestones, schedule activities, dependencies & progress", () => {
  let repo: FakeProjectsRepository;
  const tokenA = "token-tenant-a";
  const tokenB = "token-tenant-b";
  let projectId: string;

  beforeEach(async () => {
    repo = new FakeProjectsRepository();
    repo.addSession(tokenA, "tenant-a");
    repo.addSession(tokenB, "tenant-b");
    const project = await createProject(repo, tokenA, { company_id: "company-1", name: "A Tower" });
    projectId = project.id;
  });

  it("builds a WBS tree under a project via parent_wbs_node_id", async () => {
    const root = await createWBSNode(repo, tokenA, { project_id: projectId, code: "1", name: "Substructure" });
    const child = await createWBSNode(repo, tokenA, {
      project_id: projectId,
      parent_wbs_node_id: root.id,
      code: "1.1",
      name: "Excavation",
    });

    const nodes = await listWBSNodes(repo, tokenA, projectId);
    expect(nodes).toHaveLength(2);
    expect(child.parent_wbs_node_id).toBe(root.id);
  });

  it("tenant isolation: another tenant cannot list or update a WBS node", async () => {
    const node = await createWBSNode(repo, tokenA, { project_id: projectId, code: "1", name: "Substructure" });

    const listB = await listWBSNodes(repo, tokenB, projectId);
    expect(listB).toHaveLength(0);

    await expect(updateWBSNode(repo, tokenB, node.id, { name: "Hijacked" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("milestones default to pending and can be marked achieved with an actual date", async () => {
    const milestone = await createMilestone(repo, tokenA, {
      project_id: projectId,
      name: "Foundation complete",
      target_date: "2026-12-01",
    });
    expect(milestone.status).toBe("pending");
    expect(milestone.actual_date).toBeNull();

    const updated = await updateMilestone(repo, tokenA, milestone.id, {
      status: "achieved",
      actual_date: "2026-11-28",
    });
    expect(updated.status).toBe("achieved");
    expect(updated.actual_date).toBe("2026-11-28");

    const listed = await listMilestones(repo, tokenA, projectId);
    expect(listed).toHaveLength(1);
  });

  it("schedule activities default percent_complete to 0 and can be updated with actuals", async () => {
    const activity = await createScheduleActivity(repo, tokenA, {
      project_id: projectId,
      name: "Excavation",
      planned_start: "2026-11-01",
      planned_end: "2026-11-10",
    });
    expect(activity.percent_complete).toBe(0);

    const updated = await updateScheduleActivity(repo, tokenA, activity.id, {
      actual_start: "2026-11-02",
      percent_complete: 40,
    });
    expect(updated.percent_complete).toBe(40);

    const listed = await listScheduleActivities(repo, tokenA, projectId);
    expect(listed).toHaveLength(1);
  });

  it("dependency edges can be added and removed between two activities", async () => {
    const a = await createScheduleActivity(repo, tokenA, { project_id: projectId, name: "Excavation" });
    const b = await createScheduleActivity(repo, tokenA, { project_id: projectId, name: "Foundation pour" });

    await addScheduleActivityDependency(repo, tokenA, {
      activity_id: b.id,
      depends_on_activity_id: a.id,
    });

    const deps = await listScheduleActivityDependencies(repo, tokenA, b.id);
    expect(deps).toHaveLength(1);
    expect(deps[0]?.dependency_type).toBe("finish_to_start");

    await removeScheduleActivityDependency(repo, tokenA, b.id, a.id);
    const depsAfter = await listScheduleActivityDependencies(repo, tokenA, b.id);
    expect(depsAfter).toHaveLength(0);
  });

  it("progress entries are append-only: multiple entries accumulate, never overwrite", async () => {
    const activity = await createScheduleActivity(repo, tokenA, { project_id: projectId, name: "Excavation" });

    await recordProgressEntry(repo, tokenA, {
      schedule_activity_id: activity.id,
      recorded_by: "user-1",
      percent_complete: 20,
    });
    await recordProgressEntry(repo, tokenA, {
      schedule_activity_id: activity.id,
      recorded_by: "user-1",
      percent_complete: 50,
      note: "Rebar fixing in progress",
    });

    const entries = await listProgressEntries(repo, tokenA, activity.id);
    expect(entries).toHaveLength(2);
    expect(entries[1]?.percent_complete).toBe(50);
    expect(entries[1]?.note).toBe("Rebar fixing in progress");
  });

  it("tenant isolation: progress entries recorded under tenant A are invisible to tenant B", async () => {
    const activity = await createScheduleActivity(repo, tokenA, { project_id: projectId, name: "Excavation" });
    await recordProgressEntry(repo, tokenA, {
      schedule_activity_id: activity.id,
      recorded_by: "user-1",
      percent_complete: 20,
    });

    const entriesB = await listProgressEntries(repo, tokenB, activity.id);
    expect(entriesB).toHaveLength(0);
  });
});
