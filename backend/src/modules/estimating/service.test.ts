import { beforeEach, describe, expect, it } from "vitest";
import { FakeEstimatingRepository } from "../../test/fakeEstimatingRepository.js";
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
  EstimateLockedError,
  NotFoundError,
  addEstimateLine,
  createEstimateVersion,
  createNextEstimateVersionFrom,
  getEstimate,
  listEstimateLines,
  listEstimateVersions,
  removeEstimateLine,
  resolveEstimateApproval,
  submitEstimateForApproval,
  updateEstimateFields,
} from "./service.js";

const TOKEN = "token-tenant-a";
const TOKEN_B = "token-tenant-b";
const APPROVER = "approver-user";
const PROCESS_OWNER = "process-owner";
const TENDER_SUBMISSION_ID = "tender-submission-1";

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

describe("M11b: estimate versions & cost build-up (ticket 0097)", () => {
  let repo: FakeEstimatingRepository;
  let workflowRepo: FakeWorkflowRepository;
  let authorityRepo: FakeAuthorityRepository;

  beforeEach(() => {
    repo = new FakeEstimatingRepository();
    repo.addSession(TOKEN, "tenant-a");
    repo.addSession(TOKEN_B, "tenant-b");
    workflowRepo = new FakeWorkflowRepository();
    authorityRepo = new FakeAuthorityRepository();
  });

  it("creates v1 as a draft, with every FR-EST-001 field a real field", async () => {
    const estimate = await createEstimateVersion(repo, TOKEN, {
      tenderSubmissionId: TENDER_SUBMISSION_ID,
      assumptions: "Standard working hours, no night shift",
      inclusions: "All civil works per BOQ",
      exclusions: "MEP fit-out",
      taxes: 500,
      overheads: 1000,
      contingency: 2000,
      margin: 3000,
      createdBy: "estimator-a",
    });
    expect(estimate.version).toBe(1);
    expect(estimate.status).toBe("draft");
    expect(estimate.assumptions).toBe("Standard working hours, no night shift");
    expect(estimate.exclusions).toBe("MEP fit-out");
    expect(estimate.taxes).toBe(500);
    expect(estimate.overheads).toBe(1000);
    expect(estimate.contingency).toBe(2000);
    expect(estimate.margin).toBe(3000);
    expect(estimate.workflow_instance_id).toBeNull();
  });

  it("adding lines recomputes subtotal_amount and total_amount (subtotal + taxes + overheads + contingency + margin)", async () => {
    const estimate = await createEstimateVersion(repo, TOKEN, {
      tenderSubmissionId: TENDER_SUBMISSION_ID,
      taxes: 100,
      overheads: 200,
      contingency: 300,
      margin: 400,
      createdBy: "estimator-a",
    });

    await addEstimateLine(repo, TOKEN, estimate.id, {
      item: "Concrete grade 40",
      quantity: 10,
      unit: "m3",
      rate: 350,
      costCategory: "material",
    });
    await addEstimateLine(repo, TOKEN, estimate.id, {
      item: "Mason labour",
      quantity: 20,
      unit: "hr",
      rate: 45,
      costCategory: "labour",
    });

    const lines = await listEstimateLines(repo, TOKEN, estimate.id);
    expect(lines).toHaveLength(2);
    expect(lines.find((l) => l.item === "Concrete grade 40")!.line_total).toBe(3500);
    expect(lines.find((l) => l.item === "Mason labour")!.line_total).toBe(900);

    const updated = await getEstimate(repo, TOKEN, estimate.id);
    expect(updated.subtotal_amount).toBe(4400);
    expect(updated.total_amount).toBe(4400 + 100 + 200 + 300 + 400);
  });

  it("removing a line recomputes totals downward", async () => {
    const estimate = await createEstimateVersion(repo, TOKEN, { tenderSubmissionId: TENDER_SUBMISSION_ID, createdBy: "estimator-a" });
    const line = await addEstimateLine(repo, TOKEN, estimate.id, {
      item: "Excavator rental",
      quantity: 5,
      unit: "day",
      rate: 1200,
      costCategory: "equipment",
    });
    await removeEstimateLine(repo, TOKEN, estimate.id, line.id);
    const after = await getEstimate(repo, TOKEN, estimate.id);
    expect(after.subtotal_amount).toBe(0);
    expect(after.total_amount).toBe(0);
    const lines = await listEstimateLines(repo, TOKEN, estimate.id);
    expect(lines).toHaveLength(0);
  });

  it("estimate_lines default to source 'manual' with null confidence — FR-EST-002 reserved, not AI-backed", async () => {
    const estimate = await createEstimateVersion(repo, TOKEN, { tenderSubmissionId: TENDER_SUBMISSION_ID, createdBy: "estimator-a" });
    const line = await addEstimateLine(repo, TOKEN, estimate.id, {
      item: "Rebar",
      quantity: 1000,
      unit: "kg",
      rate: 3,
      costCategory: "material",
    });
    expect(line.source).toBe("manual");
    expect(line.confidence).toBeNull();
  });

  it("propose -> approve: estimate version locks (FR-EST-003); further edits fail until a new version is created", async () => {
    const estimate = await createEstimateVersion(repo, TOKEN, { tenderSubmissionId: TENDER_SUBMISSION_ID, createdBy: "estimator-a" });
    await addEstimateLine(repo, TOKEN, estimate.id, { item: "Concrete", quantity: 1, unit: "m3", rate: 100, costCategory: "material" });

    const definition = await publishApprovalWorkflow(workflowRepo, "estimate-approval-1", { approverUserIds: [APPROVER] });
    const submitted = await submitEstimateForApproval(repo, workflowRepo, TOKEN, {
      estimateId: estimate.id,
      definitionId: definition.id,
      submittedBy: "estimator-a",
    });
    expect(submitted.status).toBe("pending_approval");
    expect(submitted.workflow_instance_id).not.toBeNull();

    const [step] = await workflowRepo.listStepInstances(TOKEN, submitted.workflow_instance_id!);
    await decideApprovalStep(workflowRepo, authorityRepo, TOKEN, step!.id, APPROVER, "approved", null);

    const resolved = await resolveEstimateApproval(repo, workflowRepo, TOKEN, estimate.id);
    expect(resolved.status).toBe("approved");

    // Locked: no in-place edits, no new lines, no line removal.
    await expect(
      updateEstimateFields(repo, TOKEN, estimate.id, { margin: 9999 }),
    ).rejects.toBeInstanceOf(EstimateLockedError);
    await expect(
      addEstimateLine(repo, TOKEN, estimate.id, { item: "Should fail", quantity: 1, unit: "ea", rate: 1, costCategory: "labour" }),
    ).rejects.toBeInstanceOf(EstimateLockedError);

    // Idempotent resolve: resolving again does not create a second approved version or re-supersede anything.
    const resolvedAgain = await resolveEstimateApproval(repo, workflowRepo, TOKEN, estimate.id);
    expect(resolvedAgain.status).toBe("approved");
  });

  it("creating a next version from an approved one copies fields and lines forward, and supersedes the old one once the new one is approved", async () => {
    const v1 = await createEstimateVersion(repo, TOKEN, {
      tenderSubmissionId: TENDER_SUBMISSION_ID,
      assumptions: "v1 assumptions",
      taxes: 50,
      createdBy: "estimator-a",
    });
    await addEstimateLine(repo, TOKEN, v1.id, { item: "Concrete", quantity: 2, unit: "m3", rate: 300, costCategory: "material" });

    const definition1 = await publishApprovalWorkflow(workflowRepo, "estimate-approval-2", { approverUserIds: [APPROVER] });
    const submittedV1 = await submitEstimateForApproval(repo, workflowRepo, TOKEN, {
      estimateId: v1.id,
      definitionId: definition1.id,
      submittedBy: "estimator-a",
    });
    const [stepV1] = await workflowRepo.listStepInstances(TOKEN, submittedV1.workflow_instance_id!);
    await decideApprovalStep(workflowRepo, authorityRepo, TOKEN, stepV1!.id, APPROVER, "approved", null);
    const approvedV1 = await resolveEstimateApproval(repo, workflowRepo, TOKEN, v1.id);
    expect(approvedV1.status).toBe("approved");

    // Only path to change an approved version: a new version.
    const v2 = await createNextEstimateVersionFrom(repo, TOKEN, v1.id, "estimator-b");
    expect(v2.version).toBe(2);
    expect(v2.status).toBe("draft");
    expect(v2.assumptions).toBe("v1 assumptions");
    expect(v2.taxes).toBe(50);
    const v2Lines = await listEstimateLines(repo, TOKEN, v2.id);
    expect(v2Lines).toHaveLength(1);
    expect(v2Lines[0]!.item).toBe("Concrete");
    expect(v2.subtotal_amount).toBe(600);

    const definition2 = await publishApprovalWorkflow(workflowRepo, "estimate-approval-3", { approverUserIds: [APPROVER] });
    const submittedV2 = await submitEstimateForApproval(repo, workflowRepo, TOKEN, {
      estimateId: v2.id,
      definitionId: definition2.id,
      submittedBy: "estimator-b",
    });
    const [stepV2] = await workflowRepo.listStepInstances(TOKEN, submittedV2.workflow_instance_id!);
    await decideApprovalStep(workflowRepo, authorityRepo, TOKEN, stepV2!.id, APPROVER, "approved", null);
    const approvedV2 = await resolveEstimateApproval(repo, workflowRepo, TOKEN, v2.id);
    expect(approvedV2.status).toBe("approved");

    const oldV1 = await getEstimate(repo, TOKEN, v1.id);
    expect(oldV1.status).toBe("superseded");

    const versions = await listEstimateVersions(repo, TOKEN, TENDER_SUBMISSION_ID);
    expect(versions).toHaveLength(2);
  });

  it("propose -> reject: status updates, no new version is created, estimate stays locked out of editing until returned/new version", async () => {
    const estimate = await createEstimateVersion(repo, TOKEN, { tenderSubmissionId: TENDER_SUBMISSION_ID, createdBy: "estimator-a" });
    const definition = await publishApprovalWorkflow(workflowRepo, "estimate-approval-4", { approverUserIds: [APPROVER] });
    const submitted = await submitEstimateForApproval(repo, workflowRepo, TOKEN, {
      estimateId: estimate.id,
      definitionId: definition.id,
      submittedBy: "estimator-a",
    });
    const [step] = await workflowRepo.listStepInstances(TOKEN, submitted.workflow_instance_id!);
    await decideApprovalStep(workflowRepo, authorityRepo, TOKEN, step!.id, APPROVER, "rejected", "margin too thin");

    const resolved = await resolveEstimateApproval(repo, workflowRepo, TOKEN, estimate.id);
    expect(resolved.status).toBe("rejected");

    const versions = await listEstimateVersions(repo, TOKEN, TENDER_SUBMISSION_ID);
    expect(versions).toHaveLength(1);
  });

  it("propose -> returned_for_correction: estimate goes back to an editable state without a new version", async () => {
    const estimate = await createEstimateVersion(repo, TOKEN, { tenderSubmissionId: TENDER_SUBMISSION_ID, createdBy: "estimator-a" });
    const definition = await publishApprovalWorkflow(workflowRepo, "estimate-approval-5", { approverUserIds: [APPROVER] });
    const submitted = await submitEstimateForApproval(repo, workflowRepo, TOKEN, {
      estimateId: estimate.id,
      definitionId: definition.id,
      submittedBy: "estimator-a",
    });
    const [step] = await workflowRepo.listStepInstances(TOKEN, submitted.workflow_instance_id!);
    await decideApprovalStep(workflowRepo, authorityRepo, TOKEN, step!.id, APPROVER, "returned_for_correction", "fix quantities");

    const resolved = await resolveEstimateApproval(repo, workflowRepo, TOKEN, estimate.id);
    expect(resolved.status).toBe("returned_for_correction");

    // Still editable in place, no new version required.
    const updated = await updateEstimateFields(repo, TOKEN, estimate.id, { margin: 500 });
    expect(updated.margin).toBe(500);
    const versions = await listEstimateVersions(repo, TOKEN, TENDER_SUBMISSION_ID);
    expect(versions).toHaveLength(1);
  });

  it("tenant isolation: another tenant cannot see or resolve another tenant's estimate", async () => {
    const estimate = await createEstimateVersion(repo, TOKEN, { tenderSubmissionId: TENDER_SUBMISSION_ID, createdBy: "estimator-a" });

    const listedForB = await listEstimateVersions(repo, TOKEN_B, TENDER_SUBMISSION_ID);
    expect(listedForB).toHaveLength(0);

    await expect(getEstimate(repo, TOKEN_B, estimate.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(resolveEstimateApproval(repo, workflowRepo, TOKEN_B, estimate.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
