import type {
  AuditRepository,
  CreateDataRequestInput,
  CreateRetentionPolicyInput,
  PlaceLegalHoldInput,
  UpdateDataRequestInput,
} from "../modules/audit/repository.js";
import type { AuditLogEntry, DataRequest, LegalHold, RetentionPolicy } from "../modules/audit/types.js";

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
  dataRequests = new Map<string, DataRequest>();
  /** Seeded directly by tests that exercise buildAppUserExportBundle; keyed by app_users.id. */
  appUsers = new Map<string, Record<string, unknown> & { id: string; tenant_id: string }>();
  roleAssignments: Array<Record<string, unknown> & { user_id: string }> = [];

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

  async createDataRequest(accessToken: string, input: CreateDataRequestInput) {
    const tenant_id = this.tenantOf(accessToken);
    const now = new Date().toISOString();
    const dataRequest: DataRequest = {
      id: nextId("data-request"),
      tenant_id,
      request_type: input.request_type,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      reason: input.reason,
      requested_by: input.requested_by,
      workflow_instance_id: input.workflow_instance_id,
      status: "pending",
      result: null,
      resolved_at: null,
      created_at: now,
      updated_at: now,
    };
    this.dataRequests.set(dataRequest.id, dataRequest);
    return dataRequest;
  }

  async getDataRequest(accessToken: string, dataRequestId: string) {
    const tenant_id = this.tenantOf(accessToken);
    const dataRequest = this.dataRequests.get(dataRequestId);
    if (!dataRequest || dataRequest.tenant_id !== tenant_id) return null;
    return dataRequest;
  }

  async listDataRequests(accessToken: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.dataRequests.values()].filter((d) => d.tenant_id === tenant_id);
  }

  async updateDataRequest(accessToken: string, dataRequestId: string, patch: UpdateDataRequestInput) {
    const tenant_id = this.tenantOf(accessToken);
    const dataRequest = this.dataRequests.get(dataRequestId);
    if (!dataRequest || dataRequest.tenant_id !== tenant_id) return null;
    Object.assign(dataRequest, patch, { updated_at: new Date().toISOString() });
    return dataRequest;
  }

  async buildAppUserExportBundle(tenantId: string, userId: string) {
    const user = this.appUsers.get(userId);
    const appUser = user && user.tenant_id === tenantId ? user : null;
    const roleAssignments = this.roleAssignments.filter((r) => r.user_id === userId);
    const entries = await this.listAuditLogEntries(tenantId);
    const auditEntries = entries.filter((e) => e.actorId === userId || e.entityId === userId);
    return { appUser, roleAssignments, auditEntries };
  }
}
