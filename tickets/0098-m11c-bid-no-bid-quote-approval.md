---
id: 98
title: "M11c — Bid/no-bid decision & quote/proposal approval (FR-BID-001)"
status: in-progress
roles: [backend-engineer]
priority: 14
created: 2026-10-16
updated: 2026-10-16
---

Third of three M11 sub-tickets (see ticket 0095 for the split
rationale). Depends on ticket 0097 (M11b — the estimate that gets bid
or not) and M08 (ticket 0066's approval seam).

## What to build
- FR-BID-001: a bid/no-bid decision record that captures criteria,
  score/rationale, approvers and conditions — tied to an estimate
  (ticket 0097). Criteria/score should be real structured fields (e.g.
  a fixed or small set of named criteria with a score and rationale
  each), not a single freeform text blob, so BRD §10.1 step 7's "bid/
  no-bid approval" has something a reviewer can actually compare across
  decisions.
- The decision itself goes through the same M08 `request_approval`
  seam every other approval-gated action in this codebase uses
  (tickets 0075/0080/0092) — do not invent a second approval mechanism.
  "Conditions" (FR-BID-001's own word) means an approval can come back
  "approved with conditions," not just approved/rejected — check
  whether the M08 seam's existing decision vocabulary already covers
  this (ticket 0066's `ApprovalChainDecision` type) before adding a new
  status.
- BRD §10.1 step 8: "Proposal approval and submission" — once bid/no-
  bid is approved, a submission record (what was submitted, when, to
  whom) with evidence, same "evidence reference, not a bespoke upload
  pipeline" restraint ticket 0096 used for the tender document
  register.

## Out of scope
- Tender document register, scope matrix — ticket 0096 (M11a).
- Estimate versions, cost build-up — ticket 0097 (M11b).
- Negotiation, contract/legal review, award approval — BRD §10.1 steps
  9-10, that's M23 (Contracts, Claims, Variations & EOT), not here.

## Acceptance
- [ ] Bid/no-bid decision record (criteria, score/rationale, approvers,
      conditions) tied to an estimate, tenant-scoped RLS.
- [ ] Decision resolution reuses the M08 `request_approval` seam, same
      propose→poll→resolve shape as ticket 0075/0080/0092.
- [ ] Proposal submission record (what, when, to whom, evidence
      reference) once bid/no-bid is approved.
- [ ] Tests cover tenant isolation, permission gating, and the
      approval-seam integration (approved / rejected / conditions
      paths).

## Progress
- 2026-10-16: Filed as the third of three M11 sub-tickets (see ticket
  0095's split).
