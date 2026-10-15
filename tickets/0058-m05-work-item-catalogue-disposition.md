---
id: 58
title: "M05 — Work-Item Catalogue & Disposition"
status: testing
roles: [backend-engineer]
priority: 1
created: 2026-10-15
updated: 2026-10-15
---

Phase 1 (M01-M03) is code-complete (tickets 0053-0056, all `status: testing`).
This is the first Phase 2 module per CLAUDE.md's build order: import the
1,308-row source catalogue as real data, preserve its provenance, and store
the normalized classification (role mapping, disposition, status, etc.)
that tickets 0001-0051 already produced in `docs/catalogue/disposition-workbook.csv`.
This does NOT build the configuration studio or workflow engine itself
(triggers, forms, SLA calendars, simulation) — that is M06, a separate
ticket, and depends on this one.

Reference: BRD §6.2 (SourceCatalogue/SourceWorkItem/WorkItemDefinition/
WorkItemVersion entities), §6.3 (source-of-truth/provenance rules), §6.4
(work-item operational contract fields), §6.5 (7-value disposition
taxonomy), §8.2 (FR-WI-001 through FR-WI-013, the M05-relevant subset).

## What to build

1. **Migration** `supabase/migrations/..._m05_work_item_catalogue.sql`:
   - `source_catalogue_imports` — one row per import run (file name,
     checksum, row count, who ran it, when). Audit/idempotency anchor.
   - `source_work_items` — immutable raw snapshot per source row:
     `source_serial` (S.No., 1-1308, unique), `department`,
     `work_item_name`, `who_is_responsible`, `description`, `trigger_text`,
     `action_text`, `output_evidence`, `control_handoff`,
     `continuity_escalation`, `timing`, `governance_understanding`,
     `governance_sop_inputs` — these map 1:1 to columns in the source
     xlsx's "Source Catalogue" sheet (see `docs/catalogue/README.md`).
     Never overwritten by normalization.
   - `work_item_definitions` — the normalized record: `canonical_role_id`
     (FK to `role_definitions`), `department_cluster` (denormalized from
     the role), `disposition` (BRD §6.5's 7 values, check constraint),
     `status` (draft/under_review/approved/published/retired, FR-WI-006),
     `priority`, `risk_tier`, `phase_target` (all nullable — do not invent
     values, `TBD` until a process owner sets them), `capability_key` and
     `workflow_template_id` (nullable placeholders for M06 to wire up —
     no capability catalogue or workflow_definitions table exists yet),
     `ticket_ref` (which of tickets 0001-0051 classified this row),
     `current_version`.
   - `work_item_definition_versions` — append-only snapshot per version
     (FR-WI-007: published changes are versioned, not destructive).
   - Follow the M03 precedent recorded in DECISIONS.md
     (2026-10-15 "RoleDefinition/Permission catalogue is platform-wide"):
     this catalogue is a shared taxonomy like `role_definitions`, not
     per-tenant business data. Use nullable `tenant_id` on all four
     tables. `source_work_items` and the import-job table are
     insert-only via service-role (no authenticated insert/update/delete
     policy — same as `role_definitions`). `work_item_definitions` gets
     an authenticated UPDATE policy (process owners edit disposition/
     priority/etc. through the app) but no authenticated INSERT (only the
     bulk import creates rows). `work_item_definition_versions` gets an
     authenticated INSERT (created alongside an authenticated update) and
     no update/delete.
   - Add two new permissions: `catalogue.workitem.import`,
     `catalogue.workitem.manage`. Grant both to `role.platform_administrator`
     only, same deny-by-default pattern as the M03 seed.

2. **Backend module** `backend/src/modules/catalogue/` following the
   exact file layout of `identity`/`tenancy`/`authority`
   (`types.ts`, `repository.ts` [port + Supabase adapter], `service.ts`,
   `routes.ts`, plus `*.test.ts` for each and `importParser.ts` for the
   pure merge logic):
   - `importParser.ts`: pure functions merging a raw catalogue row array
     (shape = the xlsx's "Source Catalogue" sheet headers, see
     `docs/catalogue/README.md`) with the disposition-workbook rows
     (`s_no, department, who_is_responsible, canonical_role_id,
     disposition, ticket_id, review_needed`) by `s_no`/`S.No.`. No network
     or filesystem access in this file — keep it unit-testable with small
     fixtures.
   - `service.importCatalogue(rawRows, dispositionRows, importedBy)` —
     idempotent (re-running with the same rows updates nothing if
     unchanged; a changed raw row still never gets silently overwritten —
     raw rows are append/upsert-by-serial since they're a verbatim mirror
     of the source file, not a judgment call).
   - `service.listWorkItems(accessToken, filters)` — filters: department,
     canonicalRoleId, disposition, status, riskTier, missingData (true =
     priority/risk_tier/phase_target/capability_key all still null),
     search text (work_item_name/description), sourceSerial. (FR-WI-013.)
   - `service.getWorkItem(accessToken, id)` — definition + raw source
     fields + version history.
   - `service.updateWorkItem(accessToken, id, patch, updatedBy)` —
     validates disposition is one of the 7 BRD values if changed, bumps
     `current_version`, appends a `work_item_definition_versions` row with
     a full snapshot (FR-WI-007).
   - Routes: `GET /catalogue/work-items` (permission
     `catalogue.workitem.manage` OR a new read-only permission — decide
     and record which; a process-owner-facing list screen needs read
     access without edit rights eventually, but do not invent a
     read-permission grant to roles beyond platform_administrator yet,
     same deny-by-default precedent as M03), `GET
     /catalogue/work-items/:id`, `PATCH /catalogue/work-items/:id`
     (`catalogue.workitem.manage`).
   - Deliberately **no** `POST /catalogue/import` HTTP route: 1,308 rows
     of JSON over an HTTP body with no file-upload UI yet is not a
     realistic admin workflow at this phase. Instead add a CLI script
     `backend/src/scripts/import-catalogue.ts` (run via `tsx`, add an
     `npm run import:catalogue` script) that reads
     `docs/catalogue/source-catalogue.json` (regenerate first via
     `python3 scripts/xlsx_to_json.py` if missing — it's gitignored,
     5.5MB, fully regenerable) and `docs/catalogue/disposition-workbook.csv`
     from disk, and calls `service.importCatalogue` directly using the
     service-role client. This is the same "admin operation via
     service-role, not self-service API" precedent as M02's tenant
     creation and M03's first role assignment (see DECISIONS.md).
   - Wire the new module into `backend/src/app.ts` exactly like
     `tenancyRoutes`/`identityRoutes` (receives `requirePermission` from
     the shared authority guard, no separate guard.ts needed).

3. Tests: `importParser.test.ts` (small fixture merge, including a
   missing-disposition-row case and a duplicate-serial case),
   `service.test.ts` against a `FakeCatalogueRepository` (idempotent
   re-import, version bump on update, filter correctness, disposition
   validation rejecting an invalid value), `routes.test.ts` (401/403/200
   coverage for the three HTTP routes, same shape as
   `tenancy/routes.test.ts`).

## Explicitly out of scope (M06, separate ticket)

- Workflow templates, triggers, forms, SLA calendars, approval gates,
  simulation/validation-before-publish, publish/rollback. M05 only
  stores the placeholder `workflow_template_id`/`capability_key` columns
  for M06 to populate later.
- A real `role.cro` / "Process Admin" persona grant for
  `catalogue.workitem.manage` — deny-by-default like every other M03
  role until an explicit admin grant exists.

## Acceptance
- [x] Migration applies cleanly (reviewed by eye; no live Supabase in this
      sandbox — same recurring caveat as every Phase 1 ticket).
- [x] `backend/src/modules/catalogue/` built per the layout above.
- [x] CLI import script works against a fixture-sized sample (unit test,
      not the full 1,308 rows, since no live Supabase project is
      reachable in this sandbox). Also manually ran the parser/merge
      logic (not the live-Supabase write path) against the real,
      regenerated `source-catalogue.json` + `disposition-workbook.csv`:
      all 1,308 rows merge with **zero** issues, confirming the real
      data is import-ready once a live Supabase project is reachable.
- [x] `npm test` passes (88/88), `npm run build` clean,
      `scripts/tickets.py check` clean.

## Progress
- 2026-10-15 13:ish UTC: Filed and started. Phase 1 (0053-0056) confirmed
  code-complete and in `testing`. Researched BRD §6.2-6.5/§8.2, the actual
  xlsx "Source Catalogue" sheet's 36 columns (regenerated
  `docs/catalogue/source-catalogue.json` locally via
  `python3 scripts/xlsx_to_json.py` to inspect — confirmed the
  "Normalized Department ID"/"Normalized Role ID"/"Disposition"/etc.
  columns are blank in the raw workbook, i.e. they are what this module's
  import/normalize step is meant to fill from
  `docs/catalogue/disposition-workbook.csv`, not pre-existing source
  data), and the existing M01-M03 backend module conventions
  (`identity`/`tenancy`/`authority`) to match file layout, RLS pattern and
  test style exactly.
- 2026-10-15 ~13:30 UTC: Built and committed. Migration
  `supabase/migrations/20261015000004_m05_work_item_catalogue.sql`:
  `source_catalogue_imports`, `source_work_items`, `work_item_definitions`,
  `work_item_definition_versions` + two new permissions
  (`catalogue.workitem.import`, `catalogue.workitem.manage`), granted only
  to `role.platform_administrator` (same deny-by-default precedent as
  ticket 0056). Backend `backend/src/modules/catalogue/`: `types.ts`,
  `csv.ts` (tiny dependency-free CSV parser, unit tested), `importParser.ts`
  (pure raw+disposition merge by S.No., unit tested including
  missing-row and invalid-disposition cases), `repository.ts` (port +
  Supabase adapter — import always via service client since the two raw
  tables have no authenticated write policy, same as `role_definitions`;
  reads/updates via the user-scoped client like every other module),
  `service.ts` (`importCatalogue`, `listWorkItems`, `getWorkItem`,
  `updateWorkItem` — the last bumps `current_version` and appends a
  `work_item_definition_versions` row per FR-WI-007), `routes.ts` (`GET
  /catalogue/work-items`, `GET /catalogue/work-items/:id`, `PATCH
  /catalogue/work-items/:id`, all gated on `catalogue.workitem.manage`
  via the shared authority guard). CLI
  `backend/src/scripts/import-catalogue.ts` (`npm run import:catalogue`)
  reads `docs/catalogue/source-catalogue.json` +
  `disposition-workbook.csv` from disk and calls the service with the
  service-role client — deliberately no HTTP import route (see "What to
  build" above for why). 29 new tests (`csv.test.ts`,
  `importParser.test.ts`, `service.test.ts` against
  `FakeCatalogueRepository`, `routes.test.ts`); `npm test` 88/88, `npm
  run build` clean. Manually regenerated `docs/catalogue/source-catalogue.json`
  (`python3 scripts/xlsx_to_json.py`) and ran the merge logic against the
  real 1,308-row file + the committed disposition workbook: 1,308/1,308
  merge with 0 issues — the real data is ready to import once a live
  Supabase project is reachable (same recurring gap as every ticket so
  far: no Supabase adapter has run against a real project in this
  sandbox). Set to `status: testing`. Ticket 0059 (M06) can now start.
