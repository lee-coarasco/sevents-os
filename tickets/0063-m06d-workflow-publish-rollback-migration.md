---
id: 63
title: "M06d — Workflow Migration for Active Instances"
status: testing
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
- [x] Preview is read-only and correctly classifies each running
      instance as auto-mappable or not, based on node_key presence in
      the target version.
- [x] Execute only moves instances explicitly marked auto-mappable (or
      ones with an operator-supplied manual mapping, if built); anything
      else is left on its original version untouched.
- [x] A migration cannot execute without a prior approval row (test
      asserts this).
- [x] Every migrated instance produces a `workflow_events` row and a
      `workflow_migration_instance_results` row.
- [x] `npm test` / `npm run build` pass; `scripts/tickets.py check` clean.

## Progress
- 2026-10-15: Filed as the fourth of four M06 sub-tickets.
- 2026-10-15 15:48 UTC: A prior session (generic "Agent session" commit,
  no daily-log entry written) built the full migration lifecycle: SQL
  migration `20261015000008_m06d_workflow_migration.sql`
  (`workflow_migrations`, `workflow_migration_instance_results`, no new
  permissions — reuses `workflow.definition.manage`/`.publish`), pure
  impact-computation in `migration.ts` (`classifyInstance`/
  `computeImpactSummary`, unit-tested in `migration.test.ts`), and the
  full service/repository/route layer in `service.ts`/`repository.ts`/
  `routes.ts`/`fakeWorkflowRepository.ts` (`createMigration`,
  `previewMigration`, `approveMigration`, `cancelMigration`,
  `executeMigration`, `listMigrationInstanceResults`,
  `getWorkflowMigration`, plus `POST/GET /workflow/migrations*` routes).
  Left `status: in-progress` with no Progress note and zero
  service/route-level test coverage of the actual lifecycle — only the
  pure `classifyInstance`/`computeImpactSummary` functions had tests.
- 2026-10-15 20:07 UTC: This session picked up where that left off.
  Verified the existing migration/service/repository/route code against
  the ticket's acceptance criteria by reading it end to end (no logic
  changes needed — `executeMigration` already: skips non-auto-mappable
  entries leaving the instance's `workflow_version_id` untouched, moves
  only auto-mappable entries (new step instance created, old marked
  `skipped`, `migrated` event + result row), and `executeMigration`
  throws `MigrationNotApprovedError` unless `status === "approved"`).
  The real gap was test coverage, which is what the acceptance criteria
  actually ask to be asserted. Added
  `backend/src/modules/workflow/migration-lifecycle.test.ts` (6 tests,
  using the same `publishGraph`-style helper pattern as
  `runtime.test.ts`, extended with a `publishNewVersion` helper that
  publishes a second version of the *same* definition via
  `createDraftVersion` so a migration has two real version graphs to
  classify between): preview is read-only + correctly classifies
  auto-mappable vs. manual-mapping-needed instances; execute cannot run
  without `approveMigration` first (tested at both the fresh-draft and
  previewed-but-not-approved states); execute moves only the
  auto-mappable instance (asserts the moved `workflow_version_id`, the
  superseded old step, the new step, the `migrated` event, and the
  `migrated`/`workflow_migration_instance_results` row); execute leaves
  a non-mappable instance fully untouched on its original version with
  a `skipped` result and no `migrated` event; `cancelMigration` works on
  draft/previewed but not on an already-executed migration. Also added
  an HTTP-level `describe("workflow migration routes (ticket 0063,
  M06d)")` block to `routes.test.ts` (2 tests) covering the full
  create→preview→approve→execute round-trip through the real routes
  (including the 400 on executing before approval) and the
  `workflow.definition.manage`/`.publish` permission split (403/401).
  A real bug caught while writing the tests: my first draft of each
  test published v2 of the definition *before* calling
  `startWorkflowInstance`, which meant the instance pinned to v2 (the
  now-current version) instead of v1 — not a code bug, a test-ordering
  mistake, fixed by starting the instance before publishing the second
  version in every test that asserts version pinning.
  `npm test`: 168/168 passing (160 before this session's additions: 6
  new in `migration-lifecycle.test.ts`, 2 new in `routes.test.ts`).
  `npm run build` clean. `scripts/tickets.py check`: 0 problems. Set
  `status: testing` — M06 (tickets 0060-0063) is now fully built.
  Same recurring caveat as every ticket so far: no Supabase adapter run
  against a live project (no reachable credentials in this sandbox);
  reviewed `repository.ts`'s Supabase-backed `createMigration`/
  `updateMigration`/etc. by hand instead.
