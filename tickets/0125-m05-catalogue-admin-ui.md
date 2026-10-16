---
id: 125
title: M05 — Work-Item Catalogue admin UI (browse/search/filter/edit/archive)
status: in-progress
roles: [ui-designer, backend-engineer, test-engineer]
priority: 1
created: 2026-10-16
updated: 2026-10-16
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
- [ ] `GET /catalogue/work-items` returns enough fields (item name,
  description, department, who's responsible) to render a usable list
  without an N+1 detail fetch per row.
- [ ] `search` query param does a case-insensitive substring match
  against item name + description.
- [ ] Frontend: Catalogue admin page — search box, disposition/module/
  status filters, results table, link to an edit view.
- [ ] Edit form covers every `UpdateWorkItemFields` field (disposition,
  status, priority, risk_tier, phase_target, capability_key,
  workflow_template_id) plus an optional change note; submit goes
  through the existing PATCH endpoint and bumps the version (already
  server-side).
- [ ] "Retire" action sets status to `retired` through the same PATCH
  endpoint; retired items are hidden from the default list view and
  shown under a "Show archived" filter toggle.
- [ ] All write actions wrapped in `<PermissionGate permission="catalogue.workitem.manage">`.
- [ ] Nav link added to `AppLayout`.
- [ ] Tests: backend (repository/service/routes for search + summary
  join), frontend page test.
- [ ] `docs/USER-GUIDE.md` M05 entry updated.

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
