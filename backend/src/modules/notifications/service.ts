import { isDigestDue, isWithinQuietHours } from "./preferences.js";
import type { NotificationsRepository } from "./repository.js";
import type {
  Notification,
  NotificationChannel,
  NotificationDeliveryMode,
  NotificationSender,
  NotificationTemplate,
} from "./types.js";

export class MissingTemplateBodyError extends Error {}
export class InvalidRetryPolicyError extends Error {}
export class TemplateNotFoundError extends Error {}
export class NotificationNotFoundError extends Error {}
export class NotificationNotRetryableError extends Error {}
export class RetryPolicyNotConfiguredError extends Error {}
export class MaxRetriesExceededError extends Error {}
export class InvalidPreferenceError extends Error {}
export class InvalidScheduleSettingsError extends Error {}

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

/** Ticket 0083: one row per (template_key, channel) — see `NotificationPreference`'s own doc comment on why `template_key` and not an invented `category`. */
export async function setMyPreference(
  repository: NotificationsRepository,
  accessToken: string,
  input: { templateKey: string; channel: NotificationChannel; optedIn: boolean; deliveryMode: NotificationDeliveryMode },
) {
  if (!input.templateKey.trim()) throw new InvalidPreferenceError("templateKey is required");
  return repository.upsertPreference(accessToken, {
    template_key: input.templateKey,
    channel: input.channel,
    opted_in: input.optedIn,
    delivery_mode: input.deliveryMode,
  });
}

export async function listMyPreferences(repository: NotificationsRepository, accessToken: string) {
  return repository.listMyPreferences(accessToken);
}

/**
 * Partial update: a field left `undefined` keeps its current value
 * (reads the existing row first and merges); pass `null` explicitly to
 * clear a field (e.g. turn quiet hours back off). Quiet hours is
 * all-three-or-none — CLAUDE.md forbids inventing a default window, so
 * a start with no end/timezone is rejected rather than silently
 * defaulted.
 */
export async function setMyScheduleSettings(
  repository: NotificationsRepository,
  accessToken: string,
  input: {
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    quietHoursTimezone?: string | null;
    digestIntervalMinutes?: number | null;
  },
) {
  const current = await repository.getMyScheduleSettings(accessToken);
  const merged = {
    quiet_hours_start: input.quietHoursStart !== undefined ? input.quietHoursStart : current?.quiet_hours_start ?? null,
    quiet_hours_end: input.quietHoursEnd !== undefined ? input.quietHoursEnd : current?.quiet_hours_end ?? null,
    quiet_hours_timezone:
      input.quietHoursTimezone !== undefined ? input.quietHoursTimezone : current?.quiet_hours_timezone ?? null,
    digest_interval_minutes:
      input.digestIntervalMinutes !== undefined ? input.digestIntervalMinutes : current?.digest_interval_minutes ?? null,
  };

  const quietHoursFields = [merged.quiet_hours_start, merged.quiet_hours_end, merged.quiet_hours_timezone];
  const providedCount = quietHoursFields.filter((f) => f !== null).length;
  if (providedCount !== 0 && providedCount !== 3) {
    throw new InvalidScheduleSettingsError("quietHoursStart, quietHoursEnd and quietHoursTimezone must be set together");
  }
  if (merged.digest_interval_minutes !== null && (!Number.isInteger(merged.digest_interval_minutes) || merged.digest_interval_minutes <= 0)) {
    throw new InvalidScheduleSettingsError("digestIntervalMinutes must be a positive integer");
  }

  return repository.upsertScheduleSettings(accessToken, merged);
}

export async function getMyScheduleSettings(repository: NotificationsRepository, accessToken: string) {
  return repository.getMyScheduleSettings(accessToken);
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
    /**
     * Ticket 0083: the single explicit urgency flag — 0082's
     * notifications carried no priority/severity field to reuse, so
     * this is it, not a second parallel concept. Caller-named, same
     * "no resolution magic" precedent as `recipientId` itself. Urgent
     * notifications always deliver immediately, bypassing quiet hours
     * and digest preference.
     */
    urgent?: boolean;
    /** Injectable for deterministic tests — defaults to the real clock, same convention as sla.ts's `nowIso` params. */
    nowIso?: string;
  },
): Promise<{ notification: Notification; deduped: boolean; deferred: boolean }> {
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
  if (!created) return { notification, deduped: true, deferred: notification.status === "deferred" };

  const preference = await repository.getPreference(tenantId, input.recipientId, input.templateKey, input.channel);
  if (preference && !preference.opted_in) {
    const skipped = await repository.markNotificationSkipped(notification.id);
    return { notification: skipped, deduped: false, deferred: false };
  }

  if (!input.urgent) {
    const deliveryMode = preference?.delivery_mode ?? "immediate";
    if (deliveryMode === "digest") {
      const deferred = await repository.markNotificationDeferred(notification.id, "digest");
      return { notification: deferred, deduped: false, deferred: true };
    }

    const now = input.nowIso ?? nowIso();
    const schedule = await repository.getScheduleSettings(tenantId, input.recipientId);
    const quietHours =
      schedule?.quiet_hours_start && schedule.quiet_hours_end && schedule.quiet_hours_timezone
        ? {
            quiet_hours_start: schedule.quiet_hours_start,
            quiet_hours_end: schedule.quiet_hours_end,
            quiet_hours_timezone: schedule.quiet_hours_timezone,
          }
        : null;
    if (isWithinQuietHours(now, quietHours)) {
      const deferred = await repository.markNotificationDeferred(notification.id, "immediate");
      return { notification: deferred, deduped: false, deferred: true };
    }
  }

  const delivered = await attemptDelivery(repository, sender, notification);
  return { notification: delivered, deduped: false, deferred: false };
}

/**
 * No scheduler exists in this codebase (same gap ticket 0081/0082's
 * own service.ts notes) — nothing calls this on a timer. It is the
 * entrypoint a future read path (e.g. GET /notifications) or a
 * caller's own poll calls, same "no resolution magic, caller invokes
 * explicitly" precedent as dispatchNotification itself not subscribing
 * to workflow_events.
 */
export async function releaseDueDeferrals(
  repository: NotificationsRepository,
  sender: NotificationSender,
  tenantId: string,
  userId: string,
  nowIsoValue: string,
): Promise<{ released: Notification[]; digestReleased: boolean }> {
  const deferred = await repository.listDeferredNotifications(tenantId, userId);
  if (deferred.length === 0) return { released: [], digestReleased: false };

  const schedule = await repository.getScheduleSettings(tenantId, userId);
  const quietHours =
    schedule?.quiet_hours_start && schedule.quiet_hours_end && schedule.quiet_hours_timezone
      ? {
          quiet_hours_start: schedule.quiet_hours_start,
          quiet_hours_end: schedule.quiet_hours_end,
          quiet_hours_timezone: schedule.quiet_hours_timezone,
        }
      : null;
  if (isWithinQuietHours(nowIsoValue, quietHours)) {
    return { released: [], digestReleased: false };
  }

  const released: Notification[] = [];

  const immediate = deferred.filter((n) => n.deferred_delivery_mode !== "digest");
  for (const notification of immediate) {
    released.push(await attemptDelivery(repository, sender, notification));
  }

  const digestCandidates = deferred.filter((n) => n.deferred_delivery_mode === "digest");
  let digestReleased = false;
  if (digestCandidates.length > 0) {
    const intervalMinutes = schedule?.digest_interval_minutes ?? null;
    if (isDigestDue(nowIsoValue, schedule?.last_digest_released_at ?? null, intervalMinutes)) {
      for (const notification of digestCandidates) {
        released.push(await attemptDelivery(repository, sender, notification));
      }
      await repository.markDigestReleased(tenantId, userId, nowIsoValue);
      digestReleased = true;
    }
  }

  return { released, digestReleased };
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
