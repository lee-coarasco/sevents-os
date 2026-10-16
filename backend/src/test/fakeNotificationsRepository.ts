import type {
  CreateTemplateInput,
  InsertNotificationInput,
  NotificationDeliveryResult,
  NotificationsRepository,
  UpsertPreferenceInput,
  UpsertRetryPolicyInput,
  UpsertScheduleSettingsInput,
} from "../modules/notifications/repository.js";
import type {
  Notification,
  NotificationChannel,
  NotificationPreference,
  NotificationRetryPolicy,
  NotificationScheduleSettings,
  NotificationTemplate,
} from "../modules/notifications/types.js";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * In-memory stand-in for NotificationsRepository. Template/retry-policy/
 * own-notification methods are accessToken-keyed via `addSession`, same
 * convention as FakeTenancyRepository/FakeAuthorityRepository. Dispatch/
 * retry methods are tenantId-keyed directly, same as the real adapter's
 * service-role path (no caller session exists for those).
 */
export class FakeNotificationsRepository implements NotificationsRepository {
  // accessToken -> { tenantId, userId }. `userId` defaults to the token itself
  // for every existing caller that only ever passed (token, tenantId) — this
  // module's preference/schedule tests are the only ones that care about it.
  private sessions = new Map<string, { tenantId: string; userId: string }>();
  templates = new Map<string, NotificationTemplate>();
  retryPolicies = new Map<string, NotificationRetryPolicy>(); // key: `${tenantId}:${channel}`
  notifications = new Map<string, Notification>();
  preferences = new Map<string, NotificationPreference>(); // key: `${tenantId}:${userId}:${templateKey}:${channel}`
  scheduleSettings = new Map<string, NotificationScheduleSettings>(); // key: `${tenantId}:${userId}`

  addSession(accessToken: string, tenantId: string, userId: string = accessToken) {
    this.sessions.set(accessToken, { tenantId, userId });
  }

  private tenantOf(accessToken: string): string {
    const session = this.sessions.get(accessToken);
    if (!session) throw new Error("no tenant for this access token");
    return session.tenantId;
  }

  private sessionOf(accessToken: string): { tenantId: string; userId: string } {
    const session = this.sessions.get(accessToken);
    if (!session) throw new Error("no tenant for this access token");
    return session;
  }

  async createTemplate(accessToken: string, input: CreateTemplateInput) {
    const tenant_id = this.tenantOf(accessToken);
    const template: NotificationTemplate = {
      id: nextId("template"),
      tenant_id,
      template_key: input.template_key,
      channel: input.channel,
      subject: input.subject,
      body: input.body,
    };
    this.templates.set(template.id, template);
    return template;
  }

  async listTemplates(accessToken: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.templates.values()].filter((t) => t.tenant_id === tenant_id);
  }

  async upsertRetryPolicy(accessToken: string, input: UpsertRetryPolicyInput) {
    const tenant_id = this.tenantOf(accessToken);
    const key = `${tenant_id}:${input.channel}`;
    const existing = this.retryPolicies.get(key);
    const policy: NotificationRetryPolicy = {
      id: existing?.id ?? nextId("retry-policy"),
      tenant_id,
      channel: input.channel,
      max_attempts: input.max_attempts,
      backoff_seconds: input.backoff_seconds,
    };
    this.retryPolicies.set(key, policy);
    return policy;
  }

  async listRetryPolicies(accessToken: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.retryPolicies.values()].filter((p) => p.tenant_id === tenant_id);
  }

  async listMyNotifications(accessToken: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.notifications.values()].filter((n) => n.tenant_id === tenant_id);
  }

  async markNotificationRead(accessToken: string, notificationId: string) {
    const tenant_id = this.tenantOf(accessToken);
    const notification = this.notifications.get(notificationId);
    if (!notification || notification.tenant_id !== tenant_id) return null;
    notification.read_at = new Date().toISOString();
    return notification;
  }

  async getTemplateByKey(tenantId: string, templateKey: string, channel: NotificationChannel) {
    for (const template of this.templates.values()) {
      if (template.tenant_id === tenantId && template.template_key === templateKey && template.channel === channel) {
        return template;
      }
    }
    return null;
  }

  async getRetryPolicy(tenantId: string, channel: NotificationChannel) {
    return this.retryPolicies.get(`${tenantId}:${channel}`) ?? null;
  }

  async insertNotificationIfAbsent(tenantId: string, input: InsertNotificationInput) {
    for (const notification of this.notifications.values()) {
      if (
        notification.tenant_id === tenantId &&
        notification.dedup_key === input.dedup_key &&
        notification.recipient_id === input.recipient_id
      ) {
        return { notification, created: false };
      }
    }
    const notification: Notification = {
      id: nextId("notification"),
      tenant_id: tenantId,
      recipient_id: input.recipient_id,
      channel: input.channel,
      template_id: input.template_id,
      dedup_key: input.dedup_key,
      rendered_subject: input.rendered_subject,
      rendered_body: input.rendered_body,
      status: "pending",
      attempt_count: 0,
      last_attempted_at: null,
      delivered_at: null,
      read_at: null,
      failure_reason: null,
      deferred_delivery_mode: null,
    };
    this.notifications.set(notification.id, notification);
    return { notification, created: true };
  }

  async updateNotificationDeliveryResult(notificationId: string, result: NotificationDeliveryResult) {
    const notification = this.notifications.get(notificationId);
    if (!notification) throw new Error(`notification ${notificationId} not found`);
    notification.status = result.status;
    notification.attempt_count = result.attemptCount;
    notification.last_attempted_at = result.lastAttemptedAt;
    notification.delivered_at = result.deliveredAt;
    notification.failure_reason = result.failureReason;
    return notification;
  }

  async getNotification(notificationId: string) {
    return this.notifications.get(notificationId) ?? null;
  }

  async upsertPreference(accessToken: string, input: UpsertPreferenceInput) {
    const { tenantId, userId } = this.sessionOf(accessToken);
    const key = `${tenantId}:${userId}:${input.template_key}:${input.channel}`;
    const existing = this.preferences.get(key);
    const preference: NotificationPreference = {
      id: existing?.id ?? nextId("preference"),
      tenant_id: tenantId,
      user_id: userId,
      template_key: input.template_key,
      channel: input.channel,
      opted_in: input.opted_in,
      delivery_mode: input.delivery_mode,
    };
    this.preferences.set(key, preference);
    return preference;
  }

  async listMyPreferences(accessToken: string) {
    const { tenantId, userId } = this.sessionOf(accessToken);
    return [...this.preferences.values()].filter((p) => p.tenant_id === tenantId && p.user_id === userId);
  }

  async upsertScheduleSettings(accessToken: string, input: UpsertScheduleSettingsInput) {
    const { tenantId, userId } = this.sessionOf(accessToken);
    const key = `${tenantId}:${userId}`;
    const existing = this.scheduleSettings.get(key);
    const settings: NotificationScheduleSettings = {
      id: existing?.id ?? nextId("schedule-settings"),
      tenant_id: tenantId,
      user_id: userId,
      quiet_hours_start: input.quiet_hours_start,
      quiet_hours_end: input.quiet_hours_end,
      quiet_hours_timezone: input.quiet_hours_timezone,
      digest_interval_minutes: input.digest_interval_minutes,
      last_digest_released_at: existing?.last_digest_released_at ?? null,
    };
    this.scheduleSettings.set(key, settings);
    return settings;
  }

  async getMyScheduleSettings(accessToken: string) {
    const { tenantId, userId } = this.sessionOf(accessToken);
    return this.scheduleSettings.get(`${tenantId}:${userId}`) ?? null;
  }

  async getPreference(tenantId: string, userId: string, templateKey: string, channel: NotificationChannel) {
    return this.preferences.get(`${tenantId}:${userId}:${templateKey}:${channel}`) ?? null;
  }

  async getScheduleSettings(tenantId: string, userId: string) {
    return this.scheduleSettings.get(`${tenantId}:${userId}`) ?? null;
  }

  async markDigestReleased(tenantId: string, userId: string, releasedAtIso: string) {
    const key = `${tenantId}:${userId}`;
    const existing = this.scheduleSettings.get(key);
    if (existing) existing.last_digest_released_at = releasedAtIso;
  }

  async listDeferredNotifications(tenantId: string, userId: string) {
    return [...this.notifications.values()].filter(
      (n) => n.tenant_id === tenantId && n.recipient_id === userId && n.status === "deferred",
    );
  }

  async markNotificationDeferred(notificationId: string, deliveryMode: "immediate" | "digest") {
    const notification = this.notifications.get(notificationId);
    if (!notification) throw new Error(`notification ${notificationId} not found`);
    notification.status = "deferred";
    notification.deferred_delivery_mode = deliveryMode;
    return notification;
  }

  async markNotificationSkipped(notificationId: string) {
    const notification = this.notifications.get(notificationId);
    if (!notification) throw new Error(`notification ${notificationId} not found`);
    notification.status = "skipped";
    return notification;
  }
}
