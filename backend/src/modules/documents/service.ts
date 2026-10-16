import type { WorkflowRepository } from "../workflow/repository.js";
import { getWorkflowInstance, startWorkflowInstance } from "../workflow/service.js";
import type {
  CreateDocumentInput,
  CreateDocumentRevisionInput,
  DocumentsRepository,
  ListRevisionsOptions,
  UpdateDocumentInput,
  UpdateDocumentRevisionInput,
} from "./repository.js";
import type { Document, DocumentRevision } from "./types.js";

export class NotFoundError extends Error {
  constructor(message = "not found") {
    super(message);
  }
}

/** FR-DOC-003: only an under_review revision may be submitted for IFC release. */
export class RevisionNotUnderReviewError extends Error {}

export async function createDocument(
  repo: DocumentsRepository,
  accessToken: string,
  input: CreateDocumentInput,
): Promise<Document> {
  return repo.createDocument(accessToken, input);
}

export async function getDocument(repo: DocumentsRepository, accessToken: string, documentId: string): Promise<Document> {
  const document = await repo.getDocument(accessToken, documentId);
  if (!document) throw new NotFoundError();
  return document;
}

export async function listDocuments(
  repo: DocumentsRepository,
  accessToken: string,
  filters?: { projectId?: string },
): Promise<Document[]> {
  return repo.listDocuments(accessToken, filters);
}

export async function updateDocument(
  repo: DocumentsRepository,
  accessToken: string,
  documentId: string,
  input: UpdateDocumentInput,
): Promise<Document> {
  const updated = await repo.updateDocument(accessToken, documentId, input);
  if (!updated) throw new NotFoundError();
  return updated;
}

/**
 * FR-DOC-002: creating a new revision on a document whose current
 * revision is `approved` must mark the old revision `superseded` and
 * point its `superseded_by_revision_id` at the new one — in this same
 * call, not a separate step a caller could forget.
 */
export async function createDocumentRevision(
  repo: DocumentsRepository,
  accessToken: string,
  input: CreateDocumentRevisionInput,
): Promise<DocumentRevision> {
  const document = await repo.getDocument(accessToken, input.document_id);
  if (!document) throw new NotFoundError("document not found");

  const newRevision = await repo.createDocumentRevision(accessToken, input);

  if (document.current_revision_id) {
    const currentRevision = await repo.getDocumentRevision(accessToken, document.current_revision_id);
    if (currentRevision && currentRevision.status === "approved") {
      await repo.updateDocumentRevision(accessToken, currentRevision.id, {
        status: "superseded",
        superseded_by_revision_id: newRevision.id,
      });
    }
  }

  await repo.setDocumentCurrentRevision(accessToken, document.id, newRevision.id);

  return newRevision;
}

export async function getDocumentRevision(
  repo: DocumentsRepository,
  accessToken: string,
  revisionId: string,
): Promise<DocumentRevision> {
  const revision = await repo.getDocumentRevision(accessToken, revisionId);
  if (!revision) throw new NotFoundError();
  return revision;
}

export async function updateDocumentRevision(
  repo: DocumentsRepository,
  accessToken: string,
  revisionId: string,
  input: UpdateDocumentRevisionInput,
): Promise<DocumentRevision> {
  const updated = await repo.updateDocumentRevision(accessToken, revisionId, input);
  if (!updated) throw new NotFoundError();
  return updated;
}

/** FR-DOC-002's "excluded from current-for-construction views" — defaults to excluding superseded/rejected. */
export async function listDocumentRevisions(
  repo: DocumentsRepository,
  accessToken: string,
  documentId: string,
  options?: ListRevisionsOptions,
): Promise<DocumentRevision[]> {
  return repo.listDocumentRevisions(accessToken, documentId, options);
}

/** Raw data for a future revision-comparison screen: full ordered (oldest-to-newest) revision list. */
export async function listDocumentRevisionHistory(
  repo: DocumentsRepository,
  accessToken: string,
  documentId: string,
): Promise<DocumentRevision[]> {
  return repo.listDocumentRevisionHistory(accessToken, documentId);
}

async function requireDocumentRevision(
  repo: DocumentsRepository,
  accessToken: string,
  revisionId: string,
): Promise<DocumentRevision> {
  const revision = await repo.getDocumentRevision(accessToken, revisionId);
  if (!revision) throw new NotFoundError();
  return revision;
}

export interface SubmitRevisionForReleaseInput {
  revisionId: string;
  /** Whoever configured this in the Configuration Studio names which published approval workflow to run — same "no automatic resolution" convention as ticket 0097's SubmitEstimateForApprovalInput.definitionId; this module does not guess a definition. */
  definitionId: string;
  submittedBy: string | null;
}

/**
 * FR-DOC-003: "Submit for IFC release" — starts a real `request_approval`
 * workflow instance (ticket 0066/0062's seam), the exact same shape as
 * ticket 0097's submitEstimateForApproval, rather than inventing a second
 * approval mechanism. Only an `under_review` revision may be submitted;
 * the revision only records which instance is deciding it —
 * resolveRevisionApproval reads the outcome back out of that instance.
 */
export async function submitRevisionForRelease(
  repo: DocumentsRepository,
  workflowRepo: WorkflowRepository,
  accessToken: string,
  input: SubmitRevisionForReleaseInput,
): Promise<DocumentRevision> {
  const revision = await requireDocumentRevision(repo, accessToken, input.revisionId);
  if (revision.status !== "under_review") {
    throw new RevisionNotUnderReviewError(
      `revision ${revision.id} is ${revision.status}, not under_review — only an under_review revision may be submitted for IFC release`,
    );
  }

  const { instance } = await startWorkflowInstance(workflowRepo, accessToken, input.definitionId, input.submittedBy, {
    documentRevisionId: revision.id,
    documentId: revision.document_id,
  });

  const updated = await repo.updateDocumentRevision(accessToken, revision.id, {
    workflow_instance_id: instance.id,
  });
  if (!updated) throw new NotFoundError();
  return updated;
}

/**
 * The polling half of the seam: no event bus exists in this codebase, so
 * a revision's approval outcome is read back on demand by inspecting its
 * workflow instance's step instances for the one whose output carries a
 * `decision` (only a resolved request_approval step's completeStepInstance
 * call ever writes that key — see ticket 0066's decideApprovalStep).
 * Idempotent: once a revision is no longer carrying an unresolved
 * submission (status has moved to approved/rejected), re-reading this is
 * a no-op. On approval: stamps `approved_at` (the "approval stamp"),
 * and runs ticket 0104's supersede-the-previous-approved-revision
 * behavior as a safety net in case it didn't already fire when this
 * revision was created. On rejection/returned-for-correction: mapped to
 * this table's own `rejected` status (ticket 0104's enum) — not a new
 * rejection vocabulary; same literal-pass-through reasoning as ticket
 * 0097's resolveEstimateApproval, except document_revisions has no
 * separate `returned_for_correction` member, so both legal
 * ApprovalChainDecision rejection outcomes land on `rejected`, which is
 * already editable-in-place (not a dead end) per ticket 0104/FR-DOC-002.
 */
export async function resolveRevisionApproval(
  repo: DocumentsRepository,
  workflowRepo: WorkflowRepository,
  accessToken: string,
  revisionId: string,
): Promise<DocumentRevision> {
  const revision = await requireDocumentRevision(repo, accessToken, revisionId);
  if (revision.status !== "under_review") return revision;
  if (!revision.workflow_instance_id) return revision;

  const { stepInstances } = await getWorkflowInstance(workflowRepo, accessToken, revision.workflow_instance_id);
  const decidedStep = stepInstances.find((s) => typeof s.output?.decision === "string");
  if (!decidedStep) return revision;

  const decision = decidedStep.output.decision as string;
  if (decision === "approved") {
    const document = await repo.getDocument(accessToken, revision.document_id);
    if (document?.current_revision_id && document.current_revision_id !== revision.id) {
      const currentRevision = await repo.getDocumentRevision(accessToken, document.current_revision_id);
      if (currentRevision && currentRevision.status === "approved") {
        await repo.updateDocumentRevision(accessToken, currentRevision.id, {
          status: "superseded",
          superseded_by_revision_id: revision.id,
        });
      }
    }

    // approver_id/reviewer_id: left as whatever ticket 0104's fields
    // already carry (set at revision creation or via PATCH) — this is
    // the "approval stamp," not a second place that invents who the
    // approver was.
    const updated = await repo.updateDocumentRevision(accessToken, revisionId, {
      status: "approved",
      approved_at: new Date().toISOString(),
    });
    if (document) await repo.setDocumentCurrentRevision(accessToken, document.id, revision.id);
    return updated!;
  }

  // "rejected" and "returned_for_correction" are both legal
  // ApprovalChainDecision values (ticket 0066); document_revisions has
  // no distinct returned_for_correction status so both land on
  // `rejected` — ticket 0104's existing enum, not a third vocabulary.
  const updated = await repo.updateDocumentRevision(accessToken, revisionId, { status: "rejected" });
  return updated!;
}
