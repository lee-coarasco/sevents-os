import { beforeEach, describe, expect, it } from "vitest";
import { FakeProjectsRepository } from "../../test/fakeProjectsRepository.js";
import {
  NotFoundError,
  completeCloseoutItem,
  computeProjectHealth,
  createMilestone,
  createProject,
  createRegisterEntry,
  createScheduleActivity,
  getProjectForecast,
  listCloseoutChecklist,
  setInitialBaseline,
  updateMilestone,
  updateScheduleActivity,
} from "./service.js";
import { CLOSEOUT_ITEM_KEYS } from "./types.js";

describe("M09e: project health, forecast-vs-baseline & closeout checklist (ticket 0077)", () => {
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

  describe("computeProjectHealth", () => {
    it("never returns a bare numeric score — only factors, a text summary and a refresh timestamp", async () => {
      const snapshot = await computeProjectHealth(repo, tokenA, projectId, null);
      expect(snapshot.factors).toBeTypeOf("object");
      expect(snapshot.summary).toBeTypeOf("string");
      expect(snapshot.computed_at).toBeTypeOf("string");
      expect(snapshot).not.toHaveProperty("score");
      expect(snapshot.computed_by).toBeNull();
    });

    it("counts overdue schedule activities (planned_end in the past, not yet actualized)", async () => {
      await createScheduleActivity(repo, tokenA, {
        project_id: projectId,
        name: "Foundation works",
        planned_end: "2000-01-01",
      });
      await createScheduleActivity(repo, tokenA, {
        project_id: projectId,
        name: "Future works",
        planned_end: "2999-01-01",
      });
      const snapshot = await computeProjectHealth(repo, tokenA, projectId, null);
      expect(snapshot.factors).toMatchObject({ overdueScheduleActivitiesCount: 1 });
    });

    it("counts overdue pending milestones and missed milestones separately", async () => {
      const m1 = await createMilestone(repo, tokenA, { project_id: projectId, name: "M1", target_date: "2000-01-01" });
      await createMilestone(repo, tokenA, { project_id: projectId, name: "M2", target_date: "2999-01-01" });
      await updateMilestone(repo, tokenA, m1.id, { status: "missed" });
      const snapshot = await computeProjectHealth(repo, tokenA, projectId, null);
      expect(snapshot.factors).toMatchObject({ overdueMilestonesCount: 0, missedMilestonesCount: 1 });
    });

    it("counts open/in_progress register entries by kind, and reports baseline status", async () => {
      await createRegisterEntry(repo, tokenA, { projectId, kind: "issue", title: "Site access blocked", raisedBy: "user-a" });
      await createRegisterEntry(repo, tokenA, { projectId, kind: "risk", title: "Weather delay", raisedBy: "user-a" });

      const snapshotNoBaseline = await computeProjectHealth(repo, tokenA, projectId, null);
      expect(snapshotNoBaseline.factors).toMatchObject({
        openRegisterEntryCountsByKind: { issue: 1, risk: 1, decision: 0, assumption: 0, dependency: 0, change_request: 0 },
        currentBaselineStatus: "none",
      });

      await setInitialBaseline(repo, tokenA, projectId, "user-a");
      const snapshotWithBaseline = await computeProjectHealth(repo, tokenA, projectId, null);
      expect(snapshotWithBaseline.factors).toMatchObject({ currentBaselineStatus: "approved" });
    });

    it("inserts a fresh snapshot on every call (append-only)", async () => {
      const first = await computeProjectHealth(repo, tokenA, projectId, null);
      const second = await computeProjectHealth(repo, tokenA, projectId, null);
      expect(first.id).not.toBe(second.id);
      expect(repo.healthSnapshots.size).toBe(2);
    });

    it("tenant isolation: tenant B sees no factors from tenant A's data", async () => {
      await createScheduleActivity(repo, tokenA, { project_id: projectId, name: "Foundation works", planned_end: "2000-01-01" });
      const otherProject = await createProject(repo, tokenB, { company_id: "company-2", name: "B Tower" });
      const snapshot = await computeProjectHealth(repo, tokenB, otherProject.id, null);
      expect(snapshot.factors).toMatchObject({ overdueScheduleActivitiesCount: 0 });
    });
  });

  describe("getProjectForecast", () => {
    it("returns baseline and forecast as two distinct, separately labelled fields — never merged", async () => {
      await createScheduleActivity(repo, tokenA, { project_id: projectId, name: "Foundation works", planned_end: "2026-06-01" });
      await setInitialBaseline(repo, tokenA, projectId, "user-a");

      const forecast = await getProjectForecast(repo, tokenA, projectId);
      expect(forecast).toHaveProperty("baseline");
      expect(forecast).toHaveProperty("forecast");
      expect(forecast.baseline.plannedCompletionDate).toBe("2026-06-01");
      expect(forecast.forecast.projectedCompletionDate).toBe("2026-06-01");
      expect(forecast.baseline).not.toBe(forecast.forecast);
    });

    it("forecast reflects live schedule slippage while baseline stays frozen at its captured snapshot", async () => {
      const activity = await createScheduleActivity(repo, tokenA, {
        project_id: projectId,
        name: "Foundation works",
        planned_end: "2026-06-01",
      });
      await setInitialBaseline(repo, tokenA, projectId, "user-a");

      await updateScheduleActivity(repo, tokenA, activity.id, { planned_end: "2026-09-01" });

      const forecast = await getProjectForecast(repo, tokenA, projectId);
      expect(forecast.baseline.plannedCompletionDate).toBe("2026-06-01");
      expect(forecast.forecast.projectedCompletionDate).toBe("2026-09-01");
    });

    it("with no approved baseline yet, baseline fields are null but forecast is still computed", async () => {
      await createScheduleActivity(repo, tokenA, { project_id: projectId, name: "Foundation works", planned_end: "2026-06-01" });
      const forecast = await getProjectForecast(repo, tokenA, projectId);
      expect(forecast.baseline.baselineId).toBeNull();
      expect(forecast.baseline.plannedCompletionDate).toBeNull();
      expect(forecast.forecast.projectedCompletionDate).toBe("2026-06-01");
    });
  });

  describe("closeout checklist", () => {
    it("lists exactly the four BRD-named items, all pending by default", async () => {
      const items = await listCloseoutChecklist(repo, tokenA, projectId);
      expect(items.map((i) => i.item_key).sort()).toEqual([...CLOSEOUT_ITEM_KEYS].sort());
      expect(items.every((i) => i.status === "pending")).toBe(true);
    });

    it("completing an item records who completed it and when, and is idempotent on item identity", async () => {
      const completed = await completeCloseoutItem(repo, tokenA, projectId, "final_account", "user-a");
      expect(completed.status).toBe("complete");
      expect(completed.completed_by).toBe("user-a");
      expect(completed.completed_at).not.toBeNull();

      const items = await listCloseoutChecklist(repo, tokenA, projectId);
      expect(items).toHaveLength(4);
      const finalAccount = items.find((i) => i.item_key === "final_account");
      expect(finalAccount?.status).toBe("complete");
    });

    it("completing a closeout item is a record only — it does not touch the project's own status", async () => {
      for (const key of CLOSEOUT_ITEM_KEYS) {
        await completeCloseoutItem(repo, tokenA, projectId, key, "user-a");
      }
      const project = await repo.getProject(tokenA, projectId);
      expect(project?.status).toBe("active");
    });

    it("tenant isolation: tenant B cannot list or complete a project it does not own (fails closed, not an empty list)", async () => {
      await expect(listCloseoutChecklist(repo, tokenB, projectId)).rejects.toBeInstanceOf(NotFoundError);
      await expect(completeCloseoutItem(repo, tokenB, projectId, "final_account", "user-b")).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
