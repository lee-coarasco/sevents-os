/** M31b (ticket 0082): greenfield — no notification-shaped table existed before this. */
export type NotificationChannel = "in_app" | "email";

/**
 * `deferred` (held back for quiet hours/digest, ticket 0083) and
 * `skipped` (recipient opted out, ticket 0083) added alongside 0082's
 * original four.
 */
export type NotificationStatus = "pending" | "sent" | "failed" | "retrying" | "deferred" | "skipped";

export type NotificationDeliveryMode = "immediate" | "digest";

export interface NotificationTemplate {
  id: string;
  tenant_id: string;
  template_key: string;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
}

/**
 * No seeded rows, no hard-coded fallback anywhere in service.ts — a
 * channel with no row here is not retryable, same "no matching row
 * means not authorized, never unlimited" precedent as ticket 0056's
 * approval_limits.
 */
export interface NotificationRetryPolicy {
  id: string;
  tenant_id: string;
  channel: NotificationChannel;
  max_attempts: number;
  backoff_seconds: number;
}

export interface Notification {
  id: string;
  tenant_id: string;
  recipient_id: string;
  channel: NotificationChannel;
  template_id: string | null;
  dedup_key: string;
  rendered_subject: string | null;
  rendered_body: string;
  status: NotificationStatus;
  attempt_count: number;
  last_attempted_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failure_reason: string | null;
  /** Snapshot of the recipient's preference at the moment this notification was deferred — null unless status is/was "deferred". */
  deferred_delivery_mode: NotificationDeliveryMode | null;
}

/**
 * `template_key` is the "category" dimension (ticket 0083's own note:
 * no separate category column exists on notification_templates, so
 * don't invent one here either).
 */
export interface NotificationPreference {
  id: string;
  tenant_id: string;
  user_id: string;
  template_key: string;
  channel: NotificationChannel;
  opted_in: boolean;
  delivery_mode: NotificationDeliveryMode;
}

/**
 * One row per user. All fields nullable and never defaulted — per
 * CLAUDE.md, quiet hours/digest have no invented default window or
 * interval, so "no row" and "row with null fields" both mean
 * immediate delivery, as if nothing were configured.
 */
export interface NotificationScheduleSettings {
  id: string;
  tenant_id: string;
  user_id: string;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_timezone: string | null;
  digest_interval_minutes: number | null;
  last_digest_released_at: string | null;
}

/**
 * Pluggable so a real provider can be wired in later once the owner
 * approves one (CLAUDE.md: a new paid service needs sign-off first).
 * Tests always use a stub — never a live network call.
 */
export interface NotificationSender {
  send(notification: Notification): Promise<{ success: boolean; failureReason?: string }>;
}
