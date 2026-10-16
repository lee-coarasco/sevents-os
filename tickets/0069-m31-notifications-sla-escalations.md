---
id: 69
title: "M31 — Notifications, SLA & Escalations"
status: done
roles: [architect, backend-engineer]
priority: 11
created: 2026-10-15
updated: 2026-10-16
---

Sixth and last Phase 3 module per `docs/PRD.md`'s build-order table.
Depends on M06 (done) and M07 (ticket 0065 — notifications/escalations
need a task/queue model to attach to). BRD §8.12 already specifies some
of this module's config shape (SLA calendars, pause reasons, warning
thresholds, escalation actions) as part of configuration governance —
check whether ticket 0060/0061 (M06a/b) already stubbed any SLA-related
columns before building a second mechanism.

Reference: BRD §8.11 (FR-NOT-001/002): reminders/escalations are
deduplicated and traceable; delivery failure is visible and retried
under policy. BRD §7 module row: "In-app/email notifications initially;
configurable templates, reminders, digest, SLA timers, escalation
ladders, quiet hours, delivery status, deduplication and preference
management. WhatsApp/SMS as later integrations." CLAUDE.md: WhatsApp/
SMS or any paid notification-delivery service is a "third-party paid
service" — stop and ask the owner before adding one; in-app + email
(assuming email sending itself has no new paid-service cost beyond
what's already approved) does not need approval.

## Progress
- 2026-10-15: Filed as the sixth Phase 3 module, left at `next` behind
  tickets 0064-0068 in priority order — last in this phase's filed
  tickets. Not yet scoped. Flag early if email delivery requires a new
  paid service (SendGrid, SES, etc.) — that needs owner approval per
  CLAUDE.md before wiring it in, even though building the module's data
  model/API does not.
- 2026-10-16 01:52 UTC: Surveyed existing workflow/task/notification
  infrastructure (see ticket 0081's "Survey findings" for the full
  detail — no SLA-specific columns, no notification table, no
  email-sending code anywhere yet; `workflow_step_instances` already
  has `due_at`/`priority`/`blocked_at`, and `workflow_events` already
  declares `escalated`/`timer_fired`/`notification_sent` event types
  that no runtime code emits yet). Closed this ticket with no code of
  its own and split it the same way tickets 0059/0065/0067/0068 were,
  into three dependency-ordered sub-tickets: 0081 (M31a — SLA
  definitions, escalation ladders and the runtime that finally emits
  the already-declared `timer_fired`/`escalated` events), 0082 (M31b —
  notification delivery core: templates, the `notifications` table,
  dedup, retry/delivery-status, in-app read API; email-provider
  selection flagged as its own owner-approval question if/when
  reached, not blocking the dispatcher/dedup/retry logic itself), and
  0083 (M31c — per-user preferences, quiet hours, digest batching,
  depends on 0082's `notifications` table existing first).
- Approved by: agent (ticket classification/ordering and internal API/
  data-model design are explicitly agent-decidable per CLAUDE.md,
  same weight as every prior M06/M07/M09/M35 split; recorded in
  DECISIONS.md).
