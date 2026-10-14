---
id: 3
title: "Classify catalogue cluster: requisition intake, RFQ, quotation comparison (Procurement Lead)"
status: done
roles: [architect]
priority: 1
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for the Procurement Lead's part of the
pilot flow (`docs/PRD.md` §1): receiving the requisition through producing
a documented procurement recommendation, just before PO issue (ticket 0004).

## Source rows covered

Three sub-clusters, each with its own shared trigger in the source text
(confirms these are three configured capabilities feeding one role queue,
not one undifferentiated blob):

**A. Intake & validate requisition** — trigger: "an approved project
baseline, IFC/BOQ requirement, material request or subcontract need
reaches Procurement."

| S.No. | Work item |
|---|---|
| 601 | Receive and register purchase and subcontract requisitions |
| 604 | Return incomplete, duplicated, unapproved or unclear requisitions for correction |
| 605 | Split approved requirements into material, equipment and subcontract packages |
| 606 | Maintain the project procurement-package register |
| 608 | Build the procurement schedule backward from required-on-site dates |
| 610 | Review procurement priorities and constraints with Projects and Technical Engineering |

**B. RFQ & vendor sourcing** — trigger: "a sourcing package or new vendor/
subcontractor requirement is approved."

| S.No. | Work item |
|---|---|
| 618 | Prepare complete RFQ and subcontract-enquiry packages |
| 619 | Issue controlled RFQs and maintain the bidder and communication log |

**C. Quotation evaluation & comparison** — trigger: "the tender cutoff
passes and compliant quotations are available for evaluation."

| S.No. | Work item |
|---|---|
| 621 | Control quotation receipt, tender cutoff, confidentiality and late-bid exceptions |
| 622 | Check quotation completeness and commercial compliance |
| 624 | Coordinate technical compliance, material-submittal and approved-brand review |
| 630 | Prepare the documented procurement recommendation and approval route |

Shared escalation across all three: a competent authorised procurement
professional may provide operational backup; CPO approvals stay reserved;
cost/programme/vendor/contract/compliance exceptions escalate to the CPO.

Canonical role: `role.procurement_lead` (Procurement Manager/Buyer persona).

## Disposition

A: **Configure workflow** (604 is specifically **Configure approval/
decision** — a reject/return decision with a reason, distinct output shape
from the rest of A). B: **Configure workflow**. C: **Configure workflow**,
except 621 which is **Configure approval/decision** (a gate: late bids are
accepted or rejected against the cutoff).

## Acceptance
- [x] Three sub-clusters identified from shared trigger text, not guessed.
- [x] Per-row disposition split where output shape differs from the rest
      of its cluster (604, 621).
- [ ] Capability/step mapping against Implementation Plan §5 step types
      (6: evaluate condition for the cutoff/compliance gates; 7: approval
      only once CPO cluster in ticket 0004 picks it up).
- [ ] SLA: source `Timing` is "To be confirmed" for every row — `TBD`.
- [ ] Confirm with the business owner whether a *minimum number of
      competing quotations* is required before comparison (BRD §10.3 step 5
      implies comparison needs ≥2; the source rows don't state a number).

## Progress
- 2026-10-14: Architect session. Classified sub-clusters A/B/C, split
  disposition within clusters where a row is actually a decision gate
  rather than workflow progression.
