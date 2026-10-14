---
id: 36
title: "Classify catalogue cluster: Quantity Surveyor cost control, measurement and billing"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for the remaining 25 of 28 Projects
rows carrying "Quantity Surveyor" as `Who is Responsible` (#513-540).
Three rows (518-520) were already classified in the pilot-flow ticket
0002 ("requisition commercial control"); that ticket explicitly
**excluded** row 525 and flagged it "for a future Finance-cluster
ticket" — this is that ticket. Third Projects role picked up after COO
(0034) and Project Engineer Lead (0035).

## Source rows covered (6 clusters, by shared Trigger; excludes 518-520 already in ticket 0002)

| Cluster | S.No. range | Rows | Shared trigger (abbreviated) | Output/Evidence shape |
|---|---|---|---|---|
| A. Cost-baseline setup | 513-517 | 5 | Awarded project and approved commercial handover are received | Reconciled cost baseline, cost-code structure, cash-flow, commercial-risk register |
| B. Budget/commitment tracking (remainder) | 521 | 1 | Verified site requirement or procurement comparison requires commercial control (518-520 already in ticket 0002) | ERP requisition, budget check, commitment record, remaining-budget status |
| C. Progress measurement | 522-526 | 5 (incl. #525) | Work or subcontract progress reaches the measurement cutoff | Verified measurement sheets, quantity reconciliation, certification status |
| D. Variation & claims management | 527-531 | 5 | An instruction, scope difference, delay or additional work is identified | Timely variation/notice record, measured value, substantiation, approval status |
| E. Client/subcontractor billing | 532-536 | 5 | Client milestone or supplier/subcontractor payment cutoff is reached | Certified valuation, invoice-support pack, payment evidence, collection action |
| F1. Monthly forecast & variance reporting | 537-538 | 2 | Monthly forecast, final account, retention or project-closeout cycle becomes due | Forecast-at-completion, variance action |
| F2. Final account & commercial closeout | 539-540 | 2 | Same as F1, but final-account/closeout-specific rows | Final-account status, commercial handover |

All 28 rows: canonical `role.quantity_surveyor` (Estimator/Commercial
Manager persona, already in `docs/canonical-role-map.md`).

## Disposition

**Configure workflow** (23 of 25 rows here — clusters A, B-remainder,
C, D, E, F2): multi-step operational pipelines (cost-baseline setup,
budget tracking, progress measurement/certification, variation
lifecycle, billing preparation, final-account/closeout) feeding
Finance/Procurement/COO, consistent with 519-520's disposition in
ticket 0002.

**Periodic review/monitor** (2 rows — cluster F1, #537-538): split out
of the F cluster because "prepare monthly cost-to-complete and
forecast-at-completion" and "report budget variance" are explicitly
cadence-driven (monthly) with a measurable variance output — BRD §6.5's
review/monitor shape — while #539-540 in the same raw cluster are
closeout-event workflow steps (final account, handover), not a
recurring review. Same per-row judgement-within-a-cluster approach
ticket 0002 used for row 518 vs. 519-520.

Row #525 (previously excluded from ticket 0002) is now classified as
part of cluster C, Configure workflow — ticket 0002's deferral note is
resolved.

## Acceptance
- [x] All 25 remaining Quantity Surveyor rows (513-517, 521, 522-540)
      classified; combined with ticket 0002's 518-520, the full 28-row
      Quantity Surveyor role is now classified.
- [x] Row #525's deferred classification from ticket 0002 is resolved.
- [x] Confirmed `role.quantity_surveyor` already exists in
      `docs/canonical-role-map.md`.
- [ ] SLA: source `Timing` is "To be confirmed" for all 25 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified the remaining 25 Quantity
  Surveyor rows, resolving ticket 0002's deferred row #525. Quantity
  Surveyor role now fully classified (28/28: 3 in ticket 0002 + 25
  here). Projects: 96/304 rows classified (71 + 25, #525 no longer
  double-counted as "excluded"), 208 remain untouched (QHSE Engineer,
  Site Civil/MEP Engineer, Civil/MEP Supervisor, Foreman, Chargehand,
  Plant & Equipment Operator, Skilled/Unskilled Labour, Driver).
  975/1,308 rows classified overall, 333 remain. Next: QHSE Engineer
  (30 rows) is the next-largest untouched Projects role.
