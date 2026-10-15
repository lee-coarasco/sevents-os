import { beforeEach, describe, expect, it } from "vitest";
import { FakeWorkflowRepository } from "../../test/fakeWorkflowRepository.js";
import {
  blockedQueue,
  completedQueue,
  dueSoonQueue,
  myWorkQueue,
  overdueQueue,
  teamWorkQueue,
  waitingApprovalQueue,
} from "./service.js";
import type { NodeType, StepInstanceStatus } from "./types.js";

const TOKEN = "caller-token";
const ALICE = "alice";
const BOB = "bob";

describe("My Work / Team Work queue views (ticket 0071, M07b)", () => {
  let repo: FakeWorkflowRepository;

  beforeEach(() => {
    repo = new FakeWorkflowRepository();
    repo.addSession(TOKEN, ALICE);
  });

  async function openStep(opts: {
    nodeType?: NodeType;
    status?: StepInstanceStatus;
    assignedTo?: string | null;
    dueAt?: string | null;
    blockedReason?: string | null;
    completedAt?: string | null;
  }) {
    const instance = await repo.createInstance(TOKEN, {
      definitionId: "def-1",
      versionId: "version-1",
      startedBy: ALICE,
      context: {},
    });
    const node = await repo.addNode(TOKEN, {
      versionId: "version-1",
      nodeKey: `n-${repo.nodesById.size}`,
      nodeType: opts.nodeType ?? "create_task",
      config: {},
    });
    const step = await repo.createStepInstance(TOKEN, {
      instanceId: instance.id,
      nodeId: node.id,
      status: opts.status ?? "waiting",
      assignedTo: opts.assignedTo ?? ALICE,
    });
    return repo.updateStepInstance(TOKEN, step.id, {
      dueAt: opts.dueAt ?? undefined,
      blockedReason: opts.blockedReason ?? undefined,
      completedAt: opts.completedAt ?? undefined,
      status: opts.status,
    });
  }

  it("My Work returns only the caller's own open tasks", async () => {
    const mine = await openStep({ assignedTo: ALICE, status: "waiting" });
    await openStep({ assignedTo: BOB, status: "waiting" });
    await openStep({ assignedTo: ALICE, status: "completed", completedAt: new Date(0).toISOString() });

    const items = await myWorkQueue(repo, TOKEN);

    expect(items.map((i) => i.id)).toEqual([mine.id]);
  });

  it("Team Work returns every open task regardless of assignee", async () => {
    const mine = await openStep({ assignedTo: ALICE, status: "waiting" });
    const bobs = await openStep({ assignedTo: BOB, status: "active" });
    await openStep({ assignedTo: BOB, status: "completed", completedAt: new Date(0).toISOString() });

    const items = await teamWorkQueue(repo, TOKEN);

    expect(items.map((i) => i.id).sort()).toEqual([mine.id, bobs.id].sort());
  });

  it("Due Soon returns open tasks due within the default 72h window, excluding ones already overdue", async () => {
    const now = Date.now();
    const soon = await openStep({ dueAt: new Date(now + 10 * 60 * 60 * 1000).toISOString() });
    await openStep({ dueAt: new Date(now - 60 * 60 * 1000).toISOString() }); // already overdue
    await openStep({ dueAt: new Date(now + 200 * 60 * 60 * 1000).toISOString() }); // outside window
    await openStep({ dueAt: null });

    const items = await dueSoonQueue(repo, TOKEN);

    expect(items.map((i) => i.id)).toEqual([soon.id]);
  });

  it("Due Soon honours a caller-supplied window instead of the 72h default", async () => {
    const now = Date.now();
    const farOut = await openStep({ dueAt: new Date(now + 20 * 60 * 60 * 1000).toISOString() });

    expect(await dueSoonQueue(repo, TOKEN, 1)).toHaveLength(0);
    expect((await dueSoonQueue(repo, TOKEN, 24)).map((i) => i.id)).toEqual([farOut.id]);
  });

  it("Overdue returns open tasks whose due_at has already passed", async () => {
    const now = Date.now();
    const late = await openStep({ dueAt: new Date(now - 60 * 60 * 1000).toISOString() });
    await openStep({ dueAt: new Date(now + 60 * 60 * 1000).toISOString() });
    await openStep({ dueAt: null });

    const items = await overdueQueue(repo, TOKEN);

    expect(items.map((i) => i.id)).toEqual([late.id]);
  });

  it("Blocked returns only open tasks with a blocked_reason set", async () => {
    const blocked = await openStep({ blockedReason: "waiting on client" });
    await openStep({ blockedReason: null });

    const items = await blockedQueue(repo, TOKEN);

    expect(items.map((i) => i.id)).toEqual([blocked.id]);
  });

  it("Waiting Approval returns only open steps whose node is request_approval", async () => {
    const approval = await openStep({ nodeType: "request_approval" });
    await openStep({ nodeType: "create_task" });
    await openStep({ nodeType: "assign_role_user" });

    const items = await waitingApprovalQueue(repo, TOKEN);

    expect(items.map((i) => i.id)).toEqual([approval.id]);
  });

  it("Completed returns only completed tasks within the caller's date range", async () => {
    const inRange = await openStep({ status: "completed", completedAt: "2026-10-01T00:00:00.000Z" });
    await openStep({ status: "completed", completedAt: "2026-01-01T00:00:00.000Z" }); // outside range
    await openStep({ status: "waiting" }); // not completed at all

    const items = await completedQueue(repo, TOKEN, { from: "2026-09-01T00:00:00.000Z", to: "2026-10-15T00:00:00.000Z" });

    expect(items.map((i) => i.id)).toEqual([inRange.id]);
  });

  it("Completed defaults to the last 30 days when the caller supplies no range", async () => {
    const now = new Date();
    const recentlyCompleted = await openStep({ status: "completed", completedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString() });
    await openStep({ status: "completed", completedAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString() });

    const items = await completedQueue(repo, TOKEN);

    expect(items.map((i) => i.id)).toEqual([recentlyCompleted.id]);
  });

  it("My Work throws if the access token has no registered caller session", async () => {
    await expect(myWorkQueue(repo, "unknown-token")).rejects.toThrow();
  });
});
