---
id: 75
title: "M09c — Baseline snapshots & baseline-change control (approval-gated)"
status: next
roles: [backend-engineer]
priority: 9
created: 2026-10-15
updated: 2026-10-15
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
- [ ] `project_baselines` and `project_baseline_change_requests`
      created, tenant-scoped with RLS.
- [ ] Proposing a baseline change requires `reason` and
      `impact_analysis`; creation fails without them.
- [ ] A baseline change request starts a real workflow/approval
      instance via the existing M06/M08 machinery (no parallel
      approval logic).
- [ ] An approved change supersedes the prior baseline; a
      rejected/returned one leaves the current baseline untouched.
- [ ] Tests cover the full lifecycle (propose → approve → baseline
      superseded) and (propose → reject → baseline unchanged), plus
      tenant isolation and permission gating.
- [ ] `docs/BRD.md` FR-PROJ-004 is satisfied.

## Progress
- 2026-10-15: Filed as the third of five M09 sub-tickets.
