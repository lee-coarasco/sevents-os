---
id: 82
title: "M31b — Notification delivery core (templates, dedup, retry)"
status: testing
roles: [backend-engineer]
priority: 11
created: 2026-10-16
updated: 2026-10-16
---

Second of three M31 sub-tickets (see ticket 0069 and DECISIONS.md for
the split rationale). Covers BRD §8.11 FR-NOT-001/002's literal text —
"reminders/escalations are deduplicated and traceable; delivery
failure is visible and retried under policy" — and the §7 module row's
"in-app/email notifications initially; configurable templates...
delivery status, deduplication." Loosely depends on ticket 0081 (0081
is what starts actually emitting `escalated`/`timer_fired`
`workflow_events` for this ticket to react to) but can be built mostly
independently: `workflow_events` already exists today and already has
plenty of other event types (`task_reassigned`, `approval_decision_
recorded`, etc.) this ticket can dispatch on even before 0081 lands.

## Survey findings (read before building)
- No `notifications`, `notification_templates`, `notification_queue`
  or `digest` table exists anywhere in this codebase today — this is
  greenfield.
- `workflow_events` (`20261015000007_m06c_workflow_runtime.sql`) is
  the existing append-only event source this module should consume,
  not a second parallel event log — see ticket 0081's survey findings
  for the full list of event types already declared in
  `WORKFLOW_EVENT_TYPES`.
- No email-sending code exists anywhere in `backend/src`. Sending real
  email requires picking a transactional email
  provider/SMTP relay. **If that provider has a new monthly cost
  beyond what's already approved (Supabase), STOP and ask the owner
  per CLAUDE.md's "third-party paid services" approval rule before
  wiring a live sender in** — put the question in this ticket's `##
  Needs approval` section and set status: blocked for that half only
  if reached before an answer exists. The dispatcher/queue/dedup/retry
  logic itself has no such dependency and can be fully built and
  tested with a stubbed/no-op sender in the meantime; do not block the
  whole ticket on the provider question.

## What to build
- `notification_templates`: tenant-scoped, keyed by a template key +
  channel (`in_app` | `email`), holding the configurable body/subject
  — no hard-coded copy baked into application code.
- `notifications`: one row per attempted delivery. Columns: recipient
  (`app_users.id`), channel, `template_id`, rendered payload,
  `status` (`pending` | `sent` | `failed` | `retrying`), `dedup_key`,
  `attempt_count`, `last_attempted_at`, `delivered_at`,
  `failure_reason`.
- Deduplication (FR-NOT-001): a notification for the same
  `(dedup_key, recipient)` within whatever window the caller's own
  dispatch logic defines must not create a second row / must not
  double-send. Do not invent a specific dedup window value — this is
  about the mechanism (a uniqueness check before insert), not a
  fabricated time constant.
- A dispatcher that consumes `workflow_events` (and any other trigger
  point a later module wants to call directly, e.g. task assignment)
  and creates `notifications` rows via the template above.
- In-app delivery: a `GET /notifications` a caller's own session can
  read (their own notifications only, tenant-scoped), with a mark-
  read action.
- Email delivery: build the queue/retry bookkeeping now; the actual
  "send" step behind an interface so a real provider can be swapped in
  later once/if the owner approves one. Tests use a stub sender —
  never a live network call in tests.
- Retry policy (FR-NOT-002): a failed delivery is marked `failed`,
  visible as such, and retried per a caller-configured policy (max
  attempts, backoff) stored as config, not a hard-coded retry count.
- New deny-by-default permission `notification.template.manage` for
  template administration. (Per-user preference management is ticket
  0083's own permission — do not add it here.)

## Out of scope
- SLA timers / escalation ladder definitions — ticket 0081 (this
  ticket only reacts to events, including escalation events, once
  they exist).
- Preferences, quiet hours, digest batching — ticket 0083.
- WhatsApp/SMS channels — a new paid service; a question for this
  ticket's `## Needs approval` if a live email provider is reached,
  and out of scope entirely for any non-email channel until the owner
  approves one in a future ticket.

## Acceptance
- [x] `notifications` + `notification_templates` exist, tenant-scoped
      RLS.
- [x] Creating a notification for the same `dedup_key` + recipient
      twice does not create two rows / does not double-send.
- [x] A failed delivery is visibly `failed` and retried per a
      caller-configured policy, never a hard-coded retry count.
- [x] In-app notifications are readable via an API scoped to the
      caller's own session; a caller never sees another user's
      notifications.
- [x] Tests cover dedup, retry/backoff bookkeeping, and tenant/own-
      user isolation; no live email send in any test.

## Progress
- 2026-10-16 01:52 UTC: Filed as the second of three M31 sub-tickets
  (see ticket 0069's split). Survey done as part of filing this
  ticket — see "Survey findings" above; do not re-survey from scratch.
  Flagging now, ahead of time: whoever picks this up should check
  DECISIONS.md/NEEDS_APPROVAL.md first in case a provider question was
  already asked and answered by a later session.
- 2026-10-16 08:05 UTC: Built. New `backend/src/modules/notifications`
  module (greenfield, as the survey predicted). Migration
  `20261016000009_m31b_notification_delivery_core.sql` adds
  `notification_templates` (tenant+key+channel unique),
  `notification_retry_policies` (tenant+channel unique, no seeded
  rows), and `notifications` (dedup enforced by a DB unique constraint
  on `(tenant_id, dedup_key, recipient_id)` — the window itself is
  whatever the caller encodes into `dedup_key`, per the ticket's own
  "mechanism, not a fabricated time constant" instruction).
  `notifications`' RLS policy checks `recipient_id = auth.uid()`
  directly (not just tenant), same "own row" precedent as
  `auth_audit_log` — a caller can never see another user's row even
  within the same tenant. `dispatchNotification` renders the template
  and delivers (in_app marks sent immediately; email calls an injected
  `NotificationSender`, defaulting to no live provider — no email
  provider has been chosen or approved, so there is nothing to wire a
  real sender to yet; this is noted as an open follow-on, not asked as
  a blocking `## Needs approval` question here, because every
  acceptance box above is satisfiable with a stub sender and ticket
  0082 itself says not to block the whole ticket on the provider
  question). `retryNotification` refuses to retry with no configured
  retry policy for that channel (never an invented default max-
  attempts) and once `attempt_count` reaches the configured max. Added
  `notification.template.manage` permission (deny-by-default,
  platform-administrator-only), `FakeNotificationsRepository`, 8
  service-level tests (dedup incl. per-recipient, delivery success/
  failure, retry policy missing/not-retryable/max-exceeded) and 10
  route tests (permission gating, template/retry-policy CRUD, self-
  service GET/mark-read, 404 on an unknown notification). Did not
  build: automatic consumption of `workflow_events` (no event-bus/
  subscription mechanism exists in this codebase — same finding ticket
  0075 already made for baseline-change-request resolution;
  `dispatchNotification` is the entrypoint a future caller, e.g.
  ticket 0081's escalation runtime, calls directly), and anything from
  ticket 0081 (SLA/escalation) or 0083 (preferences/quiet hours/
  digest) — both explicitly out of scope here. Full backend suite:
  402/402 passing.
