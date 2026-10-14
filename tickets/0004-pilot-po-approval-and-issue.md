---
id: 4
title: "Classify catalogue cluster: PO approval and issue (CPO + Procurement Lead)"
status: done
roles: [architect]
priority: 1
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for the approval-and-commitment step of
the pilot flow (`docs/PRD.md` §1): the recommendation from ticket 0003
becomes an approved, issued purchase order.

## Source rows covered

**A. CPO approval gate** — trigger: "a complete comparison, recommendation,
purchase order or subcontract award reaches the approval gate."

| S.No. | Role | Work item |
|---|---|---|
| 582 | Chief Procurement Officer (CPO) | Approve purchase orders within delegated authority |
| 584 | Chief Procurement Officer (CPO) | Approve material commercial deviations, negotiated terms and award qualifications |

Control: "No commitment is released without technical compliance, budget,
competition or approved exception, commercial checks and the correct
Delegation of Authority." Escalation: a CEO-approved procurement delegate
may coordinate routine matters, but award/major-commitment/exception/
termination/blacklisting stay with the CPO or escalate per the Delegation
of Authority.

**B. PO drafting & commitment issue** — trigger: "the procurement
recommendation is approved and commitment documents must be formed."

| S.No. | Work item |
|---|---|
| 631 | Prepare the purchase-order award package |
| 633 | Draft the purchase order with controlled scope, quantities, price and revisions |
| 639 | Coordinate Legal review of non-standard or material contractual terms |
| 640 | Route signature, record vendor acceptance and issue the controlled commitment |

Canonical roles: `role.cpo`, `role.procurement_lead`.

## Disposition

A: **Configure approval/decision** — textbook approval gate (BRD §6.5):
approver, inputs, recorded outcome, follow-up. **Risk Tier 3 (human-approved
transaction)** — this is exactly the kind of financial commitment BRD §2.2
principle 6 and the Implementation Plan's risk tiers require a human to
approve; no AI-agent autonomy applies here now or later without explicit
policy approval (BRD §9.4, §Out of scope).

B: **Configure workflow**, except 639 which is **Configure approval/
decision** (non-standard terms specifically route to Legal for a second,
separate sign-off — not just a progression step).

## Acceptance
- [x] CPO approval gate and PO-drafting cluster separated — they are
      different dispositions even though adjacent in the flow.
- [x] Risk tier set to Tier 3 for the approval gate per BRD agent-risk
      guidance; flagged as never-autonomous.
- [ ] **Approval value bands are not set** — this is the open decision in
      `docs/PRD.md` §9.1. This ticket defines the *gate's shape*
      (sequential, CPO-first, Legal review on deviation); it does not and
      must not invent who approves above what value.
- [ ] Idempotency rule for PO issue (BRD §2.2 principle 8 — no duplicate PO
      on retry) needs a concrete uniqueness key once this is built; noted
      for the backend-engineer ticket that will eventually implement this,
      not resolved here.
- [ ] SLA: source `Timing` is "To be confirmed" for every row — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified the approval gate as Tier 3 /
  Configure approval-decision; explicitly did not invent approval value
  bands (see `docs/PRD.md` §9 for the standing open question).
