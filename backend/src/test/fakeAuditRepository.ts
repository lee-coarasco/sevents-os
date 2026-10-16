import type { AuditRepository } from "../modules/audit/repository.js";
import type { AuditLogEntry } from "../modules/audit/types.js";

/**
 * In-memory stand-in for AuditRepository. Entries are tagged with a
 * tenantId at seed time (the real adapter derives this from each
 * source table's own tenant_id, or — for auth_audit_log — a join
 * through app_users); `listAuditLogEntries` only ever returns entries
 * for the tenant asked for, same as the real adapter's explicit filter.
 */
export class FakeAuditRepository implements AuditRepository {
  private entriesByTenant = new Map<string, AuditLogEntry[]>();

  seed(tenantId: string, entry: AuditLogEntry) {
    const existing = this.entriesByTenant.get(tenantId) ?? [];
    existing.push(entry);
    this.entriesByTenant.set(tenantId, existing);
  }

  async listAuditLogEntries(tenantId: string): Promise<AuditLogEntry[]> {
    return this.entriesByTenant.get(tenantId) ?? [];
  }
}
