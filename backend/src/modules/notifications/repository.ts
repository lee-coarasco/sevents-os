import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Notification,
  NotificationChannel,
  NotificationDeliveryMode,
  NotificationPreference,
  NotificationRetryPolicy,
  NotificationScheduleSettings,
  NotificationTemplate,
} from "./types.js";

export interface CreateTemplateInput {
  template_key: string;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
}

export interface UpsertRetryPolicyInput {
  channel: NotificationChannel;
  max_attempts: number;
  backoff_seconds: number;
}

export interface InsertNotificationInput {
  recipient_id: string;
  channel: NotificationChannel;
  template_id: string;
  dedup_key: string;
  rendered_subject: string | null;
  rendered_body: string;
}

export interface NotificationDeliveryResult {
  status: "sent" | "failed";
  attemptCount: number;
  lastAttemptedAt: string;
  deliveredAt: string | null;
  failureReason: string | null;
}

export interface UpsertPreferenceInput {
  template_key: string;
  channel: NotificationChannel;
  opted_in: boolean;
  delivery_mode: NotificationDeliveryMode;
}

export interface UpsertScheduleSettingsInput {
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_timezone: string | null;
  digest_interval_minutes: number | null;
}

/**
 * Two access patterns, same split as tenancy/authority vs. audit's
 * listAuditLogEntries: template/retry-policy administration and a
 * caller's own notification feed go through the user-scoped client
 * (accessToken, RLS does the "own rows only" filtering) because a real
 * caller session exists for them. Dispatching a notification to an
 * arbitrary recipient and recording a delivery attempt have no caller
 * session (the dispatcher is a system-triggered action, same as ticket
 * 0056's insertAuditEvent) — those go through the service-role client
 * with an explicit tenantId instead.
 */
export interface NotificationsRepository {
  createTemplate(accessToken: string, input: CreateTemplateInput): Promise<NotificationTemplate>;
  listTemplates(accessToken: string): Promise<NotificationTemplate[]>;
  upsertRetryPolicy(accessToken: string, input: UpsertRetryPolicyInput): Promise<NotificationRetryPolicy>;
  listRetryPolicies(accessToken: string): Promise<NotificationRetryPolicy[]>;
  listMyNotifications(accessToken: string): Promise<Notification[]>;
  markNotificationRead(accessToken: string, notificationId: string): Promise<Notification | null>;

  getTemplateByKey(
    tenantId: string,
    templateKey: string,
    channel: NotificationChannel,
  ): Promise<NotificationTemplate | null>;
  getRetryPolicy(tenantId: string, channel: NotificationChannel): Promise<NotificationRetryPolicy | null>;
  /** Dedup is enforced by a DB unique constraint on (tenant_id, dedup_key, recipient_id); `created: false` means an existing row was returned instead of a new insert. */
  insertNotificationIfAbsent(
    tenantId: string,
    input: InsertNotificationInput,
  ): Promise<{ notification: Notification; created: boolean }>;
  updateNotificationDeliveryResult(notificationId: string, result: NotificationDeliveryResult): Promise<Notification>;
  getNotification(notificationId: string): Promise<Notification | null>;

  /** Self-serve preference/schedule management (ticket 0083) — accessToken-scoped, RLS enforces self-only. */
  upsertPreference(accessToken: string, input: UpsertPreferenceInput): Promise<NotificationPreference>;
  listMyPreferences(accessToken: string): Promise<NotificationPreference[]>;
  upsertScheduleSettings(accessToken: string, input: UpsertScheduleSettingsInput): Promise<NotificationScheduleSettings>;
  getMyScheduleSettings(accessToken: string): Promise<NotificationScheduleSettings | null>;

  /** Dispatch/release-time lookups (ticket 0083) — no caller session, same service-role pattern as getTemplateByKey. */
  getPreference(
    tenantId: string,
    userId: string,
    templateKey: string,
    channel: NotificationChannel,
  ): Promise<NotificationPreference | null>;
  getScheduleSettings(tenantId: string, userId: string): Promise<NotificationScheduleSettings | null>;
  markDigestReleased(tenantId: string, userId: string, releasedAtIso: string): Promise<void>;
  listDeferredNotifications(tenantId: string, userId: string): Promise<Notification[]>;
  markNotificationDeferred(notificationId: string, deliveryMode: NotificationDeliveryMode): Promise<Notification>;
  markNotificationSkipped(notificationId: string): Promise<Notification>;
}

const UNIQUE_VIOLATION = "23505";

/**
 * Supabase-backed implementation. Not exercised against a live
 * Supabase project in this session (no reachable credentials in this
 * sandbox, same gap flagged in every prior ticket's Supabase adapter).
 */
export function createSupabaseNotificationsRepository(
  serviceClient: SupabaseClient,
  userScopedClientFactory: (accessToken: string) => SupabaseClient,
): NotificationsRepository {
  return {
    async createTemplate(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("notification_templates").insert(input).select("*").single();
      if (error || !data) throw new Error(`createTemplate: ${error?.message ?? "no row returned"}`);
      return data as NotificationTemplate;
    },

    async listTemplates(accessToken) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("notification_templates").select("*");
      if (error) throw new Error(`listTemplates: ${error.message}`);
      return (data as NotificationTemplate[]) ?? [];
    },

    async upsertRetryPolicy(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("notification_retry_policies")
        .upsert(input, { onConflict: "tenant_id,channel" })
        .select("*")
        .single();
      if (error || !data) throw new Error(`upsertRetryPolicy: ${error?.message ?? "no row returned"}`);
      return data as NotificationRetryPolicy;
    },

    async listRetryPolicies(accessToken) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("notification_retry_policies").select("*");
      if (error) throw new Error(`listRetryPolicies: ${error.message}`);
      return (data as NotificationRetryPolicy[]) ?? [];
    },

    async listMyNotifications(accessToken) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(`listMyNotifications: ${error.message}`);
      return (data as Notification[]) ?? [];
    },

    async markNotificationRead(accessToken, notificationId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`markNotificationRead: ${error.message}`);
      return (data as Notification | null) ?? null;
    },

    async getTemplateByKey(tenantId, templateKey, channel) {
      const { data, error } = await serviceClient
        .from("notification_templates")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("template_key", templateKey)
        .eq("channel", channel)
        .maybeSingle();
      if (error) throw new Error(`getTemplateByKey: ${error.message}`);
      return (data as NotificationTemplate | null) ?? null;
    },

    async getRetryPolicy(tenantId, channel) {
      const { data, error } = await serviceClient
        .from("notification_retry_policies")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("channel", channel)
        .maybeSingle();
      if (error) throw new Error(`getRetryPolicy: ${error.message}`);
      return (data as NotificationRetryPolicy | null) ?? null;
    },

    async insertNotificationIfAbsent(tenantId, input) {
      const { data, error } = await serviceClient
        .from("notifications")
        .insert({ tenant_id: tenantId, ...input })
        .select("*")
        .single();
      if (!error && data) {
        return { notification: data as Notification, created: true };
      }
      if (error?.code !== UNIQUE_VIOLATION) {
        throw new Error(`insertNotificationIfAbsent: ${error?.message ?? "no row returned"}`);
      }
      const { data: existing, error: fetchError } = await serviceClient
        .from("notifications")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("dedup_key", input.dedup_key)
        .eq("recipient_id", input.recipient_id)
        .single();
      if (fetchError || !existing) {
        throw new Error(`insertNotificationIfAbsent (fetch existing): ${fetchError?.message ?? "no row returned"}`);
      }
      return { notification: existing as Notification, created: false };
    },

    async updateNotificationDeliveryResult(notificationId, result) {
      const { data, error } = await serviceClient
        .from("notifications")
        .update({
          status: result.status,
          attempt_count: result.attemptCount,
          last_attempted_at: result.lastAttemptedAt,
          delivered_at: result.deliveredAt,
          failure_reason: result.failureReason,
        })
        .eq("id", notificationId)
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(`updateNotificationDeliveryResult: ${error?.message ?? "no row returned"}`);
      }
      return data as Notification;
    },

    async getNotification(notificationId) {
      const { data, error } = await serviceClient
        .from("notifications")
        .select("*")
        .eq("id", notificationId)
        .maybeSingle();
      if (error) throw new Error(`getNotification: ${error.message}`);
      return (data as Notification | null) ?? null;
    },

    async upsertPreference(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("notification_preferences")
        .upsert(input, { onConflict: "tenant_id,user_id,template_key,channel" })
        .select("*")
        .single();
      if (error || !data) throw new Error(`upsertPreference: ${error?.message ?? "no row returned"}`);
      return data as NotificationPreference;
    },

    async listMyPreferences(accessToken) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("notification_preferences").select("*");
      if (error) throw new Error(`listMyPreferences: ${error.message}`);
      return (data as NotificationPreference[]) ?? [];
    },

    async upsertScheduleSettings(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("notification_schedule_settings")
        .upsert(input, { onConflict: "tenant_id,user_id" })
        .select("*")
        .single();
      if (error || !data) throw new Error(`upsertScheduleSettings: ${error?.message ?? "no row returned"}`);
      return data as NotificationScheduleSettings;
    },

    async getMyScheduleSettings(accessToken) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("notification_schedule_settings").select("*").maybeSingle();
      if (error) throw new Error(`getMyScheduleSettings: ${error.message}`);
      return (data as NotificationScheduleSettings | null) ?? null;
    },

    async getPreference(tenantId, userId, templateKey, channel) {
      const { data, error } = await serviceClient
        .from("notification_preferences")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .eq("template_key", templateKey)
        .eq("channel", channel)
        .maybeSingle();
      if (error) throw new Error(`getPreference: ${error.message}`);
      return (data as NotificationPreference | null) ?? null;
    },

    async getScheduleSettings(tenantId, userId) {
      const { data, error } = await serviceClient
        .from("notification_schedule_settings")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(`getScheduleSettings: ${error.message}`);
      return (data as NotificationScheduleSettings | null) ?? null;
    },

    async markDigestReleased(tenantId, userId, releasedAtIso) {
      const { error } = await serviceClient
        .from("notification_schedule_settings")
        .update({ last_digest_released_at: releasedAtIso })
        .eq("tenant_id", tenantId)
        .eq("user_id", userId);
      if (error) throw new Error(`markDigestReleased: ${error.message}`);
    },

    async listDeferredNotifications(tenantId, userId) {
      const { data, error } = await serviceClient
        .from("notifications")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("recipient_id", userId)
        .eq("status", "deferred");
      if (error) throw new Error(`listDeferredNotifications: ${error.message}`);
      return (data as Notification[]) ?? [];
    },

    async markNotificationDeferred(notificationId, deliveryMode) {
      const { data, error } = await serviceClient
        .from("notifications")
        .update({ status: "deferred", deferred_delivery_mode: deliveryMode })
        .eq("id", notificationId)
        .select("*")
        .single();
      if (error || !data) throw new Error(`markNotificationDeferred: ${error?.message ?? "no row returned"}`);
      return data as Notification;
    },

    async markNotificationSkipped(notificationId) {
      const { data, error } = await serviceClient
        .from("notifications")
        .update({ status: "skipped" })
        .eq("id", notificationId)
        .select("*")
        .single();
      if (error || !data) throw new Error(`markNotificationSkipped: ${error?.message ?? "no row returned"}`);
      return data as Notification;
    },
  };
}
