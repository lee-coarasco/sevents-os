---
id: 35
title: "Classify catalogue cluster: Project Engineer (Lead) on-site execution"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 35 Projects rows carrying
"Project Engineer (Lead)" as `Who is Responsible` (#292-326). Second
Projects role picked up after COO (ticket 0034). This is the
project's day-to-day operational owner — the role the COO appoints at
the construction-ready handover gate (ticket 0034 cluster B) and who
runs the project until final closeout.

## Source rows covered (6 clusters, by shared Trigger)

| Cluster | S.No. range | Rows | Shared trigger (abbreviated) | Output/Evidence shape |
|---|---|---|---|---|
| A. Project acceptance & setup | 292-296 | 5 | COO assigns the project after accepting the CTO-to-COO handover | Controlled project setup, confirmed scope, ownership matrix, baseline registers |
| B. Mobilisation planning | 297-302 | 6 | Project accepted and mobilisation planning is authorised | Approved baseline programme, mobilisation plan, resource plan, readiness schedule |
| C. Daily site coordination | 303-308 | 6 | A workday, lookahead activity or controlled site instruction requires coordination | Released work front, current register, coordinated instruction, daily evidence |
| D. Procurement & billing coordination | 309-314 | 6 | Programme creates a material, subcontract, billing or payment-support requirement | Verified requisition, delivery/certification record, quantity review, finance handoff |
| E. Progress & variation management | 315-320 | 6 | Progress review, client instruction, delay, RFI, variation or project risk requires action | Updated programme, notice, change record, technical response, recovery plan |
| F. Testing, handover & DLP | 321-326 | 6 | Construction reaches testing, snagging, completion, handover or DLP status | Approved test evidence, closed snags, as-builts, O&M records, handover evidence, DLP closure |

All 35 rows: canonical `role.project_engineer_lead` (already in
`docs/canonical-role-map.md`, no change needed).

## Disposition

**Configure workflow** for all 35 rows: every cluster is the PE Lead
personally executing/coordinating/certifying a multi-step operational
pipeline (setup → mobilise → coordinate daily → procure/bill →
manage progress/variations → test/handover/close). Unlike the COO
rows one level up (ticket 0034), which were almost entirely
approval/decision gates, the PE Lead's rows contain no final sign-off
authority anywhere — every cluster's Control/Handoff text routes
budget, safety, technical-design and material exceptions up to the
COO/CTO/QHSE/CFO. This is the clean inverse of the COO pattern and
matches BRD §6.5's workflow definition directly: "actionable recurring
work that fits supported capabilities."

## Acceptance
- [x] All 35 Project Engineer (Lead) rows (#292-326) classified into 6
      trigger clusters, all Configure workflow.
- [x] Confirmed `role.project_engineer_lead` already exists in
      `docs/canonical-role-map.md`.
- [ ] SLA: source `Timing` is "To be confirmed" for all 35 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 35 Project Engineer
  (Lead) rows — second Projects role. Projects: 71/304 rows classified
  (11 pilot + 25 COO + 35 here), 1 excluded, 232 remain untouched
  (Quantity Surveyor, QHSE Engineer, Site Civil/MEP Engineer, Civil/MEP
  Supervisor, Foreman, Chargehand, Plant & Equipment Operator,
  Skilled/Unskilled Labour, Driver). 950/1,308 rows classified overall,
  358 remain. Next: Quantity Surveyor (28 rows) is the next-largest
  untouched Projects role.
