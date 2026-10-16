---
id: 83
title: "M31c — Notification preferences, quiet hours & digest"
status: next
roles: [backend-engineer]
priority: 11
created: 2026-10-16
updated: 2026-10-16
---

Third of three M31 sub-tickets (see ticket 0069 and DECISIONS.md for
the split rationale). Covers the remaining BRD §7 M31 module-row items
not covered by 0081/0082: "quiet hours... preference management" and
"digest." Depends on ticket 0082 — this ticket applies preferences/
quiet-hours/digest rules against the `notifications` table and
dispatcher 0082 builds; it has nothing to attach to until that exists.

## What to build
- `notification_preferences`: one row per `(app_user, category,
  channel)` (or a narrower shape if a category dimension turns out
  unnecessary once 0082's template keys exist — check what 0082
  actually built before assuming a `category` column is needed),
  recording opt-in/opt-out and immediate-vs-digest delivery.
- Quiet hours: a time range — per-user, caller-configured, **never a
  hard-coded default window** (CLAUDE.md: don't invent unrequested
  defaults) — during which non-urgent notifications are deferred, not
  dropped. A deferred notification releases (sends, or folds into the
  next digest per the user's preference) once quiet hours end. Decide
  "urgent" via whatever priority/severity field 0082's notifications
  already carry — do not invent a second parallel urgency concept if
  one already exists there.
- Digest: periodic batching of deferred/digest-preferring
  notifications into one delivery per user per a caller-configured
  interval (never an invented default interval). Building this on top
  of 0082's `notifications` table (a digest is a read/aggregate over
  pending rows, not a new source of truth) is strongly preferred over
  a parallel digest-specific table, unless 0082's shape turns out to
  make that impractical — if so, document why in this ticket's
  Progress before diverging.
- Permissions: a user manages their own preferences under a
  `notification.preferences.manage` permission scoped to "self" (same
  "narrower administrative action gets its own permission" pattern
  used throughout this project) — if a tenant-wide default/override
  surface (e.g. an admin setting the default digest interval for
  everyone who hasn't set their own) turns out to be needed, that is
  a separate, more privileged permission; do not fold the two
  together.

## Out of scope
- SLA timers / escalation ladders — ticket 0081.
- Notification delivery core (templates, dedup, retry, the
  `notifications` table itself) — ticket 0082.
- WhatsApp/SMS channels.

## Acceptance
- [ ] A user can set their own channel/digest/quiet-hours preferences
      via API; cannot set another user's (tenant isolation + self-
      only, tested).
- [ ] A notification generated during a user's configured quiet hours
      is deferred, not dropped, and is delivered (or folded into a
      digest, per that user's preference) once quiet hours end.
- [ ] Digest batching groups deferred notifications correctly per the
      caller-configured interval.
- [ ] Tests cover quiet-hours deferral + release, digest grouping, and
      that the feature is a no-op (immediate delivery, as if no
      preference existed) until a user has actually configured quiet
      hours/digest — no silently-applied default window or interval.

## Progress
- 2026-10-16 01:52 UTC: Filed as the third of three M31 sub-tickets
  (see ticket 0069's split). Left `next` behind 0081/0082 since it has
  nothing to attach to until 0082's `notifications` table exists.
