---
id: 2
title: "Classify catalogue cluster: requisition commercial control (Quantity Surveyor)"
status: done
roles: [architect]
priority: 1
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for the commercial-control gate between
"site raises a need" (ticket 0001) and "Procurement receives a requisition"
(ticket 0003) in the pilot flow (`docs/PRD.md` §1).

## Source rows covered

| S.No. | Role | Work item |
|---|---|---|
| 518 | Quantity Surveyor | Verify site requisition quantity against BOQ, budget and installed balance |
| 519 | Quantity Surveyor | Create ERP requisitions linked to cost code and required-on-site date |
| 520 | Quantity Surveyor | Review procurement comparisons for quantity and scope completeness |

Shared trigger: "a verified site requirement or procurement comparison
requires commercial control." Shared output: ERP requisition, budget check,
commitment record, remaining-budget status. Shared control: "No quantity is
requested without BOQ/IFC need and cost code; over-budget or out-of-scope
need escalates before commitment." Escalation: budget/claim/variation/
margin/certification exceptions → Project Engineer, COO, CFO.

Note: S.No. 525 ("Reconcile material consumption, installed quantity and
site balance") was considered but **excluded** from this cluster — its
trigger is "work or subcontract progress reaches the measurement cutoff",
which is progress billing (Phase 5), not requisition control. Left
unclassified for a future Finance-cluster ticket; do not fold it in here.

Canonical role: `role.quantity_surveyor` (Estimator/Commercial Manager
persona, `docs/canonical-role-map.md`).

## Disposition

**Configure approval/decision** for row 518 (a check with pass/fail/
escalate outcome, no onward task by itself) and **Configure workflow** for
519-520 (produces the requisition record and feeds row 601 in ticket 0003).
This is a case where same-role, same-trigger rows still split disposition
by output shape — disposition is per-row judgement, not purely per-cluster.

## Acceptance
- [x] Rows identified and disposition judged per-row (not blanket-applied).
- [x] Excluded row 525 with reasoning, so it isn't silently dropped or
      silently miscounted as "done".
- [ ] Budget/authority check (518) needs the approval-limit values that are
      still an open decision — see `docs/PRD.md` §8-9. The capability (a
      configurable threshold check) can be designed now; it cannot be
      populated with real numbers yet.
- [ ] SLA: source `Timing` is "To be confirmed" for all three rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified this cluster, explicitly
  excluded row 525 with rationale rather than silently omitting it.
