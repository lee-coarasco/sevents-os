import type {
  CreateTenderClarificationInput,
  CreateTenderDocumentInput,
  TenderingRepository,
  UpdateTenderClarificationInput,
} from "../modules/tendering/repository.js";
import type { TenderClarification, TenderDocument } from "../modules/tendering/types.js";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * In-memory stand-in for TenderingRepository. Mutating/reads are keyed
 * off an access token's own session (same convention as every other
 * fake repository in this test suite) so "wrong tenant = not found" is
 * actually exercised, not just asserted.
 */
export class FakeTenderingRepository implements TenderingRepository {
  sessions = new Map<string, { userId: string; tenantId: string }>();
  tenderDocuments = new Map<string, TenderDocument>();
  tenderClarifications = new Map<string, TenderClarification>();

  addSession(accessToken: string, userId: string, tenantId: string) {
    this.sessions.set(accessToken, { userId, tenantId });
  }

  private contextOf(accessToken: string) {
    const context = this.sessions.get(accessToken);
    if (!context) throw new Error("no caller context for this access token");
    return context;
  }

  async createTenderDocument(accessToken: string, input: CreateTenderDocumentInput) {
    const { tenantId } = this.contextOf(accessToken);
    const now = new Date().toISOString();
    const document: TenderDocument = {
      id: nextId("tender-document"),
      tenant_id: tenantId,
      tender_submission_id: input.tender_submission_id,
      document_type: input.document_type,
      title: input.title,
      document_number: input.document_number ?? null,
      revision: input.revision ?? null,
      received_date: input.received_date ?? null,
      storage_reference: input.storage_reference ?? null,
      created_by: input.created_by,
      created_at: now,
      updated_at: now,
    };
    this.tenderDocuments.set(document.id, document);
    return document;
  }

  async listTenderDocuments(accessToken: string, tenderSubmissionId: string) {
    const { tenantId } = this.contextOf(accessToken);
    return [...this.tenderDocuments.values()].filter(
      (document) => document.tenant_id === tenantId && document.tender_submission_id === tenderSubmissionId,
    );
  }

  async createTenderClarification(accessToken: string, input: CreateTenderClarificationInput) {
    const { tenantId } = this.contextOf(accessToken);
    const now = new Date().toISOString();
    const clarification: TenderClarification = {
      id: nextId("tender-clarification"),
      tenant_id: tenantId,
      tender_submission_id: input.tender_submission_id,
      item: input.item,
      raised_by: input.raised_by,
      raised_at: input.raised_at ?? now,
      response: input.response ?? null,
      resolved_at: input.resolved_at ?? null,
      created_at: now,
      updated_at: now,
    };
    this.tenderClarifications.set(clarification.id, clarification);
    return clarification;
  }

  async listTenderClarifications(accessToken: string, tenderSubmissionId: string) {
    const { tenantId } = this.contextOf(accessToken);
    return [...this.tenderClarifications.values()].filter(
      (clarification) =>
        clarification.tenant_id === tenantId && clarification.tender_submission_id === tenderSubmissionId,
    );
  }

  async updateTenderClarification(accessToken: string, clarificationId: string, input: UpdateTenderClarificationInput) {
    const { tenantId } = this.contextOf(accessToken);
    const clarification = this.tenderClarifications.get(clarificationId);
    if (!clarification || clarification.tenant_id !== tenantId) return null;
    const updated: TenderClarification = {
      ...clarification,
      ...input,
      updated_at: new Date().toISOString(),
    };
    this.tenderClarifications.set(clarificationId, updated);
    return updated;
  }
}
