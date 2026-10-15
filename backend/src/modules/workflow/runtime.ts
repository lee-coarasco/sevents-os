import { pickNextTransition } from "./simulation.js";
import type {
  WorkflowCondition,
  WorkflowNode,
  WorkflowStepInstance,
  WorkflowTransition,
  WorkflowVersionGraph,
} from "./types.js";

/**
 * Ticket 0062 (M06c): the step executor. One handler per BRD §5.4.3
 * node type, dispatched from a single map rather than thirteen
 * near-duplicate functions. This module is pure graph/logic helpers —
 * no repository access — so it can be unit tested without a fake
 * repository; service.ts wires it to persistence (creating/completing
 * workflow_step_instances rows and workflow_events).
 */

export class UnregisteredServiceError extends Error {}
export class IncompleteGateError extends Error {}

/**
 * Small hard-coded allow-list of application services `call_service`
 * nodes may invoke — never arbitrary code execution. Each entry is a
 * pure-ish function from (config, context) to a partial context patch
 * that gets merged into the instance's context. Real services (e.g. a
 * PO-number generator, a notification dispatcher) get added here as
 * modules need them; an unregistered name is a typed error, not a crash.
 */
export const REGISTERED_SERVICES: Record<
  string,
  (config: Record<string, unknown>, context: Record<string, unknown>) => Promise<Record<string, unknown>>
> = {
  /** Trivial proof-of-mechanism service: merges its own config into context, unchanged. */
  echo: async (config) => ({ ...config }),
};

export async function callRegisteredService(
  serviceName: string,
  config: Record<string, unknown>,
  context: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const service = REGISTERED_SERVICES[serviceName];
  if (!service) {
    throw new UnregisteredServiceError(`"${serviceName}" is not a registered call_service target`);
  }
  return service(config, context);
}

/** Node types whose step instance is created as `waiting` because a human must act — the M07/M08 seam (see types.ts). */
const WAITING_NODE_TYPES = new Set(["create_task", "assign_role_user", "request_approval"]);

/** Node types that must be completed before a `complete` node is reachable (FR-WI-010), unless an authorized exception is recorded. */
const GATED_NODE_TYPES = new Set(["request_upload_evidence", "request_approval"]);

export function isGatedNodeType(nodeType: string): boolean {
  return GATED_NODE_TYPES.has(nodeType);
}

/**
 * Whether a freshly-reached node should start life as `waiting` (needs
 * a human hand-off M07/M08 will later resolve) or `active` (the
 * executor can resolve it immediately in this same pass, e.g.
 * evaluate_condition, call_service, send_notification).
 */
export function initialStepStatusFor(nodeType: string): "waiting" | "active" {
  return WAITING_NODE_TYPES.has(nodeType) ? "waiting" : "active";
}

/** Graph-indexing helpers shared by the executor, mirroring simulation.ts's internal shape. */
export interface IndexedGraph {
  nodesById: Map<string, WorkflowNode>;
  conditionsById: Map<string, WorkflowCondition>;
  outgoingByNode: Map<string, WorkflowTransition[]>;
  incomingByNode: Map<string, WorkflowTransition[]>;
}

export function indexGraph(graph: WorkflowVersionGraph): IndexedGraph {
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
  const conditionsById = new Map(graph.conditions.map((c) => [c.id, c]));
  const outgoingByNode = new Map<string, WorkflowTransition[]>();
  const incomingByNode = new Map<string, WorkflowTransition[]>();
  for (const transition of graph.transitions) {
    const out = outgoingByNode.get(transition.from_node_id) ?? [];
    out.push(transition);
    outgoingByNode.set(transition.from_node_id, out);
    const inc = incomingByNode.get(transition.to_node_id) ?? [];
    inc.push(transition);
    incomingByNode.set(transition.to_node_id, inc);
  }
  return { nodesById, conditionsById, outgoingByNode, incomingByNode };
}

/**
 * FR-WI-009 fan-out/fan-in semantics at the transition level:
 * - If every outgoing transition is unconditional (no condition_id),
 *   this is a parallel fan-out: activate ALL of them, not just the
 *   first by order_index (different from pickNextTransition's single-
 *   pick behavior, which is for conditional branching).
 * - If any outgoing transition carries a condition_id, fall back to
 *   pickNextTransition's deterministic single pick (ticket 0061's
 *   evaluator decides which one branch to take).
 */
export function resolveNextNodeIds(
  outgoing: WorkflowTransition[],
  conditionsById: Map<string, WorkflowCondition>,
  context: Record<string, unknown>,
): string[] {
  if (outgoing.length === 0) return [];
  const hasAnyCondition = outgoing.some((t) => t.condition_id);
  if (!hasAnyCondition) {
    return [...outgoing].sort((a, b) => a.order_index - b.order_index).map((t) => t.to_node_id);
  }
  const picked = pickNextTransition(outgoing, conditionsById, context);
  return picked ? [picked.to_node_id] : [];
}

/**
 * FR-WI-009 "wait for all predecessors": a node with multiple incoming
 * transitions only becomes active once every one of its predecessor
 * steps has a completed (or skipped) step instance on this workflow
 * instance. A node with a single or no incoming transition is never
 * blocked by this rule (the normal single-predecessor case).
 */
export function predecessorsSatisfied(
  nodeId: string,
  incomingByNode: Map<string, WorkflowTransition[]>,
  stepInstancesByNodeId: Map<string, WorkflowStepInstance[]>,
): boolean {
  const incoming = incomingByNode.get(nodeId) ?? [];
  if (incoming.length <= 1) return true;
  return incoming.every((transition) => {
    const steps = stepInstancesByNodeId.get(transition.from_node_id) ?? [];
    return steps.some((s) => s.status === "completed" || s.status === "skipped");
  });
}
