import type {
  CreateTenderClarificationInput,
  CreateTenderDocumentInput,
  TenderingRepository,
  UpdateTenderClarificationInput,
} from "./repository.js";
import type { TenderClarification, TenderDocument } from "./types.js";

export class NotFoundError extends Error {
  constructor(message = "not found") {
    super(message);
  }
}

export async function createTenderDocument(
  repo: TenderingRepository,
  accessToken: string,
  input: CreateTenderDocumentInput,
): Promise<TenderDocument> {
  return repo.createTenderDocument(accessToken, input);
}

export async function listTenderDocuments(
  repo: TenderingRepository,
  accessToken: string,
  tenderSubmissionId: string,
): Promise<TenderDocument[]> {
  return repo.listTenderDocuments(accessToken, tenderSubmissionId);
}

export async function createTenderClarification(
  repo: TenderingRepository,
  accessToken: string,
  input: CreateTenderClarificationInput,
): Promise<TenderClarification> {
  return repo.createTenderClarification(accessToken, input);
}

export async function listTenderClarifications(
  repo: TenderingRepository,
  accessToken: string,
  tenderSubmissionId: string,
): Promise<TenderClarification[]> {
  return repo.listTenderClarifications(accessToken, tenderSubmissionId);
}

/** Resolving a clarification sets response + resolved_at together — never one without the other. */
export async function resolveTenderClarification(
  repo: TenderingRepository,
  accessToken: string,
  clarificationId: string,
  response: string,
): Promise<TenderClarification> {
  const updated = await repo.updateTenderClarification(accessToken, clarificationId, {
    response,
    resolved_at: new Date().toISOString(),
  });
  if (!updated) throw new NotFoundError();
  return updated;
}

export async function updateTenderClarification(
  repo: TenderingRepository,
  accessToken: string,
  clarificationId: string,
  input: UpdateTenderClarificationInput,
): Promise<TenderClarification> {
  const updated = await repo.updateTenderClarification(accessToken, clarificationId, input);
  if (!updated) throw new NotFoundError();
  return updated;
}
