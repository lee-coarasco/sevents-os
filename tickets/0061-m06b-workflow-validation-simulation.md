---
id: 61
title: "M06b — Workflow Validation & Simulation"
status: testing
roles: [backend-engineer]
priority: 3
created: 2026-10-15
updated: 2026-10-15
---

Second of four M06 sub-tickets (see ticket 0059's split note). Depends
on ticket 0060 (`workflow_definitions`/`workflow_versions`/
`workflow_nodes`/`workflow_transitions`/`workflow_conditions` must
exist) being `done` or `testing`.

Reference: BRD §5.4.2 ("validate required fields, role references,
workflow graph integrity, missing transitions, circular dependencies,
impossible SLA conditions, unsafe agent permissions and approval-policy
conflicts... simulate against representative sample cases and show
expected paths, assignments, timers and outputs"), §6.2
(ConfigurationValidationRun/ConfigurationSimulationRun), FR-WI-012.

## What to build
- Migration: `configuration_validation_runs` (workflow_version_id,
  run_by, started_at, finished_at, result: pass/fail, findings jsonb —
  list of {severity, code, message, node_id?}), `configuration_simulation_runs`
  (workflow_version_id, run_by, test_case jsonb — the sample input, result
  jsonb — the path taken, nodes visited, unreachable nodes, assignments/
  timers implied, started_at, finished_at).
- Service: a pure structural validator (no DB writes needed to compute
  it, just reads a version's graph) checking: every node reachable from
  the start node; no circular transition path that never reaches a
  completion/cancel node; every `assign_role_user` node's role reference
  exists in `role_definitions`; every transition's `condition_id` (if
  set) resolves to a real `workflow_conditions` row in the same version;
  at least one `complete`/`cancel` terminal node exists. Record a
  `configuration_validation_runs` row with pass/fail + findings.
- A simple simulator: given a declared start node and a test-case input
  (values for each condition's `expression.field`), deterministically
  walk the graph evaluating `evaluate_condition` nodes' conditions
  against the input, produce the path of node_keys visited plus which
  nodes were never reached by any of the supplied test cases (branch
  coverage, BRD "display branch coverage and unreachable steps").
  Record a `configuration_simulation_runs` row.
- Gate: `publishVersion` (ticket 0060) should require the version's
  latest validation run to be `pass` before allowing publish — ticket
  0060 shipped without this gate since this ticket didn't exist yet;
  adding the gate here means touching `workflow/service.ts`'s
  `publishVersion`, not duplicating it.
- Routes: `POST /workflow/versions/:id/validate`, `POST
  /workflow/versions/:id/simulate`, both gated on
  `workflow.definition.manage`.

## Acceptance
- [x] Validator catches: unreachable node, circular path with no
      terminal node, dangling role reference, dangling condition
      reference, missing terminal node — one test per case.
- [x] Simulator produces the correct path for a condition-branching
      graph and correctly flags an unreached branch as uncovered.
- [x] `publishVersion` rejects publishing a version with no passing
      validation run (test asserts this); existing ticket 0060 publish
      tests still pass once a passing validation run is added to their
      setup.
- [x] `npm test` / `npm run build` pass; `scripts/tickets.py check` clean.

## Progress
- 2026-10-15: Filed as the second of four M06 sub-tickets.
- 2026-10-15 15:21 UTC: Built M06b in the same session as 0060. Migration
  `supabase/migrations/20261015000006_m06b_workflow_validation_simulation.sql`
  adds `configuration_validation_runs`/`configuration_simulation_runs`
  (NOT NULL tenant_id, same pattern as 0060's tables). Added to
  `backend/src/modules/workflow/`: `validation.ts` (pure
  `validateGraph` — reachability from an inferred start node, cycle-
  with-no-exit detection, dangling role/condition reference checks, no
  DB access of its own) and `simulation.ts` (pure `simulateGraph` —
  deterministic walk using the same condition-expression evaluator
  shape the validator reads, default/fallback branch support, branch-
  coverage reporting). Extended (not duplicated) `repository.ts`/
  `service.ts`/`routes.ts`/`types.ts` from ticket 0060 additively:
  `listRoleIds`, `insertValidationRun`/`getLatestValidationRun`,
  `insertSimulationRun`; `validateVersion`/`simulateVersion` service
  functions; `POST /workflow/versions/:versionId/validate` and
  `/simulate` routes, gated on `workflow.definition.manage` (authoring-
  level, same as node/transition/condition CRUD — not a publish-level
  action). **`publishVersion` (0060) now requires the version's latest
  validation run to be `pass`** — the gate this ticket's own scope note
  called for; updated 0060's existing test helper
  (`createPublishableDefinition` in `service.test.ts`) to call
  `validateVersion` before submit/approve so its tests keep passing
  unchanged in intent. `npm test`: 124/124 (108 prior + 16 new), `npm
  run build` clean, `scripts/tickets.py check` clean.
  **Design note on "start node" inference:** BRD doesn't give workflow
  nodes an explicit `is_start` flag (ticket 0060 didn't add one), so the
  validator/simulator infer it structurally: a start candidate is a
  node with no incoming transition that itself has at least one
  outgoing transition (excludes a fully-isolated orphan node, which
  would otherwise look identical to a legitimate start and hide itself
  from the unreachable-node check). Zero or multiple candidates is
  itself a validation finding (`AMBIGUOUS_START`). If a future ticket
  needs an explicit author-declared start (e.g. multiple valid entry
  points), that's a small additive migration on `workflow_nodes`, not a
  rework of this logic.
