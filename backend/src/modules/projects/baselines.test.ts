import { beforeEach, describe, expect, it } from "vitest";
import { FakeProjectsRepository } from "../../test/fakeProjectsRepository.js";
import { FakeWorkflowRepository } from "../../test/fakeWorkflowRepository.js";
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
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import type { NodeType } from "../workflow/types.js";
import {
  DuplicateInitialBaselineError,
  MissingBaselineChangeReasonError,
  NoCurrentBaselineError,
  NotFoundError,
  createMilestone,
  createProject,
  createWBSNode,
  listBaselineChangeRequests,
  listBaselines,
  proposeBaselineChange,
  resolveBaselineChangeRequest,
  setInitialBaseline,
} from "./service.js";

const TOKEN = "token-tenant-a";
const TOKEN_B = "token-tenant-b";
const APPROVER = "approver-user";
const PROCESS_OWNER = "process-owner";

async function publishApprovalWorkflow(
  workflowRepo: FakeWorkflowRepository,
  key: string,
  config: Record<string, unknown>,
) {
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

describe("M09c: baseline snapshots & baseline-change control (ticket 0075)", () => {
  let projectsRepo: FakeProjectsRepository;
  let workflowRepo: FakeWorkflowRepository;
  let authorityRepo: FakeAuthorityRepository;
  let projectId: string;

  beforeEach(async () => {
    projectsRepo = new FakeProjectsRepository();
    projectsRepo.addSession(TOKEN, "tenant-a");
    projectsRepo.addSession(TOKEN_B, "tenant-b");
    workflowRepo = new FakeWorkflowRepository();
    authorityRepo = new FakeAuthorityRepository();
    const project = await createProject(projectsRepo, TOKEN, {
      company_id: "company-1",
      name: "A Tower",
      budget_amount: 1_000_000,
      budget_currency: "AED",
    });
    projectId = project.id;
    await createWBSNode(projectsRepo, TOKEN, { project_id: projectId, code: "1", name: "Substructure" });
    await createMilestone(projectsRepo, TOKEN, { project_id: projectId, name: "Foundation complete", target_date: "2026-12-01" });
  });

  it("setInitialBaseline captures the live WBS/milestone/budget state as v1, approved, no workflow involved", async () => {
    const baseline = await setInitialBaseline(projectsRepo, TOKEN, projectId, "admin-a");
    expect(baseline.version).toBe(1);
    expect(baseline.status).toBe("approved");
    expect(baseline.snapshot.budgetAmount).toBe(1_000_000);
    expect(baseline.snapshot.wbsNodes).toHaveLength(1);
    expect(baseline.snapshot.milestones).toHaveLength(1);
  });

  it("refuses a second initial baseline once one exists", async () => {
    await setInitialBaseline(projectsRepo, TOKEN, projectId, "admin-a");
    await expect(setInitialBaseline(projectsRepo, TOKEN, projectId, "admin-a")).rejects.toBeInstanceOf(
      DuplicateInitialBaselineError,
    );
  });

  it("proposeBaselineChange rejects a blank reason or impact analysis", async () => {
    await setInitialBaseline(projectsRepo, TOKEN, projectId, "admin-a");
    const definition = await publishApprovalWorkflow(workflowRepo, "baseline-approval-1", { approverUserIds: [APPROVER] });

    await expect(
      proposeBaselineChange(projectsRepo, workflowRepo, TOKEN, {
        projectId,
        definitionId: definition.id,
        proposedSnapshot: { budgetAmount: 1_200_000 },
        reason: "   ",
        impactAnalysis: "cost increase",
        submittedBy: "pm-a",
      }),
    ).rejects.toBeInstanceOf(MissingBaselineChangeReasonError);
  });

  it("proposeBaselineChange requires an existing current baseline", async () => {
    const definition = await publishApprovalWorkflow(workflowRepo, "baseline-approval-2", { approverUserIds: [APPROVER] });
    await expect(
      proposeBaselineChange(projectsRepo, workflowRepo, TOKEN, {
        projectId,
        definitionId: definition.id,
        proposedSnapshot: { budgetAmount: 1_200_000 },
        reason: "scope change",
        impactAnalysis: "cost increase",
        submittedBy: "pm-a",
      }),
    ).rejects.toBeInstanceOf(NoCurrentBaselineError);
  });

  it("propose -> approve -> the new snapshot becomes v2, approved, and v1 is superseded", async () => {
    const v1 = await setInitialBaseline(projectsRepo, TOKEN, projectId, "admin-a");
    const definition = await publishApprovalWorkflow(workflowRepo, "baseline-approval-3", { approverUserIds: [APPROVER] });

    const changeRequest = await proposeBaselineChange(projectsRepo, workflowRepo, TOKEN, {
      projectId,
      definitionId: definition.id,
      proposedSnapshot: { budgetAmount: 1_200_000 },
      reason: "client requested extra scope",
      impactAnalysis: "budget increases by AED 200,000",
      submittedBy: "pm-a",
    });
    expect(changeRequest.status).toBe("pending");
    expect(changeRequest.current_baseline_id).toBe(v1.id);

    // Still pending: the approval step hasn't been decided yet.
    const stillPending = await resolveBaselineChangeRequest(projectsRepo, workflowRepo, TOKEN, changeRequest.id);
    expect(stillPending.status).toBe("pending");

    const { instance } = await workflowRepo.getInstance(TOKEN, changeRequest.workflow_instance_id).then((i) => ({ instance: i! }));
    const [step] = await workflowRepo.listStepInstances(TOKEN, instance.id);
    await decideApprovalStep(workflowRepo, authorityRepo, TOKEN, step!.id, APPROVER, "approved", null);

    const resolved = await resolveBaselineChangeRequest(projectsRepo, workflowRepo, TOKEN, changeRequest.id);
    expect(resolved.status).toBe("approved");
    expect(resolved.resulting_baseline_id).not.toBeNull();

    const baselines = await listBaselines(projectsRepo, TOKEN, projectId);
    const newBaseline = baselines.find((b) => b.id === resolved.resulting_baseline_id)!;
    expect(newBaseline.version).toBe(2);
    expect(newBaseline.status).toBe("approved");
    expect(newBaseline.snapshot.budgetAmount).toBe(1_200_000);

    const oldBaseline = baselines.find((b) => b.id === v1.id)!;
    expect(oldBaseline.status).toBe("superseded");

    // Idempotent: resolving again does not create a third baseline.
    const resolvedAgain = await resolveBaselineChangeRequest(projectsRepo, workflowRepo, TOKEN, changeRequest.id);
    expect(resolvedAgain.status).toBe("approved");
    const baselinesAfter = await listBaselines(projectsRepo, TOKEN, projectId);
    expect(baselinesAfter).toHaveLength(2);
  });

  it("propose -> reject -> the current baseline is left untouched", async () => {
    const v1 = await setInitialBaseline(projectsRepo, TOKEN, projectId, "admin-a");
    const definition = await publishApprovalWorkflow(workflowRepo, "baseline-approval-4", { approverUserIds: [APPROVER] });

    const changeRequest = await proposeBaselineChange(projectsRepo, workflowRepo, TOKEN, {
      projectId,
      definitionId: definition.id,
      proposedSnapshot: { budgetAmount: 1_200_000 },
      reason: "client requested extra scope",
      impactAnalysis: "budget increases by AED 200,000",
      submittedBy: "pm-a",
    });

    const instance = await workflowRepo.getInstance(TOKEN, changeRequest.workflow_instance_id);
    const [step] = await workflowRepo.listStepInstances(TOKEN, instance!.id);
    await decideApprovalStep(workflowRepo, authorityRepo, TOKEN, step!.id, APPROVER, "rejected", "no budget headroom");

    const resolved = await resolveBaselineChangeRequest(projectsRepo, workflowRepo, TOKEN, changeRequest.id);
    expect(resolved.status).toBe("rejected");
    expect(resolved.resulting_baseline_id).toBeNull();

    const baselines = await listBaselines(projectsRepo, TOKEN, projectId);
    expect(baselines).toHaveLength(1);
    expect(baselines[0]!.id).toBe(v1.id);
    expect(baselines[0]!.status).toBe("approved");
  });

  it("tenant isolation: another tenant cannot see or resolve a change request", async () => {
    await setInitialBaseline(projectsRepo, TOKEN, projectId, "admin-a");
    const definition = await publishApprovalWorkflow(workflowRepo, "baseline-approval-5", { approverUserIds: [APPROVER] });
    const changeRequest = await proposeBaselineChange(projectsRepo, workflowRepo, TOKEN, {
      projectId,
      definitionId: definition.id,
      proposedSnapshot: { budgetAmount: 1_200_000 },
      reason: "client requested extra scope",
      impactAnalysis: "budget increases by AED 200,000",
      submittedBy: "pm-a",
    });

    const listedForB = await listBaselineChangeRequests(projectsRepo, TOKEN_B, projectId);
    expect(listedForB).toHaveLength(0);

    await expect(resolveBaselineChangeRequest(projectsRepo, workflowRepo, TOKEN_B, changeRequest.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
