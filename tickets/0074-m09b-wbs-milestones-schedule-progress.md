---
id: 74
title: "M09b — WBS, milestones, schedule activities, dependencies & progress"
status: testing
roles: [backend-engineer]
priority: 9
created: 2026-10-15
updated: 2026-10-16
---

Second of five M09 sub-tickets (see ticket 0073 and DECISIONS.md for
the split rationale). Depends on ticket 0073 (needs a real `projects`
row to attach a WBS to). Covers BRD §8.4 FR-PROJ-003 only. BRD §6.2
entities for this ticket: `WBSNode`, `Milestone`, `ScheduleActivity`,
`ProgressEntry`.

## What to build
- `wbs_nodes`: tenant-scoped, self-referencing tree
  (`parent_wbs_node_id`) under a `project_id`, with `code`, `name`,
  `sequence`. This is the structural breakdown only — no cost/budget
  fields here (M21/Finance owns cost codes; a WBS node may later be
  tagged with a `CostCode` once M21 exists — leave a nullable
  `cost_code_id` column with no FK target yet, documented as a seam,
  same pattern as other cross-module hand-offs in this project).
- `milestones`: tenant-scoped, `project_id`, optional
  `wbs_node_id`, `name`, `target_date`, `actual_date` (null until
  reached), `status`.
- `schedule_activities`: tenant-scoped, `project_id`,
  `wbs_node_id`, `name`, `planned_start`, `planned_end`,
  `actual_start`, `actual_end`, `percent_complete`. No critical-path
  computation in this ticket — BRD §8.4 only asks for
  "dependencies and planned/actual progress," not a scheduling
  engine; critical-path/resource-levelling is M18 (Schedule, Progress
  & Resource Planning), a later Phase 3+ module. Store dependency
  edges; do not compute float/critical path here.
- `schedule_activity_dependencies`: `activity_id`,
  `depends_on_activity_id`, `dependency_type` (`finish_to_start` etc.
  — keep to the minimum set BRD actually needs; do not invent a full
  PM-software dependency type enum).
- `progress_entries`: tenant-scoped, `schedule_activity_id`,
  `recorded_by`, `recorded_at`, `percent_complete`,
  `note`. Append-only (no update/delete policy) — a progress entry is
  a point-in-time fact, corrections are a new entry, same
  append-only convention as `workflow_events`.
- Routes/service/repository under
  `backend/src/modules/projects/` (same module as ticket 0073, new
  files: `wbs.ts`/`schedule.ts` or similar split — architect/
  backend-engineer picks the file boundary when building), gated on
  a permission (reuse `tenancy.project.manage` for WBS/milestone/
  activity CRUD; use a new `project.progress.record` permission for
  recording progress entries, since that's a distinct, more widely
  held action than managing the WBS structure).

## Out of scope
- Baseline change control — ticket 0075 (M09c).
- Issue/risk register — ticket 0076 (M09d).
- Health/forecast/closeout — ticket 0077 (M09e).
- Critical-path computation, resource histograms — M18, later.

## Acceptance
- [x] All five tables created, tenant-scoped with RLS,
      `progress_entries` append-only.
- [x] CRUD for WBS/milestones/activities; dependency edges can be
      added/removed; progress entries can be recorded and listed per
      activity.
- [x] Tests cover tenant isolation, permission gating, and that a
      `progress_entries` row cannot be mutated/deleted after
      creation (no update/delete route exists for it at all, and the
      migration has no update/delete RLS policy).
- [x] `docs/BRD.md` FR-PROJ-003 is satisfied.

## Progress
- 2026-10-15: Filed as the second of five M09 sub-tickets.
- 2026-10-16 01:15 UTC: Built. Migration
  `supabase/migrations/20261016000002_m09b_wbs_milestones_schedule_progress.sql`
  adds all five tables: `wbs_nodes` (self-referencing via
  `parent_wbs_node_id`, nullable `cost_code_id` with no FK target — the
  documented M21 seam), `milestones` (status `pending`/`achieved`/
  `missed`, `actual_date` null until reached), `schedule_activities`
  (`percent_complete` 0-100, no critical-path logic), `schedule_activity_dependencies`
  (`dependency_type` constrained to the four conventional PM edge
  types — `finish_to_start`/`start_to_start`/`finish_to_finish`/
  `start_to_finish` — chosen as the minimum vocabulary to express a
  dependency, not an invented extension; a check constraint blocks an
  activity depending on itself), and `progress_entries` (insert+select
  RLS policies only, no update/delete policy — genuinely append-only
  at the database level, not just by convention).
  Extended the existing `backend/src/modules/projects/` module's four
  files in place (types/repository/service/routes) rather than
  splitting into new `wbs.ts`/`schedule.ts` files — unlike the
  `workflow` module's validation/simulation/runtime split, none of
  this ticket's logic is complex pure business logic worth isolating,
  it's CRUD over five tables, so the existing `tenancy`/`workforce`
  single-file-per-concern layout was simpler to extend. New routes:
  `POST/GET /projects/:projectId/wbs-nodes`, `PATCH /wbs-nodes/:id`,
  the same shape for `/milestones`, `/schedule-activities`, plus
  `POST/GET/DELETE /schedule-activities/:activityId/dependencies[/:dependsOnActivityId]`
  and `POST/GET /schedule-activities/:activityId/progress`. WBS/
  milestone/activity/dependency routes reuse `tenancy.project.manage`;
  the new `project.progress.record` permission gates only the
  progress-entry routes, proven distinct in `wbs-schedule-progress.routes.test.ts`
  (a caller with only `tenancy.project.manage` gets 403 on
  `POST .../progress`; a caller with only `project.progress.record`
  gets 201 there despite having no WBS/schedule-activity management
  rights).
  Tests: `wbs-schedule-progress.test.ts` (8 service-level cases:
  WBS tree construction, tenant isolation on WBS update, milestone
  default-pending→achieved transition, schedule-activity default
  `percent_complete`, dependency add/list/remove, progress-entry
  accumulation — two entries never collapse into one — and tenant
  isolation on progress reads) and `wbs-schedule-progress.routes.test.ts`
  (7 HTTP-level cases covering the permission split above and basic
  CRUD round-trips). `npm run build && npm test`: 300/300 passing (was
  287 before this ticket). `scripts/tickets.py check`: clean. Ticket →
  `testing`.
  **Not done**: same recurring caveat as every ticket so far — no
  Supabase adapter has run against a real project in this sandbox (no
  reachable credentials); the migration and Supabase-backed repository
  methods were reviewed by hand against established conventions, not
  against a live database.
