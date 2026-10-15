import { describe, expect, it } from "vitest";
import { normalizeApprovalChainConfig, pendingApproverIds, resolveChainOutcome } from "./approvals.js";
import type { ApprovalDecisionRecord, WorkflowNode } from "./types.js";

const BASE_NODE: WorkflowNode = {
  id: "node-1",
  tenant_id: "tenant-a",
  workflow_version_id: "version-1",
  node_key: "approve",
  node_type: "request_approval",
  config: {},
};

function decision(approverId: string, decision: ApprovalDecisionRecord["decision"], sequenceOrder: number | null = null): ApprovalDecisionRecord {
  return {
    id: `decision-${approverId}`,
    tenant_id: "tenant-a",
    workflow_step_instance_id: "step-1",
    sequence_order: sequenceOrder,
    approver_id: approverId,
    decision,
    reason: decision === "approved" ? null : "reason",
    decided_by: approverId,
    decided_at: new Date(0).toISOString(),
  };
}

describe("normalizeApprovalChainConfig", () => {
  it("returns null for the legacy single-approver shape (no approverUserIds array)", () => {
    expect(normalizeApprovalChainConfig({ ...BASE_NODE, config: { roleId: "role.commercial_manager" } })).toBeNull();
  });

  it("defaults mode to sequential and requiredApprovals to the approver count", () => {
    const config = normalizeApprovalChainConfig({ ...BASE_NODE, config: { approverUserIds: ["alice", "bob"] } });
    expect(config).toEqual({
      mode: "sequential",
      approverUserIds: ["alice", "bob"],
      requiredApprovals: 2,
      enforceSegregationOfDuties: false,
      approvalLimit: undefined,
    });
  });

  it("reads an explicit parallel mode and requiredApprovals", () => {
    const config = normalizeApprovalChainConfig({
      ...BASE_NODE,
      config: { approverUserIds: ["alice", "bob", "carol"], mode: "parallel", requiredApprovals: 2 },
    });
    expect(config?.mode).toBe("parallel");
    expect(config?.requiredApprovals).toBe(2);
  });
});

describe("pendingApproverIds", () => {
  const sequential = normalizeApprovalChainConfig({ ...BASE_NODE, config: { approverUserIds: ["alice", "bob", "carol"] } })!;
  const parallel = normalizeApprovalChainConfig({
    ...BASE_NODE,
    config: { approverUserIds: ["alice", "bob", "carol"], mode: "parallel", requiredApprovals: 2 },
  })!;

  it("sequential: returns only the next undecided approver, in order", () => {
    expect(pendingApproverIds(sequential, [])).toEqual(["alice"]);
    expect(pendingApproverIds(sequential, [decision("alice", "approved", 0)])).toEqual(["bob"]);
  });

  it("parallel: returns every approver who hasn't decided yet", () => {
    expect(pendingApproverIds(parallel, [decision("alice", "approved")])).toEqual(["bob", "carol"]);
  });

  it("is empty once the chain has resolved", () => {
    expect(pendingApproverIds(sequential, [decision("alice", "rejected", 0)])).toEqual([]);
  });
});

describe("resolveChainOutcome", () => {
  it("sequential: unresolved until every approver has approved", () => {
    const config = normalizeApprovalChainConfig({ ...BASE_NODE, config: { approverUserIds: ["alice", "bob"] } })!;
    expect(resolveChainOutcome(config, [decision("alice", "approved", 0)])).toEqual({ resolved: false });
    expect(resolveChainOutcome(config, [decision("alice", "approved", 0), decision("bob", "approved", 1)])).toEqual({
      resolved: true,
      decision: "approved",
    });
  });

  it("parallel: resolves once requiredApprovals approvals land, even with others still pending", () => {
    const config = normalizeApprovalChainConfig({
      ...BASE_NODE,
      config: { approverUserIds: ["alice", "bob", "carol"], mode: "parallel", requiredApprovals: 2 },
    })!;
    expect(resolveChainOutcome(config, [decision("alice", "approved"), decision("bob", "approved")])).toEqual({
      resolved: true,
      decision: "approved",
    });
  });

  it("a single rejection short-circuits the whole chain regardless of mode", () => {
    const config = normalizeApprovalChainConfig({
      ...BASE_NODE,
      config: { approverUserIds: ["alice", "bob", "carol"], mode: "parallel", requiredApprovals: 3 },
    })!;
    expect(resolveChainOutcome(config, [decision("alice", "approved"), decision("bob", "rejected")])).toEqual({
      resolved: true,
      decision: "rejected",
    });
  });

  it("a return-for-correction also short-circuits", () => {
    const config = normalizeApprovalChainConfig({ ...BASE_NODE, config: { approverUserIds: ["alice", "bob"] } })!;
    expect(resolveChainOutcome(config, [decision("alice", "returned_for_correction", 0)])).toEqual({
      resolved: true,
      decision: "returned_for_correction",
    });
  });
});
