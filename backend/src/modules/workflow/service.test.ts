import { beforeEach, describe, expect, it } from "vitest";
import { FakeWorkflowRepository } from "../../test/fakeWorkflowRepository.js";
import {
  DefinitionNotApprovedError,
  DefinitionNotDraftError,
  DefinitionNotUnderReviewError,
  InvalidNodeTypeError,
  NoStartNodeError,
  RollbackTargetNotPublishedError,
  VersionNotDraftError,
  VersionNotValidatedError,
  addConditionToVersion,
  addNodeToVersion,
  addTransitionToVersion,
  createDraftVersion,
  createWorkflowDefinition,
  getVersionGraph,
  publishVersion,
  recordApproval,
  rollbackToVersion,
  simulateVersion,
  submitForApproval,
  validateVersion,
} from "./service.js";

async function createPublishedDefinition(repo: FakeWorkflowRepository) {
  const { definition, version } = await createPublishableDefinition(repo);
  const published = await publishVersion(repo, TOKEN, definition.id, version.id, APPROVER);
  return { definition, version: published };
}

const TOKEN = "caller-token";
const USER = "process-owner";
const APPROVER = "specialist-approver";

async function createPublishableDefinition(repo: FakeWorkflowRepository) {
  const { definition, version } = await createWorkflowDefinition(
    repo,
    TOKEN,
    { key: "material_request_approval", name: "Material Request Approval" },
    USER,
  );
  const start = await addNodeToVersion(repo, TOKEN, version.id, { nodeKey: "start", nodeType: "create_task" });
  const complete = await addNodeToVersion(repo, TOKEN, version.id, { nodeKey: "complete", nodeType: "complete" });
  await addTransitionToVersion(repo, TOKEN, version.id, { fromNodeId: start.id, toNodeId: complete.id });
  await validateVersion(repo, TOKEN, version.id, USER);
  await submitForApproval(repo, TOKEN, definition.id, version.id, USER);
  await recordApproval(repo, TOKEN, definition.id, version.id, APPROVER, "approved", null);
  return { definition, version };
}

describe("createWorkflowDefinition", () => {
  it("creates a draft definition with an empty draft version 1", async () => {
    const repo = new FakeWorkflowRepository();
    const { definition, version } = await createWorkflowDefinition(
      repo,
      TOKEN,
      { key: "material_request_approval", name: "Material Request Approval" },
      USER,
    );
    expect(definition.status).toBe("draft");
    expect(definition.current_version).toBeNull();
    expect(version.version).toBe(1);
    expect(version.status).toBe("draft");
    expect(repo.changes).toHaveLength(1);
    expect(repo.changes[0]!.change_type).toBe("create");
  });
});

describe("addNodeToVersion", () => {
  let repo: FakeWorkflowRepository;
  let versionId: string;

  beforeEach(async () => {
    repo = new FakeWorkflowRepository();
    const { version } = await createWorkflowDefinition(repo, TOKEN, { key: "k", name: "K" }, USER);
    versionId = version.id;
  });

  it("rejects a node_type outside the BRD §5.4.3 supported set", async () => {
    await expect(
      addNodeToVersion(repo, TOKEN, versionId, { nodeKey: "n1", nodeType: "not_a_real_step_type" as never }),
    ).rejects.toBeInstanceOf(InvalidNodeTypeError);
  });

  it("accepts every BRD §5.4.3 supported step type", async () => {
    const node = await addNodeToVersion(repo, TOKEN, versionId, { nodeKey: "n1", nodeType: "request_approval" });
    expect(node.node_type).toBe("request_approval");
  });

  it("rejects adding a node to a non-draft (published) version", async () => {
    const { version } = await createPublishedDefinition(repo);
    await expect(
      addNodeToVersion(repo, TOKEN, version.id, { nodeKey: "extra", nodeType: "create_task" }),
    ).rejects.toBeInstanceOf(VersionNotDraftError);
  });
});

describe("submit / approve / publish lifecycle", () => {
  let repo: FakeWorkflowRepository;

  beforeEach(() => {
    repo = new FakeWorkflowRepository();
  });

  it("walks draft -> under_review -> approved -> published", async () => {
    const { definition, version } = await createPublishableDefinition(repo);
    const published = await publishVersion(repo, TOKEN, definition.id, version.id, APPROVER);
    expect(published.status).toBe("published");
    expect(published.published_by).toBe(APPROVER);

    const updatedDefinition = await repo.getDefinition(TOKEN, definition.id);
    expect(updatedDefinition!.status).toBe("published");
    expect(updatedDefinition!.current_version).toBe(1);
    expect(repo.publishedConfigurations).toHaveLength(1);
    expect(repo.changes.some((c) => c.change_type === "publish")).toBe(true);
  });

  it("rejects publish when the definition is not yet approved", async () => {
    const { definition, version } = await createWorkflowDefinition(repo, TOKEN, { key: "k2", name: "K2" }, USER);
    await expect(publishVersion(repo, TOKEN, definition.id, version.id, APPROVER)).rejects.toBeInstanceOf(
      DefinitionNotApprovedError,
    );
  });

  it("rejects submitting for approval when not currently draft", async () => {
    const { definition, version } = await createPublishableDefinition(repo); // now approved
    await expect(submitForApproval(repo, TOKEN, definition.id, version.id, USER)).rejects.toBeInstanceOf(
      DefinitionNotDraftError,
    );
  });

  it("rejects recording an approval when not under review", async () => {
    const { definition, version } = await createWorkflowDefinition(repo, TOKEN, { key: "k3", name: "K3" }, USER);
    await expect(
      recordApproval(repo, TOKEN, definition.id, version.id, APPROVER, "approved", null),
    ).rejects.toBeInstanceOf(DefinitionNotUnderReviewError);
  });

  it("a rejection sends the definition back to draft without creating a new version", async () => {
    const { definition, version } = await createWorkflowDefinition(repo, TOKEN, { key: "k4", name: "K4" }, USER);
    await submitForApproval(repo, TOKEN, definition.id, version.id, USER);
    const afterRejection = await recordApproval(repo, TOKEN, definition.id, version.id, APPROVER, "rejected", "needs more detail");
    expect(afterRejection.status).toBe("draft");
    const versions = await repo.listVersions(TOKEN, definition.id);
    expect(versions).toHaveLength(1);
  });

  it("never mutates a previously published version's row when a second version is published", async () => {
    const { definition, version: v1 } = await createPublishableDefinition(repo);
    await publishVersion(repo, TOKEN, definition.id, v1.id, APPROVER);
    const v1AfterFirstPublish = await repo.getVersion(TOKEN, v1.id);

    const v2 = await createDraftVersion(repo, TOKEN, definition.id, USER, v1.id);
    await validateVersion(repo, TOKEN, v2.id, USER);
    await submitForApproval(repo, TOKEN, definition.id, v2.id, USER);
    await recordApproval(repo, TOKEN, definition.id, v2.id, APPROVER, "approved", null);
    await publishVersion(repo, TOKEN, definition.id, v2.id, APPROVER);

    const v1AfterSecondPublish = await repo.getVersion(TOKEN, v1.id);
    expect(v1AfterSecondPublish).toEqual(v1AfterFirstPublish);

    const updatedDefinition = await repo.getDefinition(TOKEN, definition.id);
    expect(updatedDefinition!.current_version).toBe(2);
  });
});

describe("createDraftVersion (cloning)", () => {
  it("clones nodes, conditions and transitions from the source version with remapped ids", async () => {
    const repo = new FakeWorkflowRepository();
    const { definition, version } = await createWorkflowDefinition(repo, TOKEN, { key: "k5", name: "K5" }, USER);
    const condition = await addConditionToVersion(repo, TOKEN, version.id, {
      expression: { field: "amount", operator: "gt", value: 1000 },
    });
    const start = await addNodeToVersion(repo, TOKEN, version.id, { nodeKey: "start", nodeType: "evaluate_condition" });
    const end = await addNodeToVersion(repo, TOKEN, version.id, { nodeKey: "end", nodeType: "complete" });
    await addTransitionToVersion(repo, TOKEN, version.id, { fromNodeId: start.id, toNodeId: end.id, conditionId: condition.id });

    const clone = await createDraftVersion(repo, TOKEN, definition.id, USER, version.id);
    expect(clone.version).toBe(2);

    const graph = await getVersionGraph(repo, TOKEN, clone.id);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.conditions).toHaveLength(1);
    expect(graph.transitions).toHaveLength(1);
    // Cloned rows have new ids, not the originals.
    expect(graph.nodes.every((n) => n.id !== start.id && n.id !== end.id)).toBe(true);
    expect(graph.transitions[0]!.condition_id).toBe(graph.conditions[0]!.id);
  });
});

describe("rollbackToVersion", () => {
  it("creates a new version row pointing back via rollback_of_version, never rewrites the restored version's own row", async () => {
    const repo = new FakeWorkflowRepository();
    const { definition, version: v1 } = await createPublishableDefinition(repo);
    await publishVersion(repo, TOKEN, definition.id, v1.id, APPROVER);
    const v1Snapshot = await repo.getVersion(TOKEN, v1.id);

    const v2 = await createDraftVersion(repo, TOKEN, definition.id, USER, v1.id);
    await validateVersion(repo, TOKEN, v2.id, USER);
    await submitForApproval(repo, TOKEN, definition.id, v2.id, USER);
    await recordApproval(repo, TOKEN, definition.id, v2.id, APPROVER, "approved", null);
    await publishVersion(repo, TOKEN, definition.id, v2.id, APPROVER);

    const rolledBack = await rollbackToVersion(repo, TOKEN, definition.id, 1, "admin-user", "v2 broke something");

    expect(rolledBack.version).toBe(3);
    expect(rolledBack.rollback_of_version).toBe(1);
    expect(rolledBack.status).toBe("published");

    const v1AfterRollback = await repo.getVersion(TOKEN, v1.id);
    expect(v1AfterRollback).toEqual(v1Snapshot);

    const updatedDefinition = await repo.getDefinition(TOKEN, definition.id);
    expect(updatedDefinition!.current_version).toBe(3);

    expect(repo.rollbackEvents).toHaveLength(1);
    expect(repo.rollbackEvents[0]!).toMatchObject({ from_version: 2, to_version: 3 });
  });

  it("rejects rolling back to a version that was never published", async () => {
    const repo = new FakeWorkflowRepository();
    const { definition } = await createWorkflowDefinition(repo, TOKEN, { key: "k6", name: "K6" }, USER);
    await expect(
      rollbackToVersion(repo, TOKEN, definition.id, 1, "admin-user", null),
    ).rejects.toBeInstanceOf(RollbackTargetNotPublishedError);
  });
});

describe("publishVersion requires a passing validation run", () => {
  it("rejects publish when the version has never been validated", async () => {
    const repo = new FakeWorkflowRepository();
    const { definition, version } = await createWorkflowDefinition(repo, TOKEN, { key: "k-novalidate", name: "No Validate" }, USER);
    const start = await addNodeToVersion(repo, TOKEN, version.id, { nodeKey: "start", nodeType: "create_task" });
    const complete = await addNodeToVersion(repo, TOKEN, version.id, { nodeKey: "complete", nodeType: "complete" });
    await addTransitionToVersion(repo, TOKEN, version.id, { fromNodeId: start.id, toNodeId: complete.id });
    await submitForApproval(repo, TOKEN, definition.id, version.id, USER);
    await recordApproval(repo, TOKEN, definition.id, version.id, APPROVER, "approved", null);

    await expect(publishVersion(repo, TOKEN, definition.id, version.id, APPROVER)).rejects.toBeInstanceOf(
      VersionNotValidatedError,
    );
  });

  it("rejects publish when the latest validation run failed", async () => {
    const repo = new FakeWorkflowRepository();
    const { definition, version } = await createWorkflowDefinition(repo, TOKEN, { key: "k-failvalidate", name: "Fail Validate" }, USER);
    // No terminal node -> validation fails.
    await addNodeToVersion(repo, TOKEN, version.id, { nodeKey: "start", nodeType: "create_task" });
    await validateVersion(repo, TOKEN, version.id, USER);
    await submitForApproval(repo, TOKEN, definition.id, version.id, USER);
    await recordApproval(repo, TOKEN, definition.id, version.id, APPROVER, "approved", null);

    await expect(publishVersion(repo, TOKEN, definition.id, version.id, APPROVER)).rejects.toBeInstanceOf(
      VersionNotValidatedError,
    );
  });

  it("allows publish once a passing validation run exists (the createPublishableDefinition path)", async () => {
    const repo = new FakeWorkflowRepository();
    const { definition, version } = await createPublishableDefinition(repo);
    const published = await publishVersion(repo, TOKEN, definition.id, version.id, APPROVER);
    expect(published.status).toBe("published");
  });
});

describe("simulateVersion", () => {
  it("rejects a graph with no unambiguous start node", async () => {
    const repo = new FakeWorkflowRepository();
    const { version } = await createWorkflowDefinition(repo, TOKEN, { key: "k-nostart", name: "No Start" }, USER);
    const a = await addNodeToVersion(repo, TOKEN, version.id, { nodeKey: "a", nodeType: "create_task" });
    const b = await addNodeToVersion(repo, TOKEN, version.id, { nodeKey: "b", nodeType: "complete" });
    // Both a and b have an incoming transition -> no node qualifies as start.
    await addTransitionToVersion(repo, TOKEN, version.id, { fromNodeId: a.id, toNodeId: b.id });
    await addTransitionToVersion(repo, TOKEN, version.id, { fromNodeId: b.id, toNodeId: a.id });
    await expect(simulateVersion(repo, TOKEN, version.id, [{ label: "case", input: {} }], USER)).rejects.toBeInstanceOf(
      NoStartNodeError,
    );
  });

  it("records a simulation run with the walked path", async () => {
    const repo = new FakeWorkflowRepository();
    const { version } = await createPublishableDefinition(repo);
    const run = await simulateVersion(repo, TOKEN, version.id, [{ label: "case", input: {} }], USER);
    expect(run.result.paths[0]!.path).toEqual(["start", "complete"]);
    expect(repo.simulationRuns).toHaveLength(1);
  });
});

describe("configuration_changes audit trail", () => {
  it("writes a row for create, publish and rollback", async () => {
    const repo = new FakeWorkflowRepository();
    const { definition, version } = await createPublishableDefinition(repo);
    await publishVersion(repo, TOKEN, definition.id, version.id, APPROVER);
    await rollbackToVersion(repo, TOKEN, definition.id, 1, "admin-user", "testing rollback audit");

    const types = repo.changes.map((c) => c.change_type);
    expect(types).toContain("create");
    expect(types).toContain("submit");
    expect(types).toContain("approve");
    expect(types).toContain("publish");
    expect(types).toContain("rollback");
  });
});
