import type { ValidationFinding, ValidationResult, WorkflowVersionGraph } from "./types.js";

const TERMINAL_NODE_TYPES = new Set(["complete", "cancel"]);

/**
 * A start candidate is a node nothing transitions into that itself
 * transitions somewhere — this excludes a fully isolated orphan node
 * (no incoming AND no outgoing transition), which would otherwise look
 * identical to a legitimate start and mask itself from the
 * unreachable-node check below.
 */
export function findStartNodeIds(graph: WorkflowVersionGraph): string[] {
  const hasIncoming = new Set(graph.transitions.map((t) => t.to_node_id));
  const hasOutgoing = new Set(graph.transitions.map((t) => t.from_node_id));
  return graph.nodes.filter((n) => !hasIncoming.has(n.id) && hasOutgoing.has(n.id)).map((n) => n.id);
}

function adjacency(graph: WorkflowVersionGraph): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const node of graph.nodes) map.set(node.id, []);
  for (const transition of graph.transitions) {
    const list = map.get(transition.from_node_id);
    if (list) list.push(transition.to_node_id);
  }
  return map;
}

function reachableFrom(startIds: string[], adj: Map<string, string[]>): Set<string> {
  const visited = new Set<string>(startIds);
  const stack = [...startIds];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const next of adj.get(current) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        stack.push(next);
      }
    }
  }
  return visited;
}

/**
 * Structural validation for a workflow version's graph (BRD §5.4.2:
 * "validate... workflow graph integrity, missing transitions, circular
 * dependencies... unsafe agent permissions"). Pure function: no DB
 * access of its own — the caller resolves `knownRoleIds` first so this
 * stays unit-testable without a repository.
 */
export function validateGraph(graph: WorkflowVersionGraph, knownRoleIds: Set<string>): { result: ValidationResult; findings: ValidationFinding[] } {
  const findings: ValidationFinding[] = [];

  const startIds = findStartNodeIds(graph);
  if (startIds.length !== 1) {
    findings.push({
      code: "AMBIGUOUS_START",
      severity: "error",
      message: `expected exactly one node with no incoming transition, found ${startIds.length}`,
    });
  }

  const adj = adjacency(graph);
  const reachable = startIds.length > 0 ? reachableFrom(startIds, adj) : new Set<string>();

  for (const node of graph.nodes) {
    if (!reachable.has(node.id)) {
      findings.push({
        code: "UNREACHABLE_NODE",
        severity: "error",
        message: `node "${node.node_key}" is not reachable from the start node`,
        nodeId: node.id,
      });
    }
  }

  const hasTerminal = graph.nodes.some((n) => TERMINAL_NODE_TYPES.has(n.node_type));
  if (!hasTerminal) {
    findings.push({ code: "NO_TERMINAL_NODE", severity: "error", message: "graph has no complete/cancel node" });
  }

  // A reachable node sits on a "no-exit cycle" if it can reach itself
  // again without ever reaching a terminal node.
  const terminalIds = new Set(graph.nodes.filter((n) => TERMINAL_NODE_TYPES.has(n.node_type)).map((n) => n.id));
  const canReachTerminal = new Set<string>();
  for (const node of graph.nodes) {
    if (!reachable.has(node.id)) continue;
    const seen = reachableFrom([node.id], adj);
    if ([...seen].some((id) => terminalIds.has(id))) canReachTerminal.add(node.id);
  }
  for (const node of graph.nodes) {
    if (!reachable.has(node.id) || canReachTerminal.has(node.id)) continue;
    const seenFromNode = reachableFrom(adj.get(node.id) ?? [], adj);
    if (seenFromNode.has(node.id)) {
      findings.push({
        code: "CIRCULAR_NO_EXIT",
        severity: "error",
        message: `node "${node.node_key}" sits on a cycle with no path to a complete/cancel node`,
        nodeId: node.id,
      });
    }
  }

  for (const node of graph.nodes) {
    if (node.node_type === "assign_role_user") {
      const roleId = typeof node.config.roleId === "string" ? node.config.roleId : null;
      if (!roleId || !knownRoleIds.has(roleId)) {
        findings.push({
          code: "DANGLING_ROLE_REFERENCE",
          severity: "error",
          message: `node "${node.node_key}" references unknown role "${roleId ?? "(none)"}"`,
          nodeId: node.id,
        });
      }
    }
  }

  const conditionIds = new Set(graph.conditions.map((c) => c.id));
  for (const transition of graph.transitions) {
    if (transition.condition_id && !conditionIds.has(transition.condition_id)) {
      findings.push({
        code: "DANGLING_CONDITION_REFERENCE",
        severity: "error",
        message: `transition from ${transition.from_node_id} references a condition not present in this version`,
      });
    }
  }

  const result: ValidationResult = findings.some((f) => f.severity === "error") ? "fail" : "pass";
  return { result, findings };
}
