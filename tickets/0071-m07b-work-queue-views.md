---
id: 71
title: "M07b — My Work / Team Work queue views and filters"
status: next
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
- [ ] Each of the seven views returns the correct subset for a seeded
      mix of waiting/active/completed/blocked/overdue/approval-pending
      step instances (one test per view, same style as ticket 0062's
      per-node-type executor tests).
- [ ] My Work requires no permission; the other six 403 without
      `workflow.task.view_team`.
- [ ] Every view is tenant-scoped — a step instance in another tenant
      never appears regardless of permission.
- [ ] `npm test` / `npm run build` pass; `scripts/tickets.py check` clean.

## Progress
- 2026-10-15: Split out of ticket 0065 (M07) by the architect session
  that re-read BRD §8.3. Second of three M07 sub-tickets — depends on
  0070's schema fields.
