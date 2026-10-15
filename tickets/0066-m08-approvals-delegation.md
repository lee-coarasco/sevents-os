---
id: 66
title: "M08 — Approvals & Delegation"
status: next
roles: [architect, backend-engineer]
priority: 8
created: 2026-10-15
updated: 2026-10-15
---

Third Phase 3 module per `docs/PRD.md`'s build-order table. Depends on
M03 (done), M06 (done) and M07 (ticket 0065 — approvals are a kind of
task/queue entry, build after the base task model exists). Also ties
into ticket 0062 (M06c)'s `request_approval` step type and ticket
0056 (M03)'s `approval_limits`/segregation-of-duties groundwork, both
already laid but unexercised — this module is where they get real
callers.

Reference: BRD §8.3 (FR-APP-001 through 006): sequential/parallel
approval; approver sees request + evidence + policy/authority + risk
flags + audit history; approve/reject/return-for-correction require
identity+timestamp, rejection/return requires a reason; approvals
checked against current authority and conflicts; thresholds
configurable and versioned; an approval can only be revoked through a
controlled compensating process, never by deleting history. BRD §3.2
(authorization model) and CLAUDE.md's standing note that approval
value-bands and self-approval policy are still `TBD—Business Owner
Decision` (PRD open decisions #1/#4) — do not invent specific limits or
decide the self-approval question; keep using the existing deny-by-
default/TBD placeholders ticket 0056 set up.

## Progress
- 2026-10-15: Filed as the third Phase 3 module, left at `next` behind
  tickets 0064 (M04) and 0065 (M07) in priority order. Not yet scoped —
  re-read BRD §8.3 and ticket 0056/0062's existing approval-adjacent
  groundwork before designing the data model.
