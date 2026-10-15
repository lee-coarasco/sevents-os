---
id: 73
title: "M09a — Project register & setup (extends M02 stub)"
status: next
roles: [backend-engineer]
priority: 9
created: 2026-10-15
updated: 2026-10-15
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
- [ ] Migration extends `public.projects` additively (new nullable or
      defaulted columns only — no existing column dropped/renamed, no
      new parallel project table), adds `project_types` lookup table,
      both tenant-scoped with RLS.
- [ ] `createProject`/`listProjects`/`getProject`/`updateProject`
      service functions + matching routes, gated on
      `tenancy.project.manage`.
- [ ] The FR-PROJ-001 manual-entry-vs-future-workflow-trigger seam is
      documented in code (doc comment), not just in this ticket file.
- [ ] Tests cover: extended field CRUD, tenant isolation (cross-tenant
      project is not visible/editable), permission denial for a
      caller without `tenancy.project.manage`.
- [ ] `docs/BRD.md` FR-PROJ-001 and FR-PROJ-002 are satisfied.

## Progress
- 2026-10-15: Filed as the first of five M09 sub-tickets (parent
  ticket 0067 closed, split per the M06/M07 precedent — see
  DECISIONS.md entry timestamped 2026-10-15 21:2x UTC).
