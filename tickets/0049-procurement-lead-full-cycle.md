---
id: 49
title: "Classify catalogue cluster: Procurement Lead full-cycle rows"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for the remaining 39 Procurement rows
carrying "Procurement Lead" as `Who is Responsible` (#601-655, excluding
the 16 rows already classified in the pilot tickets 0003-0004). This
completes the Procurement Lead role end-to-end: intake → vendor
sourcing/RFQ → quotation evaluation/negotiation → commitment drafting →
post-award administration → closeout.

## Source rows covered (5 clusters, by shared Trigger — each cluster
also contains rows already classified in tickets 0003/0004, listed for
context but not reclassified here)

| Cluster | S.No. range | Already done (0003/0004) | New rows this ticket | Shared trigger (abbreviated) |
|---|---|---|---|---|
| A. Requisition intake | 601-610 | 601,604,605,606,608,610 (6) | 602,603,607,609 (4) | An approved project baseline, IFC/BOQ requirement, material request or subcontract need reaches Procurement |
| B. Vendor sourcing & RFQ | 611-620 | 618,619 (2) | 611,612,613,614,615,616,617,620 (8) | A sourcing package or new vendor/subcontractor requirement is approved |
| C. Quotation evaluation & negotiation | 621-630 | 621,622,624,630 (4) | 623,625,626,627,628,629 (6) | The tender cutoff passes and compliant quotations are available for evaluation |
| D. Commitment drafting | 631-640 | 631,633,639,640 (4) | 632,634,635,636,637,638 (6) | The procurement recommendation is approved and commitment documents must be formed |
| E. Post-award administration & closeout | 641-655 | none | 641-655 (15) | A PO/subcontract is awarded, a milestone becomes due, an invoice arrives or the package reaches closeout |

Canonical role: `role.procurement_lead` (already in
`docs/canonical-role-map.md`, Procurement Manager/Buyer persona; no map
change needed).

## Disposition

A, B, D: **Configure workflow** for all new rows — same disposition as
their already-classified siblings in tickets 0003/0004; no row in these
3 clusters' new set has a decision/approval output shape distinct from
the rest of its cluster.

C: **Configure workflow** for 623, 625, 626, 628, 629. **Configure
approval/decision** for 627 ("Prepare and approve the negotiation plan
within delegated authority") — the only row in this new set whose
output is itself an approval ("approve... within delegated authority"),
same per-row-judgement principle ticket 0003 used for 621.

E (new cluster, not touched by any prior ticket): **Configure workflow**
for 641-653 and 655 (14 rows) — kick-off, register/milestone tracking,
expediting, delivery call-offs, variation/suspension/termination
control, claims/dispute management, rejected-material coordination,
invoice/payment-pack verification and submission, scorecard maintenance,
final closeout. **Periodic review/monitor** for 654 ("Prepare weekly and
monthly procurement status, commitments and exception reports") — same
cadence-reporting split used in nearly every department so far (most
recently CPO, ticket 0048).

## Acceptance
- [x] All 39 remaining Procurement Lead rows (#601-655 minus the 16 in
      tickets 0003/0004) classified across 5 clusters, with per-row
      disposition split where output shape differs (627, 654).
- [x] Confirmed `role.procurement_lead` already exists in
      `docs/canonical-role-map.md`.
- [ ] SLA: source `Timing` is "To be confirmed" for all 39 rows — `TBD`.
- [ ] Negotiation-plan delegated-authority thresholds (627) are the same
      open Delegation-of-Authority decision as tickets 0002/0004/0048
      (`docs/PRD.md` §9) — not re-litigated here.

## Progress
- 2026-10-14: Architect session. Classified Procurement Lead's full
  remaining role (39 of 55 rows). **Procurement Lead role now fully
  classified (55/55 combining tickets 0003, 0004 and 0049).**
  Procurement: 102/160 rows classified, 58 remain — Storekeeper (29 of
  40), Logistics Coordinator (29 of 35). 1,250/1,308 rows classified
  overall, 58 remain. Next: Storekeeper's remaining 29 rows, the
  largest untouched role left in the entire catalogue.
