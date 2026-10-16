import { beforeEach, describe, expect, it } from "vitest";
import { FakeDocumentsRepository } from "../../test/fakeDocumentsRepository.js";
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
  NotFoundError,
  RevisionNotUnderReviewError,
  createDocument,
  createDocumentRevision,
  getDocument,
  getDocumentRevision,
  listDocumentRevisionHistory,
  listDocumentRevisions,
  listDocuments,
  resolveRevisionApproval,
  submitRevisionForRelease,
  updateDocument,
  updateDocumentRevision,
} from "./service.js";

const TOKEN = "caller-token";
const TENANT_ID = "tenant-a";
const OTHER_TOKEN = "other-tenant-token";
const OTHER_TENANT_ID = "tenant-b";
const APPROVER = "approver-user";
const PROCESS_OWNER = "process-owner";

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

describe("document register", () => {
  let repo: FakeDocumentsRepository;

  beforeEach(() => {
    repo = new FakeDocumentsRepository();
    repo.addSession(TOKEN, "user-1", TENANT_ID);
    repo.addSession(OTHER_TOKEN, "user-2", OTHER_TENANT_ID);
  });

  it("creates a document with type, number, title, project, discipline, access class and tags", async () => {
    const document = await createDocument(repo, TOKEN, {
      document_type: "drawing",
      title: "Ground Floor Plan",
      document_number: "DWG-001",
      project_id: "project-1",
      discipline: "architectural",
      access_class: "internal",
      tags: ["ifc", "structural"],
      originator_id: "user-1",
    });

    expect(document.document_type).toBe("drawing");
    expect(document.document_number).toBe("DWG-001");
    expect(document.project_id).toBe("project-1");
    expect(document.tags).toEqual(["ifc", "structural"]);
    expect(document.current_revision_id).toBeNull();
    expect(document.tenant_id).toBe(TENANT_ID);
  });

  it("allows a nullable project_id — not every controlled document is project-scoped", async () => {
    const document = await createDocument(repo, TOKEN, {
      document_type: "sop",
      title: "Corporate Safety SOP",
    });

    expect(document.project_id).toBeNull();
  });

  it("lists documents, tenant-isolated", async () => {
    await createDocument(repo, TOKEN, { document_type: "drawing", title: "Doc 1" });
    await createDocument(repo, TOKEN, { document_type: "spec", title: "Doc 2" });

    expect(await listDocuments(repo, TOKEN)).toHaveLength(2);
    expect(await listDocuments(repo, OTHER_TOKEN)).toHaveLength(0);
  });

  it("filters list by projectId", async () => {
    await createDocument(repo, TOKEN, { document_type: "drawing", title: "Project A doc", project_id: "project-a" });
    await createDocument(repo, TOKEN, { document_type: "drawing", title: "Project B doc", project_id: "project-b" });

    const filtered = await listDocuments(repo, TOKEN, { projectId: "project-a" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.title).toBe("Project A doc");
  });

  it("getDocument throws NotFoundError for another tenant's document", async () => {
    const document = await createDocument(repo, TOKEN, { document_type: "drawing", title: "Doc" });
    await expect(getDocument(repo, OTHER_TOKEN, document.id)).rejects.toThrow(NotFoundError);
  });

  it("updateDocument edits metadata", async () => {
    const document = await createDocument(repo, TOKEN, { document_type: "drawing", title: "Original title" });
    const updated = await updateDocument(repo, TOKEN, document.id, { title: "Revised title", discipline: "MEP" });
    expect(updated.title).toBe("Revised title");
    expect(updated.discipline).toBe("MEP");
  });

  it("updateDocument throws NotFoundError when the row doesn't exist", async () => {
    await expect(updateDocument(repo, TOKEN, "does-not-exist", { title: "x" })).rejects.toThrow(NotFoundError);
  });
});

describe("revision control: FR-DOC-002 auto-supersede", () => {
  let repo: FakeDocumentsRepository;

  beforeEach(() => {
    repo = new FakeDocumentsRepository();
    repo.addSession(TOKEN, "user-1", TENANT_ID);
    repo.addSession(OTHER_TOKEN, "user-2", OTHER_TENANT_ID);
  });

  it("creating a first revision sets it as the document's current revision", async () => {
    const document = await createDocument(repo, TOKEN, { document_type: "drawing", title: "Doc" });
    const revision = await createDocumentRevision(repo, TOKEN, {
      document_id: document.id,
      revision_code: "A",
      created_by: "user-1",
    });

    const refreshedDocument = await getDocument(repo, TOKEN, document.id);
    expect(refreshedDocument.current_revision_id).toBe(revision.id);
    expect(revision.status).toBe("draft");
    expect(revision.superseded_by_revision_id).toBeNull();
  });

  it("creating a new revision when the current one is approved supersedes the old one, in the same call", async () => {
    const document = await createDocument(repo, TOKEN, { document_type: "drawing", title: "Doc" });
    const revisionA = await createDocumentRevision(repo, TOKEN, {
      document_id: document.id,
      revision_code: "A",
      created_by: "user-1",
    });
    await updateDocumentRevision(repo, TOKEN, revisionA.id, { status: "approved" });

    const revisionB = await createDocumentRevision(repo, TOKEN, {
      document_id: document.id,
      revision_code: "B",
      created_by: "user-1",
    });

    const refreshedA = await getDocumentRevision(repo, TOKEN, revisionA.id);
    expect(refreshedA.status).toBe("superseded");
    expect(refreshedA.superseded_by_revision_id).toBe(revisionB.id);

    const refreshedDocument = await getDocument(repo, TOKEN, document.id);
    expect(refreshedDocument.current_revision_id).toBe(revisionB.id);
  });

  it("creating a new revision when the current one is NOT approved does not supersede it", async () => {
    const document = await createDocument(repo, TOKEN, { document_type: "drawing", title: "Doc" });
    const revisionA = await createDocumentRevision(repo, TOKEN, {
      document_id: document.id,
      revision_code: "A",
      created_by: "user-1",
    });
    // Still draft — not approved.

    await createDocumentRevision(repo, TOKEN, {
      document_id: document.id,
      revision_code: "B",
      created_by: "user-1",
    });

    const refreshedA = await getDocumentRevision(repo, TOKEN, revisionA.id);
    expect(refreshedA.status).toBe("draft");
    expect(refreshedA.superseded_by_revision_id).toBeNull();
  });

  it("createDocumentRevision throws NotFoundError for a document in another tenant", async () => {
    const document = await createDocument(repo, TOKEN, { document_type: "drawing", title: "Doc" });
    await expect(
      createDocumentRevision(repo, OTHER_TOKEN, {
        document_id: document.id,
        revision_code: "A",
        created_by: "user-2",
      }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("revision list/history defaults", () => {
  let repo: FakeDocumentsRepository;

  beforeEach(() => {
    repo = new FakeDocumentsRepository();
    repo.addSession(TOKEN, "user-1", TENANT_ID);
    repo.addSession(OTHER_TOKEN, "user-2", OTHER_TENANT_ID);
  });

  it("listDocumentRevisions excludes superseded and rejected by default", async () => {
    const document = await createDocument(repo, TOKEN, { document_type: "drawing", title: "Doc" });
    const revisionA = await createDocumentRevision(repo, TOKEN, {
      document_id: document.id,
      revision_code: "A",
      created_by: "user-1",
    });
    await updateDocumentRevision(repo, TOKEN, revisionA.id, { status: "approved" });
    await createDocumentRevision(repo, TOKEN, {
      // supersedes A
      document_id: document.id,
      revision_code: "B",
      created_by: "user-1",
    });
    const revisionC = await createDocumentRevision(repo, TOKEN, {
      document_id: document.id,
      revision_code: "C-rejected",
      created_by: "user-1",
    });
    await updateDocumentRevision(repo, TOKEN, revisionC.id, { status: "rejected" });

    const defaultView = await listDocumentRevisions(repo, TOKEN, document.id);
    expect(defaultView.map((r) => r.revision_code)).toEqual(["B"]);

    const includeSuperseded = await listDocumentRevisions(repo, TOKEN, document.id, { includeSuperseded: true });
    expect(includeSuperseded).toHaveLength(3);
  });

  it("listDocumentRevisionHistory returns every revision, oldest-to-newest, full metadata", async () => {
    const document = await createDocument(repo, TOKEN, { document_type: "drawing", title: "Doc" });
    const revisionA = await createDocumentRevision(repo, TOKEN, {
      document_id: document.id,
      revision_code: "A",
      created_by: "user-1",
    });
    await updateDocumentRevision(repo, TOKEN, revisionA.id, { status: "approved" });
    const revisionB = await createDocumentRevision(repo, TOKEN, {
      document_id: document.id,
      revision_code: "B",
      created_by: "user-1",
    });

    const history = await listDocumentRevisionHistory(repo, TOKEN, document.id);
    expect(history.map((r) => r.revision_code)).toEqual(["A", "B"]);
    expect(history[0]!.status).toBe("superseded");
    expect(history[0]!.superseded_by_revision_id).toBe(revisionB.id);
  });

  it("tenant-isolates revision lists and history", async () => {
    const document = await createDocument(repo, TOKEN, { document_type: "drawing", title: "Doc" });
    await createDocumentRevision(repo, TOKEN, {
      document_id: document.id,
      revision_code: "A",
      created_by: "user-1",
    });

    expect(await listDocumentRevisions(repo, OTHER_TOKEN, document.id)).toHaveLength(0);
    expect(await listDocumentRevisionHistory(repo, OTHER_TOKEN, document.id)).toHaveLength(0);
  });
});

describe("M13b: IFC release approval gate (ticket 0105)", () => {
  let repo: FakeDocumentsRepository;
  let workflowRepo: FakeWorkflowRepository;
  let authorityRepo: FakeAuthorityRepository;

  beforeEach(() => {
    repo = new FakeDocumentsRepository();
    repo.addSession(TOKEN, "user-1", TENANT_ID);
    repo.addSession(OTHER_TOKEN, "user-2", OTHER_TENANT_ID);
    workflowRepo = new FakeWorkflowRepository();
    authorityRepo = new FakeAuthorityRepository();
  });

  async function createUnderReviewRevision() {
    const document = await createDocument(repo, TOKEN, { document_type: "drawing", title: "Doc" });
    const revision = await createDocumentRevision(repo, TOKEN, {
      document_id: document.id,
      revision_code: "A",
      created_by: "user-1",
    });
    await updateDocumentRevision(repo, TOKEN, revision.id, { status: "under_review" });
    return { document, revision };
  }

  it("only an under_review revision may be submitted for release", async () => {
    const document = await createDocument(repo, TOKEN, { document_type: "drawing", title: "Doc" });
    const draftRevision = await createDocumentRevision(repo, TOKEN, {
      document_id: document.id,
      revision_code: "A",
      created_by: "user-1",
    });

    const definition = await publishApprovalWorkflow(workflowRepo, "ifc-release-1", { approverUserIds: [APPROVER] });
    await expect(
      submitRevisionForRelease(repo, workflowRepo, TOKEN, {
        revisionId: draftRevision.id,
        definitionId: definition.id,
        submittedBy: "user-1",
      }),
    ).rejects.toBeInstanceOf(RevisionNotUnderReviewError);
  });

  it("submit -> approve: sets status approved, stamps approved_at, and supersedes the prior approved revision", async () => {
    const { document, revision: revisionA } = await createUnderReviewRevision();
    // Approve A first via a direct PATCH (simulating an earlier approved current revision), then create B under_review.
    await updateDocumentRevision(repo, TOKEN, revisionA.id, { status: "approved" });
    const revisionB = await createDocumentRevision(repo, TOKEN, {
      document_id: document.id,
      revision_code: "B",
      created_by: "user-1",
    });
    await updateDocumentRevision(repo, TOKEN, revisionB.id, { status: "under_review" });

    const definition = await publishApprovalWorkflow(workflowRepo, "ifc-release-2", { approverUserIds: [APPROVER] });
    const submitted = await submitRevisionForRelease(repo, workflowRepo, TOKEN, {
      revisionId: revisionB.id,
      definitionId: definition.id,
      submittedBy: "user-1",
    });
    expect(submitted.status).toBe("under_review");
    expect(submitted.workflow_instance_id).not.toBeNull();

    const [step] = await workflowRepo.listStepInstances(TOKEN, submitted.workflow_instance_id!);
    await decideApprovalStep(workflowRepo, authorityRepo, TOKEN, step!.id, APPROVER, "approved", null);

    const resolved = await resolveRevisionApproval(repo, workflowRepo, TOKEN, revisionB.id);
    expect(resolved.status).toBe("approved");
    expect(resolved.approved_at).not.toBeNull();

    const refreshedDocument = await getDocument(repo, TOKEN, document.id);
    expect(refreshedDocument.current_revision_id).toBe(revisionB.id);
  });

  it("submit -> reject: maps both 'rejected' and 'returned_for_correction' decisions onto the existing 'rejected' status", async () => {
    const { revision } = await createUnderReviewRevision();
    const definition = await publishApprovalWorkflow(workflowRepo, "ifc-release-3", { approverUserIds: [APPROVER] });
    const submitted = await submitRevisionForRelease(repo, workflowRepo, TOKEN, {
      revisionId: revision.id,
      definitionId: definition.id,
      submittedBy: "user-1",
    });

    const [step] = await workflowRepo.listStepInstances(TOKEN, submitted.workflow_instance_id!);
    await decideApprovalStep(workflowRepo, authorityRepo, TOKEN, step!.id, APPROVER, "returned_for_correction", "needs more detail");

    const resolved = await resolveRevisionApproval(repo, workflowRepo, TOKEN, revision.id);
    expect(resolved.status).toBe("rejected");
  });

  it("resolveRevisionApproval is idempotent once status has left under_review", async () => {
    const { revision } = await createUnderReviewRevision();
    const definition = await publishApprovalWorkflow(workflowRepo, "ifc-release-4", { approverUserIds: [APPROVER] });
    const submitted = await submitRevisionForRelease(repo, workflowRepo, TOKEN, {
      revisionId: revision.id,
      definitionId: definition.id,
      submittedBy: "user-1",
    });
    const [step] = await workflowRepo.listStepInstances(TOKEN, submitted.workflow_instance_id!);
    await decideApprovalStep(workflowRepo, authorityRepo, TOKEN, step!.id, APPROVER, "approved", null);
    const first = await resolveRevisionApproval(repo, workflowRepo, TOKEN, revision.id);
    expect(first.status).toBe("approved");

    const second = await resolveRevisionApproval(repo, workflowRepo, TOKEN, revision.id);
    expect(second.status).toBe("approved");
    expect(second.approved_at).toBe(first.approved_at);
  });

  it("tenant-isolates submit and resolve: another tenant's revision is NotFoundError", async () => {
    const { revision } = await createUnderReviewRevision();
    const definition = await publishApprovalWorkflow(workflowRepo, "ifc-release-5", { approverUserIds: [APPROVER] });
    await expect(
      submitRevisionForRelease(repo, workflowRepo, OTHER_TOKEN, {
        revisionId: revision.id,
        definitionId: definition.id,
        submittedBy: "user-2",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    await expect(resolveRevisionApproval(repo, workflowRepo, OTHER_TOKEN, revision.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
