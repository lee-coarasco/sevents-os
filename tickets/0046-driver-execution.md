---
id: 46
title: "Classify catalogue cluster: Driver execution"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 14 Projects rows carrying
"Driver" as `Who is Responsible` (#483-496). Thirteenth Projects role.
Confirmed no overlap with the pilot tickets (0001-0002).

## Source rows covered (4 clusters, by shared Trigger)

| Cluster | S.No. range | Rows | Shared trigger (abbreviated) | Output/Evidence shape |
|---|---|---|---|---|
| A. Pre-trip vehicle/document check | 483-486 | 4 | An authorised transport request is received | Roadworthy vehicle, verified driver documents, controlled trip/load instruction |
| B. Transport execution | 487-490 | 4 | The approved vehicle, route, load and timing are confirmed | Safe transport and completed collection/delivery according to instruction |
| C. Trip/evidence recording | 491-493 | 3 | A trip, delivery or refuelling event occurs | Delivery evidence and complete trip, fuel, mileage and exception records |
| D. Incident & shift-end | 494-496 | 3 | A breakdown, accident, delay, defect or shift close occurs | Secured vehicle, notified incident, authorised recovery/maintenance, closed shift record |

All 14 rows: canonical `role.driver` (already in
`docs/canonical-role-map.md`, "(new)"; no map change needed).

## Disposition

**Configure workflow** for all 14 rows: a certification-gated field role
(licence/registration/insurance checks before a trip), same pattern as
Plant & Equipment Operator (ticket 0044) — the check is a precondition
the Driver verifies, not a decision authority; "accident, unsafe
vehicle, expired document or material transport delay escalates
immediately to the Project Engineer." Cluster D's incident-reporting row
(#494) stays Configure workflow, same reasoning as every other "report/
stop on unsafe condition" row across the field-tier tickets.

## Acceptance
- [x] All 14 Driver rows (#483-496) classified into 4 trigger clusters,
      all Configure workflow.
- [x] Confirmed `role.driver` already exists in
      `docs/canonical-role-map.md`.
- [ ] SLA: source `Timing` is "To be confirmed" for all 14 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 14 Driver rows —
  thirteenth Projects role. Projects: 292/304 rows classified, 12
  remain (Unskilled Labour only). 1,171/1,308 rows classified overall,
  137 remain. Next: Unskilled Labour (12 rows) — the last Projects
  role; completing it closes the Projects department entirely.
