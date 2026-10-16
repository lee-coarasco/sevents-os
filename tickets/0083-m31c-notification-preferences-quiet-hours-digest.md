---
id: 83
title: "M31c — Notification preferences, quiet hours & digest"
status: testing
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
- [x] A user can set their own channel/digest/quiet-hours preferences
      via API; cannot set another user's (tenant isolation + self-
      only, tested).
- [x] A notification generated during a user's configured quiet hours
      is deferred, not dropped, and is delivered (or folded into a
      digest, per that user's preference) once quiet hours end.
- [x] Digest batching groups deferred notifications correctly per the
      caller-configured interval.
- [x] Tests cover quiet-hours deferral + release, digest grouping, and
      that the feature is a no-op (immediate delivery, as if no
      preference existed) until a user has actually configured quiet
      hours/digest — no silently-applied default window or interval.

## Progress
- 2026-10-16 01:52 UTC: Filed as the third of three M31 sub-tickets
  (see ticket 0069's split). Left `next` behind 0081/0082 since it has
  nothing to attach to until 0082's `notifications` table exists.
- 2026-10-16 07:11 UTC: Built. Migration
  `20261016000010_m31c_notification_preferences_quiet_hours_digest.sql`
  adds `notification_preferences` (tenant+user+`template_key`+channel
  unique — confirmed 0082 built no `category` column, so this keys off
  `template_key` directly rather than inventing one) and
  `notification_schedule_settings` (one row per user; every field
  nullable, nothing defaulted — no row and a row with null fields both
  mean plain immediate delivery), both self-only RLS (`user_id =
  auth.uid()`, same precedent as `notifications` itself). Added
  `deferred`/`skipped` to `notifications.status` and a new
  `deferred_delivery_mode` column (snapshots the recipient's
  immediate-vs-digest preference at the moment a notification is
  deferred, so a later preference change can't retroactively alter an
  already-deferred row). New permission `notification.preferences.manage`
  — unlike every other permission in this codebase (deny-by-default,
  granted only to `role.platform_administrator`), this one is granted
  to every `role_definitions` row, since it gates a basic self-service
  action every user should have, not an administrative one; RLS (not
  the permission) is what actually prevents targeting another user.
  `backend/src/modules/notifications/preferences.ts`: pure functions
  `isWithinQuietHours` (handles same-day and midnight-wrapping windows,
  timezone-aware via `Intl.DateTimeFormat`, false for a not-configured
  or zero-width window) and `isDigestDue` (false with no interval
  configured — never an invented default). `dispatchNotification`
  (service.ts) now takes an optional `urgent` flag (the single explicit
  urgency concept this ticket needed — 0082's notifications carried no
  priority/severity field to reuse, contrary to this ticket's original
  text's assumption) and `nowIso` (injectable, same convention as
  0081's sla.ts); on a fresh insert it checks opt-out (-> `skipped`,
  never sent), then digest preference (-> deferred unconditionally,
  independent of quiet hours), then quiet hours (-> deferred) before
  falling through to the original immediate-delivery path unchanged —
  so the "no preference/settings at all" case behaves exactly as
  before this ticket (acceptance's no-op requirement). New
  `releaseDueDeferrals(repository, sender, tenantId, userId, nowIso)`
  is the release entrypoint: no scheduler exists in this codebase (same
  gap 0081/0082 both flagged), so — like `dispatchNotification` itself
  not subscribing to `workflow_events` — this is not wired into any
  route; it is the function a future caller (a cron-equivalent, or a
  read-path poll) invokes explicitly. It releases immediate-mode
  deferrals the moment quiet hours end, and releases the whole
  digest-mode batch together (one `markDigestReleased` timestamp
  update) once the caller-configured interval has elapsed — scoped
  down from a literal single merged-body send to "one batched release
  pass per interval," since a true merged email would need a digest
  template this ticket doesn't have a reason to invent; documented here
  per the ticket's own instruction to record such a divergence. New
  routes: `POST`/`GET /notifications/preferences`,
  `PUT`/`GET /notifications/schedule-settings`, all gated by
  `notification.preferences.manage` (unlike `GET /notifications`/`POST
  /notifications/:id/read`, which stay permission-free, RLS-only, per
  0082's own precedent — this ticket only changes the two self-service
  surfaces it actually built). 24 new tests across
  `preferences.test.ts` (pure quiet-hours/digest math),
  `service.preferences.test.ts` (preference/schedule CRUD + isolation,
  opt-out, quiet-hours defer/release, digest grouping incl. "no
  interval configured -> deferred forever"), and additions to
  `routes.test.ts` (permission gating, self-isolation at the route
  level). Full backend suite: 430/430 passing, `npm run build` and
  `npm run lint` both clean.
