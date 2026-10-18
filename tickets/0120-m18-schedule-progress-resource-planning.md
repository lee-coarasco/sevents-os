---
id: 120
title: M18: Schedule, Progress & Resource Planning
status: done
roles: [ui-designer, backend-engineer, test-engineer, architect]
priority: 1
created: 2026-10-17
updated: 2026-10-18
---

M18 has never been started. It depends on M09 (projects, WBS, activities).
M09 already has a `schedule_activities` table with planned/actual dates and
dependencies — M18 extends this with the full scheduling engine.

## What the PRD says M18 builds
"Baseline schedule, WBS, planned vs actual, critical path, lookahead plans,
delay reasons"

## Scope (architect to refine into sub-tickets)

**M18a — Baseline schedule management**
- M09 already has `project_baselines` (ticket 0075). M18a exposes a Gantt-style
  view of the baseline vs actual progress
- Backend: `GET /projects/:id/schedule/gantt` — returns activities ordered by
  WBS with planned start/end, actual start/end, dependencies, and
  float/critical-path flag
- Frontend: Gantt chart component rendered in the project detail Schedule tab
- Baseline vs actual toggle: show baseline bars and actual bars side by side

**M18b — Progress updates**
- `progress_entries` table: activity_id, reported_date, percent_complete,
  reported_by, notes
- Backend: `POST /schedule-activities/:activityId/progress`
- Frontend: progress update form on each Gantt bar (click → drawer with
  % slider + notes)

**M18c — Lookahead plans**
- `lookahead_plans` table: project_id, period_start, period_end, created_by,
  created_at; with child `lookahead_activities` (activity_id, planned_action,
  owner_id, target_date)
- 2-week / 4-week lookahead views
- Backend: full CRUD API
- Frontend: lookahead plan list per project, create and edit plans

**M18d — Delay reasons and variance reports**
- `delay_records` table: activity_id, delay_days, reason_category
  (design/procurement/weather/subcontractor/client/other), description,
  recorded_by, recorded_at
- Backend: `GET /projects/:id/schedule/variance` — summary of total float
  consumed, activities with delays, delay breakdown by category
- Frontend: delay register tab per project, variance summary card on the
  project dashboard

## Acceptance (architect defines sub-ticket-level criteria)

- [x] Gantt chart renders baseline vs actual for a project with activities
- [x] Progress % update persists and refreshes the Gantt view
- [x] Lookahead plan create/edit/view works
- [x] Delay register create and variance summary work
- [x] Critical-path activities are visually distinct on the Gantt
- [x] All screens follow Definition of Done checklist in CLAUDE.md
- [x] USER-GUIDE.md M18 entry written

_Created by lee-coarasco in the AppYard dashboard._

## Progress

- Built database migration `supabase/migrations/20261018000003_m18_schedule_lookahead_delays.sql` introducing `lookahead_plans`, `lookahead_activities`, and `schedule_delay_records` with RLS policies and `project.delay.manage` permission.
- Added CPM forward & backward pass algorithms, float calculation, critical path resolution, and baseline comparison in `backend/src/modules/projects/service.ts`.
- Implemented lookahead plans and activities lifecycle CRUD.
- Implemented delay logging and schedule variance drivers categorization summary in service and repository.
- Registered 9 endpoints in `backend/src/modules/projects/routes.ts`:
  - `GET /projects/:projectId/schedule/gantt`
  - `POST /projects/:projectId/lookahead-plans`
  - `GET /projects/:projectId/lookahead-plans`
  - `GET /lookahead-plans/:planId`
  - `POST /lookahead-plans/:planId/activities`
  - `PATCH /lookahead-activities/:activityId`
  - `POST /projects/:projectId/delays`
  - `GET /projects/:projectId/delays`
  - `GET /projects/:projectId/schedule/variance`
- Built full suite of backend integration tests in `backend/src/modules/projects/m18-schedule.routes.test.ts` (all passing).
- Built frontend `ScheduleGanttSection` component in `frontend/src/components/ScheduleGanttSection.tsx` with Gantt visualization, Lookahead planner, Delay register, and variance drivers.
- Integrated `ScheduleGanttSection` into `frontend/src/pages/ProjectDetailPage.tsx`.
- Wrote unit tests in `frontend/src/components/ScheduleGanttSection.test.tsx` (all passing) and verified frontend builds cleanly without TypeScript errors.
- Documented in `docs/USER-GUIDE.md`.
