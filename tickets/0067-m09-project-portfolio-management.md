---
id: 67
title: "M09 — Project & Portfolio Management"
status: done
roles: [architect, backend-engineer]
priority: 9
created: 2026-10-15
updated: 2026-10-16
---

Fourth Phase 3 module per `docs/PRD.md`'s build-order table. Depends on
M02 (done — ticket 0055 already created a minimal `projects` stub),
M03 (done) and M08 (ticket 0066 — baseline changes require approval per
FR-PROJ-004). This module replaces/extends ticket 0055's stub
`projects` table with the real WBS/budget/risk model; do not create a
second parallel project table.

Reference: BRD §8.4 (FR-PROJ-001 through 008): project creation only
via authorized manual entry or an approved opportunity/contract-award
workflow; project setup captures client/location/type/contract/PM/
baseline dates/budget/document register; WBS/milestones/activities/
dependencies/planned-vs-actual; baseline changes need reason+impact+
approval; issue/risk/decision/assumption/dependency/change-request
tracking; project health must show contributing factors and last-
refresh time (never an unexplained AI score); forecast vs. approved
baseline must stay distinguishable; closeout checklist. BRD §6.2
entities: Project, ProjectType, ProjectBaseline, WBSNode, Milestone,
ScheduleActivity, ProgressEntry.

This is a large module (WBS, baselines, scheduling, risk register) —
re-read BRD §8.4 in full and expect to split it into sub-tickets the
way ticket 0059 (M06) was split, rather than building it as one ticket.
Note M10 (CRM) and M11 (Tendering) both feed into project creation
("approved opportunity/contract-award workflow") but are later Phase 4
modules — FR-PROJ-001's "authorized manual entry" path is what this
ticket can build now; the opportunity/contract-award trigger path can
be a documented seam for M10/M11 to plug into later, same pattern as
ticket 0062's M07/M08 seam.

## Progress
- 2026-10-15: Filed as the fourth Phase 3 module, left at `next` behind
  tickets 0064-0066 in priority order. Not yet scoped — re-read BRD
  §8.4 and ticket 0055's existing stub `projects` table before
  designing the real data model.
- 2026-10-15 21:22 UTC: Architect session. Re-read BRD §8.4 in full
  and ticket 0055's stub `projects` table. Closed this ticket with no
  code and split into five sub-tickets, same precedent as ticket 0059
  (M06) splitting into 0060-0063 and ticket 0065 (M07) splitting into
  0070-0072: ticket 0073 (M09a — project register & setup, extends
  the M02 stub table in place, FR-PROJ-001/002), 0074 (M09b — WBS/
  milestones/schedule activities/dependencies/progress, FR-PROJ-003),
  0075 (M09c — baseline snapshots and approval-gated baseline-change
  control via the M08 approval seam, FR-PROJ-004). That session's
  commit (03fc91f) filed 0073-0075 but did not close this parent
  ticket or record the split in DECISIONS.md — doing both now.
- 2026-10-16: Found the gap above while picking up this ticket as
  `tickets.py next`'s result (it was still `status: next` despite
  0073-0075 existing). Closing it out properly: filed the two
  remaining sub-tickets 0073/0074/0075 had already referenced in
  their "out of scope" sections but that didn't exist as files —
  0076 (M09d — issue/risk/decision/assumption/dependency/change-
  request register, FR-PROJ-005) and 0077 (M09e — health/forecast-
  vs-baseline/closeout checklist, FR-PROJ-006/007/008). Recorded the
  full split rationale in DECISIONS.md. M09 is now five sub-tickets:
  0073-0077, all `status: next`, same pattern as M06/M07. Picking up
  0073 next in this same session.
