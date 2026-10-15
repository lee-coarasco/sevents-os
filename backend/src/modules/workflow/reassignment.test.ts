import { beforeEach, describe, expect, it } from "vitest";
import { FakeWorkflowRepository } from "../../test/fakeWorkflowRepository.js";
import { CrossTenantError, delegateTask, reassignTask, StepInstanceNotActionableError } from "./service.js";

const TOKEN = "token-a";
const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

describe("task reassignment & delegation, audited (ticket 0072, M07c)", () => {
  let repo: FakeWorkflowRepository;

  beforeEach(() => {
    repo = new FakeWorkflowRepository();
  });

  async function openStep() {
    const instance = await repo.createInstance(TOKEN, {
      definitionId: "def-1",
      versionId: "version-1",
      startedBy: "alice",
      context: {},
    });
    return repo.createStepInstance(TOKEN, {
      instanceId: instance.id,
      nodeId: "node-1",
      status: "waiting",
      assignedTo: "alice",
    });
  }

  it("reassigns an open step and records a task_reassigned event with from/to/reason", async () => {
    const step = await openStep();
    repo.setUserTenant("bob", TENANT_A);

    const updated = await reassignTask(repo, TOKEN, step.id, "bob", "alice is on leave");

    expect(updated.assigned_to).toBe("bob");
    const event = repo.events.find((e) => e.event_type === "task_reassigned");
    expect(event?.payload).toEqual({ from: "alice", to: "bob", reason: "alice is on leave" });
  });

  it("delegates an open step and records task_delegated instead of task_reassigned", async () => {
    const step = await openStep();
    repo.setUserTenant("carol", TENANT_A);

    const updated = await delegateTask(repo, TOKEN, step.id, "carol", "covering while alice is out");

    expect(updated.assigned_to).toBe("carol");
    expect(repo.events.some((e) => e.event_type === "task_reassigned")).toBe(false);
    const event = repo.events.find((e) => e.event_type === "task_delegated");
    expect(event?.payload).toEqual({ from: "alice", to: "carol", reason: "covering while alice is out", delegated: true });
  });

  it("rejects reassigning a step that is already completed", async () => {
    const step = await openStep();
    await repo.updateStepInstance(TOKEN, step.id, { status: "completed", completedAt: new Date(0).toISOString() });
    repo.setUserTenant("bob", TENANT_A);

    await expect(reassignTask(repo, TOKEN, step.id, "bob", null)).rejects.toBeInstanceOf(StepInstanceNotActionableError);
  });

  it("rejects delegating a step that is already completed", async () => {
    const step = await openStep();
    await repo.updateStepInstance(TOKEN, step.id, { status: "skipped" });
    repo.setUserTenant("carol", TENANT_A);

    await expect(delegateTask(repo, TOKEN, step.id, "carol", null)).rejects.toBeInstanceOf(StepInstanceNotActionableError);
  });

  it("rejects reassigning to a user in a different tenant", async () => {
    const step = await openStep();
    repo.setUserTenant("dave", TENANT_B);

    await expect(reassignTask(repo, TOKEN, step.id, "dave", null)).rejects.toBeInstanceOf(CrossTenantError);
  });

  it("rejects delegating to a user with no known tenant at all", async () => {
    const step = await openStep();
    // "ghost" was never registered via setUserTenant.
    await expect(delegateTask(repo, TOKEN, step.id, "ghost", null)).rejects.toBeInstanceOf(CrossTenantError);
  });
});
