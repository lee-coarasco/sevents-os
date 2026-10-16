---
id: 73
title: "M09a — Project register & setup (extends M02 stub)"
status: testing
roles: [backend-engineer]
priority: 9
created: 2026-10-15
updated: 2026-10-16
---

First of five M09 sub-tickets (ticket 0067 split the same way ticket
0059/0065 were split — see DECISIONS.md). Covers BRD §8.4 FR-PROJ-001
and FR-PROJ-002 only.

Ticket 0055 (M02) already created a **stub** `public.projects` table
(`tenant_id`, `company_id`, `name`, `code`, `status`) gated on the
`tenancy.project.manage` permission, with the explicit comment "the
full Project/WBS/budget/milestone model is M09 — do not extend this
table here [in that migration]." This ticket is where that extension
happens. **Extend the existing `projects` table in place** (additive
migration, same table, same id/tenant_id/company_id columns kept) —
do not create a second parallel project table. Reuse the
`tenancy.project.manage` permission for project register CRUD; do not
invent a new permission for the same action.

## What to build
- Extend `public.projects` with the FR-PROJ-002 fields: client
  (`client_name` text for now — a real `Client` entity is M10/CRM,
  later Phase; do not build a Client table here), location
  (free-text address/geo fields, no country-specific format), a
  `project_type_id` referencing a new minimal `project_types` lookup
  table (tenant-scoped, admin-managed — just a name/code catalogue,
  not a workflow), contract reference (free-text contract
  number/value for now — the real `Contract` entity is M23, later
  Phase), `project_manager_id` referencing `app_users`, baseline start
  date, baseline end date, budget (amount + currency — no tax/VAT
  logic), and a document register pointer (reuse `file_objects`,
  already has a nullable `project_id` FK from ticket 0055 — no new
  table needed, just confirm/exercise that link from this module).
- `POST /projects`, `GET /projects`, `GET /projects/:id`,
  `PATCH /projects/:id` routes, gated on `tenancy.project.manage`
  (reuse, per above) with tenant_id/company_id scoping identical to
  the rest of the tenancy module.
- FR-PROJ-001: project creation is "authorized manual entry" only in
  this ticket (gated on `tenancy.project.manage`) — there is no
  opportunity/contract-award trigger yet (M10/M11 are later Phase 4
  modules per `docs/PRD.md`). Document this as an explicit seam
  (comment in types.ts/service.ts, same pattern as ticket 0062's
  `workflow_step_instances.assigned_to` doc comment describing the
  M07/M08 hand-off): when M10/M11 exist, an approved
  opportunity/contract-award event will call the same
  `createProject()` service function that the manual-entry route
  calls today — do not build a second code path for it now.
- Follow the existing module file layout exactly:
  `backend/src/modules/projects/{types,repository,service,routes}.ts`
  + colocated `*.test.ts` (look at `backend/src/modules/tenancy/` for
  the pattern this project already uses for a sibling M02 module).

## Out of scope (future M09 sub-tickets, don't build here)
- WBS/milestones/activities/dependencies/progress — ticket 0074 (M09b).
- Baseline change control/approval — ticket 0075 (M09c).
- Issue/risk/decision/assumption/dependency/change-request register —
  ticket 0076 (M09d).
- Health score, forecast-vs-baseline, closeout checklist — ticket
  0077 (M09e).

## Acceptance
- [x] Migration extends `public.projects` additively (new nullable or
      defaulted columns only — no existing column dropped/renamed, no
      new parallel project table), adds `project_types` lookup table,
      both tenant-scoped with RLS.
- [x] `createProject`/`listProjects`/`getProject`/`updateProject`
      service functions + matching routes, gated on
      `tenancy.project.manage`.
- [x] The FR-PROJ-001 manual-entry-vs-future-workflow-trigger seam is
      documented in code (doc comment), not just in this ticket file.
- [x] Tests cover: extended field CRUD, tenant isolation (cross-tenant
      project is not visible/editable), permission denial for a
      caller without `tenancy.project.manage`.
- [x] `docs/BRD.md` FR-PROJ-001 and FR-PROJ-002 are satisfied.

## Progress
- 2026-10-15: Filed as the first of five M09 sub-tickets (parent
  ticket 0067 closed, split per the M06/M07 precedent — see
  DECISIONS.md entry timestamped 2026-10-15 21:2x UTC).
- 2026-10-16 01:10 UTC: Built. Migration
  `supabase/migrations/20261016000001_m09a_project_register_and_setup.sql`
  extends `public.projects` in place with the FR-PROJ-002 fields
  (`client_name`, `location`, `project_type_id`, `contract_reference`/
  `contract_value`/`contract_currency`, `project_manager_id`,
  `baseline_start_date`/`baseline_end_date`, `budget_amount`/
  `budget_currency`) and adds a tenant-scoped `project_types` lookup
  table — no new parallel project table. New
  `backend/src/modules/projects/` module (types/repository/service/
  routes, same four-file layout as `tenancy`/`workforce`), reusing the
  `tenancy.project.manage` permission for all CRUD. `createProject`
  has a doc comment recording the FR-PROJ-001 seam: it is today's only
  creation path, and a future M10/M11 approved-event handler should
  call the same function rather than add a second path.
  **Retired the old minimal Project CRUD from the `tenancy` module**
  (`createProject`/`listProjects`/`getProject` and the
  `POST`/`GET /tenancy/projects` routes) rather than leaving two
  overlapping APIs over the same table — grep confirmed no other
  module called into those three functions, so this was a safe
  removal, not a breaking change to a real consumer. `FakeTenancyRepository`
  and its tests were trimmed to match; a new `FakeProjectsRepository`
  backs the new module's tests.
  Tests: `backend/src/modules/projects/service.test.ts` (6 cases:
  extended-field create, update-only-supplied-fields, tenant isolation
  on get/list/update, 404 on nonexistent id) and `routes.test.ts` (10
  cases: create/update/list/get at HTTP level, 403 without
  `tenancy.project.manage`, 401 with no token, 400 on missing required
  fields, cross-tenant 404 on GET and PATCH, project-types create/list/403).
  `npm install && npm run build && npm test`: 287/287 passing (was 274
  before this ticket — net +13, since 3 tenancy-module project tests
  were removed and their coverage was superseded by the new module's
  broader suite). `scripts/tickets.py check`: clean. Ticket → `testing`.
  **Not done**: same recurring caveat as every ticket so far — no
  Supabase adapter has run against a real project in this sandbox (no
  reachable credentials); the migration and Supabase-backed repository
  were reviewed by hand against the established `tenancy`/`workforce`
  conventions, not against a live database.
