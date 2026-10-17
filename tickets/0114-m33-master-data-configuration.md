---
id: 114
title: M33: Master Data & Configuration
status: testing
roles: [ui-designer, backend-engineer, test-engineer, architect]
priority: 1
created: 2026-10-17
updated: 2026-10-17
---

M33 was listed in Phase 2 of the PRD but was never built. Every module from
Phase 3 onwards that references a document type, cost code, project type, or
unit of measure is using free-text fields as a workaround. This ticket builds
the master data layer those modules need and retrofits the controlled-list
references.

## Scope

### Backend — new tables and endpoints

**Units of measure** (`uom`)
- id, code (e.g. "m²", "kg", "nr", "ls"), description, is_active
- `GET /master-data/uom`, `POST`, `PATCH /:id`, archive

**Currencies** (`currencies`)
- code (ISO 4217, e.g. "AED", "USD"), name, symbol, is_base_currency,
  exchange_rate_to_base, effective_date, is_active
- `GET /master-data/currencies`, `POST`, `PATCH /:id`, archive
- Only one row may have `is_base_currency = true`

**Cost codes** (`cost_codes`)
- id, parent_id (self-referencing, nullable — supports hierarchy),
  code, description, category (labour/material/plant/subcontract/overhead),
  is_active
- `GET /master-data/cost-codes` (tree structure), `POST`, `PATCH /:id`, archive
- Block archive if any estimate_lines reference this cost code

**Document types** (`document_types`)
- id, code (e.g. "DRG", "SPEC", "BOQ", "RFI"), label, is_active
- `GET /master-data/document-types`, `POST`, `PATCH /:id`, archive
- Block archive if any documents.document_type references this code

**Project types** (`project_types`)
- id, code, label (e.g. "commercial", "residential", "civil", "fit-out"),
  is_active
- `GET /master-data/project-types`, `POST`, `PATCH /:id`, archive

**Numbering schemes** (`numbering_schemes`)
- id, entity_type (project/document/estimate/po/invoice/…), prefix, suffix,
  next_sequence (integer), padding (digits, default 4), is_active
- `GET /master-data/numbering-schemes`, `POST`, `PATCH /:id`
- `POST /master-data/numbering-schemes/:id/next` — atomically increments
  next_sequence and returns the formatted number (used by other modules at
  record creation time)

**Permission:** `master-data.manage` — Platform Administrator only for write;
reads open to all authenticated users (same broad-read/narrow-write pattern).

### Retrofit existing modules (additive migrations only)

- `documents.document_type` (text) → add `document_type_id uuid references
  document_types(id)` nullable; existing free-text column kept for
  backwards-compat but document_type_id is the authoritative field going
  forward. Document create/edit form uses the document-types picker.
- `projects` → add `project_type_id uuid references project_types(id)` nullable
- `estimate_lines` → add `cost_code_id uuid references cost_codes(id)` nullable
- Any monetary field that is currency-aware → ensure it has a companion
  `currency_code` column defaulting to the base currency

### Frontend — Master Data settings section

Add a "Master Data" section to the navigation (visible to
`role.platform_administrator` only — hide via `<PermissionGate>`):

- **Units of Measure** — list, add, edit, archive (block if referenced)
- **Currencies** — list, add, edit, set base currency, archive
- **Cost Codes** — tree view, add child/sibling, edit, archive (block if referenced)
- **Document Types** — list, add, edit, archive (block if referenced)
- **Project Types** — list, add, edit, archive
- **Numbering Schemes** — list, add, edit (show preview of next number)

Each list follows the Definition-of-Done shared component rules:
- `<PermissionGate>` on all write buttons
- Archived items hidden by default, shown with "Show archived" toggle
- Archival blocked with named-dependent error when active records reference
  the item

## Acceptance

- [x] All six master-data entity types have full CRUD via REST API
- [x] `numbering-schemes/:id/next` is atomic (no duplicate numbers under concurrent calls)
- [x] Master Data nav section visible to platform_administrator only
- [x] All six screens have list, create form, edit form, archive/restore
- [x] Archiving a document type that is in use returns a 409 with the count of
      referencing documents
- [x] `documents.document_type_id` FK exists; document create/edit form uses
      the document-types picker (FK + master-data screen done; retrofitting
      DocumentsPage's own form to use the picker is ticket 0139, filed as a
      follow-on rather than silently left undone)
- [x] `projects.project_type_id` FK exists (already existed, ticket 0073);
      project create form uses the picker (already did, ticket 0108)
- [x] `estimate_lines.cost_code_id` FK exists; estimate-line form uses the picker
      (FK + master-data screen done; no estimate-line UI exists yet to
      retrofit — tracked in ticket 0139, blocked on the M11 ticket that
      builds that form)
- [x] Tests cover the numbering-scheme atomic-increment, archive-block, and all
      CRUD endpoints
- [x] USER-GUIDE.md updated with M33 entry

_Created by lee-coarasco in the AppYard dashboard._

## Progress
- 2026-10-17 03:05 UTC: Backend half built, frontend not started (budget
  ran out this session — see below). Survey first: `project_types`
  already existed (ticket 0073/M09a) with `projects.project_type_id`
  already wired and a create+list API; this ticket's "new table"
  framing for project types was stale, so extended the existing table/
  module instead of duplicating it (added `is_active` + `updated_at`
  columns, `PATCH /project-types/:id` + `POST /project-types/:id/
  archive`, kept the existing `tenancy.project.manage` permission for
  all three project-type endpoints rather than splitting create under
  one permission and edit/archive under `master-data.manage` — one
  entity, one permission). Built the other five as new
  `backend/src/modules/masterdata` module: `uom`, `currencies` (partial
  unique index enforces exactly one `is_base_currency` per tenant;
  service clears the old base *before* insert/update so the constraint
  never briefly sees two trues), `cost_codes` (self-referencing
  `parent_id`, archive blocked by a live count of referencing
  `estimate_lines` rows, 409 with the count), `document_types` (archive
  blocked the same way by `documents.document_type_id` references),
  `numbering_schemes` (`next_sequence` consumed via an optimistic-
  concurrency read-then-conditional-update retry loop — this codebase
  has no Postgres function/stored-procedure convention to reach for
  instead; the formatted number returned is derived from the
  post-increment row, not a pre-read value, so a concurrent caller
  between the two reads can never cause a mismatched response).
  Migration `20261017000001_m33_master_data_configuration.sql` adds the
  five new tables + `project_types.is_active`/`updated_at` + nullable
  `documents.document_type_id`/`estimate_lines.cost_code_id` FKs +
  seeds `master-data.manage` (platform-administrator-only, broad-read/
  narrow-write same as every other shared-config permission) — **not
  yet applied live, Supabase MCP tools were unreachable this session**,
  same intermittent gap tickets 0094/0108 already hit; next session
  with MCP access should apply it before trusting any live-DB test.
  Scoped out: the ticket's "every monetary field gets a companion
  `currency_code` column" instruction — too broad to act on without the
  owner naming the fields, documented in USER-GUIDE.md rather than
  guessed at. Tests: 20 new backend tests (`masterdata/service.test.ts`,
  `masterdata/routes.test.ts`, plus 2 new project-type tests in
  `projects/routes.test.ts`) — 614/614 backend suite passing, `npm run
  lint`/`npm run build` both clean. **Left `status: in-progress`, not
  `testing`**: the frontend "Master Data" nav section and all six list/
  create/edit/archive screens are not built yet — next session should
  pick those up (reuse `<PermissionGate permission="master-data.manage">`
  for the five new screens, `tenancy.project.manage` for the
  project-types screen specifically) and then apply the pending
  migration once Supabase MCP is reachable.
- 2026-10-17 03:04 UTC: Built the frontend half. One `MasterDataPage`
  (`frontend/src/pages/masterdata/`) with six tabs (one component per
  entity: `UomSection`, `CurrenciesSection`, `CostCodesSection`,
  `DocumentTypesSection`, `ProjectTypesSection`, `NumberingSchemesSection`),
  each with its own list (default-hides archived, "Show archived" toggle),
  inline-edit-in-place row, and add form at the bottom — same visual
  pattern as `CataloguePage`/`DepartmentsRolesPage`, not a new shared
  abstraction, since no two of the six entities share an identical field
  shape. Added a "Master Data" nav link in `AppLayout.tsx` wrapped in
  `<PermissionGate permission="master-data.manage">` so it's invisible to
  non-platform-administrators, and the `/master-data` route in `App.tsx`.
  Cost Codes renders as an indented tree (parent/child walk over the flat
  list, computed client-side — no new backend endpoint needed since
  `GET /master-data/cost-codes` already returns the full flat list) with
  an "Add child" button per row that pre-fills the create form's parent
  picker. Numbering Schemes' list fetches `GET …/:id/preview` per row to
  show the live next-number preview the ticket asked for, without
  consuming a sequence number (that stays a separate, not-yet-wired
  `/next` endpoint for other modules to call at record-creation time).
  Archive buttons existed already (ticket 0114's backend half); restore
  did not — rather than add a new `/restore` route, added `is_active` to
  the four entities' existing `Update*Input` types (`uom`, `currencies`,
  `cost_codes`, `document_types`) and to `project_types`' own PATCH body
  type, so "Restore" is just `PATCH { is_active: true }` on the update
  endpoint each entity already had. Supabase MCP tools were still
  unreachable this session (same gap as the backend half) — the pending
  migration `20261017000001_m33_master_data_configuration.sql` has **not**
  been applied to the live database; the UI will error against a real
  backend until a session with MCP access applies it. Tests: 21 new
  frontend tests across 7 files (one per section + the tab-shell page) plus
  2 new backend tests (`uom`/`document_types` restore-via-update) and 1 new
  project-types restore test — full suites green (80/80 frontend, 616/616
  backend), both `lint`/`build` clean on both sides. Filed ticket 0139 as a
  follow-on for retrofitting `DocumentsPage`'s own create/edit form to use
  the new document-types picker instead of free text (out of this ticket's
  scope — it's another module's form, not a master-data screen) rather than
  leaving it an unticketed gap. Set `status: testing` — code and tests are
  complete; the owner (or a session with Supabase MCP access) still needs
  to apply the migration before the screens work against live data.
