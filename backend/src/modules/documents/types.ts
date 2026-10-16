/**
 * M13a (ticket 0104): document register & revision control — the
 * general-purpose document-control spine (FR-DOC-001, FR-DOC-002) other
 * modules (M12 engineering, M14 procurement, M17 site ops, M19 quality,
 * M27 legal, etc.) will eventually attach records to.
 */
export interface Document {
  id: string;
  tenant_id: string;
  /** Free text — this module does not own the list of document types other modules may use. */
  document_type: string;
  document_number: string | null;
  title: string;
  /** Nullable — not every controlled document is project-scoped (e.g. a corporate SOP). */
  project_id: string | null;
  discipline: string | null;
  /** Free text — no fixed classification scheme invented here. */
  access_class: string | null;
  tags: string[];
  originator_id: string | null;
  /** Set once the first revision is created. */
  current_revision_id: string | null;
  created_at: string;
}

export const DOCUMENT_REVISION_STATUSES = [
  "draft",
  "under_review",
  "approved",
  "superseded",
  "rejected",
] as const;

/** Own vocabulary, distinct from ApprovalChainDecision — a revision's lifecycle is broader than one approval decision. */
export type DocumentRevisionStatus = (typeof DOCUMENT_REVISION_STATUSES)[number];

export interface DocumentRevision {
  id: string;
  tenant_id: string;
  document_id: string;
  /** Free text, caller-supplied (e.g. "A", "B", "P1") — no numbering scheme invented here. */
  revision_code: string;
  status: DocumentRevisionStatus;
  /** Pointer only, same convention as ticket 0096's tender_documents.storage_reference. */
  storage_reference: string | null;
  reviewer_id: string | null;
  approver_id: string | null;
  /** FR-DOC-002: set when a newer revision supersedes this one. */
  superseded_by_revision_id: string | null;
  /**
   * FR-DOC-003 (ticket 0105): which request_approval workflow instance is
   * deciding this revision's "submit for IFC release" — same nullable
   * shape ticket 0097 used on estimates.workflow_instance_id. Null until
   * submitRevisionForRelease is called.
   */
  workflow_instance_id: string | null;
  /** FR-DOC-003's "approval stamp" timestamp — set when the workflow resolves to "approved". */
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
}
