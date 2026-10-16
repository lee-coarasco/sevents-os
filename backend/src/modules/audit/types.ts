/**
 * M35a (ticket 0078): unified read surface over every audit-shaped table
 * this codebase already writes to. No new audit table — this module only
 * normalizes and merges reads of existing ones.
 */
export type AuditSource =
  | "auth_audit_log"
  | "configuration_changes"
  | "workflow_events"
  | "approval_decisions"
  | "approval_revocations";

/**
 * FR-AUD-001 says actor is human/agent/system. Every actor in this
 * codebase today is a human (no agent runtime exists until M29/M30) —
 * do not widen this union ahead of that, and never set it to anything
 * else just because a row's actor column happens to be null.
 */
export type AuditActorType = "human";

export interface AuditLogEntry {
  /** `${source}:${row id}` — globally unique across the merged sources. */
  id: string;
  source: AuditSource;
  actorType: AuditActorType;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  occurredAt: string;
  /**
   * Raw passthrough of the source row's own diff/payload/metadata (or,
   * for sources with no such jsonb column, its own plain columns) —
   * never reshaped into a guessed common before/after structure.
   */
  detail: Record<string, unknown>;
  /** No source table carries a request/correlation id yet. Always null — a real gap, not a guess. */
  correlationId: null;
}

export interface AuditLogFilters {
  entityType?: string;
  actorId?: string;
  /** Inclusive ISO timestamp lower bound on occurredAt. */
  from?: string;
  /** Inclusive ISO timestamp upper bound on occurredAt. */
  to?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogPage {
  entries: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}
