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
