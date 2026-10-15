import { describe, expect, it } from "vitest";
import { simulateGraph } from "./simulation.js";
import type { WorkflowCondition, WorkflowNode, WorkflowTransition, WorkflowVersionGraph } from "./types.js";

function node(id: string, nodeKey: string, nodeType: WorkflowNode["node_type"]): WorkflowNode {
  return { id, tenant_id: "t", workflow_version_id: "v", node_key: nodeKey, node_type: nodeType, config: {} };
}

function transition(id: string, fromNodeId: string, toNodeId: string, conditionId: string | null, orderIndex: number): WorkflowTransition {
  return { id, tenant_id: "t", workflow_version_id: "v", from_node_id: fromNodeId, to_node_id: toNodeId, condition_id: conditionId, order_index: orderIndex };
}

function condition(id: string, value: number): WorkflowCondition {
  return { id, tenant_id: "t", workflow_version_id: "v", expression: { field: "amount", operator: "gt", value }, description: null };
}

describe("simulateGraph", () => {
  // start -(amount>1000)-> high_value_approval -> end
  //       -(default)-----> auto_approve -> end
  const graph: WorkflowVersionGraph = {
    nodes: [
      node("start", "start", "evaluate_condition"),
      node("high", "high_value_approval", "request_approval"),
      node("auto", "auto_approve", "create_task"),
      node("end", "end", "complete"),
    ],
    transitions: [
      transition("t1", "start", "high", "c1", 0),
      transition("t2", "start", "auto", null, 1),
      transition("t3", "high", "end", null, 0),
      transition("t4", "auto", "end", null, 0),
    ],
    conditions: [condition("c1", 1000)],
  };

  it("takes the conditioned branch when the test case matches", () => {
    const result = simulateGraph(graph, "start", [{ label: "big order", input: { amount: 5000 } }]);
    expect(result.paths[0]!.path).toEqual(["start", "high_value_approval", "end"]);
  });

  it("falls back to the default branch when the condition does not match", () => {
    const result = simulateGraph(graph, "start", [{ label: "small order", input: { amount: 10 } }]);
    expect(result.paths[0]!.path).toEqual(["start", "auto_approve", "end"]);
  });

  it("flags a branch no supplied test case ever reaches as uncovered", () => {
    const result = simulateGraph(graph, "start", [{ label: "small order", input: { amount: 10 } }]);
    expect(result.unreachedNodeKeys).toContain("high_value_approval");
    expect(result.unreachedNodeKeys).not.toContain("auto_approve");
  });

  it("reports full branch coverage when test cases exercise every path", () => {
    const result = simulateGraph(graph, "start", [
      { label: "big order", input: { amount: 5000 } },
      { label: "small order", input: { amount: 10 } },
    ]);
    expect(result.unreachedNodeKeys).toEqual([]);
  });
});
