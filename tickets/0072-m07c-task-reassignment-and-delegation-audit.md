---
id: 72
title: "M07c — Task reassignment and delegation, audited"
status: testing
roles: [backend-engineer]
priority: 7
created: 2026-10-15
updated: 2026-10-15
---

Third of three M07 sub-tickets (ticket 0065 split note). Depends on
ticket 0070 (M07a's schema) and benefits from ticket 0071 (M07b's My
Work/Team Work views) existing to verify a reassignment actually moves
a task between queues, though it doesn't strictly require 0071's code.

Reference: BRD §8.3 FR-TASK-005: "Reassignment and delegation are
audited."

## What to build
- `reassignTask(stepInstanceId, newAssigneeUserId, reason)`: updates
  `assigned_to` on a `workflow_step_instances` row (only while `status`
  is `waiting` or `active` — same guard as M07a's blocking actions) and
  writes a `workflow_events` row (`task_reassigned`, payload `{from,
  to, reason}`). New assignee must be in the same tenant as the step
  instance (same cross-tenant guard shape as `authority.assignRole`'s
  `CrossTenantError`).
- Delegation: BRD doesn't give tasks a dedicated time-bound Delegation
  entity the way it does for authority (ticket 0056's `delegations`
  table, with its own `valid_from`/`valid_to`). Scope decision for this
  ticket — **a task "delegation" is a reassignment with
  `metadata.delegated = true` in the same `workflow_events` row**, not a
  second temporal entity; if a future ticket needs delegations to
  auto-expire and revert, that's an additive table at that point, not
  invented here speculatively. Record this as a `DECISIONS.md` entry
  when building (same weight as the M06 tenant_id/nullable decisions),
  since it's a real scope call, not just an implementation detail.
- `delegateTask(stepInstanceId, delegateUserId, reason)`: same mechanics
  as `reassignTask`, writes `task_delegated` instead of
  `task_reassigned` as the event type (add both to
  `WORKFLOW_EVENT_TYPES` and the DB check constraint).
- Fastify routes: `POST /tasks/:stepInstanceId/reassign`,
  `POST /tasks/:stepInstanceId/delegate`, gated on
  `workflow.instance.act` (the existing "can act on a step" permission)
  — reassigning/delegating your *own* assigned task should also be
  allowed without the admin-wide permission (same "is this your own
  row" shape used throughout the codebase): if `assigned_to === caller`,
  skip the permission check.

## Explicitly NOT in this ticket
- A full temporal Delegation entity for tasks (see scope decision
  above) — only build it if a later ticket actually needs expiring
  delegations.
- Queue views — ticket 0071 (M07b), already built.

## Acceptance
- [x] Reassigning a task updates `assigned_to` and writes a
      `task_reassigned` `workflow_events` row with `from`/`to`/`reason`.
- [x] Delegating a task writes `task_delegated` instead, same shape.
- [x] Both actions are rejected once the step is
      `completed`/`skipped`/`failed`.
- [x] A step's own assignee can reassign/delegate it without
      `workflow.instance.act`; a caller who is neither the assignee nor
      a `workflow.instance.act` holder gets 403.
- [x] Cross-tenant reassignment (new assignee in a different tenant) is
      rejected.
- [x] `npm test` / `npm run build` pass; `scripts/tickets.py check` clean.

## Progress
- 2026-10-15: Split out of ticket 0065 (M07) by the architect session
  that re-read BRD §8.3. Third of three M07 sub-tickets.
- 2026-10-15 22:50 UTC: Built. `reassignTask`/`delegateTask` in
  `service.ts` share one `requireSameTenantTarget` helper (new
  `WorkflowRepository.getUserTenantId`, service-role-backed like
  `modules/authority`'s `getUserTenantId` — `createSupabaseWorkflowRepository`
  now takes a `serviceClient` first arg, `app.ts` updated) and the
  existing `requireOpenStep` guard from ticket 0070; they differ only
  in the `workflow_events` type they write (`task_reassigned` vs.
  `task_delegated` — see DECISIONS.md for why delegation isn't a
  second temporal entity). Routes `POST /tasks/:stepInstanceId/{reassign,delegate}`
  use a new `requireActOrOwnTask` preHandler (routes.ts): looks up the
  step, and if `assigned_to` already equals the caller's own id
  (resolved via new `WorkflowRepository.resolveCallerUserId`, same
  `auth.getUser()` trick as ticket 0071's My Work), allows it with no
  permission; otherwise falls through to the ordinary
  `workflow.instance.act` permission gate. New `queue.test.ts`-sibling
  `reassignment.test.ts` (6 cases: reassign+event, delegate+event,
  reject-on-completed for both, cross-tenant rejection for both) plus a
  `routes.test.ts` block covering the own-row bypass, the
  permission-holder path, the neither-owner-nor-permission 403, the
  cross-tenant 403, and 401-without-token. `npm run build`/`lint`/
  `npm test`: 251/251 across 23 files. `scripts/tickets.py check`
  clean. Status set to `testing` — all three M07 sub-tickets (0070,
  0071, 0072) are now built. Next: M08 (Approvals & Delegation, ticket
  0066), the next module in the BRD build order.
