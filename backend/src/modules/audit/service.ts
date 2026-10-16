import type { AuditRepository } from "./repository.js";
import type { AuditLogEntry, AuditLogFilters, AuditLogPage } from "./types.js";

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
