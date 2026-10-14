---
id: 5
title: "Classify catalogue cluster: delivery logistics and GRN receipt (Logistics Coordinator + Storekeeper)"
status: done
roles: [architect]
priority: 1
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for delivery tracking and goods receipt in
the pilot flow (`docs/PRD.md` §1), between PO issue (ticket 0004) and stock/
site issue (ticket 0006).

## Source rows covered

**A. Delivery planning** — trigger: "an approved PO, delivery milestone or
project call-off requires logistics planning."

| S.No. | Role | Work item |
|---|---|---|
| 656 | Logistics Coordinator | Create the delivery and transport register from approved purchase orders |
| 660 | Logistics Coordinator | Obtain transport or carrier quotations and prepare the logistics recommendation |

**B. Delivery exceptions & transfers** — trigger: "a delay, damage,
rejection, transfer, rental movement or reporting cutoff occurs."

| S.No. | Work item |
|---|---|
| 683 | Coordinate rejected-material collection and return to supplier |
| 685 | Coordinate warehouse-to-project material transfers |
| 686 | Coordinate project-to-warehouse and inter-project material transfers |
| 690 | Close each delivery file and hand receipt evidence to Procurement, Store and Finance |

**C. Goods receipt (GRN)** — trigger: "a booked delivery arrives at the
warehouse, yard or project store" (692, 696) then "the initial receiving
check is complete and acceptance, inspection or rejection must be recorded"
(700, 703, 704, 705).

| S.No. | Role | Work item |
|---|---|---|
| 692 | Storekeeper | Verify delivery booking, purchase order and authorised supplier or carrier |
| 696 | Storekeeper | Verify item, model, size, batch and project allocation against the purchase order |
| 700 | Storekeeper | Segregate and quarantine unapproved, damaged or nonconforming material |
| 703 | Storekeeper | Create the FirstBit GRN for accepted quantities |
| 704 | Storekeeper | Link GRN, delivery note, inspection and project-allocation evidence |
| 705 | Storekeeper | Submit GRN and invoice-support records to Procurement and Finance |

("FirstBit" in the source text is the prior/reference system named in the
source workbook, not a SEVENTS dependency — see Review Notes below.)

Canonical roles: `role.logistics_coordinator`, `role.storekeeper`.

## Disposition

A: **Configure workflow**. B: **Configure workflow**, except 690 which
is closer to **Track obligation/document** (a closure/evidence-handoff
record, not an ongoing workflow step). C: **Configure workflow** throughout
— this is the GRN capability named directly in `docs/PRD.md` acceptance
criterion 6, and BRD §10.3 step 8 ("receive and inspect; create GRN and
discrepancy record").

## Review notes (not operational yet)

- Row 705 ("Submit GRN and invoice-support records to Procurement and
  Finance") is the handoff into the Phase 5 invoice-matching flow. It is
  classified here because the *GRN submission* is in pilot scope; what
  Finance does with it (3-way match, payment) is explicitly out of scope
  per `docs/PRD.md` §6.
- Source text repeatedly names "FirstBit" (apparently a pre-existing/
  reference system in the source organisation). Do not read this as a
  SEVENTS integration requirement — it's provenance of the original SOP
  language, kept verbatim per BRD §6.3 (raw text preserved, not rewritten).

## Acceptance
- [x] Delivery planning, exceptions, and GRN separated into 3 sub-clusters
      by trigger; disposition judged per-row where it diverges (690).
- [x] "FirstBit" references flagged as source provenance, not an
      integration requirement, so a future session doesn't misread it as
      scope.
- [ ] Discrepancy/rejection handling (row 700) needs its evidence/closure
      rule (BRD §6.4 field 5) defined before this can be simulated — SLA
      and escalation threshold for unresolved quarantine are not in the
      source text and should be confirmed with the process owner.
- [ ] SLA: source `Timing` is "To be confirmed" for every row — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all three sub-clusters;
  flagged the "FirstBit" provenance note so it isn't mistaken for a real
  integration requirement in a later phase.
