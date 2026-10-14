---
id: 51
title: "Classify catalogue cluster: Logistics Coordinator full-cycle rows"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for the remaining 29 Procurement rows
carrying "Logistics Coordinator" as `Who is Responsible` (#656-690,
excluding the 6 rows already classified in ticket 0005). **This is the
last unclassified role in the entire 1,308-row catalogue** — completing
it closes out ticket 0007's tracking work.

## Source rows covered (4 clusters, by shared Trigger)

| Cluster | S.No. range | Already done (0005) | New rows this ticket | Shared trigger (abbreviated) |
|---|---|---|---|---|
| A. Delivery planning | 656-663 | 656, 660 (2) | 657,658,659,661,662,663 (6) | An approved PO, delivery milestone or project call-off requires logistics planning |
| B. Booking & dispatch compliance | 664-672 | none | 664-672 (9) | The approved delivery reaches booking, collection, dispatch or cross-border movement |
| C. Arrival coordination | 673-680 | none | 673-680 (8) | The consignment is dispatched or approaches the project/warehouse delivery window |
| D. Exceptions, transfers & closure | 681-690 | 683,685,686,690 (4) | 681,682,684,687,688,689 (6) | A delay, damage, rejection, transfer, rental movement or reporting cutoff occurs |

Canonical role: `role.logistics_coordinator` (already in
`docs/canonical-role-map.md`, no map change needed).

## Disposition

A: **Configure workflow** for all new rows — same disposition as the
already-classified siblings in ticket 0005.

B (new cluster): **Configure workflow** for all 9 rows — booking,
collection/dispatch authorisation, packing/document verification,
customs/duty/broker coordination, cargo insurance, shipment tracking,
dispatch-evidence maintenance. All execution/verification steps with no
decision output of their own; exceptions escalate to the Procurement
Lead per the shared Continuity/Escalation text.

C (new cluster): **Configure workflow** for all 8 rows — ETA
communication, gate access, lifting/HSE coordination, receiving-
inspection attendance, proof-of-delivery capture, waiting-time/demurrage
recording, after-hours delivery coordination. Same reasoning as B.

D: **Configure workflow** for 681, 682, 684, 687, 688. **Periodic
review/monitor** for 689 ("prepare logistics cost, carrier-performance
and exception reporting") — cadence/exception reporting language,
matching the review/monitor split used throughout nearly every
department's reporting rows (most recently ticket 0050's Storekeeper
cluster).

## Acceptance
- [x] All 29 remaining Logistics Coordinator rows (#656-690 minus the 6
      in ticket 0005) classified across 4 clusters.
- [x] Confirmed `role.logistics_coordinator` already exists in
      `docs/canonical-role-map.md`.
- [ ] SLA: source `Timing` is "To be confirmed" for all 29 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified Logistics Coordinator's
  full remaining role (29 of 35 rows). **Logistics Coordinator role now
  fully classified (35/35 combining tickets 0005 and 0051).**
  **Procurement department now fully classified (160/160 rows).**
  **All 1,308 rows in the source catalogue are now classified** across
  tickets 0001-0051 (ticket 0007's tracking table confirms the final
  count). Acceptance criteria 1-3 in ticket 0007 are now met for every
  row having a disposition, canonical role and source-row record; the
  remaining open items across all classification tickets are the
  cross-cutting ones already flagged repeatedly — Delegation of
  Authority/approval-value bands (`docs/PRD.md` §9) and SLA values
  (every row's source `Timing` is "To be confirmed"). Next: ticket 0007
  itself should be closed out and the architect's attention moves to
  whatever `docs/PRD.md`/`docs/IMPLEMENTATION-PLAN.md` names as the
  next Phase 0 deliverable, since the catalogue import is done.
