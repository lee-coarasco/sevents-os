import { beforeEach, describe, expect, it } from "vitest";
import { FakeWorkflowRepository } from "../../test/fakeWorkflowRepository.js";
import {
  IncompleteGateError,
  InstanceNotPausedError,
  InstanceNotRunningError,
  StepInstanceNotActionableError,
  UnregisteredServiceError,
  addNodeToVersion,
  addTransitionToVersion,
  addConditionToVersion,
  cancelInstance,
  completeStepInstance,
  createWorkflowDefinition,
  pauseInstance,
  publishVersion,
  recordApproval,
  resumeInstance,
  rollbackToVersion,
  startWorkflowInstance,
  submitForApproval,
  validateVersion,
} from "./service.js";
import type { NodeType } from "./types.js";

const TOKEN = "caller-token";
const USER = "process-owner";
const APPROVER = "specialist-approver";

/**
 * Builds and publishes a definition from an explicit node/transition
 * list so each test can shape a small graph exercising the node
 * type(s) it cares about. `start -> ... -> complete|cancel`.
 */
async function publishGraph(
  repo: FakeWorkflowRepository,
  key: string,
  nodes: { key: string; type: NodeType; config?: Record<string, unknown> }[],
  edges: { from: string; to: string; conditionId?: string }[],
) {
  const { definition, version } = await createWorkflowDefinition(repo, TOKEN, { key, name: key }, USER);
  const nodeIdByKey = new Map<string, string>();
  for (const n of nodes) {
    const node = await addNodeToVersion(repo, TOKEN, version.id, { nodeKey: n.key, nodeType: n.type, config: n.config ?? {} });
    nodeIdByKey.set(n.key, node.id);
  }
  for (const [index, e] of edges.entries()) {
    await addTransitionToVersion(repo, TOKEN, version.id, {
      fromNodeId: nodeIdByKey.get(e.from)!,
      toNodeId: nodeIdByKey.get(e.to)!,
      conditionId: e.conditionId,
      orderIndex: index,
    });
  }
  await validateVersion(repo, TOKEN, version.id, USER);
  await submitForApproval(repo, TOKEN, definition.id, version.id, USER);
  await recordApproval(repo, TOKEN, definition.id, version.id, APPROVER, "approved", null);
  const published = await publishVersion(repo, TOKEN, definition.id, version.id, APPROVER);
  return { definition, version: published, nodeIdByKey };
}

describe("startWorkflowInstance version pinning", () => {
  it("pins workflow_version_id at creation; publishing a newer version afterwards does not change it", async () => {
    const repo = new FakeWorkflowRepository();
    const { definition, version: v1 } = await publishGraph(
      repo,
      "pin-test",
      [
        { key: "start", type: "create_task" },
        { key: "end", type: "complete" },
      ],
      [{ from: "start", to: "end" }],
    );

    const { instance } = await startWorkflowInstance(repo, TOKEN, definition.id, USER);
    expect(instance.workflow_version_id).toBe(v1.id);

    // Publish a second version for the same definition.
    const v2 = await rollbackToVersion(repo, TOKEN, definition.id, v1.version, "admin", "republish as v2");
    expect(v2.id).not.toBe(v1.id);
    const refreshedDefinition = await repo.getDefinition(TOKEN, definition.id);
    expect(refreshedDefinition!.current_version).toBe(v2.version);

    const instanceAfter = await repo.getInstance(TOKEN, instance.id);
    expect(instanceAfter!.workflow_version_id).toBe(v1.id);
    expect(instanceAfter!.workflow_version_id).not.toBe(v2.id);
  });
});

describe("executor coverage: one test per BRD §5.4.3 node type", () => {
  let repo: FakeWorkflowRepository;

  beforeEach(() => {
    repo = new FakeWorkflowRepository();
  });

  it("create_task: creates a waiting step instance and stops (M07 seam)", async () => {
    const { definition } = await publishGraph(
      repo,
      "create-task",
      [
        { key: "start", type: "create_task" },
        { key: "end", type: "complete" },
      ],
      [{ from: "start", to: "end" }],
    );
    const { instance, stepInstances } = await startWorkflowInstance(repo, TOKEN, definition.id, USER);
    expect(instance.status).toBe("running");
    expect(stepInstances).toHaveLength(1);
    expect(stepInstances[0]!.status).toBe("waiting");
  });

  it("assign_role_user: creates a waiting step instance assigned to the configured role (M07 seam)", async () => {
    repo.knownRoleIds.add("role.site_engineer");
    const { definition } = await publishGraph(
      repo,
      "assign-role",
      [
        { key: "start", type: "assign_role_user", config: { roleId: "role.site_engineer" } },
        { key: "end", type: "complete" },
      ],
      [{ from: "start", to: "end" }],
    );
    const { stepInstances } = await startWorkflowInstance(repo, TOKEN, definition.id, USER);
    expect(stepInstances[0]!.status).toBe("waiting");
    expect(stepInstances[0]!.assigned_to).toBe("role.site_engineer");
  });

  it("collect_form_data: resolves synchronously and advances to the next node", async () => {
    const { definition } = await publishGraph(
      repo,
      "collect-form",
      [
        { key: "start", type: "collect_form_data", config: { fields: ["amount"] } },
        { key: "end", type: "complete" },
      ],
      [{ from: "start", to: "end" }],
    );
    const { instance, stepInstances } = await startWorkflowInstance(repo, TOKEN, definition.id, USER);
    expect(stepInstances.map((s) => s.status)).toEqual(["completed", "completed"]);
    expect(instance.status).toBe("completed");
  });

  it("request_upload_evidence: leaves a waiting step instance (gate-relevant, no auto-resolve)", async () => {
    const { definition } = await publishGraph(
      repo,
      "upload-evidence",
      [
        { key: "start", type: "request_upload_evidence" },
        { key: "end", type: "complete" },
      ],
      [{ from: "start", to: "end" }],
    );
    const { stepInstances } = await startWorkflowInstance(repo, TOKEN, definition.id, USER);
    expect(stepInstances).toHaveLength(1);
    expect(stepInstances[0]!.status).toBe("waiting");
  });

  it("evaluate_condition: picks the next transition deterministically via simulation.ts's evaluator, not an LLM", async () => {
    const { definition, nodeIdByKey } = await (async () => {
      const repoLocal = repo;
      const { definition, version } = await createWorkflowDefinition(repoLocal, TOKEN, { key: "evaluate-condition", name: "evaluate-condition" }, USER);
      const cond = await addConditionToVersion(repoLocal, TOKEN, version.id, { expression: { field: "amount", operator: "gt", value: 1000 } });
      const start = await addNodeToVersion(repoLocal, TOKEN, version.id, { nodeKey: "start", nodeType: "evaluate_condition" });
      const highPath = await addNodeToVersion(repoLocal, TOKEN, version.id, { nodeKey: "high", nodeType: "complete" });
      const lowPath = await addNodeToVersion(repoLocal, TOKEN, version.id, { nodeKey: "low", nodeType: "cancel" });
      await addTransitionToVersion(repoLocal, TOKEN, version.id, { fromNodeId: start.id, toNodeId: highPath.id, conditionId: cond.id, orderIndex: 0 });
      await addTransitionToVersion(repoLocal, TOKEN, version.id, { fromNodeId: start.id, toNodeId: lowPath.id, orderIndex: 1 });
      await validateVersion(repoLocal, TOKEN, version.id, USER);
      await submitForApproval(repoLocal, TOKEN, definition.id, version.id, USER);
      await recordApproval(repoLocal, TOKEN, definition.id, version.id, APPROVER, "approved", null);
      await publishVersion(repoLocal, TOKEN, definition.id, version.id, APPROVER);
      return { definition, nodeIdByKey: new Map([["high", highPath.id], ["low", lowPath.id]]) };
    })();

    const highResult = await startWorkflowInstance(repo, TOKEN, definition.id, USER, { amount: 5000 });
    expect(highResult.instance.status).toBe("completed");
    expect(highResult.stepInstances.some((s) => s.node_id === nodeIdByKey.get("high"))).toBe(true);

    const lowResult = await startWorkflowInstance(repo, TOKEN, definition.id, USER, { amount: 10 });
    expect(lowResult.instance.status).toBe("cancelled");
    expect(lowResult.stepInstances.some((s) => s.node_id === nodeIdByKey.get("low"))).toBe(true);
  });

  it("call_service: invokes the registered echo service and merges its output into instance context", async () => {
    const { definition } = await publishGraph(
      repo,
      "call-service",
      [
        { key: "start", type: "call_service", config: { service: "echo", config: { greeting: "hello" } } },
        { key: "end", type: "complete" },
      ],
      [{ from: "start", to: "end" }],
    );
    const { instance, stepInstances } = await startWorkflowInstance(repo, TOKEN, definition.id, USER);
    expect(instance.context.greeting).toBe("hello");
    expect(stepInstances[0]!.output).toMatchObject({ service: "echo" });
  });

  it("call_service: an unregistered service name is a typed error, not a crash", async () => {
    const { definition } = await publishGraph(
      repo,
      "call-service-bad",
      [
        { key: "start", type: "call_service", config: { service: "not_a_real_service" } },
        { key: "end", type: "complete" },
      ],
      [{ from: "start", to: "end" }],
    );
    await expect(startWorkflowInstance(repo, TOKEN, definition.id, USER)).rejects.toBeInstanceOf(UnregisteredServiceError);
  });

  it("request_approval: creates a waiting step instance assigned to the configured role (M08 seam)", async () => {
    const { definition } = await publishGraph(
      repo,
      "request-approval",
      [
        { key: "start", type: "request_approval", config: { roleId: "role.commercial_manager" } },
        { key: "end", type: "complete" },
      ],
      [{ from: "start", to: "end" }],
    );
    const { stepInstances } = await startWorkflowInstance(repo, TOKEN, definition.id, USER);
    expect(stepInstances[0]!.status).toBe("waiting");
    expect(stepInstances[0]!.assigned_to).toBe("role.commercial_manager");
  });

  it("send_notification: resolves synchronously and records a notification_sent event", async () => {
    const { definition } = await publishGraph(
      repo,
      "send-notification",
      [
        { key: "start", type: "send_notification", config: { template: "material_request_submitted" } },
        { key: "end", type: "complete" },
      ],
      [{ from: "start", to: "end" }],
    );
    const { instance } = await startWorkflowInstance(repo, TOKEN, definition.id, USER);
    const events = await repo.listEvents(TOKEN, instance.id);
    expect(events.some((e) => e.event_type === "notification_sent")).toBe(true);
  });

  it("wait_event_time: resolves and advances (no timer infra in this ticket's scope)", async () => {
    const { definition } = await publishGraph(
      repo,
      "wait-event-time",
      [
        { key: "start", type: "wait_event_time", config: { durationMinutes: 60 } },
        { key: "end", type: "complete" },
      ],
      [{ from: "start", to: "end" }],
    );
    const { instance } = await startWorkflowInstance(repo, TOKEN, definition.id, USER);
    expect(instance.status).toBe("completed");
  });

  it("create_linked_followup: resolves synchronously with its config recorded as output", async () => {
    const { definition } = await publishGraph(
      repo,
      "create-linked-followup",
      [
        { key: "start", type: "create_linked_followup", config: { targetKey: "snag_list_item" } },
        { key: "end", type: "complete" },
      ],
      [{ from: "start", to: "end" }],
    );
    const { stepInstances } = await startWorkflowInstance(repo, TOKEN, definition.id, USER);
    expect(stepInstances[0]!.output).toMatchObject({ followup: { targetKey: "snag_list_item" } });
  });

  it("escalate: resolves synchronously and records an escalated event", async () => {
    const { definition } = await publishGraph(
      repo,
      "escalate",
      [
        { key: "start", type: "escalate" },
        { key: "end", type: "complete" },
      ],
      [{ from: "start", to: "end" }],
    );
    const { instance } = await startWorkflowInstance(repo, TOKEN, definition.id, USER);
    const events = await repo.listEvents(TOKEN, instance.id);
    expect(events.some((e) => e.event_type === "escalated")).toBe(true);
  });

  it("complete: ends the instance with status completed", async () => {
    const { definition } = await publishGraph(
      repo,
      "complete-node",
      [
        { key: "start", type: "collect_form_data" },
        { key: "end", type: "complete" },
      ],
      [{ from: "start", to: "end" }],
    );
    const { instance } = await startWorkflowInstance(repo, TOKEN, definition.id, USER);
    expect(instance.status).toBe("completed");
    expect(instance.ended_at).not.toBeNull();
  });

  it("cancel: ends the instance with status cancelled", async () => {
    const { definition } = await publishGraph(
      repo,
      "cancel-node",
      [
        { key: "start", type: "collect_form_data" },
        { key: "end", type: "cancel" },
      ],
      [{ from: "start", to: "end" }],
    );
    const { instance } = await startWorkflowInstance(repo, TOKEN, definition.id, USER);
    expect(instance.status).toBe("cancelled");
    expect(instance.ended_at).not.toBeNull();
  });
});

describe("pause / resume / cancel", () => {
  let repo: FakeWorkflowRepository;

  beforeEach(() => {
    repo = new FakeWorkflowRepository();
  });

  async function startedInstance() {
    const { definition } = await publishGraph(
      repo,
      "lifecycle",
      [
        { key: "start", type: "create_task" },
        { key: "end", type: "complete" },
      ],
      [{ from: "start", to: "end" }],
    );
    const { instance } = await startWorkflowInstance(repo, TOKEN, definition.id, USER);
    return instance;
  }

  it("pause produces a paused event and sets status paused", async () => {
    const instance = await startedInstance();
    const paused = await pauseInstance(repo, TOKEN, instance.id);
    expect(paused.status).toBe("paused");
    const events = await repo.listEvents(TOKEN, instance.id);
    expect(events.some((e) => e.event_type === "paused")).toBe(true);
  });

  it("resume produces a resumed event and sets status running", async () => {
    const instance = await startedInstance();
    await pauseInstance(repo, TOKEN, instance.id);
    const resumed = await resumeInstance(repo, TOKEN, instance.id);
    expect(resumed.status).toBe("running");
    const events = await repo.listEvents(TOKEN, instance.id);
    expect(events.some((e) => e.event_type === "resumed")).toBe(true);
  });

  it("rejects resuming an instance that isn't paused", async () => {
    const instance = await startedInstance();
    await expect(resumeInstance(repo, TOKEN, instance.id)).rejects.toBeInstanceOf(InstanceNotPausedError);
  });

  it("cancel produces a cancelled event and sets status cancelled with ended_at set", async () => {
    const instance = await startedInstance();
    const cancelled = await cancelInstance(repo, TOKEN, instance.id, "no longer needed");
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.ended_at).not.toBeNull();
    const events = await repo.listEvents(TOKEN, instance.id);
    expect(events.some((e) => e.event_type === "cancelled" && e.payload.reason === "no longer needed")).toBe(true);
  });

  it("rejects cancelling an already-terminal instance", async () => {
    const instance = await startedInstance();
    await cancelInstance(repo, TOKEN, instance.id, null);
    await expect(cancelInstance(repo, TOKEN, instance.id, null)).rejects.toBeInstanceOf(InstanceNotRunningError);
  });
});

describe("FR-WI-009 predecessor/parallel semantics", () => {
  let repo: FakeWorkflowRepository;

  beforeEach(() => {
    repo = new FakeWorkflowRepository();
  });

  it("parallel fan-out: a node with multiple unconditional outgoing transitions activates all of them", async () => {
    const { definition, version } = await createWorkflowDefinition(repo, TOKEN, { key: "fan-out", name: "fan-out" }, USER);
    const start = await addNodeToVersion(repo, TOKEN, version.id, { nodeKey: "start", nodeType: "collect_form_data" });
    const branchA = await addNodeToVersion(repo, TOKEN, version.id, { nodeKey: "branchA", nodeType: "create_task" });
    const branchB = await addNodeToVersion(repo, TOKEN, version.id, { nodeKey: "branchB", nodeType: "create_task" });
    const end = await addNodeToVersion(repo, TOKEN, version.id, { nodeKey: "end", nodeType: "complete" });
    await addTransitionToVersion(repo, TOKEN, version.id, { fromNodeId: start.id, toNodeId: branchA.id, orderIndex: 0 });
    await addTransitionToVersion(repo, TOKEN, version.id, { fromNodeId: start.id, toNodeId: branchB.id, orderIndex: 1 });
    await addTransitionToVersion(repo, TOKEN, version.id, { fromNodeId: branchA.id, toNodeId: end.id });
    await addTransitionToVersion(repo, TOKEN, version.id, { fromNodeId: branchB.id, toNodeId: end.id });
    await validateVersion(repo, TOKEN, version.id, USER);
    await submitForApproval(repo, TOKEN, definition.id, version.id, USER);
    await recordApproval(repo, TOKEN, definition.id, version.id, APPROVER, "approved", null);
    await publishVersion(repo, TOKEN, definition.id, version.id, APPROVER);

    const { stepInstances } = await startWorkflowInstance(repo, TOKEN, definition.id, USER);
    const nodeIdsReached = stepInstances.map((s) => s.node_id);
    // Both branches activate — not just the first by order_index — and
    // the shared downstream "end" node is correctly withheld until both
    // branches complete (it requires a human hand-off on each branch,
    // so it isn't reached in this synchronous pass at all).
    expect(nodeIdsReached).toContain(branchA.id);
    expect(nodeIdsReached).toContain(branchB.id);
    expect(nodeIdsReached).not.toContain(end.id);
  });

  it("wait-for-all-predecessors: a fan-in node only activates once every predecessor branch has completed", async () => {
    const { definition, version } = await createWorkflowDefinition(repo, TOKEN, { key: "fan-in", name: "fan-in" }, USER);
    const start = await addNodeToVersion(repo, TOKEN, version.id, { nodeKey: "start", nodeType: "collect_form_data" });
    const branchA = await addNodeToVersion(repo, TOKEN, version.id, { nodeKey: "branchA", nodeType: "collect_form_data" });
    const branchB = await addNodeToVersion(repo, TOKEN, version.id, { nodeKey: "branchB", nodeType: "request_approval", config: { roleId: "role.approver" } });
    const join = await addNodeToVersion(repo, TOKEN, version.id, { nodeKey: "join", nodeType: "complete" });
    await addTransitionToVersion(repo, TOKEN, version.id, { fromNodeId: start.id, toNodeId: branchA.id, orderIndex: 0 });
    await addTransitionToVersion(repo, TOKEN, version.id, { fromNodeId: start.id, toNodeId: branchB.id, orderIndex: 1 });
    await addTransitionToVersion(repo, TOKEN, version.id, { fromNodeId: branchA.id, toNodeId: join.id });
    await addTransitionToVersion(repo, TOKEN, version.id, { fromNodeId: branchB.id, toNodeId: join.id });
    await validateVersion(repo, TOKEN, version.id, USER);
    await submitForApproval(repo, TOKEN, definition.id, version.id, USER);
    await recordApproval(repo, TOKEN, definition.id, version.id, APPROVER, "approved", null);
    await publishVersion(repo, TOKEN, definition.id, version.id, APPROVER);

    const { instance, stepInstances } = await startWorkflowInstance(repo, TOKEN, definition.id, USER);
    // branchA (collect_form_data) auto-resolves; branchB (request_approval) waits for a human.
    expect(instance.status).toBe("running");
    const joinStepBefore = stepInstances.find((s) => s.node_id === join.id);
    expect(joinStepBefore).toBeUndefined();

    const branchBStep = (await repo.listStepInstances(TOKEN, instance.id)).find((s) => s.node_id === branchB.id)!;
    const { instance: afterApproval, stepInstances: newSteps } = await completeStepInstance(repo, TOKEN, branchBStep.id, {
      output: { decision: "approved" },
    });
    expect(afterApproval.status).toBe("completed");
    expect(newSteps.some((s) => s.node_id === join.id)).toBe(true);
  });
});

describe("FR-WI-010 complete-node gate", () => {
  let repo: FakeWorkflowRepository;

  beforeEach(() => {
    repo = new FakeWorkflowRepository();
  });

  /**
   * Two separate paths off "start": one straight to a `complete` node
   * (single predecessor, so FR-WI-009's wait-for-all-predecessors never
   * blocks it), the other into a request_upload_evidence step that
   * dead-ends (no transition onward — it is not itself a predecessor of
   * complete). The evidence step represents a required checklist item
   * for this workflow instance that FR-WI-010 must still catch as
   * outstanding even though it sits off the direct graph path to
   * complete, since the instance as a whole has required evidence that
   * hasn't been furnished yet.
   */
  async function sideEvidenceBranchInstance() {
    const { definition, version } = await createWorkflowDefinition(repo, TOKEN, { key: "evidence-gate", name: "evidence-gate" }, USER);
    const start = await addNodeToVersion(repo, TOKEN, version.id, { nodeKey: "start", nodeType: "collect_form_data" });
    const evidence = await addNodeToVersion(repo, TOKEN, version.id, { nodeKey: "evidence", nodeType: "request_upload_evidence" });
    const end = await addNodeToVersion(repo, TOKEN, version.id, { nodeKey: "end", nodeType: "complete" });
    await addTransitionToVersion(repo, TOKEN, version.id, { fromNodeId: start.id, toNodeId: evidence.id, orderIndex: 0 });
    await addTransitionToVersion(repo, TOKEN, version.id, { fromNodeId: start.id, toNodeId: end.id, orderIndex: 1 });
    await validateVersion(repo, TOKEN, version.id, USER);
    await submitForApproval(repo, TOKEN, definition.id, version.id, USER);
    await recordApproval(repo, TOKEN, definition.id, version.id, APPROVER, "approved", null);
    await publishVersion(repo, TOKEN, definition.id, version.id, APPROVER);
    const { instance } = await startWorkflowInstance(repo, TOKEN, definition.id, USER);
    return { instance };
  }

  it("blocks reaching complete while a required evidence step elsewhere on the instance is still outstanding", async () => {
    const { instance } = await sideEvidenceBranchInstance();
    // start fans out into both the evidence branch (left waiting) and
    // straight to "end" in the same synchronous pass — the gate fires
    // during that very activation, so "end" is never actually reached
    // (no step instance exists for it) and the instance stays running.
    const steps = await repo.listStepInstances(TOKEN, instance.id);
    expect(steps.some((s) => s.status === "waiting")).toBe(true);

    const events = await repo.listEvents(TOKEN, instance.id);
    expect(events.some((e) => e.event_type === "gate_blocked")).toBe(true);
    const instanceAfter = await repo.getInstance(TOKEN, instance.id);
    expect(instanceAfter!.status).toBe("running");
  });

  /**
   * Two independent request_upload_evidence branches off "start", both
   * feeding the same "end" node (fan-in, FR-WI-009 wait-for-all-
   * predecessors applies). Completing evidenceA first leaves evidenceB
   * genuinely outstanding at gate-check time — and "end" also hasn't
   * got both predecessors yet — so this exercises "provide an
   * authorized reason to proceed without this evidence" distinctly
   * from "end becomes reachable," which is covered by completing
   * evidenceB afterwards.
   */
  async function independentEvidenceBranchesInstance() {
    const { definition, version } = await createWorkflowDefinition(repo, TOKEN, { key: "evidence-gate-2", name: "evidence-gate-2" }, USER);
    const start = await addNodeToVersion(repo, TOKEN, version.id, { nodeKey: "start", nodeType: "collect_form_data" });
    const evidenceA = await addNodeToVersion(repo, TOKEN, version.id, { nodeKey: "evidenceA", nodeType: "request_upload_evidence" });
    const evidenceB = await addNodeToVersion(repo, TOKEN, version.id, { nodeKey: "evidenceB", nodeType: "request_upload_evidence" });
    const end = await addNodeToVersion(repo, TOKEN, version.id, { nodeKey: "end", nodeType: "complete" });
    await addTransitionToVersion(repo, TOKEN, version.id, { fromNodeId: start.id, toNodeId: evidenceA.id, orderIndex: 0 });
    await addTransitionToVersion(repo, TOKEN, version.id, { fromNodeId: start.id, toNodeId: evidenceB.id, orderIndex: 1 });
    await addTransitionToVersion(repo, TOKEN, version.id, { fromNodeId: evidenceA.id, toNodeId: end.id });
    await addTransitionToVersion(repo, TOKEN, version.id, { fromNodeId: evidenceB.id, toNodeId: end.id });
    await validateVersion(repo, TOKEN, version.id, USER);
    await submitForApproval(repo, TOKEN, definition.id, version.id, USER);
    await recordApproval(repo, TOKEN, definition.id, version.id, APPROVER, "approved", null);
    await publishVersion(repo, TOKEN, definition.id, version.id, APPROVER);
    const { instance } = await startWorkflowInstance(repo, TOKEN, definition.id, USER);
    const steps = await repo.listStepInstances(TOKEN, instance.id);
    const evidenceAStep = steps.find((s) => s.node_id === evidenceA.id)!;
    const evidenceBStep = steps.find((s) => s.node_id === evidenceB.id)!;
    return { instance, evidenceAStep, evidenceBStep };
  }

  it("allows reaching complete when an authorized exception is recorded, and records it in context + events", async () => {
    const { instance, evidenceAStep, evidenceBStep } = await independentEvidenceBranchesInstance();

    await expect(completeStepInstance(repo, TOKEN, evidenceAStep.id)).rejects.toBeInstanceOf(IncompleteGateError);

    const { instance: afterException } = await completeStepInstance(repo, TOKEN, evidenceAStep.id, {
      gateException: { authorizedBy: "specialist-approver", reason: "evidence lost on site, verbally confirmed" },
    });
    // The exception excuses the gate check itself (evidenceA's own
    // completion no longer throws), but FR-WI-009's wait-for-all-
    // predecessors is a separate, unaffected rule: "end" still has an
    // unmet predecessor (evidenceB), so the instance legitimately stays
    // running rather than reaching complete.
    expect(afterException.status).toBe("running");
    expect(await repo.getStepInstance(TOKEN, evidenceAStep.id)).toMatchObject({ status: "completed" });

    const events = await repo.listEvents(TOKEN, instance.id);
    const exceptionEvent = events.find((e) => e.event_type === "gate_exception");
    expect(exceptionEvent).toBeDefined();
    expect(exceptionEvent!.payload.authorizedBy).toBe("specialist-approver");

    const instanceAfter = await repo.getInstance(TOKEN, instance.id);
    expect((instanceAfter!.context.gateExceptions as unknown[]).length).toBe(1);

    // Completing the last remaining predecessor (no gate issue now —
    // nothing gated is outstanding once evidenceB itself completes)
    // reaches "end" and finishes the instance.
    const { instance: finalInstance } = await completeStepInstance(repo, TOKEN, evidenceBStep.id);
    expect(finalInstance.status).toBe("completed");
  });
});

describe("completeStepInstance guards", () => {
  let repo: FakeWorkflowRepository;

  beforeEach(() => {
    repo = new FakeWorkflowRepository();
  });

  it("rejects completing a step instance that is already completed", async () => {
    const { definition } = await publishGraph(
      repo,
      "double-complete",
      [
        { key: "start", type: "create_task" },
        { key: "end", type: "complete" },
      ],
      [{ from: "start", to: "end" }],
    );
    const { instance } = await startWorkflowInstance(repo, TOKEN, definition.id, USER);
    const step = (await repo.listStepInstances(TOKEN, instance.id))[0]!;
    await completeStepInstance(repo, TOKEN, step.id);
    await expect(completeStepInstance(repo, TOKEN, step.id)).rejects.toBeInstanceOf(StepInstanceNotActionableError);
  });
});
