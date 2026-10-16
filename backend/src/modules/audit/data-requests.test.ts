import { beforeEach, describe, expect, it } from "vitest";
import { FakeAuditRepository } from "../../test/fakeAuditRepository.js";
import { FakeWorkflowRepository } from "../../test/fakeWorkflowRepository.js";
import { FakeIdentityRepository } from "../../test/fakeIdentityRepository.js";
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
  DataRequestNotFoundError,
  MissingDataRequestReasonError,
  UnsupportedDataRequestEntityTypeError,
  listDataRequests,
  requestDataAction,
  resolveDataRequest,
} from "./service.js";

const TOKEN = "token-tenant-a";
const TOKEN_B = "token-tenant-b";
const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const APPROVER = "approver-user";
const PROCESS_OWNER = "process-owner";
const SUBJECT_USER = "subject-user";

async function publishApprovalWorkflow(workflowRepo: FakeWorkflowRepository, key: string) {
  const nodes: { key: string; type: NodeType }[] = [
    { key: "approve", type: "request_approval" },
    { key: "end", type: "complete" },
  ];
  const { definition, version } = await createWorkflowDefinition(workflowRepo, TOKEN, { key, name: key }, PROCESS_OWNER);
  const nodeIdByKey = new Map<string, string>();
  for (const n of nodes) {
    const node = await addNodeToVersion(workflowRepo, TOKEN, version.id, {
      nodeKey: n.key,
      nodeType: n.type,
      config: n.type === "request_approval" ? { approverUserIds: [APPROVER] } : {},
    });
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

async function decideTheOnlyPendingStep(
  workflowRepo: FakeWorkflowRepository,
  authorityRepo: FakeAuthorityRepository,
  instanceId: string,
  decision: "approved" | "rejected" | "returned_for_correction",
  reason: string | null,
) {
  const [step] = await workflowRepo.listStepInstances(TOKEN, instanceId);
  await decideApprovalStep(workflowRepo, authorityRepo, TOKEN, step!.id, APPROVER, decision, reason);
}

describe("M35c: data export & deletion requests (ticket 0080)", () => {
  let auditRepo: FakeAuditRepository;
  let workflowRepo: FakeWorkflowRepository;
  let identityRepo: FakeIdentityRepository;
  let authorityRepo: FakeAuthorityRepository;

  beforeEach(() => {
    auditRepo = new FakeAuditRepository();
    auditRepo.addSession(TOKEN, TENANT_A);
    auditRepo.addSession(TOKEN_B, TENANT_B);
    workflowRepo = new FakeWorkflowRepository();
    identityRepo = new FakeIdentityRepository();
    authorityRepo = new FakeAuthorityRepository();
  });

  it("rejects a blank reason", async () => {
    const definition = await publishApprovalWorkflow(workflowRepo, "data-request-1");
    await expect(
      requestDataAction(auditRepo, workflowRepo, TOKEN, {
        requestType: "export",
        entityType: "app_users",
        entityId: SUBJECT_USER,
        reason: "   ",
        requestedBy: "requester-a",
        definitionId: definition.id,
      }),
    ).rejects.toBeInstanceOf(MissingDataRequestReasonError);
  });

  it("rejects an unsupported entity type", async () => {
    const definition = await publishApprovalWorkflow(workflowRepo, "data-request-2");
    await expect(
      requestDataAction(auditRepo, workflowRepo, TOKEN, {
        requestType: "export",
        entityType: "projects",
        entityId: "project-1",
        reason: "owner asked for their project data",
        requestedBy: "requester-a",
        definitionId: definition.id,
      }),
    ).rejects.toBeInstanceOf(UnsupportedDataRequestEntityTypeError);
  });

  it("export: nothing happens before approval, then the bundle is built once approved", async () => {
    await identityRepo.insertAppUser({ id: SUBJECT_USER, email: "subject@example.com", display_name: "Subject", invited_by: null });
    await identityRepo.activateAppUser(SUBJECT_USER);
    auditRepo.appUsers.set(SUBJECT_USER, { id: SUBJECT_USER, tenant_id: TENANT_A, email: "subject@example.com" });
    auditRepo.roleAssignments.push({ user_id: SUBJECT_USER, role_id: "role.site_engineer" });
    auditRepo.seed(TENANT_A, {
      id: "auth_audit_log:1",
      source: "auth_audit_log",
      actorType: "human",
      actorId: SUBJECT_USER,
      action: "sign_in",
      entityType: "user",
      entityId: SUBJECT_USER,
      occurredAt: "2026-10-16T01:00:00.000Z",
      detail: {},
      correlationId: null,
    });

    const definition = await publishApprovalWorkflow(workflowRepo, "data-request-export");
    const request = await requestDataAction(auditRepo, workflowRepo, TOKEN, {
      requestType: "export",
      entityType: "app_users",
      entityId: SUBJECT_USER,
      reason: "data subject asked for a copy of their data",
      requestedBy: "requester-a",
      definitionId: definition.id,
    });
    expect(request.status).toBe("pending");

    const stillPending = await resolveDataRequest(auditRepo, workflowRepo, identityRepo, TOKEN, TENANT_A, request.id);
    expect(stillPending.status).toBe("pending");
    expect(stillPending.result).toBeNull();

    await decideTheOnlyPendingStep(workflowRepo, authorityRepo, request.workflow_instance_id, "approved", null);

    const resolved = await resolveDataRequest(auditRepo, workflowRepo, identityRepo, TOKEN, TENANT_A, request.id);
    expect(resolved.status).toBe("completed");
    expect((resolved.result as any).appUser.id).toBe(SUBJECT_USER);
    expect((resolved.result as any).roleAssignments).toHaveLength(1);
    expect((resolved.result as any).auditEntries).toHaveLength(1);

    // Idempotent re-resolve.
    const resolvedAgain = await resolveDataRequest(auditRepo, workflowRepo, identityRepo, TOKEN, TENANT_A, request.id);
    expect(resolvedAgain.status).toBe("completed");
  });

  it("export: a rejected request leaves no export result", async () => {
    const definition = await publishApprovalWorkflow(workflowRepo, "data-request-export-reject");
    const request = await requestDataAction(auditRepo, workflowRepo, TOKEN, {
      requestType: "export",
      entityType: "app_users",
      entityId: SUBJECT_USER,
      reason: "data subject asked for a copy",
      requestedBy: "requester-a",
      definitionId: definition.id,
    });

    await decideTheOnlyPendingStep(workflowRepo, authorityRepo, request.workflow_instance_id, "rejected", "not verified");

    const resolved = await resolveDataRequest(auditRepo, workflowRepo, identityRepo, TOKEN, TENANT_A, request.id);
    expect(resolved.status).toBe("rejected");
    expect(resolved.result).toBeNull();
  });

  it("deletion: approved and no active legal hold anonymizes the user in place, row and FKs intact", async () => {
    await identityRepo.insertAppUser({ id: SUBJECT_USER, email: "subject@example.com", display_name: "Subject", invited_by: null });
    await identityRepo.activateAppUser(SUBJECT_USER);

    const definition = await publishApprovalWorkflow(workflowRepo, "data-request-deletion");
    const request = await requestDataAction(auditRepo, workflowRepo, TOKEN, {
      requestType: "deletion",
      entityType: "app_users",
      entityId: SUBJECT_USER,
      reason: "right to erasure request",
      requestedBy: "requester-a",
      definitionId: definition.id,
    });

    await decideTheOnlyPendingStep(workflowRepo, authorityRepo, request.workflow_instance_id, "approved", null);
    const resolved = await resolveDataRequest(auditRepo, workflowRepo, identityRepo, TOKEN, TENANT_A, request.id);

    expect(resolved.status).toBe("completed");
    expect((resolved.result as any).anonymizedUserId).toBe(SUBJECT_USER);

    const user = await identityRepo.getAppUserById(SUBJECT_USER);
    expect(user!.id).toBe(SUBJECT_USER);
    expect(user!.status).toBe("deactivated");
    expect(user!.display_name).toBeNull();
    expect(user!.email).not.toBe("subject@example.com");
  });

  it("deletion: refuses and does not anonymize when an active legal hold matches the entity", async () => {
    await identityRepo.insertAppUser({ id: SUBJECT_USER, email: "subject@example.com", display_name: "Subject", invited_by: null });
    const hold = await auditRepo.placeLegalHold(TOKEN, {
      entity_type: "app_users",
      entity_id: SUBJECT_USER,
      reason: "active litigation",
      placed_by: "compliance-a",
    });

    const definition = await publishApprovalWorkflow(workflowRepo, "data-request-deletion-hold");
    const request = await requestDataAction(auditRepo, workflowRepo, TOKEN, {
      requestType: "deletion",
      entityType: "app_users",
      entityId: SUBJECT_USER,
      reason: "right to erasure request",
      requestedBy: "requester-a",
      definitionId: definition.id,
    });

    await decideTheOnlyPendingStep(workflowRepo, authorityRepo, request.workflow_instance_id, "approved", null);
    const resolved = await resolveDataRequest(auditRepo, workflowRepo, identityRepo, TOKEN, TENANT_A, request.id);

    expect(resolved.status).toBe("refused");
    expect((resolved.result as any).legalHoldId).toBe(hold.id);

    const user = await identityRepo.getAppUserById(SUBJECT_USER);
    expect(user!.email).toBe("subject@example.com");
    expect(user!.status).not.toBe("deactivated");
  });

  it("deletion: a type-wide legal hold (entity_id null) also blocks a specific entity", async () => {
    await identityRepo.insertAppUser({ id: SUBJECT_USER, email: "subject@example.com", display_name: "Subject", invited_by: null });
    await auditRepo.placeLegalHold(TOKEN, {
      entity_type: "app_users",
      entity_id: null,
      reason: "tenant-wide freeze",
      placed_by: "compliance-a",
    });

    const definition = await publishApprovalWorkflow(workflowRepo, "data-request-deletion-typewide-hold");
    const request = await requestDataAction(auditRepo, workflowRepo, TOKEN, {
      requestType: "deletion",
      entityType: "app_users",
      entityId: SUBJECT_USER,
      reason: "right to erasure request",
      requestedBy: "requester-a",
      definitionId: definition.id,
    });

    await decideTheOnlyPendingStep(workflowRepo, authorityRepo, request.workflow_instance_id, "approved", null);
    const resolved = await resolveDataRequest(auditRepo, workflowRepo, identityRepo, TOKEN, TENANT_A, request.id);

    expect(resolved.status).toBe("refused");
  });

  it("throws DataRequestNotFoundError for an id that doesn't exist", async () => {
    await expect(
      resolveDataRequest(auditRepo, workflowRepo, identityRepo, TOKEN, TENANT_A, "does-not-exist"),
    ).rejects.toBeInstanceOf(DataRequestNotFoundError);
  });

  it("tenant isolation: tenant B cannot see or resolve tenant A's data request", async () => {
    const definition = await publishApprovalWorkflow(workflowRepo, "data-request-isolation");
    const request = await requestDataAction(auditRepo, workflowRepo, TOKEN, {
      requestType: "export",
      entityType: "app_users",
      entityId: SUBJECT_USER,
      reason: "data subject asked for a copy",
      requestedBy: "requester-a",
      definitionId: definition.id,
    });

    await expect(listDataRequests(auditRepo, TOKEN_B)).resolves.toEqual([]);
    await expect(
      resolveDataRequest(auditRepo, workflowRepo, identityRepo, TOKEN_B, TENANT_B, request.id),
    ).rejects.toBeInstanceOf(DataRequestNotFoundError);

    const listedByA = await listDataRequests(auditRepo, TOKEN);
    expect(listedByA.map((r) => r.id)).toEqual([request.id]);
  });
});
