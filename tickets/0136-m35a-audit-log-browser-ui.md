---
id: 136
title: M35a — Audit log browser UI
status: next
roles: [ui-designer, test-engineer]
priority: 1
created: 2026-10-17
updated: 2026-10-17
---

Split out of ticket 0112 (owner-filed "Audit & compliance viewer," too
large for one ticket — three independent screens over three independent
backend tickets, same "split by screen" pattern as every other oversized
ticket in this project — see DECISIONS.md). This sub-ticket is the audit
log browser, the first of the three bullets.

Backend is fully built (ticket 0078, `status: testing`), no backend work
needed:
- `GET /audit/log` — filters: `entityType`, `actorId`, `from`, `to`,
  `limit`, `offset`. Merges `auth_audit_log`, `configuration_changes`,
  `workflow_events`, `approval_decisions`, `approval_revocations` into
  one normalized read.
- Permission: `audit.log.view` (deny-by-default, platform-administrator
  only).
- Known backend gaps (not this ticket's to fix): `correlationId` is
  always null, `actorId` can be null for `workflow_events` rows, no
  server-side push-down beyond the documented filters (pagination is
  in-app over the full tenant result set).

## What to build
- A new page (e.g. `/audit`) listing audit entries newest-first: actor
  (via `<UserPicker>`-style display, not a raw UUID — resolve through
  whatever user list endpoint already backs `<UserPicker>`), entity
  type, action/event type, timestamp, and the raw detail as an
  expandable JSON panel (no normalized "pretty" view is required, these
  are heterogeneous rows from five source tables).
- Filters matching the API: actor (user picker), entity type (free-text
  or dropdown seeded from distinct values seen so far), date range
  (`<DatePicker>` x2 for `from`/`to`).
- Pagination (the API takes `limit`/`offset`).
- Wrap the nav link in `<PermissionGate permission="audit.log.view">`
  per CLAUDE.md's Definition of Done — a user without the permission
  should not see the nav item or be able to reach a 403 page.
- `docs/USER-GUIDE.md`: add the M35 section (this is the first M35 UI
  ticket — none exists yet) describing the backend (ticket
  0078/0079/0080, one line each) and this screen.

## Acceptance
- [ ] Audit log page lists entries with actor/entity/action/timestamp,
  newest first, paginated.
- [ ] Filters (actor, entity type, from/to date) work and match the API.
- [ ] Raw detail is viewable per row (expandable JSON, no raw UUID shown
  anywhere a human-readable label is available).
- [ ] Nav link + page gated by `audit.log.view` via `<PermissionGate>`.
- [ ] `docs/USER-GUIDE.md` M35 section added.
- [ ] Test: list renders, filters narrow the result, permission gate
  hides the nav item for a caller without `audit.log.view`.

## Progress
