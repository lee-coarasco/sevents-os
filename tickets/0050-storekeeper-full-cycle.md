---
id: 50
title: "Classify catalogue cluster: Storekeeper full-cycle rows"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for the remaining 29 Procurement rows
carrying "Storekeeper" as `Who is Responsible` (#691-730, excluding the
11 rows already classified in the pilot tickets 0005-0006). Completes
the Storekeeper role end-to-end: receiving → GRN/inspection → storage/
preservation → stock-ledger maintenance → issue/transfer/closeout.

## Source rows covered (5 clusters, by shared Trigger)

| Cluster | S.No. range | Already done (0005/0006) | New rows this ticket | Shared trigger (abbreviated) |
|---|---|---|---|---|
| A. Delivery receiving | 691-698 | 692, 696 (2) | 691,693,694,695,697,698 (6) | A booked delivery arrives at the warehouse, yard or project store |
| B. GRN / acceptance recording | 699-705 | 700,703,704,705 (4) | 699,701,702 (3) | The initial receiving check is complete and acceptance, inspection or rejection must be recorded |
| C. Storage & preservation | 706-713 | none | 706-713 (8) | Material is accepted into custody or a scheduled preservation check becomes due |
| D. Stock-ledger maintenance | 714-722 | 714,716,720 (3) | 715,717,718,719,721,722 (6) | A receipt, issue, reservation, count, reorder or inventory-review event occurs |
| E. Issue, transfer & closeout | 723-730 | 723,725 (2) | 724,726,727,728,729,730 (6) | An authorised material/tool request, return, transfer, loss event or project closeout occurs |

Canonical role: `role.storekeeper` (already in
`docs/canonical-role-map.md`, no map change needed).

## Disposition

A, B, E: **Configure workflow** for all new rows — same disposition as
their already-classified siblings in tickets 0005/0006.

C (new cluster): **Configure workflow** for all 8 rows. The scheduled-
sounding row (#713, "perform scheduled preservation and storage-
condition inspections") stays workflow rather than Periodic review/
monitor because the cluster's shared Output/Evidence is a physical
stock *condition* ("labelled, safely stored, protected and inspection-
ready"), not a review/exception report — a different output shape than
the review/monitor rows below.

D: **Configure workflow** for 715, 717, 722. **Periodic review/monitor**
for 718 ("perform scheduled cycle counts"), 719 ("perform the monthly
physical inventory count") and 721 ("report slow-moving, obsolete,
surplus, damaged and expired stock") — all explicitly scheduled counts
or exception reports, same disposition ticket 0006 already gave 720
("reconcile physical stock... and investigate variances") within this
exact cluster. 722 ("maintain stock-value, consumption and inventory-
exception schedules **for review**") stays workflow — it prepares the
record the review consumes, it is not the review itself.

## Acceptance
- [x] All 29 remaining Storekeeper rows (#691-730 minus the 11 in
      tickets 0005/0006) classified across 5 clusters, with per-row
      disposition split in clusters C/D consistent with ticket 0006's
      existing split of row 720.
- [x] Confirmed `role.storekeeper` already exists in
      `docs/canonical-role-map.md`.
- [ ] SLA: source `Timing` is "To be confirmed" for all 29 rows — `TBD`.
- [ ] Negative-stock/variance-investigation threshold (shared by 718-
      721) is the same open process-owner decision ticket 0006 flagged
      for row 720 — not re-litigated here.

## Progress
- 2026-10-14: Architect session. Classified Storekeeper's full
  remaining role (29 of 40 rows). **Storekeeper role now fully
  classified (40/40 combining tickets 0005, 0006 and 0050).**
  Procurement: 131/160 rows classified, 29 remain — Logistics
  Coordinator only. 1,279/1,308 rows classified overall, 29 remain.
  Next: Logistics Coordinator's remaining 29 rows — the last
  unclassified role in the entire 1,308-row catalogue.
