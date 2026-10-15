import type {
  ConditionExpression,
  SimulationPathResult,
  SimulationResultPayload,
  SimulationTestCase,
  WorkflowCondition,
  WorkflowNode,
  WorkflowTransition,
  WorkflowVersionGraph,
} from "./types.js";

function evaluateExpression(expression: ConditionExpression, input: Record<string, unknown>): boolean {
  const actual = input[expression.field];
  switch (expression.operator) {
    case "eq":
      return actual === expression.value;
    case "neq":
      return actual !== expression.value;
    case "gt":
      return (actual as number) > (expression.value as number);
    case "gte":
      return (actual as number) >= (expression.value as number);
    case "lt":
      return (actual as number) < (expression.value as number);
    case "lte":
      return (actual as number) <= (expression.value as number);
    default:
      return false;
  }
}

function pickNextTransition(
  outgoing: WorkflowTransition[],
  conditionsById: Map<string, WorkflowCondition>,
  input: Record<string, unknown>,
): WorkflowTransition | null {
  const sorted = [...outgoing].sort((a, b) => a.order_index - b.order_index);
  let fallback: WorkflowTransition | null = null;
  for (const transition of sorted) {
    if (!transition.condition_id) {
      fallback = fallback ?? transition;
      continue;
    }
    const condition = conditionsById.get(transition.condition_id);
    if (condition && evaluateExpression(condition.expression, input)) {
      return transition;
    }
  }
  return fallback;
}

/**
 * Deterministic, pure walk of a version's graph for a set of sample
 * test cases (BRD §5.4.2: "simulate against representative sample
 * cases and show expected paths... branch coverage and unreachable
 * steps"). Never consults an LLM — every branch decision is the same
 * structured condition evaluator ticket 0061's validator reads, just
 * applied step by step instead of statically.
 */
export function simulateGraph(
  graph: WorkflowVersionGraph,
  startNodeId: string,
  testCases: SimulationTestCase[],
): SimulationResultPayload {
  const nodesById = new Map<string, WorkflowNode>(graph.nodes.map((n) => [n.id, n]));
  const conditionsById = new Map<string, WorkflowCondition>(graph.conditions.map((c) => [c.id, c]));
  const outgoingByNode = new Map<string, WorkflowTransition[]>();
  for (const transition of graph.transitions) {
    const list = outgoingByNode.get(transition.from_node_id) ?? [];
    list.push(transition);
    outgoingByNode.set(transition.from_node_id, list);
  }

  const maxSteps = graph.nodes.length * 2 + 2;
  const paths: SimulationPathResult[] = [];
  const visitedAcrossAll = new Set<string>();

  for (const testCase of testCases) {
    const path: string[] = [];
    let currentId: string | null = startNodeId;
    let blockedAtNodeKey: string | null = null;
    let steps = 0;

    while (currentId && steps < maxSteps) {
      const node = nodesById.get(currentId);
      if (!node) break;
      path.push(node.node_key);
      visitedAcrossAll.add(node.node_key);
      steps += 1;

      const outgoing = outgoingByNode.get(currentId) ?? [];
      if (outgoing.length === 0) {
        currentId = null;
        break;
      }
      const next = pickNextTransition(outgoing, conditionsById, testCase.input);
      if (!next) {
        blockedAtNodeKey = node.node_key;
        currentId = null;
        break;
      }
      currentId = next.to_node_id;
    }

    paths.push({ label: testCase.label, path, blockedAtNodeKey });
  }

  const unreachedNodeKeys = graph.nodes.map((n) => n.node_key).filter((key) => !visitedAcrossAll.has(key));
  return { paths, unreachedNodeKeys };
}
