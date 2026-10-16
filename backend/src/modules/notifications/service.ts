import type { NotificationsRepository } from "./repository.js";
import type { Notification, NotificationChannel, NotificationSender, NotificationTemplate } from "./types.js";

export class MissingTemplateBodyError extends Error {}
export class InvalidRetryPolicyError extends Error {}
export class TemplateNotFoundError extends Error {}
export class NotificationNotFoundError extends Error {}
export class NotificationNotRetryableError extends Error {}
export class RetryPolicyNotConfiguredError extends Error {}
export class MaxRetriesExceededError extends Error {}

function nowIso(): string {
  return new Date().toISOString();
}

export async function createTemplate(
  repository: NotificationsRepository,
  accessToken: string,
  input: { templateKey: string; channel: NotificationChannel; subject?: string | null; body: string },
): Promise<NotificationTemplate> {
  if (!input.body.trim()) throw new MissingTemplateBodyError("a template requires a non-empty body");
  return repository.createTemplate(accessToken, {
    template_key: input.templateKey,
    channel: input.channel,
    subject: input.subject ?? null,
    body: input.body,
  });
}

export async function listTemplates(repository: NotificationsRepository, accessToken: string) {
  return repository.listTemplates(accessToken);
}

/** FR-NOT-002: max attempts/backoff are always caller-supplied — never a hard-coded retry count. */
export async function upsertRetryPolicy(
  repository: NotificationsRepository,
  accessToken: string,
  input: { channel: NotificationChannel; maxAttempts: number; backoffSeconds: number },
) {
  if (!Number.isInteger(input.maxAttempts) || input.maxAttempts <= 0) {
    throw new InvalidRetryPolicyError("maxAttempts must be a positive integer");
  }
  if (!Number.isInteger(input.backoffSeconds) || input.backoffSeconds < 0) {
    throw new InvalidRetryPolicyError("backoffSeconds must be a non-negative integer");
  }
  return repository.upsertRetryPolicy(accessToken, {
    channel: input.channel,
    max_attempts: input.maxAttempts,
    backoff_seconds: input.backoffSeconds,
  });
}

export async function listRetryPolicies(repository: NotificationsRepository, accessToken: string) {
  return repository.listRetryPolicies(accessToken);
}

export async function listMyNotifications(repository: NotificationsRepository, accessToken: string) {
  return repository.listMyNotifications(accessToken);
}

export async function markNotificationRead(
  repository: NotificationsRepository,
  accessToken: string,
  notificationId: string,
) {
  const updated = await repository.markNotificationRead(accessToken, notificationId);
  if (!updated) throw new NotificationNotFoundError(`notification ${notificationId} not found`);
  return updated;
}

/** `{{key}}` placeholders only — no templating engine dependency for this small a need. */
function renderTemplate(body: string, variables: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => variables[key] ?? "");
}

async function attemptDelivery(
  repository: NotificationsRepository,
  sender: NotificationSender,
  notification: Notification,
): Promise<Notification> {
  if (notification.channel === "in_app") {
    const now = nowIso();
    return repository.updateNotificationDeliveryResult(notification.id, {
      status: "sent",
      attemptCount: notification.attempt_count + 1,
      lastAttemptedAt: now,
      deliveredAt: now,
      failureReason: null,
    });
  }

  const result = await sender.send(notification);
  const now = nowIso();
  return repository.updateNotificationDeliveryResult(notification.id, {
    status: result.success ? "sent" : "failed",
    attemptCount: notification.attempt_count + 1,
    lastAttemptedAt: now,
    deliveredAt: result.success ? now : null,
    failureReason: result.success ? null : result.failureReason ?? "unknown error",
  });
}

/**
 * The single creation entrypoint any trigger point (a future SLA/
 * escalation event handler, a direct call from another module) calls.
 * There is no event-bus/subscription mechanism in this codebase (same
 * finding as ticket 0075's baseline-change-request polling) — this
 * function does not subscribe to `workflow_events` itself; a caller
 * that observes a relevant event (e.g. ticket 0081's escalation runtime)
 * calls this directly with an explicit recipient, same "no resolution
 * magic, caller names it explicitly" precedent as ticket 0066's
 * approverUserIds.
 */
export async function dispatchNotification(
  repository: NotificationsRepository,
  sender: NotificationSender,
  tenantId: string,
  input: {
    recipientId: string;
    templateKey: string;
    channel: NotificationChannel;
    dedupKey: string;
    variables?: Record<string, string>;
  },
): Promise<{ notification: Notification; deduped: boolean }> {
  const template = await repository.getTemplateByKey(tenantId, input.templateKey, input.channel);
  if (!template) {
    throw new TemplateNotFoundError(`no ${input.channel} template for key "${input.templateKey}"`);
  }

  const variables = input.variables ?? {};
  const renderedBody = renderTemplate(template.body, variables);
  const renderedSubject = template.subject ? renderTemplate(template.subject, variables) : null;

  const { notification, created } = await repository.insertNotificationIfAbsent(tenantId, {
    recipient_id: input.recipientId,
    channel: input.channel,
    template_id: template.id,
    dedup_key: input.dedupKey,
    rendered_subject: renderedSubject,
    rendered_body: renderedBody,
  });
  if (!created) return { notification, deduped: true };

  const delivered = await attemptDelivery(repository, sender, notification);
  return { notification: delivered, deduped: false };
}

/**
 * No scheduler exists in this codebase (same reasoning ticket 0077 used
 * to skip scheduled health recomputation) — a retry only happens when
 * something calls this. A channel with no configured retry policy is
 * not retryable: never fall back to an invented max-attempts constant,
 * same "no matching row = not authorized, never unlimited" precedent as
 * ticket 0056's approval_limits.
 */
export async function retryNotification(
  repository: NotificationsRepository,
  sender: NotificationSender,
  tenantId: string,
  notificationId: string,
): Promise<Notification> {
  const notification = await repository.getNotification(notificationId);
  if (!notification || notification.tenant_id !== tenantId) {
    throw new NotificationNotFoundError(`notification ${notificationId} not found`);
  }
  if (notification.status !== "failed") {
    throw new NotificationNotRetryableError(`notification ${notificationId} is not in a failed state`);
  }

  const policy = await repository.getRetryPolicy(tenantId, notification.channel);
  if (!policy) {
    throw new RetryPolicyNotConfiguredError(
      `no retry policy configured for channel "${notification.channel}" in this tenant`,
    );
  }
  if (notification.attempt_count >= policy.max_attempts) {
    throw new MaxRetriesExceededError(
      `notification ${notificationId} has exceeded its configured max attempts (${policy.max_attempts})`,
    );
  }

  return attemptDelivery(repository, sender, notification);
}
