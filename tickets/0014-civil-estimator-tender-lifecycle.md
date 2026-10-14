---
id: 14
title: "Classify catalogue cluster: Civil Estimator tender-to-award lifecycle"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 25 Technical Engineering rows
carrying "Civil Estimator" as `Who is Responsible` (#217-241). Seventh
batch of ticket 0007's Technical Engineering pass — this role is BRD §7
module M11 (Tendering, Estimation & Commercials), not M12's design
pipeline; it runs in parallel to, and consumes output from, the design
roles already classified in tickets 0008-0013.

## Source rows covered

**A. Tender intake and scope review** — trigger: "a controlled tender/
quotation package and deadline are received."

| S.No. | Work item |
|---|---|
| 217 | Receive and register civil tender package and submission deadline |
| 218 | Review civil, architectural and structural tender scope |
| 219 | Identify missing civil information, contradictions and commercial risks |
| 220 | Prepare civil tender queries, assumptions and clarification log |
| 221 | Attend civil tender site visit and record pricing constraints |

**B. Quantity takeoff** — trigger: "the controlled tender drawings, BOQ
and specifications are available."

| S.No. | Work item |
|---|---|
| 222 | Prepare civil and earthworks quantity takeoff |
| 223 | Prepare architectural and finishing quantity takeoff |
| 224 | Prepare structural concrete and reinforcement quantity takeoff |
| 225 | Prepare masonry, waterproofing and roofing quantity takeoff |
| 226 | Prepare external works and provisional-item quantity takeoff |
| 227 | Reconcile civil takeoff against BOQ, drawings and specifications |

**C. Market pricing (RFQ/comparison)** — trigger: "takeoff and RFQ
packages are ready for market enquiry."

| S.No. | Work item |
|---|---|
| 228 | Prepare civil supplier and subcontractor RFQ packages |
| 229 | Coordinate civil market quotations through Procurement |
| 230 | Prepare civil quotation comparison and compliance review |
| 231 | Resolve civil vendor exclusions, deviations and unpriced scope |

**D. Rate build-up and risk** — trigger: "verified quantities and market
inputs are available."

| S.No. | Work item |
|---|---|
| 232 | Prepare civil labour, material, plant and subcontract rate build-ups |
| 233 | Apply civil productivity, wastage and logistics assumptions |
| 234 | Price preliminaries, temporary works and project constraints |
| 235 | Prepare civil risk, opportunity, exclusion and contingency register |
| 236 | Develop civil value-engineering and alternative pricing options |

**E. Submission, negotiation and award handover** — trigger: "the
estimate reaches internal review, client submission, negotiation or
award."

| S.No. | Work item |
|---|---|
| 237 | Prepare priced civil BOQ and commercial summary |
| 238 | Complete civil estimate self-check and reconciliation |
| 239 | Submit civil estimate for CTO review and approved margin integration |
| 240 | Revise civil offer for client clarification and negotiation |
| 241 | Handover final civil estimate, assumptions and cost baseline after award |

All 25 rows: canonical `role.civil_estimator`
(`docs/canonical-role-map.md`). Shared escalation throughout A-E: "The
MEP Estimator may support tender administration but not civil technical
judgement; missing scope, pricing, margin or contract risk escalates to
CTO and CFO/CEO within authority" — note this is a discipline-competence
boundary (MEP Estimator cannot deputise on civil judgement), distinct
from the simple backup-resource pattern seen in the design roles
(tickets 0008-0013).

## Disposition

**All 25 rows (A-E): Configure workflow.**

Considered splitting C230/C231 ("prepare quotation comparison and
compliance review" / "resolve vendor exclusions, deviations and unpriced
scope") out as **Configure approval/decision**, the same way ticket 0002
split row 518 — each produces a per-vendor accept/reject/escalate
judgement. Kept as Configure workflow instead: unlike ticket 0002's row
518, the comparison result here is a required *input* that D's rate
build-up consumes (not a closed decision that stops the chain), and the
source's own Output/Evidence groups 228-231 under one shared output shape
("comparable supplier/subcontractor quotations, compliance review and
clarification record"). Recording the consideration so the next session
sees it was weighed, not missed.

## Acceptance
- [x] All 25 Civil Estimator rows (#217-241) classified into 5
      trigger-clusters mapped to BRD §7 module M11.
- [x] Explicitly recorded why a Configure approval/decision split was
      considered for C230/C231 and rejected, instead of silently picking
      one.
- [ ] SLA: source `Timing` is "To be confirmed" for all 25 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 25 Civil Estimator rows;
  seventh role batch of ticket 0007's Technical Engineering pass. 7 roles
  done; 1 raw label / 25 rows remain in this department (MEP Estimator) —
  last role before Technical Engineering is fully classified.
