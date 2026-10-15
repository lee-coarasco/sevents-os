---
id: 62
title: "M06c — Workflow Runtime / Instance Engine"
status: next
roles: [backend-engineer]
priority: 4
created: 2026-10-15
updated: 2026-10-15
---

Third of four M06 sub-tickets (see ticket 0059's split note). Depends on
ticket 0060 (published `workflow_versions`) and ticket 0061 (a version
must pass validation before it can be published/instantiated).

Reference: BRD §5.4.3 (generic workflow runtime contract — the finite
step-type list: create task; assign role/user; collect form data;
request/upload evidence; evaluate deterministic condition; call an
approved application service; request approval; send notification; wait
for event/time; create linked follow-up; escalate; complete/cancel),
§6.2 (WorkflowInstance/WorkflowStepInstance/WorkflowEvent), §6.3
("Workflow instances reference the exact published workflow/
configuration version used at creation... Separate workflow definition
from task instance and business record; task completion may update
domain records only through authorized service commands"), FR-WI-004,
FR-WI-008, FR-WI-009, FR-WI-010, FR-WI-011.

## What to build
- Migration: `workflow_instances` (workflow_definition_id,
  workflow_version_id — pinned at creation, never changes even if a
  newer version publishes later per BRD §6.3 — status: running/paused/
  completed/cancelled, started_by, started_at, ended_at, context jsonb),
  `workflow_step_instances` (workflow_instance_id, node_id, status:
  pending/active/waiting/completed/skipped/failed, assigned_to,
  started_at, completed_at, output jsonb — form data/evidence/approval
  decision recorded against this step), `workflow_events` (append-only
  — workflow_instance_id, step_instance_id nullable, event_type
  (started/step_completed/paused/resumed/escalated/cancelled/
  timer_fired/etc.), payload jsonb, created_at). All tenant-scoped NOT
  NULL tenant_id, RLS.
- Step executor: one handler per BRD §5.4.3 step type. `create_task` /
  `assign_role/user` create a `workflow_step_instances` row and (reuse,
  don't reinvent) hook into whatever task-queue mechanism exists by
  then — if M07 (Tasks, My Work & Work Queues) hasn't landed yet when
  this ticket starts, that is a real blocker: raise it in this ticket's
  `## Needs approval` or re-sequence, don't invent a parallel task
  table. `evaluate_condition` evaluates deterministically (reuse ticket
  0061's condition evaluator, don't duplicate it) and picks the next
  transition — never an LLM call for this (BRD §5.4.3). `call_service`
  invokes a named, pre-registered application service (a small allow-
  list map in code, not arbitrary code execution) and feeds its output
  into `context`. `request_approval` creates a step the approver must
  act on (ties into M08 Approvals once that exists — same
  re-sequencing note as task creation above). `wait_event_time`
  suspends the step until a named event arrives or a timer fires. Other
  step types per the same pattern.
- Pause/resume/cancel on an instance: explicit state transitions,
  audited via `workflow_events`.
- `WorkItemDependency`-style predecessor/successor/blocking/conditional/
  parallel step support (FR-WI-009) at the transition level (ticket
  0060's `workflow_transitions` already has `order_index`; this ticket
  is where "wait for all predecessors" / "parallel fan-out" semantics
  get implemented in the executor, not the schema).
- Evidence/approval close-out gate (FR-WI-010): a `complete` node cannot
  be reached while any required checklist/evidence/approval step for
  that path is unsatisfied, unless an authorized exception is recorded
  (store the exception + who authorized it in `context`/`workflow_events`,
  don't silently bypass).

## Explicitly NOT in this ticket
- The task-queue/My Work UI itself (M07) or the approval workflow UI
  (M08) — this ticket only creates the step-instance rows and events
  those modules will read/write; if M07/M08 don't exist yet, flag the
  dependency rather than building a shadow task system.
- Migrating existing running instances to a newer template version —
  that is ticket 0063.

## Acceptance
- [ ] A workflow instance created from a published version is pinned to
      that version id for its whole lifecycle (test: publishing a newer
      version after instance creation does not change the running
      instance's `workflow_version_id`).
- [ ] Each BRD §5.4.3 step type has at least one executor test.
- [ ] `evaluate_condition` steps use the same deterministic evaluator as
      ticket 0061, not a second implementation.
- [ ] Pause/resume/cancel each produce a `workflow_events` row and the
      expected instance status.
- [ ] A `complete` node is unreachable while a required evidence/
      approval step is outstanding, unless an exception is recorded
      (test both the blocked and the authorized-exception path).
- [ ] `npm test` / `npm run build` pass; `scripts/tickets.py check` clean.

## Progress
- 2026-10-15: Filed as the third of four M06 sub-tickets. Flagging now:
  this ticket's task/approval integration may hit M07/M08 not existing
  yet (those are Phase 3, this is Phase 2) — the session that picks this
  up should check CLAUDE.md's build order first and, if M07/M08 are
  still `next`, scope this ticket to the step-instance/event data model
  and the executor logic that doesn't require a real task queue
  (everything except `create_task`/`request_approval`'s actual queue
  hand-off), leaving a clearly marked seam for M07/M08 to plug into
  later rather than inventing a throwaway task table.
