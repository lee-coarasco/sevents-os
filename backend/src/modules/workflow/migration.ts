import type { MigrationImpactEntry, MigrationImpactSummary, WorkflowStepInstance, WorkflowVersionGraph } from "./types.js";

/**
 * Ticket 0063 (M06d): pure impact-computation for migrating running
 * instances from one published version to another. No repository
 * access — service.ts gathers the running instances and their open
 * step instances, then hands them here, mirroring validation.ts/
 * simulation.ts's split between pure graph logic and persistence.
 */

const OPEN_STEP_STATUSES = new Set<WorkflowStepInstance["status"]>(["pending", "active", "waiting"]);

export function isOpenStepInstance(step: WorkflowStepInstance): boolean {
  return OPEN_STEP_STATUSES.has(step.status);
}

/**
 * For one running instance, classifies whether its currently-open step
 * instances can all be mapped 1:1 by node_key into the target version's
 * graph (a "safe" auto-mappable migration) or not (needs manual
 * mapping). An instance with no open steps at all (a running instance
 * in an otherwise-finished state — not expected in practice) is treated
 * as not auto-mappable since there is nothing safe to assert about it.
 */
export function classifyInstance(
  workflowInstanceId: string,
  openSteps: WorkflowStepInstance[],
  fromGraph: WorkflowVersionGraph,
  toGraph: WorkflowVersionGraph,
): MigrationImpactEntry {
  const fromNodeById = new Map(fromGraph.nodes.map((n) => [n.id, n]));
  const toNodeIdByKey = new Map(toGraph.nodes.map((n) => [n.node_key, n.id]));

  const nodeIdMap: Record<string, string> = {};
  const unmappedNodeKeys: string[] = [];

  for (const step of openSteps) {
    const node = fromNodeById.get(step.node_id);
    const toNodeId = node ? toNodeIdByKey.get(node.node_key) : undefined;
    if (node && toNodeId) {
      nodeIdMap[node.id] = toNodeId;
    } else {
      unmappedNodeKeys.push(node?.node_key ?? step.node_id);
    }
  }

  return {
    workflowInstanceId,
    openStepInstanceIds: openSteps.map((s) => s.id),
    autoMappable: openSteps.length > 0 && unmappedNodeKeys.length === 0,
    nodeIdMap,
    unmappedNodeKeys,
  };
}

export function computeImpactSummary(
  fromVersionId: string,
  toVersionId: string,
  fromGraph: WorkflowVersionGraph,
  toGraph: WorkflowVersionGraph,
  instanceOpenSteps: { workflowInstanceId: string; openSteps: WorkflowStepInstance[] }[],
): MigrationImpactSummary {
  const entries = instanceOpenSteps.map(({ workflowInstanceId, openSteps }) =>
    classifyInstance(workflowInstanceId, openSteps, fromGraph, toGraph),
  );
  return {
    fromVersionId,
    toVersionId,
    totalRunningInstances: entries.length,
    autoMappableCount: entries.filter((e) => e.autoMappable).length,
    manualMappingCount: entries.filter((e) => !e.autoMappable).length,
    entries,
  };
}
