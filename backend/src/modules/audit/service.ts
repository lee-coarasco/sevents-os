import type { AuditRepository } from "./repository.js";
import type { AuditLogEntry, AuditLogFilters, AuditLogPage, LegalHold, RetentionPolicy } from "./types.js";

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
