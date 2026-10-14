---
id: 48
title: "Classify catalogue cluster: CPO governance & oversight"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for the remaining 28 Procurement rows
carrying "Chief Procurement Officer (CPO)" as `Who is Responsible`
(#571-600, excluding 582/584 already classified in ticket 0004 — the PO
approval gate in the pilot flow). First role picked up in Procurement
after the pilot tickets (0001-0006); same C-suite skew pattern as
CFO/CLO/CMO/CRO (tickets 0016, 0019, 0022, 0030) — mostly Configure
approval/decision with a small review/monitor slice.

## Source rows covered (6 clusters, by shared Trigger)

| Cluster | S.No. range | Rows | Shared trigger (abbreviated) | Output/Evidence shape |
|---|---|---|---|---|
| A. Policy & governance approval | 571-575 | 5 | The annual planning cycle, policy review, authority review or material control concern requires direction | Approved procurement policy, authority decision, ethical-control action, controlled template |
| B. Project procurement strategy approval | 576-580 | 5 | A new project, annual category review, procurement-plan update or critical sourcing need is approved | Approved procurement strategy, package plan, sourcing route, resource plan, long-lead control |
| C. Award/commitment approval gate | 581, 583, 585 (+582, 584 in ticket 0004) | 3 (+2) | A complete comparison, recommendation, purchase order or subcontract award reaches the approval gate | Authorised selection, award, commitment or escalated approval decision |
| D. Supply-risk & recovery decision | 586-590 | 5 | The weekly review, critical-path alert, cost variance, vendor failure or supply exception occurs | Approved recovery, value-engineering, replacement, claim or risk-treatment decision |
| E. Vendor/compliance/continuity approval | 591-595 | 5 | A vendor, master-data, inventory, audit, insurance or compliance review becomes due | Approved vendor, inventory, compliance, suspension or continuity action |
| F. Reporting cadence & access/continuity approval | 596-600 | 5 | The daily/weekly/monthly reporting cycle, access review, absence or process-improvement need occurs | Verified dashboard, executive decision, continuity arrangement, approved improvement action |

Canonical role: `role.cpo` (already in `docs/canonical-role-map.md`,
"Department Head (new — not separately named in §3.1)"; no map change
needed).

## Disposition

Clusters A, B, C, D, E: **Configure approval/decision** (25 rows) —
every row's Output/Evidence is an approval, authorisation or decision
record, matching BRD §6.5 exactly; same pattern as every other C-suite
ticket (Chairman/CEO/CFO/CLO/CMO all skew heavily to this disposition).

Cluster F splits by Output/Evidence shape, same as CFO (0016)/CMO
(0022)'s cadence-reporting rows: **Periodic review/monitor** for 596
("review the weekly ... dashboard"), 597 ("review the monthly ...
scorecard") and 598 ("report ... to the CEO") — recurring cadence checks
with a measurable output, no decision outcome of their own beyond the
review/report itself. **Configure approval/decision** for 599 (approve
access-control/continuity arrangements) and 600 (sponsor process/
automation improvements — a sponsorship decision, not a routine report).

## Acceptance
- [x] All 28 remaining CPO rows (#571-600 minus 582/584) classified
      into 6 trigger clusters.
- [x] Confirmed `role.cpo` already exists in
      `docs/canonical-role-map.md`.
- [ ] SLA: source `Timing` is "To be confirmed" for all 28 rows — `TBD`.
- [ ] Approval value bands/Delegation of Authority thresholds are the
      same open decision as tickets 0002/0004 (`docs/PRD.md` §9) — not
      re-litigated here; this ticket defines the gate shapes only.

## Progress
- 2026-10-14: Architect session. Classified CPO's full remaining role
  (28 of 30 rows; 582/584 already done in ticket 0004) — first
  Procurement role picked up post-pilot. CPO role now fully classified
  (30/30 combining tickets 0004 and 0048). Procurement: 63/160 rows
  classified, 97 remain (Procurement Lead 39 remaining of 55,
  Storekeeper 29 remaining of 40, Logistics Coordinator 29 remaining of
  35). 1,211/1,308 rows classified overall, 97 remain. Next:
  Procurement Lead's vendor-management-beyond-RFQ rows (39 remaining)
  — the largest untouched Procurement role.
