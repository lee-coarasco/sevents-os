import { beforeEach, describe, expect, it } from "vitest";
import { FakeBiddingRepository } from "../../test/fakeBiddingRepository.js";
import { FakeWorkflowRepository } from "../../test/fakeWorkflowRepository.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import {
  addNodeToVersion,
  addTransitionToVersion,
  createWorkflowDefinition,
  decideApprovalStep,
  publishVersion,
  recordApproval,
  submitForApproval,
  validateVersion,
} from "../workflow/service.js";
import type { NodeType } from "../workflow/types.js";
import {
  BidDecisionLockedError,
  BidNotApprovedError,
  MissingCriteriaScoresError,
  NotFoundError,
  addCriteriaScore,
  createBidNoBidDecision,
  getBidNoBidDecision,
  listBidNoBidDecisions,
  listBidSubmissions,
  listCriteriaScores,
  recordBidSubmission,
  removeCriteriaScore,
  resolveBidNoBidApproval,
  submitBidNoBidForApproval,
  updateBidNoBidRecommendation,
} from "./service.js";

const TOKEN = "token-tenant-a";
const TOKEN_B = "token-tenant-b";
const APPROVER = "approver-user";
const PROCESS_OWNER = "process-owner";
const ESTIMATE_ID = "estimate-1";

async function publishApprovalWorkflow(workflowRepo: FakeWorkflowRepository, key: string, config: Record<string, unknown>) {
  const nodes: { key: string; type: NodeType; config?: Record<string, unknown> }[] = [
    { key: "approve", type: "request_approval", config },
    { key: "end", type: "complete" },
  ];
  const { definition, version } = await createWorkflowDefinition(workflowRepo, TOKEN, { key, name: key }, PROCESS_OWNER);
  const nodeIdByKey = new Map<string, string>();
  for (const n of nodes) {
    const node = await addNodeToVersion(workflowRepo, TOKEN, version.id, { nodeKey: n.key, nodeType: n.type, config: n.config ?? {} });
    nodeIdByKey.set(n.key, node.id);
  }
  await addTransitionToVersion(workflowRepo, TOKEN, version.id, {
    fromNodeId: nodeIdByKey.get("approve")!,
    toNodeId: nodeIdByKey.get("end")!,
    orderIndex: 0,
  });
  await validateVersion(workflowRepo, TOKEN, version.id, PROCESS_OWNER);
  await submitForApproval(workflowRepo, TOKEN, definition.id, version.id, PROCESS_OWNER);
  await recordApproval(workflowRepo, TOKEN, definition.id, version.id, APPROVER, "approved", null);
  await publishVersion(workflowRepo, TOKEN, definition.id, version.id, APPROVER);
  return definition;
}

describe("M11c: bid/no-bid decision & quote/proposal approval (ticket 0098)", () => {
  let repo: FakeBiddingRepository;
  let workflowRepo: FakeWorkflowRepository;
  let authorityRepo: FakeAuthorityRepository;

  beforeEach(() => {
    repo = new FakeBiddingRepository();
    repo.addSession(TOKEN, "tenant-a");
    repo.addSession(TOKEN_B, "tenant-b");
    workflowRepo = new FakeWorkflowRepository();
    authorityRepo = new FakeAuthorityRepository();
  });

  it("creates a draft bid/no-bid decision tied to an estimate", async () => {
    const decision = await createBidNoBidDecision(repo, TOKEN, {
      estimateId: ESTIMATE_ID,
      recommendation: "bid",
      createdBy: "estimator-a",
    });
    expect(decision.status).toBe("draft");
    expect(decision.recommendation).toBe("bid");
    expect(decision.estimate_id).toBe(ESTIMATE_ID);
    expect(decision.conditions).toBeNull();
  });

  it("FR-BID-001: criteria scores are real structured rows (criterion, score, rationale), comparable across decisions", async () => {
    const decision = await createBidNoBidDecision(repo, TOKEN, { estimateId: ESTIMATE_ID, recommendation: "bid", createdBy: "estimator-a" });
    await addCriteriaScore(repo, TOKEN, decision.id, { criterion: "financial_viability", score: 4, rationale: "healthy margin" });
    await addCriteriaScore(repo, TOKEN, decision.id, { criterion: "risk_exposure", score: 2, rationale: "tight schedule" });

    const scores = await listCriteriaScores(repo, TOKEN, decision.id);
    expect(scores).toHaveLength(2);
    expect(scores.find((s) => s.criterion === "financial_viability")!.score).toBe(4);
    expect(scores.find((s) => s.criterion === "risk_exposure")!.rationale).toBe("tight schedule");
  });

  it("removes a criteria score while still draft", async () => {
    const decision = await createBidNoBidDecision(repo, TOKEN, { estimateId: ESTIMATE_ID, recommendation: "bid", createdBy: "estimator-a" });
    const score = await addCriteriaScore(repo, TOKEN, decision.id, { criterion: "strategic_fit", score: 3, rationale: "repeat client" });
    await removeCriteriaScore(repo, TOKEN, decision.id, score.id);
    const scores = await listCriteriaScores(repo, TOKEN, decision.id);
    expect(scores).toHaveLength(0);
  });

  it("refuses to submit for approval with no scored criteria", async () => {
    const decision = await createBidNoBidDecision(repo, TOKEN, { estimateId: ESTIMATE_ID, recommendation: "bid", createdBy: "estimator-a" });
    const definition = await publishApprovalWorkflow(workflowRepo, "bid-decision-no-criteria", { approverUserIds: [APPROVER] });
    await expect(
      submitBidNoBidForApproval(repo, workflowRepo, TOKEN, { decisionId: decision.id, definitionId: definition.id, submittedBy: "estimator-a" }),
    ).rejects.toBeInstanceOf(MissingCriteriaScoresError);
  });

  it("propose -> approved: reuses the M08 request_approval seam", async () => {
    const decision = await createBidNoBidDecision(repo, TOKEN, { estimateId: ESTIMATE_ID, recommendation: "bid", createdBy: "estimator-a" });
    await addCriteriaScore(repo, TOKEN, decision.id, { criterion: "financial_viability", score: 4, rationale: "healthy margin" });

    const definition = await publishApprovalWorkflow(workflowRepo, "bid-decision-approve", { approverUserIds: [APPROVER] });
    const submitted = await submitBidNoBidForApproval(repo, workflowRepo, TOKEN, {
      decisionId: decision.id,
      definitionId: definition.id,
      submittedBy: "estimator-a",
    });
    expect(submitted.status).toBe("pending_approval");
    expect(submitted.workflow_instance_id).not.toBeNull();

    const [step] = await workflowRepo.listStepInstances(TOKEN, submitted.workflow_instance_id!);
    await decideApprovalStep(workflowRepo, authorityRepo, TOKEN, step!.id, APPROVER, "approved", null);

    const resolved = await resolveBidNoBidApproval(repo, workflowRepo, TOKEN, decision.id);
    expect(resolved.status).toBe("approved");
    expect(resolved.conditions).toBeNull();

    // Idempotent: resolving again doesn't change anything.
    const resolvedAgain = await resolveBidNoBidApproval(repo, workflowRepo, TOKEN, decision.id);
    expect(resolvedAgain.status).toBe("approved");

    // Locked: no further edits.
    await expect(updateBidNoBidRecommendation(repo, TOKEN, decision.id, "no_bid")).rejects.toBeInstanceOf(BidDecisionLockedError);
  });

  it("propose -> approved_with_conditions: the approver's reason becomes the decision's conditions text", async () => {
    const decision = await createBidNoBidDecision(repo, TOKEN, { estimateId: ESTIMATE_ID, recommendation: "bid", createdBy: "estimator-a" });
    await addCriteriaScore(repo, TOKEN, decision.id, { criterion: "risk_exposure", score: 3, rationale: "manageable" });

    const definition = await publishApprovalWorkflow(workflowRepo, "bid-decision-conditions", { approverUserIds: [APPROVER] });
    const submitted = await submitBidNoBidForApproval(repo, workflowRepo, TOKEN, {
      decisionId: decision.id,
      definitionId: definition.id,
      submittedBy: "estimator-a",
    });
    const [step] = await workflowRepo.listStepInstances(TOKEN, submitted.workflow_instance_id!);
    await decideApprovalStep(
      workflowRepo,
      authorityRepo,
      TOKEN,
      step!.id,
      APPROVER,
      "approved_with_conditions",
      "subject to client accepting a 2-week schedule extension",
    );

    const resolved = await resolveBidNoBidApproval(repo, workflowRepo, TOKEN, decision.id);
    expect(resolved.status).toBe("approved_with_conditions");
    expect(resolved.conditions).toBe("subject to client accepting a 2-week schedule extension");
  });

  it("propose -> rejected: status updates, decision is a dead end", async () => {
    const decision = await createBidNoBidDecision(repo, TOKEN, { estimateId: ESTIMATE_ID, recommendation: "bid", createdBy: "estimator-a" });
    await addCriteriaScore(repo, TOKEN, decision.id, { criterion: "financial_viability", score: 1, rationale: "thin margin" });
    const definition = await publishApprovalWorkflow(workflowRepo, "bid-decision-reject", { approverUserIds: [APPROVER] });
    const submitted = await submitBidNoBidForApproval(repo, workflowRepo, TOKEN, {
      decisionId: decision.id,
      definitionId: definition.id,
      submittedBy: "estimator-a",
    });
    const [step] = await workflowRepo.listStepInstances(TOKEN, submitted.workflow_instance_id!);
    await decideApprovalStep(workflowRepo, authorityRepo, TOKEN, step!.id, APPROVER, "rejected", "margin too thin");

    const resolved = await resolveBidNoBidApproval(repo, workflowRepo, TOKEN, decision.id);
    expect(resolved.status).toBe("rejected");
  });

  it("propose -> returned_for_correction: stays editable without a new decision row", async () => {
    const decision = await createBidNoBidDecision(repo, TOKEN, { estimateId: ESTIMATE_ID, recommendation: "bid", createdBy: "estimator-a" });
    await addCriteriaScore(repo, TOKEN, decision.id, { criterion: "financial_viability", score: 3, rationale: "borderline" });
    const definition = await publishApprovalWorkflow(workflowRepo, "bid-decision-return", { approverUserIds: [APPROVER] });
    const submitted = await submitBidNoBidForApproval(repo, workflowRepo, TOKEN, {
      decisionId: decision.id,
      definitionId: definition.id,
      submittedBy: "estimator-a",
    });
    const [step] = await workflowRepo.listStepInstances(TOKEN, submitted.workflow_instance_id!);
    await decideApprovalStep(workflowRepo, authorityRepo, TOKEN, step!.id, APPROVER, "returned_for_correction", "rescore risk");

    const resolved = await resolveBidNoBidApproval(repo, workflowRepo, TOKEN, decision.id);
    expect(resolved.status).toBe("returned_for_correction");

    const updated = await updateBidNoBidRecommendation(repo, TOKEN, decision.id, "no_bid");
    expect(updated.recommendation).toBe("no_bid");
  });

  it("BRD §10.1 step 8: a submission record can only be created once approved (or approved with conditions)", async () => {
    const decision = await createBidNoBidDecision(repo, TOKEN, { estimateId: ESTIMATE_ID, recommendation: "bid", createdBy: "estimator-a" });
    await expect(
      recordBidSubmission(repo, TOKEN, {
        decisionId: decision.id,
        submittedTo: "Client Co.",
        submittedAt: "2026-10-20T00:00:00.000Z",
        evidenceReference: null,
        submittedBy: "estimator-a",
      }),
    ).rejects.toBeInstanceOf(BidNotApprovedError);

    await addCriteriaScore(repo, TOKEN, decision.id, { criterion: "financial_viability", score: 4, rationale: "healthy margin" });
    const definition = await publishApprovalWorkflow(workflowRepo, "bid-decision-submission", { approverUserIds: [APPROVER] });
    const submitted = await submitBidNoBidForApproval(repo, workflowRepo, TOKEN, {
      decisionId: decision.id,
      definitionId: definition.id,
      submittedBy: "estimator-a",
    });
    const [step] = await workflowRepo.listStepInstances(TOKEN, submitted.workflow_instance_id!);
    await decideApprovalStep(workflowRepo, authorityRepo, TOKEN, step!.id, APPROVER, "approved", null);
    await resolveBidNoBidApproval(repo, workflowRepo, TOKEN, decision.id);

    const submission = await recordBidSubmission(repo, TOKEN, {
      decisionId: decision.id,
      submittedTo: "Client Co.",
      submittedAt: "2026-10-20T00:00:00.000Z",
      evidenceReference: "https://files.example/proposal-final.pdf",
      submittedBy: "estimator-a",
    });
    expect(submission.submitted_to).toBe("Client Co.");
    expect(submission.evidence_reference).toBe("https://files.example/proposal-final.pdf");

    const submissions = await listBidSubmissions(repo, TOKEN, decision.id);
    expect(submissions).toHaveLength(1);
  });

  it("tenant isolation: another tenant cannot see or resolve another tenant's decision", async () => {
    const decision = await createBidNoBidDecision(repo, TOKEN, { estimateId: ESTIMATE_ID, recommendation: "bid", createdBy: "estimator-a" });

    const listedForB = await listBidNoBidDecisions(repo, TOKEN_B, ESTIMATE_ID);
    expect(listedForB).toHaveLength(0);

    await expect(getBidNoBidDecision(repo, TOKEN_B, decision.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(resolveBidNoBidApproval(repo, workflowRepo, TOKEN_B, decision.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
