---
id: 6
title: "Classify catalogue cluster: stock ledger and site material issue (Storekeeper)"
status: done
roles: [architect]
priority: 1
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for the final step of the pilot flow
(`docs/PRD.md` §1): stock ledger update and authorised issue to site,
closing the loop back to ticket 0001's site requirement.

## Source rows covered

**A. Stock ledger maintenance** — trigger: "a receipt, issue, reservation,
count, reorder or inventory-review event occurs."

| S.No. | Work item |
|---|---|
| 714 | Maintain real-time stock and bin-location records |
| 716 | Reserve and allocate stock to approved projects and work fronts |
| 720 | Reconcile physical stock and investigate variances |

**B. Material issue** — trigger: "an authorised material/tool request,
return, transfer, loss event or project closeout occurs."

| S.No. | Work item |
|---|---|
| 723 | Issue material only against an authorised material request |
| 725 | Record material issues, consumption, balances and acknowledgements |

Both sub-clusters: role Storekeeper (`role.storekeeper`). Shared
escalation: a trained authorised storekeeper may provide custody backup
with controlled system access; GRN correction, stock adjustment, disposal,
loss and material exceptions require Procurement Lead or CPO approval.

## Disposition

A: **Configure workflow** (714, 716) and **Periodic review/monitor** (720
— "reconcile ... and investigate variances" is a recurring check with a
measurable output, matching BRD §6.5's periodic-review definition more than
an ad hoc workflow step). B: **Configure workflow** throughout — this is
the capability named in `docs/PRD.md` acceptance criterion 7 ("material
issue against GRN'd stock requires an authorised material request").

## Acceptance
- [x] Stock-ledger and issue sub-clusters classified; 720 given a different
      disposition than its siblings with reasoning (periodic check vs.
      workflow step).
- [x] Closes the traceability loop: issued material satisfies the
      requirement raised in ticket 0001 — confirmed the role/record chain
      is continuous end to end (334/361 → 518-520 → 601-630 → 582/584/
      631-640 → 656-705 → 714-725).
- [ ] Negative-stock / variance-investigation threshold (720) is not in the
      source text; needs a process-owner-confirmed rule before this can be
      simulated.
- [ ] "Authorised material request" (723) depends on the authority/role
      check being resolved — same open approval-authority decision as
      tickets 0002 and 0004, not re-litigated here.
- [ ] SLA: source `Timing` is "To be confirmed" for every row — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified both sub-clusters; confirmed
  this ticket closes the full pilot-flow traceability chain documented in
  `docs/PRD.md` §1.2.
