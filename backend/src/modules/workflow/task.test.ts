import { beforeEach, describe, expect, it } from "vitest";
import { FakeWorkflowRepository } from "../../test/fakeWorkflowRepository.js";
import {
  MissingBlockReasonError,
  StepInstanceNotActionableError,
  addTaskComment,
  attachTaskEvidence,
  clearTaskBlocked,
  setTaskBlocked,
} from "./service.js";

const TOKEN = "token-a";

describe("task blocking (ticket 0070, M07a)", () => {
  let repo: FakeWorkflowRepository;

  beforeEach(async () => {
    repo = new FakeWorkflowRepository();
  });

  async function openStep() {
    const instance = await repo.createInstance(TOKEN, {
      definitionId: "def-1",
      versionId: "version-1",
      startedBy: "admin-user",
      context: {},
    });
    return repo.createStepInstance(TOKEN, {
      instanceId: instance.id,
      nodeId: "node-1",
      status: "waiting",
      assignedTo: "alice",
    });
  }

  it("blocks a waiting step with a reason and records a task_blocked event", async () => {
    const step = await openStep();

    const blocked = await setTaskBlocked(repo, TOKEN, step.id, "waiting on client sign-off");

    expect(blocked.blocked_reason).toBe("waiting on client sign-off");
    expect(blocked.blocked_at).not.toBeNull();
    expect(repo.events.some((e) => e.event_type === "task_blocked")).toBe(true);
  });

  it("rejects blocking with an empty reason", async () => {
    const step = await openStep();

    await expect(setTaskBlocked(repo, TOKEN, step.id, "")).rejects.toBeInstanceOf(MissingBlockReasonError);
  });

  it("clears a block and records a task_unblocked event", async () => {
    const step = await openStep();
    await setTaskBlocked(repo, TOKEN, step.id, "waiting on client sign-off");

    const unblocked = await clearTaskBlocked(repo, TOKEN, step.id);

    expect(unblocked.blocked_reason).toBeNull();
    expect(repo.events.some((e) => e.event_type === "task_unblocked")).toBe(true);
  });

  it("rejects blocking a step that is already completed", async () => {
    const step = await openStep();
    await repo.updateStepInstance(TOKEN, step.id, { status: "completed", completedAt: new Date(0).toISOString() });

    await expect(setTaskBlocked(repo, TOKEN, step.id, "too late")).rejects.toBeInstanceOf(
      StepInstanceNotActionableError,
    );
  });
});

describe("task comments and evidence (ticket 0070, M07a)", () => {
  let repo: FakeWorkflowRepository;

  beforeEach(() => {
    repo = new FakeWorkflowRepository();
  });

  async function openStep() {
    const instance = await repo.createInstance(TOKEN, {
      definitionId: "def-1",
      versionId: "version-1",
      startedBy: "admin-user",
      context: {},
    });
    return repo.createStepInstance(TOKEN, {
      instanceId: instance.id,
      nodeId: "node-1",
      status: "waiting",
      assignedTo: "alice",
    });
  }

  it("adds a comment to a step instance and records a comment_added event", async () => {
    const step = await openStep();

    const comment = await addTaskComment(repo, TOKEN, step.id, "alice", "started on this");

    expect(comment.body).toBe("started on this");
    expect(repo.events.some((e) => e.event_type === "comment_added")).toBe(true);
  });

  it("attaches evidence to a step instance and records an evidence_attached event", async () => {
    const step = await openStep();

    await attachTaskEvidence(repo, TOKEN, step.id, "file-object-1");

    expect(repo.evidenceLinks.get("file-object-1")).toBe(step.id);
    expect(repo.events.some((e) => e.event_type === "evidence_attached")).toBe(true);
  });
});
