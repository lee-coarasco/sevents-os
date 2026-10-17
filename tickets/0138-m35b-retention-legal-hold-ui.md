---
id: 138
title: M35b — Retention policy & legal hold management UI
status: next
roles: [ui-designer, test-engineer]
priority: 2
created: 2026-10-17
updated: 2026-10-17
---

Split out of ticket 0112 (see ticket 0136 and DECISIONS.md for the split
rationale). Third of the three bullets.

Backend is fully built (ticket 0079, `status: testing`), no backend work
needed:
- `POST /audit/retention-policies`, `GET /audit/retention-policies` —
  one row per `entity_type` (`retention_days` positive int, no default
  seeded for any type — every type starts unmanaged until an admin sets
  one).
- `POST /audit/legal-holds`, `GET /audit/legal-holds`,
  `POST /audit/legal-holds/:id/release` — `entity_type` +
  optional `entity_id` (null = whole type), `reason` required,
  `placed_by`/`placed_at`, `released_by`/`released_at` once released.
  Rows are never deleted, matching the `approval_revocations` pattern.
- Permission: `audit.retention.manage` (deny-by-default, platform-
  administrator only).
- No auto-purge job exists (no scheduler in this codebase) — this UI
  manages policy/hold records only, it does not need to show or trigger
  any purge action because there isn't one yet.

## What to build
- A retention-policies screen: list (entity type, retention days, set
  by/at), create/edit form (entity type free-text — this module does
  not own a fixed list of entity types, same convention as `documents.
  document_type` — retention days). No delete action exists in the API;
  don't add a delete button for one that isn't there.
- A legal-holds screen: list with an active/released filter (default to
  active-only, matching the "hide archived by default" convention used
  everywhere else), create form (entity type, optional entity id,
  reason), and a "Release" action on an active hold (confirms, calls
  the release endpoint, shows released-by/at once done).
- Wrap all actions in `<PermissionGate permission="audit.retention.manage">`.
- `docs/USER-GUIDE.md` M35 section: add this screen (create the section
  if ticket 0136/0137 haven't already).

## Acceptance
- [ ] Retention policies: list + create/edit (no delete — none exists
  in the API).
- [ ] Legal holds: list (active-only by default, with a toggle to show
  released), place, release.
- [ ] All actions gated by `audit.retention.manage` via
  `<PermissionGate>`.
- [ ] `docs/USER-GUIDE.md` M35 section covers both screens.
- [ ] Test: set a retention policy, place and release a legal hold,
  permission gate hides create/release without
  `audit.retention.manage`.

## Progress
