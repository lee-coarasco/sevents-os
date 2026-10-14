---
id: 15
title: "Classify catalogue cluster: MEP Estimator tender-to-award lifecycle"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 25 Technical Engineering rows
carrying "MEP Estimator" as `Who is Responsible` (#242-266). Eighth and
final batch of ticket 0007's Technical Engineering pass — completes the
entire department (196/196 rows).

## Source rows covered

Mirrors ticket 0014's Civil Estimator structure row-for-row (same
clusters, same shared trigger text, same escalation shape, substituting
MEP scope for civil scope).

**A. Tender intake and scope review** — trigger: "a controlled tender/
quotation package and deadline are received."

| S.No. | Work item |
|---|---|
| 242 | Receive and register MEP tender package and submission deadline |
| 243 | Review HVAC, plumbing, electrical and ELV tender scope |
| 244 | Identify missing MEP information, contradictions and commercial risks |
| 245 | Prepare MEP tender queries, assumptions and clarification log |
| 246 | Attend MEP tender site visit and record services constraints |

**B. Quantity takeoff** — trigger: "the controlled tender drawings, BOQ
and specifications are available."

| S.No. | Work item |
|---|---|
| 247 | Prepare HVAC equipment, ductwork and piping quantity takeoff |
| 248 | Prepare plumbing, drainage and water-system quantity takeoff |
| 249 | Prepare fire-protection quantity takeoff where included in scope |
| 250 | Prepare electrical power and lighting quantity takeoff |
| 251 | Prepare ELV, containment and specialist-system quantity takeoff |
| 252 | Reconcile MEP takeoff against BOQ, drawings and specifications |

**C. Market pricing (RFQ/comparison)** — trigger: "takeoff and RFQ
packages are ready for market enquiry."

| S.No. | Work item |
|---|---|
| 253 | Prepare MEP supplier and specialist-subcontractor RFQ packages |
| 254 | Coordinate MEP market quotations through Procurement |
| 255 | Prepare MEP quotation comparison and technical-commercial compliance review |
| 256 | Resolve MEP vendor exclusions, deviations and unpriced scope |

**D. Rate build-up and risk** — trigger: "verified quantities and market
inputs are available."

| S.No. | Work item |
|---|---|
| 257 | Prepare MEP labour, material, equipment and subcontract rate build-ups |
| 258 | Apply MEP productivity, access, testing and logistics assumptions |
| 259 | Price builders-work, authority, testing and commissioning allowances |
| 260 | Prepare MEP risk, opportunity, exclusion and contingency register |
| 261 | Develop MEP value-engineering and alternative-system pricing options |

**E. Submission, negotiation and award handover** — trigger: "the
estimate reaches internal review, client submission, negotiation or
award."

| S.No. | Work item |
|---|---|
| 262 | Prepare priced MEP BOQ and commercial summary |
| 263 | Complete MEP estimate self-check and reconciliation |
| 264 | Submit MEP estimate for CTO review and approved margin integration |
| 265 | Revise MEP offer for client clarification and negotiation |
| 266 | Handover final MEP estimate, assumptions and cost baseline after award |

All 25 rows: canonical `role.mep_estimator`
(`docs/canonical-role-map.md`). Shared escalation throughout A-E: "The
Civil Estimator may support tender administration but not MEP technical
judgement" — the mirror image of ticket 0014's escalation text.

## Disposition

**All 25 rows (A-E): Configure workflow.** Same reasoning as ticket
0014, including the same considered-and-rejected split for C255/C256
(quotation comparison/resolution) — kept as workflow because the
comparison output is a required input to D's rate build-up, not a
closed, chain-stopping decision.

## Acceptance
- [x] All 25 MEP Estimator rows (#242-266) classified into 5
      trigger-clusters, confirmed structurally identical to ticket 0014's
      Civil Estimator clusters.
- [x] Technical Engineering department now fully classified: 196/196 rows
      across 8 roles (tickets 0008-0015).
- [ ] SLA: source `Timing` is "To be confirmed" for all 25 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 25 MEP Estimator rows —
  the eighth and final role in Technical Engineering. Department complete
  (196/196 rows, tickets 0008-0015). Next department: Finance (120 rows,
  not started) per ticket 0007's table.
