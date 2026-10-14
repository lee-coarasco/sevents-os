---
id: 41
title: "Classify catalogue cluster: MEP Supervisor execution"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 20 Projects rows carrying "MEP
Supervisor" as `Who is Responsible` (#403-422). Eighth Projects role,
directly after Civil Supervisor (ticket 0040) — mirrors it exactly, one
discipline over, same chain of command under Site MEP Engineer (ticket
0039).

## Source rows covered (4 clusters, by shared Trigger)

| Cluster | S.No. range | Rows | Shared trigger (abbreviated) | Output/Evidence shape |
|---|---|---|---|---|
| A. Receive plan & brief crew | 403-407 | 5 | The engineer releases the daily work plan and work-front target | Ready work front, allocated crew, verified resources, completed briefing |
| B. Supervise execution | 408-412 | 5 | The approved MEP crew begins the assigned activity | Controlled MEP execution completed to the daily target, ready for checking |
| C. Self-check & monitor | 413-417 | 5 | Work is underway or reaches the supervisor self-check point | Verified productivity, quality, material-use and constraint record |
| D. Shift-end reporting & handover | 418-422 | 5 | The shift, task or inspection point is completed | Attendance, quantity, status, resource request and work-front handover evidence |

All 20 rows: canonical `role.mep_supervisor` (already in
`docs/canonical-role-map.md`, under Projects, mapped as "(new, field
supervisor)"; no map change needed).

## Disposition

**Configure workflow** for all 20 rows, identical reasoning to Civil
Supervisor (ticket 0040): authority explicitly capped to "minor issues"
with repeated defects, shortages, delays or unsafe conditions escalating
to the Site MEP Engineer. Cluster B's "ELV, fire-alarm and
specialist-system installation within scope" row (#411) stayed
Configure workflow for the same reason ticket 0039's equivalent row did
— it is installation execution, not the life-safety approval itself.

## Acceptance
- [x] All 20 MEP Supervisor rows (#403-422) classified into 4 trigger
      clusters, all Configure workflow.
- [x] Confirmed `role.mep_supervisor` already exists in
      `docs/canonical-role-map.md`.
- [ ] SLA: source `Timing` is "To be confirmed" for all 20 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 20 MEP Supervisor
  rows — eighth Projects role, mirroring Civil Supervisor (0040)
  exactly. Projects: 222/304 rows classified, 82 remain (Foreman,
  Chargehand, Plant & Equipment Operator, Skilled/Unskilled Labour,
  Driver all untouched — all 5 remaining roles are 12-18 rows each).
  1,101/1,308 rows classified overall, 207 remain. Next: Foreman
  (18 rows) is the next-largest untouched Projects role.
