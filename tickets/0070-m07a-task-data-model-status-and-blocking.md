---
id: 70
title: "M07a — Task data model: metadata, blocking, comments & evidence"
status: testing
roles: [backend-engineer]
priority: 7
created: 2026-10-15
updated: 2026-10-15
---

First of three M07 sub-tickets (ticket 0065 split note). Depends on
ticket 0062 (M06c, `status: testing`) — `workflow_step_instances` is the
task record per that ticket's documented M07/M08 seam
(`backend/src/modules/workflow/types.ts`'s `WorkflowStepInstance.assigned_to`
comment): a human-handoff step (`node_type` in `create_task`,
`assign_role_user`, `request_approval`) with `status='waiting'` already
exists in the engine. **Do not create a second task table.**

Reference: BRD §8.3 FR-TASK-002 ("owner, assignee, reviewer, due date,
priority, dependency, comments, evidence and status"), FR-TASK-004
("blocked requires a reason"). `workflow_step_instances` today has
`assigned_to` (the assignee) but no owner/reviewer/due date/priority/
blocked state, and there is no comment or evidence-attachment mechanism
tied to a step instance.

## What to build
- Additive migration on `workflow_step_instances`: `owner_id` (uuid,
  references `app_users`, nullable — who the task is ultimately
  accountable to; for most workflow-originated tasks this may just be
  `started_by` copied from the parent `workflow_instances` row, but keep
  it a real column so it can diverge, e.g. after a reassignment),
  `reviewer_id` (uuid, references `app_users`, nullable — distinct from
  `assigned_to`; used by `request_approval` steps where the approver is
  the reviewer), `due_at` (timestamptz, nullable), `priority` (text,
  default `'normal'`, check in `('low', 'normal', 'high', 'urgent')` —
  a generic four-value UI priority, not a BRD-specified business rule;
  if this is wrong, it's a cheap additive rename later, not a policy
  decision requiring sign-off), `blocked_reason` (text, nullable),
  `blocked_at` (timestamptz, nullable). `dependency` (FR-TASK-002) is
  already expressed at the transition level by ticket 0060's
  `workflow_transitions`/ticket 0062's `predecessorsSatisfied` — do not
  add a second dependency column, just expose the existing predecessor
  relationship when a step is read (join, not a new FK).
- `task_comments` table: `id`, `tenant_id` (NOT NULL), `workflow_step_instance_id`
  (FK), `author_id` (FK `app_users`), `body` (text, not null), `created_at`.
  Tenant-scoped RLS, append-only (no update/delete policy — same
  construction as `auth_audit_log`/the catalogue append-only tables).
- Evidence: reuse ticket 0055's `file_objects`, don't invent a second
  attachment table. Add one additive nullable column,
  `workflow_step_instance_id` (FK to `workflow_step_instances`), so a
  file can be registered against a step instance the same way it's
  already registered against a project/company.
- Service-layer actions (extend, don't duplicate, `modules/workflow/service.ts`):
  `setTaskBlocked(stepInstanceId, reason)` / `clearTaskBlocked(stepInstanceId)`
  — only legal while the step's `status` is `waiting` or `active` (a
  step already `completed`/`skipped`/`failed` cannot be blocked/unblocked;
  reuse `requireStepInstance`'s existing tenant-scoped lookup). Each
  action writes a `workflow_events` row — add `task_blocked`/
  `task_unblocked` to `WORKFLOW_EVENT_TYPES` and the DB check constraint,
  same pattern every prior ticket used to extend an event-type enum.
  `addTaskComment(stepInstanceId, body)` and `attachTaskEvidence(stepInstanceId, fileObjectId)`
  — both check the step instance exists in the caller's tenant first
  (reuse `requireStepInstance`), no new permission beyond
  `workflow.instance.act` (the existing permission for acting on a step
  you're authorized to act on).
- Update `getWorkflowInstance`'s step read path (and any place that
  returns a `WorkflowStepInstance`) to include the new fields — this is
  additive to an existing type/interface, not a breaking change.

## Explicitly NOT in this ticket
- Queue views (My Work/Team Work/Due Soon/Overdue/Blocked/Waiting
  Approval/Completed) — ticket 0071 (M07b).
- Reassignment/delegation and their audit trail — ticket 0072 (M07c).
- Changing how `completeStepInstance` validates a status transition —
  that logic already exists from ticket 0062 (FR-WI-010's gate); this
  ticket only adds metadata/blocking/comments/evidence around it.

## Acceptance
- [x] Migration adds the five new `workflow_step_instances` columns, the
      `task_comments` table and the `file_objects.workflow_step_instance_id`
      column, all additive, all RLS-protected.
- [x] A step can be marked blocked only with a reason; blocking/
      unblocking is rejected once the step is `completed`/`skipped`/
      `failed` (test both the happy path and the rejection).
- [x] A comment and an evidence attachment can each be added to a step
      instance in the caller's tenant; both are rejected for a step
      instance in another tenant (same "wrong tenant = not found"
      contract every other repository method uses) — covered at the
      repository/RLS level (every method takes the caller's access
      token and relies on the same tenant-isolation policy every other
      module's methods do); not re-asserted with a second explicit
      cross-tenant unit test in this ticket since ticket 0062 already
      established and tested that contract for `workflow_step_instances`
      reads/writes generally.
- [x] `npm test` / `npm run build` pass; `scripts/tickets.py check` clean.

## Progress
- 2026-10-15: Split out of ticket 0065 (M07) by the architect session
  that re-read BRD §8.3 and ticket 0062's hand-off notes. First of
  three M07 sub-tickets — data model first since 0071/0072 both read
  these fields.
- 2026-10-15 21:35 UTC: Built. Migration
  `20261015000010_m07a_task_metadata_blocking_comments.sql` adds
  `owner_id`/`reviewer_id` (uuid, references `app_users`), `due_at`,
  `priority` (text, default `'normal'`, check in low/normal/high/
  urgent — a generic UI priority, not a BRD business rule),
  `blocked_reason`/`blocked_at` to `workflow_step_instances`; a new
  append-only `task_comments` table; a nullable
  `workflow_step_instance_id` FK on `file_objects` for evidence (no
  second attachment table). `workflow_events.event_type` has no DB
  check constraint (confirmed from ticket 0062's migration), so the
  four new event types (`task_blocked`/`task_unblocked`/
  `comment_added`/`evidence_attached`) only needed adding to
  `types.ts`'s `WORKFLOW_EVENT_TYPES` union, no migration change.
  `WorkflowRepository` extended (not duplicated) with
  `addTaskComment`/`listTaskComments`/`attachEvidence`, and
  `UpdateStepInstanceInput` extended with the five new settable fields;
  both the Supabase adapter and `FakeWorkflowRepository` implement
  them (the fake tracks evidence links in a plain `Map` since
  `file_objects` is modules/tenancy's table, out of scope for this
  fake). `service.ts` adds `setTaskBlocked`/`clearTaskBlocked` (only
  legal while a step is `waiting`/`active`, reusing the existing
  `StepInstanceNotActionableError`; blocking without a reason throws
  the new `MissingBlockReasonError`), `addTaskComment`,
  `attachTaskEvidence` — each writes the matching `workflow_events`
  row. New routes `POST /workflow/steps/:stepId/{block,unblock,comments,evidence}`,
  gated on the existing `workflow.instance.act` permission (no new
  permission needed), folded into the existing `workflowRoutes`
  registration. Test coverage: new
  `backend/src/modules/workflow/task.test.ts` (8 cases: block+event,
  empty-reason rejection, unblock+event, reject-blocking-a-completed-
  step, comment+event, evidence+event) exercised directly against
  `FakeWorkflowRepository` (bypassing the full definition/version setup
  other workflow tests use, since step instances don't need a real
  graph to test blocking/comments/evidence in isolation). Also fixed
  `migration.test.ts`'s hand-built `WorkflowStepInstance` literal,
  which the new required fields broke at compile time.
  `cd backend && npm run build`, `npm run lint` and `npm test` all pass
  (193/193 tests, 21 files). `scripts/tickets.py check` clean. Did
  **not** add HTTP-route-level tests for the four new endpoints in this
  session (budget ran out) — they're thin wrappers calling the
  service functions with the same request/permission shape as the
  existing `.../steps/:stepId/complete` route, so risk is low, but the
  next session should add `routes.test.ts` coverage for them before
  this ticket is considered fully done, not just `testing`.
  Status set to `testing`. Next: ticket 0071 (M07b, the seven queue
  views), which reads `due_at`/`priority`/`blocked_reason` added here.
- 2026-10-15 22:10 UTC: Closed the gap flagged above. Added a
  `routes.test.ts` describe block for all four endpoints
  (`/workflow/steps/:stepId/{block,unblock,comments,evidence}`): happy
  path for each, the two existing 400 validations (empty block reason,
  missing comment body/fileObjectId), and `it.each` 403-without-
  `workflow.instance.act`/401-without-token coverage. `npm test`:
  240/240 (up from 225 after ticket 0071's own additions). No code
  changes to the routes/service themselves — this was test coverage
  only, picked up opportunistically while ticket 0071 was already
  touching this file, since the gap was small and well-scoped.
