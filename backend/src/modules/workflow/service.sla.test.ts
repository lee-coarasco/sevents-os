import { beforeEach, describe, expect, it } from "vitest";
import { FakeWorkflowRepository } from "../../test/fakeWorkflowRepository.js";
import { SlaDefinitionNotFoundError, createEscalationRung, createSlaDefinition, evaluateStepSla } from "./service.js";

const TOKEN = "token-a";

describe("evaluateStepSla (ticket 0081, M31a)", () => {
  let repo: FakeWorkflowRepository;

  beforeEach(() => {
    repo = new FakeWorkflowRepository();
  });

  async function openStepWithNode(config: Record<string, unknown>) {
    const instance = await repo.createInstance(TOKEN, {
      definitionId: "def-1",
      versionId: "version-1",
      startedBy: "admin-user",
      context: {},
    });
    repo.nodesById.set("node-1", {
      id: "node-1",
      tenant_id: "tenant-a",
      workflow_version_id: "version-1",
      node_key: "rfi_response",
      node_type: "create_task",
      config,
    });
    return repo.createStepInstance(TOKEN, {
      instanceId: instance.id,
      nodeId: "node-1",
      status: "waiting",
      assignedTo: "alice",
    });
  }

  it("returns not_configured when the node carries no slaDefinitionKey", async () => {
    const step = await openStepWithNode({});

    const state = await evaluateStepSla(repo, TOKEN, step.id);

    expect(state.status).toBe("not_configured");
    expect(repo.events).toHaveLength(0);
  });

  it("throws SlaDefinitionNotFoundError for a dangling slaDefinitionKey", async () => {
    const step = await openStepWithNode({ slaDefinitionKey: "does-not-exist" });

    await expect(evaluateStepSla(repo, TOKEN, step.id)).rejects.toBeInstanceOf(SlaDefinitionNotFoundError);
  });

  it("emits timer_fired once on warning, and escalated once per rung on breach — idempotently across repeat calls", async () => {
    const sla = await createSlaDefinition(repo, TOKEN, {
      key: "rfi_response",
      name: "RFI response",
      warningThresholdSeconds: 3600,
      breachThresholdSeconds: 7200,
      createdBy: "admin-user",
    });
    await createEscalationRung(repo, TOKEN, {
      slaDefinitionId: sla.id,
      rungOrder: 1,
      delayAfterBreachSeconds: 0,
      actionType: "notify_owner",
    });
    const step = await openStepWithNode({ slaDefinitionKey: "rfi_response" });
    // Push the step's own started_at far enough into the past to be breached right now.
    repo.stepInstancesById.set(step.id, { ...step, started_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString() });

    const first = await evaluateStepSla(repo, TOKEN, step.id);
    expect(first.status).toBe("breached");
    expect(first.activeRungOrder).toBe(1);
    expect(repo.events.filter((e) => e.event_type === "timer_fired")).toHaveLength(1);
    expect(repo.events.filter((e) => e.event_type === "escalated")).toHaveLength(1);

    const second = await evaluateStepSla(repo, TOKEN, step.id);
    expect(second.status).toBe("breached");
    // Re-evaluating does not emit a second timer_fired/escalated for the same rung.
    expect(repo.events.filter((e) => e.event_type === "timer_fired")).toHaveLength(1);
    expect(repo.events.filter((e) => e.event_type === "escalated")).toHaveLength(1);
  });

  it("pauses SLA accrual while the step is blocked (never breaches if the pause covers the whole elapsed window)", async () => {
    const sla = await createSlaDefinition(repo, TOKEN, {
      key: "rfi_response",
      name: "RFI response",
      warningThresholdSeconds: 3600,
      breachThresholdSeconds: 7200,
      createdBy: "admin-user",
    });
    const step = await openStepWithNode({ slaDefinitionKey: "rfi_response" });
    const startedAt = new Date(Date.now() - 8 * 3600 * 1000);
    repo.stepInstancesById.set(step.id, { ...step, started_at: startedAt.toISOString() });
    // Blocked for the entire 8h window (still blocked now) — paused time cancels out elapsed time.
    repo.events.push({
      id: "evt-1",
      tenant_id: "tenant-a",
      workflow_instance_id: step.workflow_instance_id,
      step_instance_id: step.id,
      event_type: "task_blocked",
      payload: {},
      created_at: startedAt.toISOString(),
    });

    const state = await evaluateStepSla(repo, TOKEN, step.id);

    expect(state.status).toBe("on_time");
    void sla;
  });
});
