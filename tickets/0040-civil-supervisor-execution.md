---
id: 40
title: "Classify catalogue cluster: Civil Supervisor execution"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 20 Projects rows carrying
"Civil Supervisor" as `Who is Responsible` (#383-402). Seventh Projects
role, first supervisor-level role (one level below Site Civil Engineer,
ticket 0038, in the field chain of command).

## Source rows covered (4 clusters, by shared Trigger)

| Cluster | S.No. range | Rows | Shared trigger (abbreviated) | Output/Evidence shape |
|---|---|---|---|---|
| A. Receive plan & brief crew | 383-387 | 5 | The engineer releases the daily work plan and work-front target | Ready work front, allocated crew, verified resources, completed briefing |
| B. Supervise execution | 388-392 | 5 | The approved civil crew begins the assigned activity | Controlled civil execution completed to the daily target, ready for checking |
| C. Self-check & monitor | 393-397 | 5 | Work is underway or reaches the supervisor self-check point | Verified productivity, quality, material-use and constraint record |
| D. Shift-end reporting & handover | 398-402 | 5 | The shift, task or inspection point is completed | Attendance, quantity, status, resource request and work-front handover evidence |

All 20 rows: canonical `role.civil_supervisor` (already in
`docs/canonical-role-map.md`, under Projects, mapped as "(new, field
supervisor)" since it has no direct BRD §3.1 persona — a distinct
subordinate role to Site Civil Engineer per the source text's own
Continuity/Escalation line, "engineering decisions remain with the
Site Civil Engineer"; no map change needed).

## Disposition

**Configure workflow** for all 20 rows: a supervisor-level operational
pipeline (receive & brief → supervise execution → self-check/correct
minor issues → report & hand over) with authority explicitly capped —
Control/Handoff text repeatedly states the supervisor "corrects minor
issues within authority" but escalates "repeated defects, shortages,
delays or unsafe conditions" and that "engineering decisions remain
with the Site Civil Engineer." Cluster C's "self-check point" trigger
reads like it could be Periodic review/monitor, but it is a continuous
in-task check with a workflow-shaped output (a record), not a scheduled
review — kept as Configure workflow, consistent with how ticket 0038
treated the Site Civil Engineer's own inspection-point rows.

## Acceptance
- [x] All 20 Civil Supervisor rows (#383-402) classified into 4 trigger
      clusters, all Configure workflow.
- [x] Confirmed `role.civil_supervisor` already exists in
      `docs/canonical-role-map.md`.
- [ ] SLA: source `Timing` is "To be confirmed" for all 20 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 20 Civil Supervisor
  rows — seventh Projects role, first supervisor tier. Projects:
  202/304 rows classified, 102 remain (MEP Supervisor, Foreman,
  Chargehand, Plant & Equipment Operator, Skilled/Unskilled Labour,
  Driver all untouched). 1,081/1,308 rows classified overall, 227
  remain. Next: MEP Supervisor (20 rows) should mirror this ticket's
  pattern exactly, same as Site MEP Engineer mirrored Site Civil
  Engineer.
