/** M31b (ticket 0082): greenfield — no notification-shaped table existed before this. */
export type NotificationChannel = "in_app" | "email";

export type NotificationStatus = "pending" | "sent" | "failed" | "retrying";

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
}

/**
 * Pluggable so a real provider can be wired in later once the owner
 * approves one (CLAUDE.md: a new paid service needs sign-off first).
 * Tests always use a stub — never a live network call.
 */
export interface NotificationSender {
  send(notification: Notification): Promise<{ success: boolean; failureReason?: string }>;
}
