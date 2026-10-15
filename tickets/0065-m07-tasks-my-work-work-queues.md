---
id: 65
title: "M07 — Tasks, My Work & Work Queues"
status: done
roles: [architect, backend-engineer]
priority: 7
created: 2026-10-15
updated: 2026-10-15
---

Second Phase 3 module per `docs/PRD.md`'s build-order table. Depends on
M03 (done) and M06 (tickets 0060-0063, code-complete). This is the
module ticket 0062 (M06c) explicitly left a seam for: `workflow_step_instances`
rows with `status='waiting'` and `node_type` in (`create_task`,
`assign_role_user`, `request_approval`) are sitting there with no queue
UI/API reading them yet — re-read ticket 0062's Progress note for the
exact hand-off contract before designing this module's data model, and
reuse `workflow_step_instances` as the task record where a task
originates from a workflow step rather than inventing a second task
table that duplicates it. (A manually-created, non-workflow task — if
the BRD requires one — is a separate, smaller case.)

Reference: BRD §8.3 (FR-TASK-001 through 005): My Work/Team Work/Due
Soon/Overdue/Blocked/Waiting Approval/Completed views; owner/assignee/
reviewer/due date/priority/dependency/comments/evidence/status; status
transitions validated server-side; blocked requires a reason; reassignment/
delegation audited. BRD §6.2 entities: Task, TaskAssignment, Checklist,
Comment, Attachment, SLA, Escalation.

This is likely a multi-ticket module (data model + queue views/filters +
comments/evidence attachment + blocked/escalation state) — re-read BRD
§8.3 in full and split it the way ticket 0059 (M06) was split into
0060-0063, rather than building it as one giant ticket.

## Progress
- 2026-10-15: Filed as the second Phase 3 module, left at `next` behind
  ticket 0064 (M04) in priority order (PRD's Phase 3 table lists M04
  first). Not yet scoped in detail — the architect picking this up
  should re-read BRD §8.3 and ticket 0062's M07/M08 hand-off notes
  before splitting into sub-tickets.
- 2026-10-15 21:05 UTC: Architect session. Re-read BRD §8.3 in full
  (FR-TASK-001 through 005 is the entire section for this module — the
  FR-APP-* items right after it belong to M08) and ticket 0062's
  Progress note for the exact M07/M08 hand-off contract
  (`workflow_step_instances` rows with `status='waiting'` and
  `node_type` in `create_task`/`assign_role_user`/`request_approval`,
  `assigned_to` already set — confirmed `workflow_step_instances` is
  the task record, no second table). Closed this ticket with no code
  and split into three sub-tickets, same precedent as ticket 0059 (M06)
  splitting into 0060-0063: ticket 0070 (M07a — task metadata columns/
  blocking/comments/evidence, additive to `workflow_step_instances` +
  new `task_comments` + a nullable FK on `file_objects`), ticket 0071
  (M07b — the seven BRD-named queue views as read-only queries/routes),
  ticket 0072 (M07c — reassignment/delegation, audited). Each depends
  on the one before it. See DECISIONS.md for the split rationale. The
  task-delegation scope call (delegation as a reassignment variant, not
  a second temporal entity like authority's `delegations`) is recorded
  directly in ticket 0072 and gets its own DECISIONS.md entry when that
  ticket is actually built, not here.
