---
id: 69
title: "M31 — Notifications, SLA & Escalations"
status: next
roles: [architect, backend-engineer]
priority: 11
created: 2026-10-15
updated: 2026-10-15
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
