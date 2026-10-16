import type {
  AuditRepository,
  CreateRetentionPolicyInput,
  PlaceLegalHoldInput,
} from "../modules/audit/repository.js";
import type { AuditLogEntry, LegalHold, RetentionPolicy } from "../modules/audit/types.js";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * In-memory stand-in for AuditRepository. `listAuditLogEntries` is
 * tenantId-keyed directly (entries tagged at seed time), matching the
 * service-role-backed real adapter. The retention/legal-hold methods
 * are accessToken-keyed instead, via their own `addSession` map —
 * matching the real adapter's user-scoped-client convention for those
 * plain tenant-scoped RLS tables (see repository.ts's doc comment).
 */
export class FakeAuditRepository implements AuditRepository {
  private entriesByTenant = new Map<string, AuditLogEntry[]>();
  private sessions = new Map<string, string>(); // accessToken -> tenantId
  retentionPolicies = new Map<string, RetentionPolicy>();
  legalHolds = new Map<string, LegalHold>();

  seed(tenantId: string, entry: AuditLogEntry) {
    const existing = this.entriesByTenant.get(tenantId) ?? [];
    existing.push(entry);
    this.entriesByTenant.set(tenantId, existing);
  }

  addSession(accessToken: string, tenantId: string) {
    this.sessions.set(accessToken, tenantId);
  }

  private tenantOf(accessToken: string): string {
    const tenantId = this.sessions.get(accessToken);
    if (!tenantId) throw new Error("no tenant for this access token");
    return tenantId;
  }

  async listAuditLogEntries(tenantId: string): Promise<AuditLogEntry[]> {
    return this.entriesByTenant.get(tenantId) ?? [];
  }

  async createRetentionPolicy(accessToken: string, input: CreateRetentionPolicyInput) {
    const tenant_id = this.tenantOf(accessToken);
    const policy: RetentionPolicy = {
      id: nextId("retention-policy"),
      tenant_id,
      entity_type: input.entity_type,
      retention_days: input.retention_days,
      set_by: input.set_by,
      set_at: new Date().toISOString(),
    };
    this.retentionPolicies.set(policy.id, policy);
    return policy;
  }

  async listRetentionPolicies(accessToken: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.retentionPolicies.values()].filter((p) => p.tenant_id === tenant_id);
  }

  async placeLegalHold(accessToken: string, input: PlaceLegalHoldInput) {
    const tenant_id = this.tenantOf(accessToken);
    const hold: LegalHold = {
      id: nextId("legal-hold"),
      tenant_id,
      entity_type: input.entity_type,
      entity_id: input.entity_id ?? null,
      reason: input.reason,
      placed_by: input.placed_by,
      placed_at: new Date().toISOString(),
      released_by: null,
      released_at: null,
    };
    this.legalHolds.set(hold.id, hold);
    return hold;
  }

  async releaseLegalHold(accessToken: string, legalHoldId: string, releasedBy: string | null) {
    const tenant_id = this.tenantOf(accessToken);
    const hold = this.legalHolds.get(legalHoldId);
    if (!hold || hold.tenant_id !== tenant_id) throw new Error(`legal hold ${legalHoldId} not found`);
    hold.released_by = releasedBy;
    hold.released_at = new Date().toISOString();
    return hold;
  }

  async listLegalHolds(accessToken: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.legalHolds.values()].filter((h) => h.tenant_id === tenant_id);
  }

  async getLegalHold(accessToken: string, legalHoldId: string) {
    const tenant_id = this.tenantOf(accessToken);
    const hold = this.legalHolds.get(legalHoldId);
    if (!hold || hold.tenant_id !== tenant_id) return null;
    return hold;
  }
}
