import type {
  CreateDocumentInput,
  CreateDocumentRevisionInput,
  DocumentsRepository,
  ListRevisionsOptions,
  UpdateDocumentInput,
  UpdateDocumentRevisionInput,
} from "../modules/documents/repository.js";
import type { Document, DocumentRevision } from "../modules/documents/types.js";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/** Monotonically increasing (by 1ms per call) so revision ordering is stable even when calls land in the same tick. */
let lastTimestampMs = Date.now();
function nextTimestamp(): string {
  lastTimestampMs += 1;
  return new Date(lastTimestampMs).toISOString();
}

/**
 * In-memory stand-in for DocumentsRepository. Mutating/reads are keyed
 * off an access token's own session (same convention as every other
 * fake repository in this test suite) so "wrong tenant = not found" is
 * actually exercised, not just asserted.
 */
export class FakeDocumentsRepository implements DocumentsRepository {
  sessions = new Map<string, { userId: string; tenantId: string }>();
  documents = new Map<string, Document>();
  revisions = new Map<string, DocumentRevision>();

  addSession(accessToken: string, userId: string, tenantId: string) {
    this.sessions.set(accessToken, { userId, tenantId });
  }

  private contextOf(accessToken: string) {
    const context = this.sessions.get(accessToken);
    if (!context) throw new Error("no caller context for this access token");
    return context;
  }

  async createDocument(accessToken: string, input: CreateDocumentInput) {
    const { tenantId } = this.contextOf(accessToken);
    const document: Document = {
      id: nextId("document"),
      tenant_id: tenantId,
      document_type: input.document_type,
      title: input.title,
      document_number: input.document_number ?? null,
      project_id: input.project_id ?? null,
      discipline: input.discipline ?? null,
      access_class: input.access_class ?? null,
      tags: input.tags ?? [],
      originator_id: input.originator_id ?? null,
      current_revision_id: null,
      created_at: nextTimestamp(),
    };
    this.documents.set(document.id, document);
    return document;
  }

  async getDocument(accessToken: string, documentId: string) {
    const { tenantId } = this.contextOf(accessToken);
    const document = this.documents.get(documentId);
    if (!document || document.tenant_id !== tenantId) return null;
    return document;
  }

  async listDocuments(accessToken: string, filters?: { projectId?: string }) {
    const { tenantId } = this.contextOf(accessToken);
    return [...this.documents.values()].filter(
      (document) =>
        document.tenant_id === tenantId && (!filters?.projectId || document.project_id === filters.projectId),
    );
  }

  async updateDocument(accessToken: string, documentId: string, input: UpdateDocumentInput) {
    const { tenantId } = this.contextOf(accessToken);
    const document = this.documents.get(documentId);
    if (!document || document.tenant_id !== tenantId) return null;
    const updated: Document = { ...document, ...input };
    this.documents.set(documentId, updated);
    return updated;
  }

  async setDocumentCurrentRevision(accessToken: string, documentId: string, revisionId: string) {
    const { tenantId } = this.contextOf(accessToken);
    const document = this.documents.get(documentId);
    if (!document || document.tenant_id !== tenantId) return null;
    const updated: Document = { ...document, current_revision_id: revisionId };
    this.documents.set(documentId, updated);
    return updated;
  }

  async createDocumentRevision(accessToken: string, input: CreateDocumentRevisionInput) {
    const { tenantId } = this.contextOf(accessToken);
    const revision: DocumentRevision = {
      id: nextId("document-revision"),
      tenant_id: tenantId,
      document_id: input.document_id,
      revision_code: input.revision_code,
      status: input.status ?? "draft",
      storage_reference: input.storage_reference ?? null,
      reviewer_id: input.reviewer_id ?? null,
      approver_id: input.approver_id ?? null,
      superseded_by_revision_id: null,
      workflow_instance_id: null,
      approved_at: null,
      created_by: input.created_by,
      created_at: nextTimestamp(),
    };
    this.revisions.set(revision.id, revision);
    return revision;
  }

  async getDocumentRevision(accessToken: string, revisionId: string) {
    const { tenantId } = this.contextOf(accessToken);
    const revision = this.revisions.get(revisionId);
    if (!revision || revision.tenant_id !== tenantId) return null;
    return revision;
  }

  async updateDocumentRevision(accessToken: string, revisionId: string, input: UpdateDocumentRevisionInput) {
    const { tenantId } = this.contextOf(accessToken);
    const revision = this.revisions.get(revisionId);
    if (!revision || revision.tenant_id !== tenantId) return null;
    const updated: DocumentRevision = { ...revision, ...input };
    this.revisions.set(revisionId, updated);
    return updated;
  }

  async listDocumentRevisionHistory(accessToken: string, documentId: string) {
    const { tenantId } = this.contextOf(accessToken);
    return [...this.revisions.values()]
      .filter((revision) => revision.tenant_id === tenantId && revision.document_id === documentId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async listDocumentRevisions(accessToken: string, documentId: string, options?: ListRevisionsOptions) {
    const { tenantId } = this.contextOf(accessToken);
    return [...this.revisions.values()]
      .filter(
        (revision) =>
          revision.tenant_id === tenantId &&
          revision.document_id === documentId &&
          (options?.includeSuperseded || (revision.status !== "superseded" && revision.status !== "rejected")),
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
}
