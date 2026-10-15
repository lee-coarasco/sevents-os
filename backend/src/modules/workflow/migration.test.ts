import { describe, expect, it } from "vitest";
import { classifyInstance, computeImpactSummary } from "./migration.js";
import type { WorkflowNode, WorkflowStepInstance, WorkflowVersionGraph } from "./types.js";

function node(id: string, versionId: string, nodeKey: string, nodeType: WorkflowNode["node_type"] = "create_task"): WorkflowNode {
  return { id, tenant_id: "t", workflow_version_id: versionId, node_key: nodeKey, node_type: nodeType, config: {} };
}

function graph(nodes: WorkflowNode[]): WorkflowVersionGraph {
  return { nodes, transitions: [], conditions: [] };
}

function step(id: string, nodeId: string, status: WorkflowStepInstance["status"] = "waiting"): WorkflowStepInstance {
  return {
    id,
    tenant_id: "t",
    workflow_instance_id: "instance-1",
    node_id: nodeId,
    status,
    assigned_to: null,
    started_at: new Date(0).toISOString(),
    completed_at: null,
    output: {},
  };
}

describe("classifyInstance", () => {
  it("is auto-mappable when every open step's node_key exists in the target version", () => {
    const fromGraph = graph([node("n1", "v1", "approve")]);
    const toGraph = graph([node("n1b", "v2", "approve")]);
    const entry = classifyInstance("instance-1", [step("s1", "n1")], fromGraph, toGraph);
    expect(entry.autoMappable).toBe(true);
    expect(entry.nodeIdMap).toEqual({ n1: "n1b" });
    expect(entry.unmappedNodeKeys).toEqual([]);
  });

  it("is not auto-mappable when an open step's node_key has no counterpart in the target version", () => {
    const fromGraph = graph([node("n1", "v1", "approve")]);
    const toGraph = graph([node("n1b", "v2", "renamed_approve")]);
    const entry = classifyInstance("instance-1", [step("s1", "n1")], fromGraph, toGraph);
    expect(entry.autoMappable).toBe(false);
    expect(entry.unmappedNodeKeys).toEqual(["approve"]);
  });

  it("is not auto-mappable when any one of several open steps fails to map (fan-out)", () => {
    const fromGraph = graph([node("n1", "v1", "evidence"), node("n2", "v1", "approve")]);
    const toGraph = graph([node("n1b", "v2", "evidence")]);
    const entry = classifyInstance("instance-1", [step("s1", "n1"), step("s2", "n2")], fromGraph, toGraph);
    expect(entry.autoMappable).toBe(false);
    expect(entry.nodeIdMap).toEqual({ n1: "n1b" });
    expect(entry.unmappedNodeKeys).toEqual(["approve"]);
  });

  it("is not auto-mappable when there are no open steps at all", () => {
    const entry = classifyInstance("instance-1", [], graph([]), graph([]));
    expect(entry.autoMappable).toBe(false);
    expect(entry.openStepInstanceIds).toEqual([]);
  });
});

describe("computeImpactSummary", () => {
  it("aggregates per-instance classifications into summary counts", () => {
    const fromGraph = graph([node("n1", "v1", "approve"), node("n2", "v1", "evidence")]);
    const toGraph = graph([node("n1b", "v2", "approve")]);
    const summary = computeImpactSummary("v1", "v2", fromGraph, toGraph, [
      { workflowInstanceId: "instance-1", openSteps: [step("s1", "n1")] },
      { workflowInstanceId: "instance-2", openSteps: [step("s2", "n2")] },
    ]);
    expect(summary.totalRunningInstances).toBe(2);
    expect(summary.autoMappableCount).toBe(1);
    expect(summary.manualMappingCount).toBe(1);
  });
});
