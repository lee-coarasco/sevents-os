---
id: 74
title: "M09b — WBS, milestones, schedule activities, dependencies & progress"
status: next
roles: [backend-engineer]
priority: 9
created: 2026-10-15
updated: 2026-10-15
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
- [ ] All five tables created, tenant-scoped with RLS,
      `progress_entries` append-only.
- [ ] CRUD for WBS/milestones/activities; dependency edges can be
      added/removed; progress entries can be recorded and listed per
      activity.
- [ ] Tests cover tenant isolation, permission gating, and that a
      `progress_entries` row cannot be mutated/deleted after
      creation.
- [ ] `docs/BRD.md` FR-PROJ-003 is satisfied.

## Progress
- 2026-10-15: Filed as the second of five M09 sub-tickets.
