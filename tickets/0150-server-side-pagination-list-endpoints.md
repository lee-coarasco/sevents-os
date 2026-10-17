---
id: 150
title: Server-side pagination for all major list endpoints
module: cross-cutting
status: next
priority: 2
created: 2026-10-17
updated: 2026-10-17
depends_on: []
roles: [backend-engineer, ui-designer]
---

## Goal
Every list endpoint that could return more than ~50 rows must support cursor- or
offset-based pagination so the frontend never fetches the entire table on page load.

## Background
Several list endpoints currently return every row (no LIMIT/OFFSET). As data
grows this will cause slow queries, large JSON payloads, and browser freezes.
The catalogue endpoint already hit this: `GET /catalogue/items` was returning
all 1,308 rows until a hot-fix (commit `2e91b47`) capped it at 100.

## Endpoints to update
Priority-1 (already known to be problematic):
- `GET /catalogue/items` — already capped at 100, needs proper cursor pagination + total count
- `GET /employees` — can grow large for big tenants
- `GET /projects` — medium risk
- `GET /documents` — medium risk

Priority-2 (smaller but should be consistent):
- `GET /tasks` (my-work inbox)
- `GET /approvals` (approval queue)
- `GET /notifications`
- `GET /admin/users`

## Pagination contract (apply uniformly)
```
GET /endpoint?limit=50&cursor=<opaque_base64_cursor>
→ { items: [...], nextCursor: "<base64>" | null, total: <int> }
```
- `limit` defaults to 50, max 200
- `cursor` is opaque (base64 of `{ id, createdAt }`) — never expose raw SQL offsets
- `total` is a COUNT(*) with the same WHERE filters applied
- Frontend pages get total count so they can show "Showing X of Y"

## Acceptance criteria
- [ ] All priority-1 endpoints updated with cursor pagination
- [ ] All priority-2 endpoints updated
- [ ] Frontend list components updated to show pagination controls and load next page
- [ ] CataloguePage shows page controls (previous/next or infinite scroll)
- [ ] Tests updated: each paginated endpoint has a test for `?limit=2&cursor=<...>` returning the right slice

## Notes
- Do not break existing callers — the `nextCursor` field is additive; if `cursor` is absent return from the start.
- The catalogue endpoint `GET /catalogue/items` already passes `search`, `department`, `disposition`, `status`, `includeArchived` filters — pagination must compose with all of them.

## Progress
(not started)
