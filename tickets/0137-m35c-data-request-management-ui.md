---
id: 137
title: M35c — Data request management UI
status: next
roles: [ui-designer, test-engineer]
priority: 2
created: 2026-10-17
updated: 2026-10-17
---

Split out of ticket 0112 (see ticket 0136 and DECISIONS.md for the split
rationale). Second of the three bullets.

Backend is fully built (ticket 0080, `status: testing`), no backend work
needed:
- `POST /data-requests` — starts an approval workflow (caller names a
  published workflow definition, same "no automatic resolution"
  convention used by every other approval seam in this codebase).
  Body: `request_type` (`export`|`deletion`), `entity_type`,
  `entity_id`, `reason`, `workflow_definition_id`.
- `GET /data-requests` — list all.
- `GET /data-requests/:id` — poll for resolution (reads the linked
  workflow instance's decision; once approved, export bundles the
  entity + role assignments + audit entries, or deletion anonymizes
  in-place).
- Permission: `data.request.manage` (deny-by-default, platform-
  administrator only).
- Deletion is scoped to `app_users` only (owner-approved 2026-10-16); an
  active legal hold on the entity blocks deletion with a 409 — surface
  that error message as-is, don't reword it.

## What to build
- A new page (e.g. `/data-requests`) listing requests: type, entity
  type/id (resolve to a human label where the entity type is known,
  e.g. a user — fall back to the raw id only if no lookup exists),
  status, requested-at, resolved-at.
- "New request" form: request type, entity type, entity picker (user
  picker when entity_type is `app_users` — that's the only type
  deletion supports today, so make that the obvious/default path),
  reason, and the same published-workflow-definition `<select>` already
  used by every other approval seam (`GET /workflow/definitions/
  published`) — no new picker endpoint needed.
- Detail view: current status, and once resolved — the export bundle
  (rendered readably, not a raw JSON dump if avoidable) or the
  deletion result.
- Wrap all actions in `<PermissionGate permission="data.request.manage">`.
- `docs/USER-GUIDE.md` M35 section: add this screen (ticket 0136 adds
  the section itself if it lands first; if this ticket lands first,
  create the section instead of waiting).

## Acceptance
- [ ] List + create + detail screens for data requests, as above.
- [ ] Create form uses existing pickers (user picker for entity, the
  published-workflow-definition select) — no raw UUID text boxes.
- [ ] A blocked deletion (active legal hold) shows the backend's 409
  message clearly, not a generic error.
- [ ] All actions gated by `data.request.manage` via `<PermissionGate>`.
- [ ] `docs/USER-GUIDE.md` M35 section covers this screen.
- [ ] Test: create a request, poll/see its status, permission gate
  hides the create action without `data.request.manage`.

## Progress
