import { beforeEach, describe, expect, it } from "vitest";
import { FakeWorkflowRepository } from "../../test/fakeWorkflowRepository.js";
import {
  MigrationNotApprovedError,
  addNodeToVersion,
  addTransitionToVersion,
  approveMigration,
  cancelMigration,
  createDraftVersion,
  createMigration,
  createWorkflowDefinition,
  executeMigration,
  previewMigration,
  publishVersion,
  recordApproval,
  startWorkflowInstance,
  submitForApproval,
  validateVersion,
} from "./service.js";
import type { NodeType } from "./types.js";

const TOKEN = "caller-token";
const USER = "process-owner";
const APPROVER = "specialist-approver";

/**
 * Publishes a fresh version (v1) for a brand new definition, same
 * node/edge-driven shape as runtime.test.ts's publishGraph, but also
 * exposed here so this file can drive a second published version
 * (v2/v3) for the *same* definition via createDraftVersion.
 */
async function publishGraph(
  repo: FakeWorkflowRepository,
  key: string,
  nodes: { key: string; type: NodeType; config?: Record<string, unknown> }[],
  edges: { from: string; to: string }[],
) {
  const { definition, version } = await createWorkflowDefinition(repo, TOKEN, { key, name: key }, USER);
  return publishNodesOnVersion(repo, definition.id, version.id, nodes, edges);
}

async function publishNewVersion(
  repo: FakeWorkflowRepository,
  definitionId: string,
  nodes: { key: string; type: NodeType; config?: Record<string, unknown> }[],
  edges: { from: string; to: string }[],
) {
  const version = await createDraftVersion(repo, TOKEN, definitionId, USER);
  return publishNodesOnVersion(repo, definitionId, version.id, nodes, edges);
}

async function publishNodesOnVersion(
  repo: FakeWorkflowRepository,
  definitionId: string,
  versionId: string,
  nodes: { key: string; type: NodeType; config?: Record<string, unknown> }[],
  edges: { from: string; to: string }[],
) {
  const nodeIdByKey = new Map<string, string>();
  for (const n of nodes) {
    const node = await addNodeToVersion(repo, TOKEN, versionId, { nodeKey: n.key, nodeType: n.type, config: n.config ?? {} });
    nodeIdByKey.set(n.key, node.id);
  }
  for (const [index, e] of edges.entries()) {
    await addTransitionToVersion(repo, TOKEN, versionId, {
      fromNodeId: nodeIdByKey.get(e.from)!,
      toNodeId: nodeIdByKey.get(e.to)!,
      orderIndex: index,
    });
  }
  await validateVersion(repo, TOKEN, versionId, USER);
  await submitForApproval(repo, TOKEN, definitionId, versionId, USER);
  await recordApproval(repo, TOKEN, definitionId, versionId, APPROVER, "approved", null);
  const published = await publishVersion(repo, TOKEN, definitionId, versionId, APPROVER);
  return { versionId: published.id, nodeIdByKey };
}

describe("workflow migration lifecycle (ticket 0063, M06d)", () => {
  let repo: FakeWorkflowRepository;

  beforeEach(() => {
    repo = new FakeWorkflowRepository();
  });

  it("preview is read-only and classifies a running instance as auto-mappable when its open node_key survives into the target version", async () => {
    const { definition } = await createWorkflowDefinition(repo, TOKEN, { key: "pv-auto", name: "pv-auto" }, USER);
    const { versionId: v1Id } = await publishNodesOnVersion(
      repo,
      definition.id,
      (await repo.listVersions(TOKEN, definition.id))[0]!.id,
      [
        { key: "start", type: "create_task" },
        { key: "end", type: "complete" },
      ],
      [{ from: "start", to: "end" }],
    );

    const { instance } = await startWorkflowInstance(repo, TOKEN, definition.id, USER);
    expect(instance.workflow_version_id).toBe(v1Id);
    const openStepsBefore = await repo.listStepInstances(TOKEN, instance.id);

    const { versionId: v2Id } = await publishNewVersion(
      repo,
      definition.id,
      [
        { key: "start", type: "create_task" },
        { key: "end", type: "complete" },
      ],
      [{ from: "start", to: "end" }],
    );

    const migration = await createMigration(repo, TOKEN, v1Id, v2Id, USER);
    expect(migration.status).toBe("draft");

    const previewed = await previewMigration(repo, TOKEN, migration.id);
    expect(previewed.status).toBe("previewed");
    expect(previewed.impact_summary!.totalRunningInstances).toBe(1);
    expect(previewed.impact_summary!.autoMappableCount).toBe(1);
    expect(previewed.impact_summary!.manualMappingCount).toBe(0);

    // Read-only: the running instance and its step instances are untouched by preview.
    const instanceAfterPreview = await repo.getInstance(TOKEN, instance.id);
    expect(instanceAfterPreview!.workflow_version_id).toBe(v1Id);
    const openStepsAfter = await repo.listStepInstances(TOKEN, instance.id);
    expect(openStepsAfter).toEqual(openStepsBefore);
  });

  it("classifies a running instance as needing manual mapping when its open node_key has no counterpart in the target version", async () => {
    const { definition } = await createWorkflowDefinition(repo, TOKEN, { key: "pv-manual", name: "pv-manual" }, USER);
    const { versionId: v1Id } = await publishNodesOnVersion(
      repo,
      definition.id,
      (await repo.listVersions(TOKEN, definition.id))[0]!.id,
      [
        { key: "start", type: "create_task" },
        { key: "end", type: "complete" },
      ],
      [{ from: "start", to: "end" }],
    );

    await startWorkflowInstance(repo, TOKEN, definition.id, USER);

    const { versionId: v2Id } = await publishNewVersion(
      repo,
      definition.id,
      [
        { key: "kickoff", type: "create_task" },
        { key: "end", type: "complete" },
      ],
      [{ from: "kickoff", to: "end" }],
    );

    const migration = await createMigration(repo, TOKEN, v1Id, v2Id, USER);
    const previewed = await previewMigration(repo, TOKEN, migration.id);
    expect(previewed.impact_summary!.autoMappableCount).toBe(0);
    expect(previewed.impact_summary!.manualMappingCount).toBe(1);
    expect(previewed.impact_summary!.entries[0]!.unmappedNodeKeys).toEqual(["start"]);
  });

  it("cannot execute without a prior approval (status must be approved, not just previewed)", async () => {
    const { definition } = await createWorkflowDefinition(repo, TOKEN, { key: "no-approval", name: "no-approval" }, USER);
    const { versionId: v1Id } = await publishNodesOnVersion(
      repo,
      definition.id,
      (await repo.listVersions(TOKEN, definition.id))[0]!.id,
      [
        { key: "start", type: "create_task" },
        { key: "end", type: "complete" },
      ],
      [{ from: "start", to: "end" }],
    );
    const { versionId: v2Id } = await publishNewVersion(
      repo,
      definition.id,
      [
        { key: "start", type: "create_task" },
        { key: "end", type: "complete" },
      ],
      [{ from: "start", to: "end" }],
    );

    await startWorkflowInstance(repo, TOKEN, definition.id, USER);
    const migration = await createMigration(repo, TOKEN, v1Id, v2Id, USER);

    // Freshly created (draft), never previewed or approved.
    await expect(executeMigration(repo, TOKEN, migration.id, APPROVER)).rejects.toBeInstanceOf(MigrationNotApprovedError);

    // Previewed, but still not approved.
    await previewMigration(repo, TOKEN, migration.id);
    await expect(executeMigration(repo, TOKEN, migration.id, APPROVER)).rejects.toBeInstanceOf(MigrationNotApprovedError);

    // Only after approveMigration does execute succeed.
    await approveMigration(repo, TOKEN, migration.id, APPROVER);
    await expect(executeMigration(repo, TOKEN, migration.id, APPROVER)).resolves.toBeTruthy();
  });

  it("execute moves only the auto-mappable instance, leaves the non-mappable one untouched on its original version, and records events + results for both", async () => {
    const { definition } = await createWorkflowDefinition(repo, TOKEN, { key: "exec-mixed", name: "exec-mixed" }, USER);
    const { versionId: v1Id } = await publishNodesOnVersion(
      repo,
      definition.id,
      (await repo.listVersions(TOKEN, definition.id))[0]!.id,
      [
        { key: "start", type: "create_task" },
        { key: "end", type: "complete" },
      ],
      [{ from: "start", to: "end" }],
    );

    const { instance: mappableInstance } = await startWorkflowInstance(repo, TOKEN, definition.id, USER);
    expect(mappableInstance.workflow_version_id).toBe(v1Id);
    const [mappableOpenStep] = await repo.listStepInstances(TOKEN, mappableInstance.id);

    // v2 keeps the "start" node_key, so an instance open on it is auto-mappable.
    const { versionId: v2Id } = await publishNewVersion(
      repo,
      definition.id,
      [
        { key: "start", type: "create_task" },
        { key: "end", type: "complete" },
      ],
      [{ from: "start", to: "end" }],
    );

    const migration = await createMigration(repo, TOKEN, v1Id, v2Id, USER);
    await previewMigration(repo, TOKEN, migration.id);
    await approveMigration(repo, TOKEN, migration.id, APPROVER);
    const { migration: executed, results } = await executeMigration(repo, TOKEN, migration.id, APPROVER);

    expect(executed.status).toBe("executed");
    expect(executed.executed_by).toBe(APPROVER);
    expect(executed.executed_at).toBeTruthy();

    expect(results).toHaveLength(1);
    expect(results[0]!.outcome).toBe("migrated");
    expect(results[0]!.workflow_instance_id).toBe(mappableInstance.id);
    expect(results[0]!.old_step_instance_id).toBe(mappableOpenStep!.id);
    expect(results[0]!.new_step_instance_id).toBeTruthy();

    // Instance pointer actually moved to the target version.
    const movedInstance = await repo.getInstance(TOKEN, mappableInstance.id);
    expect(movedInstance!.workflow_version_id).toBe(v2Id);

    // Old step instance is superseded, not deleted; new one exists and is the one recorded.
    const oldStep = await repo.getStepInstance(TOKEN, mappableOpenStep!.id);
    expect(oldStep!.status).toBe("skipped");
    const newStep = await repo.getStepInstance(TOKEN, results[0]!.new_step_instance_id!);
    expect(newStep).toBeTruthy();
    expect(newStep!.workflow_instance_id).toBe(mappableInstance.id);

    // An audited workflow_events row for the migration exists on this instance.
    const events = await repo.listEvents(TOKEN, mappableInstance.id);
    expect(events.some((e) => e.event_type === "migrated")).toBe(true);
  });

  it("execute leaves a non-mappable instance on its original version and records it as skipped", async () => {
    const { definition } = await createWorkflowDefinition(repo, TOKEN, { key: "exec-skip", name: "exec-skip" }, USER);
    const { versionId: v1Id } = await publishNodesOnVersion(
      repo,
      definition.id,
      (await repo.listVersions(TOKEN, definition.id))[0]!.id,
      [
        { key: "start", type: "create_task" },
        { key: "end", type: "complete" },
      ],
      [{ from: "start", to: "end" }],
    );

    const { instance } = await startWorkflowInstance(repo, TOKEN, definition.id, USER);
    const [openStep] = await repo.listStepInstances(TOKEN, instance.id);

    // v2 renames "start" -> "kickoff": no safe 1:1 mapping for an instance open on "start".
    const { versionId: v2Id } = await publishNewVersion(
      repo,
      definition.id,
      [
        { key: "kickoff", type: "create_task" },
        { key: "end", type: "complete" },
      ],
      [{ from: "kickoff", to: "end" }],
    );

    const migration = await createMigration(repo, TOKEN, v1Id, v2Id, USER);
    await previewMigration(repo, TOKEN, migration.id);
    await approveMigration(repo, TOKEN, migration.id, APPROVER);
    const { results } = await executeMigration(repo, TOKEN, migration.id, APPROVER);

    expect(results).toHaveLength(1);
    expect(results[0]!.outcome).toBe("skipped");
    expect(results[0]!.new_step_instance_id).toBeNull();

    // Untouched: still on v1, step instance still exactly as it was.
    const untouchedInstance = await repo.getInstance(TOKEN, instance.id);
    expect(untouchedInstance!.workflow_version_id).toBe(v1Id);
    const stepAfter = await repo.getStepInstance(TOKEN, openStep!.id);
    expect(stepAfter!.status).toBe(openStep!.status);

    const events = await repo.listEvents(TOKEN, instance.id);
    expect(events.some((e) => e.event_type === "migrated")).toBe(false);
  });

  it("cancelMigration can cancel a draft or previewed migration but not an already-executed one", async () => {
    const { definition } = await createWorkflowDefinition(repo, TOKEN, { key: "cancel-flow", name: "cancel-flow" }, USER);
    const { versionId: v1Id } = await publishNodesOnVersion(
      repo,
      definition.id,
      (await repo.listVersions(TOKEN, definition.id))[0]!.id,
      [
        { key: "start", type: "create_task" },
        { key: "end", type: "complete" },
      ],
      [{ from: "start", to: "end" }],
    );
    const { versionId: v2Id } = await publishNewVersion(
      repo,
      definition.id,
      [
        { key: "start", type: "create_task" },
        { key: "end", type: "complete" },
      ],
      [{ from: "start", to: "end" }],
    );

    await startWorkflowInstance(repo, TOKEN, definition.id, USER);
    const migration = await createMigration(repo, TOKEN, v1Id, v2Id, USER);
    const cancelled = await cancelMigration(repo, TOKEN, migration.id);
    expect(cancelled.status).toBe("cancelled");

    const migration2 = await createMigration(repo, TOKEN, v1Id, v2Id, USER);
    await previewMigration(repo, TOKEN, migration2.id);
    await approveMigration(repo, TOKEN, migration2.id, APPROVER);
    await executeMigration(repo, TOKEN, migration2.id, APPROVER);
    await expect(cancelMigration(repo, TOKEN, migration2.id)).rejects.toThrow();
  });
});
