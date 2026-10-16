---
id: 75
title: "M09c — Baseline snapshots & baseline-change control (approval-gated)"
status: testing
roles: [backend-engineer]
priority: 9
created: 2026-10-15
updated: 2026-10-16
---

Third of five M09 sub-tickets. Depends on ticket 0073 (project
record), ticket 0074 (WBS/milestones/activities to baseline) and M08
(ticket 0066 — the `request_approval` workflow seam this ticket plugs
into). Covers BRD §8.4 FR-PROJ-004 only. BRD §6.2 entity:
`ProjectBaseline`.

## What to build
- `project_baselines`: tenant-scoped, `project_id`, `version`
  (incrementing per project), `baseline_dates`/`budget` snapshot
  (jsonb snapshot of the WBS/milestone/activity planned dates and
  budget at the moment the baseline was set — a baseline is a frozen
  copy, not a live view), `status` (`draft`, `pending_approval`,
  `approved`, `superseded`), `created_by`, `created_at`. The first
  baseline for a project (baseline v1) is set at project setup and
  does not require approval — approval is for *changes* to an
  existing approved baseline (FR-PROJ-004 says "baseline changes
  require... approval," not "the initial baseline requires
  approval").
- `project_baseline_change_requests`: tenant-scoped,
  `project_id`, `current_baseline_id`, `proposed_baseline_snapshot`
  (jsonb), `reason` (required, not null), `impact_analysis`
  (required text — FR-PROJ-004's "impact analysis" field), submitted
  by, and a `workflow_instance_id` FK into the M06/M08 workflow
  engine. Submitting a change request starts a `request_approval`
  workflow instance (same seam ticket 0066 documented for approval
  chains) rather than this module inventing its own approval
  mechanism — call the same `startWorkflowInstance`/approval-chain
  functions M08's module exposes; do not duplicate
  sequential/parallel approval logic here.
- When the linked workflow instance's approval resolves `approved`,
  the proposed snapshot becomes a new `project_baselines` row
  (`status='approved'`) and the prior baseline is marked
  `superseded`. When it resolves `rejected`/`returned_for_correction`,
  the change request is marked accordingly and no new baseline is
  created. Wire this via the same kind of callback/polling mechanism
  M07c (ticket 0072) used for its own workflow-seam consumption —
  look at that ticket's code before inventing a new one.
- A new permission `project.baseline.manage` for proposing a baseline
  change (distinct from `tenancy.project.manage`, since who can
  *propose* a baseline change may be broader or narrower than who can
  manage general project setup — BRD doesn't say they're the same
  role).

## Out of scope
- Issue/risk register — ticket 0076 (M09d).
- Health/forecast/closeout — ticket 0077 (M09e).
- Inventing a generic "approval required for any field change"
  mechanism — this ticket is scoped to baseline changes only, per
  FR-PROJ-004's literal text.

## Acceptance
- [x] `project_baselines` and `project_baseline_change_requests`
      created, tenant-scoped with RLS.
- [x] Proposing a baseline change requires `reason` and
      `impact_analysis`; creation fails without them.
- [x] A baseline change request starts a real workflow/approval
      instance via the existing M06/M08 machinery (no parallel
      approval logic).
- [x] An approved change supersedes the prior baseline; a
      rejected/returned one leaves the current baseline untouched.
- [x] Tests cover the full lifecycle (propose → approve → baseline
      superseded) and (propose → reject → baseline unchanged), plus
      tenant isolation and permission gating.
- [x] `docs/BRD.md` FR-PROJ-004 is satisfied.

## Progress
- 2026-10-15: Filed as the third of five M09 sub-tickets.
- 2026-10-16 01:26 UTC: Built. Migration
  `20261016000003_m09c_baseline_management.sql` adds
  `project_baselines` (version, jsonb `snapshot`, status
  draft/pending_approval/approved/superseded) and
  `project_baseline_change_requests` (required `reason`/
  `impact_analysis`, `workflow_instance_id` FK into
  `workflow_instances`, status pending/approved/rejected/
  returned_for_correction), both tenant-scoped with RLS, plus
  `project.baseline.manage` permission. `backend/src/modules/projects/
  service.ts` adds `setInitialBaseline` (v1, approved immediately, no
  workflow — captures the project's current WBS/milestone/budget state
  via a new `buildLiveSnapshot` helper; refuses a second call via
  `DuplicateInitialBaselineError`), `proposeBaselineChange` (requires
  non-blank reason/impactAnalysis, requires an existing approved
  baseline via `NoCurrentBaselineError`, calls the existing
  `startWorkflowInstance` — no parallel approval logic here) and
  `resolveBaselineChangeRequest`, the polling half of the seam: since
  this codebase has no event bus, a change request's workflow instance
  is read back on demand (`getWorkflowInstance`) and resolved by
  finding the step instance whose `output.decision` key is set (only a
  resolved `request_approval` step's `completeStepInstance` call ever
  writes that key, per ticket 0066) — idempotent once status leaves
  `pending`. `routes.ts` wires `GET /baseline-change-requests/:id` as
  the poll endpoint (each read re-resolves) plus
  `POST /projects/:projectId/baselines`,
  `GET /projects/:projectId/baselines`, `GET /baselines/:baselineId`,
  `POST /projects/:projectId/baseline-change-requests`,
  `GET /projects/:projectId/baseline-change-requests`, all gated on
  the new `project.baseline.manage` permission. `app.ts` now injects
  `getWorkflowRepository` into `projectsRoutes` (projects module reads
  the workflow module's repository directly, same direct-call
  convention every other module uses — no HTTP hop between modules).
  Two scope calls recorded in DECISIONS.md: (1) the proposer names an
  explicit, already-published `definitionId` for the approval workflow
  — no "the baseline-approval workflow" auto-resolution exists or is
  built here, matching ticket 0066's explicit-approverUserIds
  precedent; (2) `proposedSnapshot` is supplied explicitly by the
  caller, never auto-computed from live state, since proposing a
  change is explicitly proposing a *different* state than what's live.
  Tests: `baselines.test.ts` (8 cases — v1 capture, duplicate-v1
  rejection, blank reason/impact rejection, missing-current-baseline
  rejection, full propose→approve→supersede lifecycle incl.
  idempotent re-resolve, propose→reject→unchanged, tenant isolation)
  and `baselines.routes.test.ts` (permission gating 403/201/409,
  missing-field 400, full HTTP propose→approve→GET-resolves lifecycle).
  `npm test`: 309/309 across 31 files. `npm run build`/`lint` clean.
  `scripts/tickets.py check` clean. Status set to `testing` — owner
  reviews migration/API contracts per Phase 2-era testing instructions
  (no UI yet). Next: ticket 0076 (M09d — issue/risk/decision/
  assumption/dependency/change-request register).
