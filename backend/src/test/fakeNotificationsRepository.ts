import type {
  CreateTemplateInput,
  InsertNotificationInput,
  NotificationDeliveryResult,
  NotificationsRepository,
  UpsertRetryPolicyInput,
} from "../modules/notifications/repository.js";
import type { Notification, NotificationChannel, NotificationRetryPolicy, NotificationTemplate } from "../modules/notifications/types.js";

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
  private sessions = new Map<string, string>(); // accessToken -> tenantId
  templates = new Map<string, NotificationTemplate>();
  retryPolicies = new Map<string, NotificationRetryPolicy>(); // key: `${tenantId}:${channel}`
  notifications = new Map<string, Notification>();

  addSession(accessToken: string, tenantId: string) {
    this.sessions.set(accessToken, tenantId);
  }

  private tenantOf(accessToken: string): string {
    const tenantId = this.sessions.get(accessToken);
    if (!tenantId) throw new Error("no tenant for this access token");
    return tenantId;
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
}
