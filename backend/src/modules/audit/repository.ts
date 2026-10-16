import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditLogEntry, DataRequest, LegalHold, RetentionPolicy } from "./types.js";

export interface CreateRetentionPolicyInput {
  entity_type: string;
  retention_days: number;
  set_by: string | null;
}

export interface PlaceLegalHoldInput {
  entity_type: string;
  entity_id?: string | null;
  reason: string;
  placed_by: string | null;
}

export interface CreateDataRequestInput {
  request_type: "export" | "deletion";
  entity_type: string;
  entity_id: string;
  reason: string;
  requested_by: string | null;
  workflow_instance_id: string;
}

export interface UpdateDataRequestInput {
  status?: DataRequest["status"];
  result?: Record<string, unknown> | null;
  resolved_at?: string | null;
}

/**
 * All audit-shaped rows across every source table, already normalized
 * and scoped to this one tenant. Unfiltered beyond tenant — service.ts
 * applies entityType/actorId/date filtering and pagination on top, as
 * plain, mock-free logic.
 *
 * The retention/legal-hold methods below (ticket 0079, M35b) are a
 * different shape on purpose: `retention_policies`/`legal_holds` are
 * plain tenant-scoped RLS tables, so they follow the usual
 * accessToken + user-scoped-client convention every other module in
 * this codebase uses (tenancy, authority) — unlike
 * `listAuditLogEntries`, which must bypass `auth_audit_log`'s own
 * narrower RLS policy via the service-role client (see the Supabase
 * adapter's doc comment below).
 */
export interface AuditRepository {
  listAuditLogEntries(tenantId: string): Promise<AuditLogEntry[]>;
  createRetentionPolicy(accessToken: string, input: CreateRetentionPolicyInput): Promise<RetentionPolicy>;
  listRetentionPolicies(accessToken: string): Promise<RetentionPolicy[]>;
  placeLegalHold(accessToken: string, input: PlaceLegalHoldInput): Promise<LegalHold>;
  releaseLegalHold(accessToken: string, legalHoldId: string, releasedBy: string | null): Promise<LegalHold>;
  listLegalHolds(accessToken: string): Promise<LegalHold[]>;
  getLegalHold(accessToken: string, legalHoldId: string): Promise<LegalHold | null>;
  createDataRequest(accessToken: string, input: CreateDataRequestInput): Promise<DataRequest>;
  getDataRequest(accessToken: string, dataRequestId: string): Promise<DataRequest | null>;
  listDataRequests(accessToken: string): Promise<DataRequest[]>;
  updateDataRequest(accessToken: string, dataRequestId: string, patch: UpdateDataRequestInput): Promise<DataRequest | null>;
  /**
   * Bundles the app_users row plus every role_assignments row and
   * audit entry attributed to it. Goes through the service-role
   * client, same as listAuditLogEntries: an approver resolving someone
   * else's export request is reading another user's row, which that
   * user's own "select own" RLS policy would otherwise block.
   */
  buildAppUserExportBundle(tenantId: string, userId: string): Promise<Record<string, unknown>>;
}

interface AuthAuditLogRow {
  id: string;
  user_id: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface ConfigurationChangeRow {
  id: string;
  entity_type: string;
  entity_id: string;
  change_type: string;
  diff: Record<string, unknown>;
  reason: string | null;
  changed_by: string | null;
  created_at: string;
}

interface WorkflowEventRow {
  id: string;
  workflow_instance_id: string;
  step_instance_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

interface ApprovalDecisionRow {
  id: string;
  workflow_step_instance_id: string;
  decision: string;
  reason: string | null;
  approver_id: string;
  decided_by: string;
  decided_at: string;
}

interface ApprovalRevocationRow {
  id: string;
  approval_decision_id: string;
  revoked_by: string;
  reason: string;
  created_at: string;
}

function normalizeAuthAuditLog(row: AuthAuditLogRow): AuditLogEntry {
  return {
    id: `auth_audit_log:${row.id}`,
    source: "auth_audit_log",
    actorType: "human",
    actorId: row.user_id,
    action: row.event_type,
    entityType: "user",
    entityId: row.user_id,
    occurredAt: row.created_at,
    detail: row.metadata,
    correlationId: null,
  };
}

function normalizeConfigurationChange(row: ConfigurationChangeRow): AuditLogEntry {
  return {
    id: `configuration_changes:${row.id}`,
    source: "configuration_changes",
    actorType: "human",
    actorId: row.changed_by,
    action: row.change_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    occurredAt: row.created_at,
    detail: { ...row.diff, reason: row.reason },
    correlationId: null,
  };
}

function normalizeWorkflowEvent(row: WorkflowEventRow): AuditLogEntry {
  return {
    id: `workflow_events:${row.id}`,
    source: "workflow_events",
    actorType: "human",
    // No explicit actor column on this table — whoever triggered the
    // event is wherever the calling code chose to put it inside
    // `payload` (inconsistent key across call sites). Do not guess one.
    actorId: null,
    action: row.event_type,
    entityType: "workflow_instance",
    entityId: row.workflow_instance_id,
    occurredAt: row.created_at,
    detail: { ...row.payload, stepInstanceId: row.step_instance_id },
    correlationId: null,
  };
}

function normalizeApprovalDecision(row: ApprovalDecisionRow): AuditLogEntry {
  return {
    id: `approval_decisions:${row.id}`,
    source: "approval_decisions",
    actorType: "human",
    actorId: row.decided_by,
    action: row.decision,
    entityType: "workflow_step_instance",
    entityId: row.workflow_step_instance_id,
    occurredAt: row.decided_at,
    detail: { approverId: row.approver_id, reason: row.reason },
    correlationId: null,
  };
}

function normalizeApprovalRevocation(row: ApprovalRevocationRow): AuditLogEntry {
  return {
    id: `approval_revocations:${row.id}`,
    source: "approval_revocations",
    actorType: "human",
    actorId: row.revoked_by,
    action: "revoked",
    entityType: "approval_decision",
    entityId: row.approval_decision_id,
    occurredAt: row.created_at,
    detail: { reason: row.reason },
    correlationId: null,
  };
}

/**
 * Supabase-backed implementation. Uses the **service-role client** for
 * every read here, with the tenant filter applied explicitly in this
 * code (`tenant_id = tenantId`, or — for `auth_audit_log`, which has no
 * tenant_id column — `user_id in (this tenant's app_users ids)`). This
 * is the same "service role, explicit tenant check in code" precedent
 * as `backend/src/scripts/import-catalogue.ts` (ticket 0058) and the
 * identity module's admin operations (ticket 0056); it exists because
 * a tenant-wide, permission-gated read across tables that each carry
 * their own narrower RLS policy can't be expressed as plain RLS without
 * loosening `auth_audit_log`'s policy to "any tenant member" — which
 * ticket 0078 explicitly rejected. The caller-facing route's own
 * `requirePermission("audit.log.view")` guard is what actually gates
 * this: get that check right before trusting this repository's tenant
 * filter alone.
 */
export function createSupabaseAuditRepository(
  serviceClient: SupabaseClient,
  userScopedClientFactory: (accessToken: string) => SupabaseClient,
): AuditRepository {
  return {
    async listAuditLogEntries(tenantId) {
      const { data: tenantUsers, error: tenantUsersError } = await serviceClient
        .from("app_users")
        .select("id")
        .eq("tenant_id", tenantId);
      if (tenantUsersError) throw tenantUsersError;
      const tenantUserIds = (tenantUsers ?? []).map((row) => row.id as string);

      const [authAuditLog, configurationChanges, workflowEvents, approvalDecisions, approvalRevocations] =
        await Promise.all([
          tenantUserIds.length === 0
            ? Promise.resolve({ data: [] as AuthAuditLogRow[], error: null })
            : serviceClient.from("auth_audit_log").select("*").in("user_id", tenantUserIds),
          serviceClient.from("configuration_changes").select("*").eq("tenant_id", tenantId),
          serviceClient.from("workflow_events").select("*").eq("tenant_id", tenantId),
          serviceClient.from("approval_decisions").select("*").eq("tenant_id", tenantId),
          serviceClient.from("approval_revocations").select("*").eq("tenant_id", tenantId),
        ]);

      if (authAuditLog.error) throw authAuditLog.error;
      if (configurationChanges.error) throw configurationChanges.error;
      if (workflowEvents.error) throw workflowEvents.error;
      if (approvalDecisions.error) throw approvalDecisions.error;
      if (approvalRevocations.error) throw approvalRevocations.error;

      return [
        ...((authAuditLog.data ?? []) as AuthAuditLogRow[]).map(normalizeAuthAuditLog),
        ...((configurationChanges.data ?? []) as ConfigurationChangeRow[]).map(normalizeConfigurationChange),
        ...((workflowEvents.data ?? []) as WorkflowEventRow[]).map(normalizeWorkflowEvent),
        ...((approvalDecisions.data ?? []) as ApprovalDecisionRow[]).map(normalizeApprovalDecision),
        ...((approvalRevocations.data ?? []) as ApprovalRevocationRow[]).map(normalizeApprovalRevocation),
      ];
    },

    async createRetentionPolicy(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("retention_policies")
        .insert(input)
        .select("*")
        .single();
      if (error || !data) throw new Error(`createRetentionPolicy: ${error?.message ?? "no row returned"}`);
      return data as RetentionPolicy;
    },

    async listRetentionPolicies(accessToken) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("retention_policies").select("*");
      if (error) throw new Error(`listRetentionPolicies: ${error.message}`);
      return (data as RetentionPolicy[]) ?? [];
    },

    async placeLegalHold(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("legal_holds")
        .insert({ entity_id: null, ...input })
        .select("*")
        .single();
      if (error || !data) throw new Error(`placeLegalHold: ${error?.message ?? "no row returned"}`);
      return data as LegalHold;
    },

    async releaseLegalHold(accessToken, legalHoldId, releasedBy) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("legal_holds")
        .update({ released_by: releasedBy, released_at: new Date().toISOString() })
        .eq("id", legalHoldId)
        .select("*")
        .single();
      if (error || !data) throw new Error(`releaseLegalHold: ${error?.message ?? "no row returned"}`);
      return data as LegalHold;
    },

    async listLegalHolds(accessToken) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("legal_holds").select("*");
      if (error) throw new Error(`listLegalHolds: ${error.message}`);
      return (data as LegalHold[]) ?? [];
    },

    async getLegalHold(accessToken, legalHoldId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("legal_holds")
        .select("*")
        .eq("id", legalHoldId)
        .maybeSingle();
      if (error) throw new Error(`getLegalHold: ${error.message}`);
      return (data as LegalHold | null) ?? null;
    },

    async createDataRequest(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("data_requests")
        .insert(input)
        .select("*")
        .single();
      if (error || !data) throw new Error(`createDataRequest: ${error?.message ?? "no row returned"}`);
      return data as DataRequest;
    },

    async getDataRequest(accessToken, dataRequestId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("data_requests")
        .select("*")
        .eq("id", dataRequestId)
        .maybeSingle();
      if (error) throw new Error(`getDataRequest: ${error.message}`);
      return (data as DataRequest | null) ?? null;
    },

    async listDataRequests(accessToken) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("data_requests").select("*");
      if (error) throw new Error(`listDataRequests: ${error.message}`);
      return (data as DataRequest[]) ?? [];
    },

    async updateDataRequest(accessToken, dataRequestId, patch) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("data_requests")
        .update(patch)
        .eq("id", dataRequestId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateDataRequest: ${error.message}`);
      return (data as DataRequest | null) ?? null;
    },

    async buildAppUserExportBundle(tenantId, userId) {
      const { data: userRow, error: userError } = await serviceClient
        .from("app_users")
        .select("*")
        .eq("id", userId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (userError) throw new Error(`buildAppUserExportBundle: ${userError.message}`);

      const { data: roleAssignments, error: roleError } = await serviceClient
        .from("role_assignments")
        .select("*")
        .eq("user_id", userId);
      if (roleError) throw new Error(`buildAppUserExportBundle: ${roleError.message}`);

      const auditEntries = await this.listAuditLogEntries(tenantId);
      const subjectAuditEntries = auditEntries.filter(
        (entry) => entry.actorId === userId || entry.entityId === userId,
      );

      return {
        appUser: userRow ?? null,
        roleAssignments: roleAssignments ?? [],
        auditEntries: subjectAuditEntries,
      };
    },
  };
}
