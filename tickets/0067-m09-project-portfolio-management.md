---
id: 67
title: "M09 — Project & Portfolio Management"
status: next
roles: [architect, backend-engineer]
priority: 9
created: 2026-10-15
updated: 2026-10-15
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
