---
id: 126
title: M05 — Catalogue item creation + bulk CSV import/export over HTTP
status: next
roles: [backend-engineer, ui-designer, architect]
priority: 2
created: 2026-10-16
updated: 2026-10-16
---

Split out of ticket 0110 (see ticket 0125 and DECISIONS.md for the
survey that produced this split). Covers the two M05 UI asks that
ticket 0125 could not build on the existing backend:

1. **Add a new catalogue item** from the UI. Today
  `work_item_definitions.source_work_item_id` is a required FK and
  there's no authenticated INSERT policy on either `source_work_items`
  or `work_item_definitions` (ticket 0058's decision: import is a
  trusted service-role CLI script, not a self-service API — the
  1,308-row catalogue is a shared taxonomy, not per-tenant data). A
  "create new item" action needs a design decision: does it insert a
  synthetic `source_work_items` row (source_serial = next available,
  marked as operator-added rather than xlsx-derived) alongside the new
  `work_item_definitions` row? Does it need its own narrower INSERT RLS
  policy gated on `catalogue.workitem.manage`, separate from the
  service-role-only import path? Architect should decide before backend
  work starts — this changes the table's trust model, which ticket 0058
  deliberately locked down.
2. **Bulk import via CSV** and **export to CSV** as real HTTP endpoints
  (today: only `npm run import:catalogue`, a local script with no HTTP
  surface). Needs: an authenticated endpoint that accepts the same
  CSV shape `scripts/import-catalogue.ts` already parses, reuses
  `mergeCatalogueRows`/`importParser.ts`, and returns the same
  `created`/`updated`/`unchanged` summary the CLI script shows,  gated
  on `catalogue.workitem.manage`. Export is simpler — a GET that
  serializes the current `work_item_definitions` (+ joined source
  fields) back to CSV; `catalogue/csv.ts` only has a parser today, needs
  a serializer.

## Acceptance
- [ ] Decision recorded in DECISIONS.md: how a UI-created item gets a
  `source_work_item_id` (synthetic source row vs. schema change), and
  what permission model governs it.
- [ ] `POST /catalogue/work-items` (or equivalent) creates a new item
  through the normal authenticated/RLS path, gated on
  `catalogue.workitem.manage`.
- [ ] `POST /catalogue/work-items/import` accepts a CSV upload/body in
  the same shape the CLI script consumes, dedupes/upserts the same way,
  returns a summary.
- [ ] `GET /catalogue/work-items/export` streams/returns a CSV of the
  current catalogue (respecting the same filters as the list endpoint).
- [ ] Frontend: "Add item" button/form, "Bulk import" (CSV file picker
  + summary result), "Export" button on the catalogue admin page built
  in ticket 0125.
- [ ] Tests for all three new endpoints.

## Progress
