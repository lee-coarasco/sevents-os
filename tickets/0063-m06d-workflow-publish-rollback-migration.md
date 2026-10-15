---
id: 63
title: "M06d — Workflow Migration for Active Instances"
status: in-progress
roles: [backend-engineer]
priority: 5
created: 2026-10-15
updated: 2026-10-15
---

Fourth and last of the four M06 sub-tickets (see ticket 0059's split
note). Depends on ticket 0062 (there must be running `workflow_instances`
pinned to a version for a migration to move them off of).

Reference: BRD §5.4.2 ("existing instances remain pinned unless an
explicit, audited migration is run"), §8.2 ("Existing active instances
are not silently rewritten when a template changes. Provide an explicit
migration workflow with preview, impact summary, approvals and audit"),
§6.2 (WorkflowMigration), FR-WI-011.

## What to build
- Migration: `workflow_migrations` (from_version_id, to_version_id,
  status: draft/previewed/approved/executed/cancelled, impact_summary
  jsonb — which instances/steps would move and how their current step
  maps to the new graph, approved_by, executed_by, executed_at,
  created_by, created_at), `workflow_migration_instance_results`
  (migration_id, workflow_instance_id, old_step_instance_id,
  new_step_instance_id nullable, outcome: migrated/skipped/failed,
  detail).
- Preview: given a from/to version pair, compute which running
  instances are on `from_version_id`, and for each, whether its current
  active node_key exists by the same key in the target version's graph
  (a "safe" 1:1 mapping) or not (needs manual mapping / cannot
  auto-migrate) — this is the "impact summary," read-only, no writes.
- Approval + execute: same two-step gate as ticket 0060's publish flow
  (`workflow.definition.publish` permission) — approving a migration
  does not execute it; a separate explicit execute step actually moves
  each eligible instance's `workflow_version_id` pointer and current
  step, writing a `workflow_events` row per instance and a
  `workflow_migration_instance_results` row. Instances that don't map
  safely are left untouched and marked `skipped`/`failed`, never forced.
- Audit: every migration run is fully traceable — which instances moved,
  who approved, who executed, when.

## Acceptance
- [ ] Preview is read-only and correctly classifies each running
      instance as auto-mappable or not, based on node_key presence in
      the target version.
- [ ] Execute only moves instances explicitly marked auto-mappable (or
      ones with an operator-supplied manual mapping, if built); anything
      else is left on its original version untouched.
- [ ] A migration cannot execute without a prior approval row (test
      asserts this).
- [ ] Every migrated instance produces a `workflow_events` row and a
      `workflow_migration_instance_results` row.
- [ ] `npm test` / `npm run build` pass; `scripts/tickets.py check` clean.

## Progress
- 2026-10-15: Filed as the fourth of four M06 sub-tickets.
