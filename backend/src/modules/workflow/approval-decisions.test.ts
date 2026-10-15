import { beforeEach, describe, expect, it } from "vitest";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeWorkflowRepository } from "../../test/fakeWorkflowRepository.js";
import { createApprovalLimit } from "../authority/service.js";
import {
  ApprovalLimitExceededError,
  ApprovalLimitFieldsMissingError,
  decideApprovalStep,
  getApprovalDetail,
  MissingApprovalReasonError,
  NotAnEligibleApproverError,
  revokeApprovalDecision,
} from "./service.js";

const TOKEN = "token-a";

describe("approval chain decisions (ticket 0066, M08)", () => {
  let repo: FakeWorkflowRepository;
  let authorityRepo: FakeAuthorityRepository;

  beforeEach(() => {
    repo = new FakeWorkflowRepository();
    authorityRepo = new FakeAuthorityRepository();
  });

  async function approvalStep(config: Record<string, unknown>, context: Record<string, unknown> = {}) {
    const instance = await repo.createInstance(TOKEN, { definitionId: "def-1", versionId: "version-1", startedBy: "requester", context });
    const node = await repo.addNode(TOKEN, { versionId: "version-1", nodeKey: "approve", nodeType: "request_approval", config });
    const step = await repo.createStepInstance(TOKEN, { instanceId: instance.id, nodeId: node.id, status: "waiting", assignedTo: "alice" });
    return { instance, node, step };
  }

  it("sequential chain: resolves only once every approver has approved, in order", async () => {
    const { step } = await approvalStep({ approverUserIds: ["alice", "bob"] });

    const first = await decideApprovalStep(repo, authorityRepo, TOKEN, step.id, "alice", "approved", null);
    expect(first.chainResolved).toBe(false);
    expect(first.stepInstance.assigned_to).toBe("bob");
    expect(first.stepInstance.status).toBe("waiting");

    const second = await decideApprovalStep(repo, authorityRepo, TOKEN, step.id, "bob", "approved", null);
    expect(second.chainResolved).toBe(true);
    expect(second.stepInstance.status).toBe("completed");
    expect(second.stepInstance.output).toEqual({ decision: "approved", approvalDecisionIds: expect.any(Array) });
  });

  it("sequential chain: bob cannot jump ahead of alice", async () => {
    const { step } = await approvalStep({ approverUserIds: ["alice", "bob"] });
    await expect(decideApprovalStep(repo, authorityRepo, TOKEN, step.id, "bob", "approved", null)).rejects.toBeInstanceOf(
      NotAnEligibleApproverError,
    );
  });

  it("parallel chain: resolves once requiredApprovals land, ignoring the remaining approver", async () => {
    const { step } = await approvalStep({ approverUserIds: ["alice", "bob", "carol"], mode: "parallel", requiredApprovals: 2 });

    await decideApprovalStep(repo, authorityRepo, TOKEN, step.id, "alice", "approved", null);
    const result = await decideApprovalStep(repo, authorityRepo, TOKEN, step.id, "bob", "approved", null);

    expect(result.chainResolved).toBe(true);
    expect(result.stepInstance.status).toBe("completed");
  });

  it("any rejection short-circuits the chain and requires a reason", async () => {
    const { step } = await approvalStep({ approverUserIds: ["alice", "bob"] });
    await expect(decideApprovalStep(repo, authorityRepo, TOKEN, step.id, "alice", "rejected", null)).rejects.toBeInstanceOf(
      MissingApprovalReasonError,
    );

    const result = await decideApprovalStep(repo, authorityRepo, TOKEN, step.id, "alice", "rejected", "missing cost breakdown");
    expect(result.chainResolved).toBe(true);
    expect(result.stepInstance.output.decision).toBe("rejected");
  });

  it("checks the configured approval limit against instance context and denies over-limit", async () => {
    repo.setUserTenant("alice", "tenant-a");
    authorityRepo.addSession(TOKEN, "admin-a", "tenant-a");
    await createApprovalLimit(authorityRepo, TOKEN, "admin-a", { roleId: "role.commercial_manager", currency: "AED", maxValue: 5000 });

    const { step } = await approvalStep(
      { approverUserIds: ["alice"], approvalLimit: { roleId: "role.commercial_manager", amountField: "amount", currencyField: "currency" } },
      { amount: 9000, currency: "AED" },
    );

    await expect(decideApprovalStep(repo, authorityRepo, TOKEN, step.id, "alice", "approved", null)).rejects.toBeInstanceOf(
      ApprovalLimitExceededError,
    );
  });

  it("throws when the node asks for an approval-limit check but the instance context is missing the fields", async () => {
    const { step } = await approvalStep({
      approverUserIds: ["alice"],
      approvalLimit: { amountField: "amount", currencyField: "currency" },
    });
    await expect(decideApprovalStep(repo, authorityRepo, TOKEN, step.id, "alice", "approved", null)).rejects.toBeInstanceOf(
      ApprovalLimitFieldsMissingError,
    );
  });

  it("getApprovalDetail surfaces the chain config, decisions, request context and empty riskFlags", async () => {
    const { step } = await approvalStep({ approverUserIds: ["alice", "bob"] }, { amount: 100 });
    await decideApprovalStep(repo, authorityRepo, TOKEN, step.id, "alice", "approved", null);

    const detail = await getApprovalDetail(repo, authorityRepo, TOKEN, step.id);
    expect(detail.chainConfig?.approverUserIds).toEqual(["alice", "bob"]);
    expect(detail.decisions).toHaveLength(1);
    expect(detail.requestContext).toEqual({ amount: 100 });
    expect(detail.riskFlags).toEqual([]);
    expect(detail.authorityCheck).toEqual({ configured: false, withinLimit: null });
  });

  it("revoking a decision on a still-open sequential step frees that approver's turn again", async () => {
    const { step } = await approvalStep({ approverUserIds: ["alice", "bob", "carol"] });
    const first = await decideApprovalStep(repo, authorityRepo, TOKEN, step.id, "alice", "approved", null);
    const decisions = await repo.listApprovalDecisions(TOKEN, step.id);
    expect(first.stepInstance.assigned_to).toBe("bob");

    await revokeApprovalDecision(repo, TOKEN, decisions[0]!.id, "admin-a", "alice approved the wrong version by mistake");

    await expect(decideApprovalStep(repo, authorityRepo, TOKEN, step.id, "bob", "approved", null)).rejects.toBeInstanceOf(
      NotAnEligibleApproverError,
    );
    const redone = await decideApprovalStep(repo, authorityRepo, TOKEN, step.id, "alice", "approved", null);
    expect(redone.stepInstance.assigned_to).toBe("bob");

    expect(repo.events.some((e) => e.event_type === "approval_revoked")).toBe(true);
  });
});
