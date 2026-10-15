import type { ApprovalChainConfig, ApprovalChainDecision, ApprovalDecisionRecord, WorkflowNode } from "./types.js";

/**
 * Ticket 0066 (M08): pure chain logic, no repository access — same
 * split as validation.ts/simulation.ts/migration.ts. service.ts gathers
 * the node/decisions, hands them here, and persists whatever these
 * functions say to do next.
 */

/**
 * Normalizes a request_approval node's generic `config` jsonb into a
 * chain shape. Returns null when the node has no `approverUserIds`
 * array configured — the legacy single-approver shape (ticket 0062's
 * resolveAssignee, `config.roleId`/`config.userId`) resolves a step's
 * `assigned_to` but has no chain for this module to act on; callers
 * treat that as "one decision resolves the step" rather than a
 * configuration error, since plenty of existing workflows predate this
 * ticket and still use the single-approver shape.
 */
export function normalizeApprovalChainConfig(node: WorkflowNode): ApprovalChainConfig | null {
  const config = node.config ?? {};
  const rawApprovers = config.approverUserIds;
  if (!Array.isArray(rawApprovers)) return null;
  const approverUserIds = rawApprovers.filter((id): id is string => typeof id === "string" && id.length > 0);
  if (approverUserIds.length === 0) return null;

  const mode = config.mode === "parallel" ? "parallel" : "sequential";
  const requiredApprovals =
    typeof config.requiredApprovals === "number" && config.requiredApprovals > 0
      ? config.requiredApprovals
      : approverUserIds.length;
  const enforceSegregationOfDuties = config.enforceSegregationOfDuties === true;

  const rawLimit = config.approvalLimit as Record<string, unknown> | undefined;
  const approvalLimit =
    rawLimit && typeof rawLimit.amountField === "string" && typeof rawLimit.currencyField === "string"
      ? {
          roleId: typeof rawLimit.roleId === "string" ? rawLimit.roleId : undefined,
          departmentId: typeof rawLimit.departmentId === "string" ? rawLimit.departmentId : undefined,
          amountField: rawLimit.amountField,
          currencyField: rawLimit.currencyField,
        }
      : undefined;

  return { mode, approverUserIds, requiredApprovals, enforceSegregationOfDuties, approvalLimit };
}

/**
 * Whoever still needs to act, given the decisions recorded so far
 * (already filtered down to non-revoked ones by the caller). Sequential
 * chains return at most one id — the next approver in
 * `approverUserIds` order who hasn't decided yet; parallel chains
 * return every approver who hasn't decided yet. Empty once the chain
 * has a terminal (non-approved) decision or has reached its required
 * approval count.
 */
export function pendingApproverIds(chainConfig: ApprovalChainConfig, decisions: ApprovalDecisionRecord[]): string[] {
  if (resolveChainOutcome(chainConfig, decisions).resolved) return [];
  const decided = new Set(decisions.map((d) => d.approver_id));
  const undecided = chainConfig.approverUserIds.filter((id) => !decided.has(id));
  return chainConfig.mode === "sequential" ? undecided.slice(0, 1) : undecided;
}

export interface ChainResolution {
  resolved: boolean;
  decision?: ApprovalChainDecision;
}

/**
 * FR-APP-001: a chain resolves as soon as either (a) any approver
 * rejects or returns-for-correction — this codebase's scope decision
 * to short-circuit rather than wait out the remaining approvers, same
 * "don't invent unrequested machinery" spirit as ticket 0072's
 * delegation note — or (b) enough approvals have accumulated (every
 * approver for sequential; `requiredApprovals` of them for parallel).
 */
export function resolveChainOutcome(chainConfig: ApprovalChainConfig, decisions: ApprovalDecisionRecord[]): ChainResolution {
  const terminal = decisions.find((d) => d.decision !== "approved");
  if (terminal) return { resolved: true, decision: terminal.decision };

  const approvedCount = decisions.filter((d) => d.decision === "approved").length;
  const required = chainConfig.mode === "sequential" ? chainConfig.approverUserIds.length : chainConfig.requiredApprovals!;
  if (approvedCount >= required) return { resolved: true, decision: "approved" };
  return { resolved: false };
}
