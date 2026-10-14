---
id: 43
title: "Classify catalogue cluster: Chargehand execution"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 16 Projects rows carrying
"Chargehand" as `Who is Responsible` (#441-456). Tenth Projects role,
one tier below Foreman (ticket 0042) — the crew-level coordinator, not
split by trade.

## Source rows covered (4 clusters, by shared Trigger)

| Cluster | S.No. range | Rows | Shared trigger (abbreviated) | Output/Evidence shape |
|---|---|---|---|---|
| A. Receive instruction & brief workers | 441-444 | 4 | The Foreman assigns a crew task and target | Workers allocated, briefed and equipped for the approved task |
| B. Coordinate execution | 445-448 | 4 | Workers begin the authorised task | Coordinated crew execution, stable material supply, controlled interfaces |
| C. Check & protect | 449-452 | 4 | Work is underway or a hazard/quality concern is observed | Corrected minor work, protected assets, safe and orderly work front |
| D. Record & report | 453-456 | 4 | The shift, task or material issue is completed | Crew output, exception, material return and completion status reported to the Foreman |

All 16 rows: canonical `role.chargehand` (already in
`docs/canonical-role-map.md`, "(new) crew-level supervisory, reports to
Foreman"; no map change needed).

## Disposition

**Configure workflow** for all 16 rows: the same authority-capped
pattern one tier further down than Foreman — "technical, quality,
safety and resource exceptions escalate to the Foreman or Supervisor,"
"unsafe work is stopped immediately" (a stop-work action, not a
decision), and "only observed quantities and conditions are reported."

## Acceptance
- [x] All 16 Chargehand rows (#441-456) classified into 4 trigger
      clusters, all Configure workflow.
- [x] Confirmed `role.chargehand` already exists in
      `docs/canonical-role-map.md`.
- [ ] SLA: source `Timing` is "To be confirmed" for all 16 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 16 Chargehand rows —
  tenth Projects role. Projects: 256/304 rows classified, 48 remain
  (Plant & Equipment Operator 16, Skilled Labour 14, Driver 14,
  Unskilled Labour 12 — the 4 lowest-tier roles). 1,135/1,308 rows
  classified overall, 173 remain. Next: Plant & Equipment Operator (16
  rows) is the next-largest untouched Projects role.
