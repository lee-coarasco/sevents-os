---
id: 125
title: M05 — Work-Item Catalogue admin UI (browse/search/filter/edit/archive)
status: testing
roles: [ui-designer, backend-engineer, test-engineer]
priority: 1
created: 2026-10-16
updated: 2026-10-17
---

Split out of ticket 0110 (too large for one ticket, same pattern as every
other oversized module ticket — see DECISIONS.md). This sub-ticket is the
part buildable entirely on the existing `catalogue` module backend
(ticket 0058): browse, keyword search, filter, edit, archive/retire.

Survey findings that shaped this split (see DECISIONS.md entry):
- `GET /catalogue/work-items` only returns `work_item_definitions` rows
  (disposition/status/priority/risk_tier/...) — no item name or
  description, which live on the joined `source_work_items` row. A
  browse screen needs those to be usable at all, so this ticket adds a
  joined summary shape to the list endpoint.
- `WorkItemFilters.search` was declared in the type but never wired to
  the route, repository query, or in-memory filter fake — dead code.
  This ticket wires it to search `work_item_name`/`description`.
- "Archive/retire" needs no new endpoint — `status` already includes
  `retired` in `WORK_ITEM_STATUSES`, so retiring is just
  `PATCH /catalogue/work-items/:id { status: "retired" }` through the
  existing update endpoint.
- "Add a new catalogue item" and "bulk import/export via CSV" are
  **out of scope here** — `work_item_definitions.source_work_item_id` is
  a required FK to a source row, and there is no authenticated INSERT
  path for either table (ticket 0058's decision: import is a
  service-role CLI script). Giving operators a way to add a brand new
  item or re-import a CSV through the UI needs real backend design
  (what creates the source row? what does re-import conflict
  resolution do through an API instead of a trusted script?). Filed as
  ticket 0126.

## Acceptance
- [x] `GET /catalogue/work-items` returns enough fields (item name,
  description, department, who's responsible) to render a usable list
  without an N+1 detail fetch per row.
- [x] `search` query param does a case-insensitive substring match
  against item name + description.
- [x] Frontend: Catalogue admin page — search box, disposition/module/
  status filters, results table, link to an edit view.
- [x] Edit form covers every `UpdateWorkItemFields` field (disposition,
  status, priority, risk_tier, phase_target, capability_key,
  workflow_template_id) plus an optional change note; submit goes
  through the existing PATCH endpoint and bumps the version (already
  server-side).
- [x] "Retire" action sets status to `retired` through the same PATCH
  endpoint; retired items are hidden from the default list view and
  shown under a "Show archived" filter toggle.
- [x] All write actions wrapped in `<PermissionGate permission="catalogue.workitem.manage">`.
- [x] Nav link added to `AppLayout`.
- [x] Tests: backend (repository/service/routes for search + summary
  join), frontend page test.
- [x] `docs/USER-GUIDE.md` M05 entry updated.

## Progress
- 2026-10-16 23:10 UTC: backend half done and committed (5c22fcf):
  `GET /catalogue/work-items` now returns a `WorkItemSummary` (joined
  `work_item_name`/`description`/`who_is_responsible`/`source_department`
  alongside the definition fields) instead of a bare
  `work_item_definitions` row, and the `search` querystring param
  (previously declared in `WorkItemFilters` but never wired anywhere)
  now does a case-insensitive substring match against name+description.
  Updated `FakeCatalogueRepository` to match so existing tests still
  pass conceptually (`.id`/array-length assertions are unaffected by
  the superset shape) — **not actually run this session**: this
  sandbox had no `node_modules` installed and running `npm install`
  would have pushed past this session's budget cap, so `npm test`/
  `npm run lint` in `backend/` have not been executed against this
  change. Next session: run `npm install && npm run lint && npm test`
  in `backend/` first and fix anything that surfaces before touching
  the frontend.
  Still to build (frontend, this ticket's actual UI deliverable): the
  Catalogue admin page itself (search box, disposition/module/status
  filters, results table, edit form for all `UpdateWorkItemFields`,
  retire action via `PATCH status=retired`, "show archived" toggle,
  `<PermissionGate permission="catalogue.workitem.manage">` on writes,
  nav link in `AppLayout`), a frontend test for it, and the
  `docs/USER-GUIDE.md` M05 entry update. None of that frontend work has
  started yet.
- 2026-10-17 00:36 UTC: backend verified first — ran `npm install && npm
  run lint && npm test` in `backend/` (594/594 tests, clean tsc) against
  last session's uncommitted-but-already-pushed search/summary-join
  change; no fixes needed. Built the frontend half:
  `frontend/src/pages/CataloguePage.tsx` (search box debounced 300ms,
  department/disposition/status filters, results table, retired items
  hidden unless "Show archived" is ticked, Edit panel covering every
  `UpdateWorkItemFields` field + change note, Retire action), nav link
  in `AppLayout`, route in `App.tsx`. The `workflow_template_id` field
  uses a `<select>` populated from the existing permission-light `GET
  /workflow/definitions/published` endpoint rather than a free-text id
  box, per CLAUDE.md's "no raw UUIDs" rule — found that endpoint already
  existed (built for M11's own picker need) rather than adding a new one.
  `capability_key` stayed a free-text input: it's a descriptive key
  matched against workflow definitions, not a foreign key to a specific
  row, so there's nothing to pick from.
  Also built `frontend/src/components/PermissionGate.tsx` — no module
  before this one had actually built the shared `<PermissionGate>`
  component CLAUDE.md's component table requires (every prior page just
  calls `has(...)` inline); this ticket's acceptance explicitly asks for
  it wrapping writes, so built it now per the "build it once" shared-
  component rule rather than deferring again. Did not retrofit the
  ~8 existing pages that use the inline `has()` pattern — out of this
  ticket's scope, no regression risk, flagged here for awareness only.
  Tests: `frontend/src/pages/CataloguePage.test.tsx` (5 cases — default
  list hides retired, show-archived toggle, debounced search re-fetch,
  edit+save PATCH, permission-gated actions hidden). Full suites green:
  backend 594/594, frontend 56/56 (14 files), `npm run build` (tsc +
  vite) succeeds on both. `docs/USER-GUIDE.md` M05 entry updated to
  describe the actual screen. Ticket 0125 is now fully built — moving to
  `status: testing`.
