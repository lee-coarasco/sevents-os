---
id: 77
title: "M09e — Project health, forecast-vs-baseline & closeout checklist"
status: testing
roles: [backend-engineer]
priority: 9
created: 2026-10-16
updated: 2026-10-16
---

Fifth and last of five M09 sub-tickets (see ticket 0073 and
DECISIONS.md for the split rationale). Depends on ticket 0073
(project), 0074 (schedule/progress data to derive health from) and
0075 (approved baseline to forecast against). Covers BRD §8.4
FR-PROJ-006, FR-PROJ-007 and FR-PROJ-008.

## What to build
- A `project_health_snapshots` table (tenant-scoped, `project_id`,
  `computed_at`, `factors` jsonb, `summary` text, `computed_by` —
  nullable, null means system-computed not a person). FR-PROJ-006 is
  explicit: "must show the contributing factors and last refresh
  time; never display an unexplained AI score as fact." So this
  ticket computes a snapshot from existing recorded data only
  (e.g. count of overdue schedule activities from ticket 0074's
  `schedule_activities`, count of open `issue`/`risk` register
  entries from ticket 0076, whether the current baseline per ticket
  0075 is `approved` vs. `pending_approval`) and stores exactly which
  factors fed the summary — it does not call any AI/ML service and
  does not produce a single unexplained numeric "health score." If a
  future AI module wants to add a narrative on top, it must cite
  these same stored factors (BRD §8.10 FR-AI-004: AI outputs are
  typed and not treated as approved records by default) — that is a
  seam for M28, not built here.
- `GET /projects/:projectId/health` recomputes-and-returns the
  latest snapshot on demand (no scheduled job infrastructure exists
  yet in this codebase — on-demand computation on read is the
  correct scope here, not a cron).
- FR-PROJ-007: a `GET /projects/:projectId/forecast` endpoint that
  returns the current approved baseline (ticket 0075's
  `project_baselines` row with `status='approved'`) side by side with
  a derived forecast (e.g. planned completion from baseline vs. a
  naive projection from `schedule_activities`/`progress_entries`
  actuals) — the two must be clearly labelled and never merged into
  one field, so a caller can never mistake forecast for baseline.
- FR-PROJ-008: a `project_closeout_checklists` table (tenant-scoped,
  `project_id`, one row per required closeout item: handover
  records, final account, defects/DLP, lessons learned — a small
  fixed list of item keys, not a configurable checklist builder,
  since BRD names the exact items and this project's configuration
  studio (M06) is the place for admin-configurable checklists, not
  this module) with `status` (`pending`/`complete`) and
  `completed_by`/`completed_at` per item. `POST
  /projects/:projectId/closeout/:itemKey/complete` and `GET
  /projects/:projectId/closeout`.

## Out of scope
- Any AI-generated narrative or score — M28 (AI Knowledge Assistant),
  much later phase, and even then must cite these stored factors per
  FR-PROJ-006/FR-AI-004.
- Scheduled/background recomputation — no job scheduler exists in
  this codebase.
- A configurable checklist builder — reuse M06 if that's ever wanted;
  this ticket's checklist is the fixed BRD-named item list only.

## Acceptance
- [x] `project_health_snapshots` and `project_closeout_checklists`
      created, tenant-scoped, RLS enabled.
- [x] Health endpoint returns factors + last-refresh timestamp, never
      a bare score.
- [x] Forecast endpoint returns baseline and forecast as distinct,
      separately labelled fields.
- [x] Closeout checklist covers exactly the four BRD-named items and
      blocks nothing else in the system (completing it is a record,
      not a gate on project closure elsewhere, since BRD doesn't ask
      for that gate).
- [x] Tests cover tenant isolation, permission gating, and that
      forecast/baseline never collapse into a single value.
- [x] `docs/BRD.md` FR-PROJ-006, FR-PROJ-007 and FR-PROJ-008 are
      satisfied.

## Progress
- 2026-10-16: Filed as the fifth of five M09 sub-tickets — ticket
  0073/0074/0075 all referenced this ticket number in their "out of
  scope" sections before it existed as a file; filing it now to close
  that gap (see DECISIONS.md). This completes the M09 split: 0073,
  0074, 0075, 0076, 0077.
- 2026-10-16 01:39 UTC: Built. Migration
  `20261016000005_m09e_health_forecast_closeout.sql` adds
  `project_health_snapshots` (append-only, select/insert-only RLS,
  same convention as `progress_entries`) and
  `project_closeout_checklists` (tenant-scoped, unique on
  `(tenant_id, project_id, item_key)`), plus a new
  `project.closeout.manage` permission. `backend/src/modules/projects/
  service.ts` adds `computeProjectHealth` (inserts a fresh snapshot
  every call from overdue-activity/milestone counts, open
  register-entry counts by kind, and current baseline status — no
  numeric score, ever), `getProjectForecast` (baseline's frozen
  planned-completion date vs. a naive live-schedule projection,
  returned as two distinct top-level keys), and
  `listCloseoutChecklist`/`completeCloseoutItem` (auto-vivify the four
  fixed items as `pending`, mark one `complete`). Routes: `GET
  /projects/:id/health`, `GET /projects/:id/forecast`, `GET
  /projects/:id/closeout`, `POST
  /projects/:id/closeout/:itemKey/complete`. 17 new tests (service +
  HTTP route layer), full suite 340/340 passing, `tsc --noEmit` clean.
  Two scope calls recorded in DECISIONS.md: cost-forecast is out of
  scope (no cost-actuals tracking exists until M21); closeout
  completion gets its own permission while health/forecast/closeout-
  list reuse `tenancy.project.manage`, same pattern ticket 0075 used
  for baseline vs. general project admin. Also caught and fixed a
  latent cross-tenant-write risk in my own new "auto-create missing
  checklist items" logic (a GET with a cross-tenant project id would
  otherwise have silently created rows under the caller's tenant that
  reference someone else's project) — guarded with an explicit
  `getProject` ownership check before any closeout write. Status:
  testing — this closes out the full M09 split (0073-0077); M09
  (Project & Portfolio Management) is now code-complete. Next session
  should move to M10 (Client, CRM & Sales Pipeline) per the BRD module
  build order, or pick up any other `next` ticket `tickets.py next`
  names first.
