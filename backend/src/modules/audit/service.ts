import type { AuditRepository } from "./repository.js";
import type { AuditLogEntry, AuditLogFilters, AuditLogPage, DataRequest, DataRequestType, LegalHold, RetentionPolicy } from "./types.js";
import type { IdentityRepository } from "../identity/repository.js";
import { anonymizeUser } from "../identity/service.js";
import type { WorkflowRepository } from "../workflow/repository.js";
import { getWorkflowInstance, startWorkflowInstance } from "../workflow/service.js";

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

export class InvalidAuditFilterError extends Error {}

function parseIsoOrThrow(label: string, value: string): number {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new InvalidAuditFilterError(`${label} must be a valid ISO timestamp`);
  }
  return ms;
}

/**
 * Pure merge/filter/sort/paginate over already tenant-scoped,
 * already-normalized entries. Kept free of any Supabase call so the
 * "never fabricate actorType/correlationId" acceptance criterion and
 * the filter semantics are testable directly, without mocking a client.
 */
export function filterAndPaginate(entries: AuditLogEntry[], filters: AuditLogFilters): AuditLogPage {
  const limit = Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(filters.offset ?? 0, 0);

  const fromMs = filters.from !== undefined ? parseIsoOrThrow("from", filters.from) : null;
  const toMs = filters.to !== undefined ? parseIsoOrThrow("to", filters.to) : null;

  const filtered = entries.filter((entry) => {
    if (filters.entityType !== undefined && entry.entityType !== filters.entityType) return false;
    if (filters.actorId !== undefined && entry.actorId !== filters.actorId) return false;
    const occurredMs = Date.parse(entry.occurredAt);
    if (fromMs !== null && occurredMs < fromMs) return false;
    if (toMs !== null && occurredMs > toMs) return false;
    return true;
  });

  filtered.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));

  return {
    entries: filtered.slice(offset, offset + limit),
    total: filtered.length,
    limit,
    offset,
  };
}

export async function listAuditLog(
  repository: AuditRepository,
  tenantId: string,
  filters: AuditLogFilters,
): Promise<AuditLogPage> {
  const entries = await repository.listAuditLogEntries(tenantId);
  return filterAndPaginate(entries, filters);
}

// ---------------------------------------------------------------------------
// Retention policy & legal hold (ticket 0079, M35b)
// ---------------------------------------------------------------------------

export class InvalidRetentionPeriodError extends Error {}
export class MissingLegalHoldReasonError extends Error {}
export class LegalHoldNotFoundError extends Error {}
export class LegalHoldAlreadyReleasedError extends Error {}

/** Per CLAUDE.md: never invent a default retention period. retentionDays is always caller-supplied. */
export async function createRetentionPolicy(
  repository: AuditRepository,
  accessToken: string,
  setBy: string | null,
  input: { entityType: string; retentionDays: number },
): Promise<RetentionPolicy> {
  if (!Number.isInteger(input.retentionDays) || input.retentionDays <= 0) {
    throw new InvalidRetentionPeriodError("retentionDays must be a positive integer");
  }
  return repository.createRetentionPolicy(accessToken, {
    entity_type: input.entityType,
    retention_days: input.retentionDays,
    set_by: setBy,
  });
}

export async function listRetentionPolicies(
  repository: AuditRepository,
  accessToken: string,
): Promise<RetentionPolicy[]> {
  return repository.listRetentionPolicies(accessToken);
}

export async function placeLegalHold(
  repository: AuditRepository,
  accessToken: string,
  placedBy: string | null,
  input: { entityType: string; entityId?: string | null; reason: string },
): Promise<LegalHold> {
  if (!input.reason.trim()) {
    throw new MissingLegalHoldReasonError("a legal hold requires a non-empty reason");
  }
  return repository.placeLegalHold(accessToken, {
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    reason: input.reason,
    placed_by: placedBy,
  });
}

/** Never deletes a hold row — only this compensating action fills released_by/released_at. */
export async function releaseLegalHold(
  repository: AuditRepository,
  accessToken: string,
  legalHoldId: string,
  releasedBy: string | null,
): Promise<LegalHold> {
  const hold = await repository.getLegalHold(accessToken, legalHoldId);
  if (!hold) throw new LegalHoldNotFoundError(`legal hold ${legalHoldId} not found`);
  if (hold.released_at) {
    throw new LegalHoldAlreadyReleasedError(`legal hold ${legalHoldId} is already released`);
  }
  return repository.releaseLegalHold(accessToken, legalHoldId, releasedBy);
}

export async function listLegalHolds(repository: AuditRepository, accessToken: string): Promise<LegalHold[]> {
  return repository.listLegalHolds(accessToken);
}

// ---------------------------------------------------------------------------
// Data export & deletion requests (ticket 0080, M35c)
// ---------------------------------------------------------------------------

export class MissingDataRequestReasonError extends Error {}
export class UnsupportedDataRequestEntityTypeError extends Error {}
export class DataRequestNotFoundError extends Error {}

/**
 * The only entity type this module knows how to export/anonymize. See
 * DECISIONS.md 2026-10-16 (ticket 0080): real deletion is scoped to
 * app_users only, and export follows the same scope since nothing else
 * has a defined bundling shape yet. Widening this is a future ticket's
 * decision, not a guess made here.
 */
export const SUPPORTED_DATA_REQUEST_ENTITY_TYPE = "app_users";

export interface RequestDataActionInput {
  requestType: DataRequestType;
  entityType: string;
  entityId: string;
  reason: string;
  requestedBy: string | null;
  /** Caller names an already-published request_approval workflow definition — same explicit, no-auto-resolution convention as ticket 0075's proposeBaselineChange. */
  definitionId: string;
}

/** Starting a request never acts on data by itself — only resolveDataRequest does, once the linked workflow instance approves it. */
export async function requestDataAction(
  repository: AuditRepository,
  workflowRepo: WorkflowRepository,
  accessToken: string,
  input: RequestDataActionInput,
): Promise<DataRequest> {
  if (!input.reason.trim()) {
    throw new MissingDataRequestReasonError("a data request requires a non-empty reason");
  }
  if (input.entityType !== SUPPORTED_DATA_REQUEST_ENTITY_TYPE) {
    throw new UnsupportedDataRequestEntityTypeError(
      `entityType "${input.entityType}" is not supported; only "${SUPPORTED_DATA_REQUEST_ENTITY_TYPE}" is wired for export/deletion`,
    );
  }
  const { instance } = await startWorkflowInstance(workflowRepo, accessToken, input.definitionId, input.requestedBy, {
    requestType: input.requestType,
    entityType: input.entityType,
    entityId: input.entityId,
  });
  return repository.createDataRequest(accessToken, {
    request_type: input.requestType,
    entity_type: input.entityType,
    entity_id: input.entityId,
    reason: input.reason,
    requested_by: input.requestedBy,
    workflow_instance_id: instance.id,
  });
}

export async function listDataRequests(repository: AuditRepository, accessToken: string): Promise<DataRequest[]> {
  return repository.listDataRequests(accessToken);
}

/**
 * The polling half of the seam: no event bus exists in this codebase,
 * so a request's outcome is read back on demand from its workflow
 * instance's step instances, same pattern as projects'
 * resolveBaselineChangeRequest. Idempotent once status leaves
 * `pending`. A deletion request checks legal_holds before acting and
 * refuses (status `refused`, never deletes) if an active hold matches
 * the entity — either a hold on this exact entity_id, or a
 * type-wide hold (entity_id null).
 */
export async function resolveDataRequest(
  repository: AuditRepository,
  workflowRepo: WorkflowRepository,
  identityRepo: IdentityRepository,
  accessToken: string,
  tenantId: string,
  dataRequestId: string,
): Promise<DataRequest> {
  const request = await repository.getDataRequest(accessToken, dataRequestId);
  if (!request) throw new DataRequestNotFoundError(`data request ${dataRequestId} not found`);
  if (request.status !== "pending") return request;

  const { stepInstances } = await getWorkflowInstance(workflowRepo, accessToken, request.workflow_instance_id);
  const decidedStep = stepInstances.find((s) => typeof s.output?.decision === "string");
  if (!decidedStep) return request;

  const decision = decidedStep.output.decision as string;
  if (decision !== "approved") {
    const updated = await repository.updateDataRequest(accessToken, dataRequestId, {
      status: decision as "rejected" | "returned_for_correction",
    });
    return updated!;
  }

  if (request.request_type === "export") {
    const bundle = await repository.buildAppUserExportBundle(tenantId, request.entity_id);
    const updated = await repository.updateDataRequest(accessToken, dataRequestId, {
      status: "completed",
      result: bundle,
      resolved_at: new Date().toISOString(),
    });
    return updated!;
  }

  const legalHolds = await repository.listLegalHolds(accessToken);
  const activeHold = legalHolds.find(
    (hold) =>
      hold.released_at === null &&
      hold.entity_type === request.entity_type &&
      (hold.entity_id === null || hold.entity_id === request.entity_id),
  );
  if (activeHold) {
    const updated = await repository.updateDataRequest(accessToken, dataRequestId, {
      status: "refused",
      result: { reason: "active legal hold", legalHoldId: activeHold.id },
      resolved_at: new Date().toISOString(),
    });
    return updated!;
  }

  const anonymized = await anonymizeUser(identityRepo, request.entity_id);
  const updated = await repository.updateDataRequest(accessToken, dataRequestId, {
    status: "completed",
    result: { anonymizedUserId: anonymized.id },
    resolved_at: new Date().toISOString(),
  });
  return updated!;
}
