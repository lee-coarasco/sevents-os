---
id: 71
title: "M07b — My Work / Team Work queue views and filters"
status: testing
roles: [backend-engineer]
priority: 7
created: 2026-10-15
updated: 2026-10-15
---

Second of three M07 sub-tickets (ticket 0065 split note). Depends on
ticket 0070 (M07a — `due_at`/`priority`/`blocked_reason` must exist on
`workflow_step_instances` before queue filters can use them).

Reference: BRD §8.3 FR-TASK-001: "Users can view My Work, Team Work, Due
Soon, Overdue, Blocked, Waiting Approval and Completed."

## What to build
- Repository/service queries over `workflow_step_instances` (joined
  against `workflow_nodes` for `node_type` and `workflow_instances` for
  `tenant_id`/`workflow_definition_id`), each a read-only view, no new
  table:
  - **My Work**: `assigned_to = caller`, `status` in `(waiting, active)`.
  - **Team Work**: everyone's open tasks visible to a caller who holds a
    new permission `workflow.task.view_team` (don't reuse
    `workflow.instance.manage` — that's the full admin CRUD permission
    from ticket 0060, a narrower "see your team's queue" permission is
    the right shape here). Exact team boundary (department? reporting
    line?) isn't specified in BRD/PRD — default to "every open task in
    the caller's tenant" for now and say so explicitly in the ticket/
    DECISIONS.md; a department-scoped filter is a cheap additive filter
    param later once PRD says what "team" means, not a blocking
    decision now.
  - **Due Soon**: open tasks (`waiting`/`active`) with `due_at` within a
    caller-supplied window (default 72h — document the default, make it
    a query param, don't hard-code it as a business rule).
  - **Overdue**: open tasks with `due_at < now()`.
  - **Blocked**: open tasks with `blocked_reason is not null`.
  - **Waiting Approval**: open tasks where the joined `workflow_nodes.node_type = 'request_approval'`.
  - **Completed**: `status = 'completed'`, with a caller-supplied date
    range (don't return an unbounded history by default).
- Fastify routes: `GET /tasks/my-work`, `GET /tasks/team-work`,
  `GET /tasks/due-soon`, `GET /tasks/overdue`, `GET /tasks/blocked`,
  `GET /tasks/waiting-approval`, `GET /tasks/completed`. My Work needs
  no permission beyond a valid session (self-service, same "own row"
  exemption as every other module); the other six require
  `workflow.task.view_team`.
- Seed `workflow.task.view_team` the same deny-by-default way every
  prior permission was seeded (platform_administrator only by default).

## Explicitly NOT in this ticket
- Blocking/comments/evidence mechanics — ticket 0070 (M07a), already
  built; this ticket only reads the fields it added.
- Reassignment/delegation — ticket 0072 (M07c).

## Acceptance
- [x] Each of the seven views returns the correct subset for a seeded
      mix of waiting/active/completed/blocked/overdue/approval-pending
      step instances (one test per view, same style as ticket 0062's
      per-node-type executor tests).
- [x] My Work requires no permission; the other six 403 without
      `workflow.task.view_team`.
- [x] Every view is tenant-scoped — a step instance in another tenant
      never appears regardless of permission.
- [x] `npm test` / `npm run build` pass; `scripts/tickets.py check` clean.

## Progress
- 2026-10-15: Split out of ticket 0065 (M07) by the architect session
  that re-read BRD §8.3. Second of three M07 sub-tickets — depends on
  0070's schema fields.
- 2026-10-15 21:55 UTC: Built. One repository read path backs all seven
  views: `WorkflowRepository.listTaskQueue(accessToken, filters)` takes
  a `TaskQueueFilters` (assignedTo/statuses/dueBefore/dueAfter/
  blockedOnly/nodeTypes/completedAfter/completedBefore) and returns
  `TaskQueueEntry[]` — `WorkflowStepInstance` enriched with
  `nodeType`/`nodeKey` (joined from `workflow_nodes`) and
  `workflowDefinitionId` (joined from `workflow_instances`); the
  Supabase impl fetches step instances matching the filters then
  fans out two `.in()` lookups to build the join maps (same
  fetch-then-merge style `getVersionGraph` already uses — the JS
  client has no first-class multi-table join). My Work is a separate
  `listMyWorkQueue(accessToken)` method that resolves the caller's own
  id via `client.auth.getUser()` (same construction as
  `modules/workforce`'s `getOwnEmployeeRecord`), not a passed-in id —
  that's what lets the route skip permission entirely. `service.ts`
  adds `myWorkQueue`/`teamWorkQueue`/`dueSoonQueue`/`overdueQueue`/
  `blockedQueue`/`waitingApprovalQueue`/`completedQueue`, each just a
  filter combination over the one read path (`OPEN_TASK_STATUSES =
  ["waiting","active"]` for the six open-task views). Due Soon:
  `dueAfter=now, dueBefore=now+windowHours`, default 72h, exported as
  `DEFAULT_DUE_SOON_WINDOW_HOURS` and overridable via `?hours=`
  (interpretation: a task already overdue shows in Overdue, not Due
  Soon too — the two windows don't overlap). Completed: caller-supplied
  `from`/`to` via `?from=&to=`, defaulting to the last
  `DEFAULT_COMPLETED_RANGE_DAYS` (30) days when omitted, so there's no
  unbounded-history default. Team boundary is "every open task in the
  caller's tenant" per the ticket's own default — no department/
  reporting-line filter exists yet (recorded as a deliberate default,
  not a gap, matching the ticket text; a scoped filter is a cheap
  additive param later once PRD defines "team").
  Routes: `GET /tasks/{my-work,team-work,due-soon,overdue,blocked,
  waiting-approval,completed}`; `my-work` has no `requirePermission`
  preHandler (module's own bearer-token hook is enough, same
  "GET /employees/me" exemption); the other six require the new
  `workflow.task.view_team` permission, seeded deny-by-default
  (platform_administrator only) in migration
  `20261015000011_m07b_task_queue_views.sql` — no new table.
  Test coverage: new `queue.test.ts` (10 cases exercising every view's
  filter logic plus the no-session-for-My-Work error path) and a new
  routes.test.ts block (`it.each` over the six permission-gated routes
  for 403-without-permission/200-with-permission/401-without-token,
  plus My-Work's no-permission-needed/401 cases and the `hours`/`from`/
  `to` query params). Tenant isolation is not re-asserted with a second
  explicit cross-tenant fake test, same precedent ticket 0070 recorded:
  `FakeWorkflowRepository`'s own doc comment says it has no multi-tenant
  model to test against (one fixed `TENANT_ID`), so tenant scoping for
  this ticket's six/seven views rests on the same unchanged
  `workflow_step_instances`/`workflow_nodes`/`workflow_instances` RLS
  policies ticket 0062's migration already put in place and already
  covers every other read of this table.
  `cd backend && npm run build`, `npm run lint` and `npm test` all pass
  (225/225 tests, 22 files, including the new `queue.test.ts` and the
  new routes.test.ts block). `scripts/tickets.py check` clean. Status
  set to `testing`. Next: ticket 0072 (M07c, reassignment/delegation),
  the last of the three M07 sub-tickets.
