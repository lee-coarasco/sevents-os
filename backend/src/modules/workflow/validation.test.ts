import { describe, expect, it } from "vitest";
import { validateGraph } from "./validation.js";
import type { WorkflowCondition, WorkflowNode, WorkflowTransition, WorkflowVersionGraph } from "./types.js";

function node(id: string, nodeKey: string, nodeType: WorkflowNode["node_type"], config: Record<string, unknown> = {}): WorkflowNode {
  return { id, tenant_id: "t", workflow_version_id: "v", node_key: nodeKey, node_type: nodeType, config };
}

function transition(id: string, fromNodeId: string, toNodeId: string, conditionId: string | null = null, orderIndex = 0): WorkflowTransition {
  return { id, tenant_id: "t", workflow_version_id: "v", from_node_id: fromNodeId, to_node_id: toNodeId, condition_id: conditionId, order_index: orderIndex };
}

function condition(id: string): WorkflowCondition {
  return { id, tenant_id: "t", workflow_version_id: "v", expression: { field: "amount", operator: "gt", value: 0 }, description: null };
}

describe("validateGraph", () => {
  it("passes a well-formed start -> complete graph", () => {
    const graph: WorkflowVersionGraph = {
      nodes: [node("n1", "start", "create_task"), node("n2", "end", "complete")],
      transitions: [transition("t1", "n1", "n2")],
      conditions: [],
    };
    const { result, findings } = validateGraph(graph, new Set());
    expect(result).toBe("pass");
    expect(findings).toEqual([]);
  });

  it("flags an unreachable node", () => {
    const graph: WorkflowVersionGraph = {
      nodes: [node("n1", "start", "create_task"), node("n2", "end", "complete"), node("n3", "orphan", "send_notification")],
      transitions: [transition("t1", "n1", "n2")],
      conditions: [],
    };
    const { result, findings } = validateGraph(graph, new Set());
    expect(result).toBe("fail");
    expect(findings.some((f) => f.code === "UNREACHABLE_NODE" && f.nodeId === "n3")).toBe(true);
  });

  it("flags a graph with no terminal node", () => {
    const graph: WorkflowVersionGraph = {
      nodes: [node("n1", "start", "create_task"), node("n2", "loop", "send_notification")],
      transitions: [transition("t1", "n1", "n2"), transition("t2", "n2", "n1")],
      conditions: [],
    };
    const { result, findings } = validateGraph(graph, new Set());
    expect(result).toBe("fail");
    expect(findings.some((f) => f.code === "NO_TERMINAL_NODE")).toBe(true);
  });

  it("flags a cycle that can never reach a terminal node even though one exists elsewhere", () => {
    const graph: WorkflowVersionGraph = {
      nodes: [
        node("n0", "start", "create_task"),
        node("n1", "loop_a", "send_notification"),
        node("n2", "loop_b", "send_notification"),
        node("n3", "end", "complete"),
      ],
      transitions: [
        transition("t0", "n0", "n1"),
        transition("t1", "n1", "n2"),
        transition("t2", "n2", "n1"), // n1 <-> n2 cycle, reachable from start but never reaches n3
      ],
      conditions: [],
    };
    const { result, findings } = validateGraph(graph, new Set());
    expect(result).toBe("fail");
    expect(findings.some((f) => f.code === "CIRCULAR_NO_EXIT" && f.nodeId === "n1")).toBe(true);
    expect(findings.some((f) => f.code === "CIRCULAR_NO_EXIT" && f.nodeId === "n2")).toBe(true);
    // n3 is also unreachable since nothing transitions to it.
    expect(findings.some((f) => f.code === "UNREACHABLE_NODE" && f.nodeId === "n3")).toBe(true);
  });

  it("flags a dangling role reference on an assign_role_user node", () => {
    const graph: WorkflowVersionGraph = {
      nodes: [
        node("n1", "start", "assign_role_user", { roleId: "role.nonexistent" }),
        node("n2", "end", "complete"),
      ],
      transitions: [transition("t1", "n1", "n2")],
      conditions: [],
    };
    const { result, findings } = validateGraph(graph, new Set(["role.known"]));
    expect(result).toBe("fail");
    expect(findings.some((f) => f.code === "DANGLING_ROLE_REFERENCE")).toBe(true);
  });

  it("accepts an assign_role_user node whose role is known", () => {
    const graph: WorkflowVersionGraph = {
      nodes: [node("n1", "start", "assign_role_user", { roleId: "role.known" }), node("n2", "end", "complete")],
      transitions: [transition("t1", "n1", "n2")],
      conditions: [],
    };
    const { result } = validateGraph(graph, new Set(["role.known"]));
    expect(result).toBe("pass");
  });

  it("flags a transition referencing a condition not present in this version", () => {
    const graph: WorkflowVersionGraph = {
      nodes: [node("n1", "start", "evaluate_condition"), node("n2", "end", "complete")],
      transitions: [transition("t1", "n1", "n2", "condition-not-in-graph")],
      conditions: [condition("c1")],
    };
    const { result, findings } = validateGraph(graph, new Set());
    expect(result).toBe("fail");
    expect(findings.some((f) => f.code === "DANGLING_CONDITION_REFERENCE")).toBe(true);
  });
});
