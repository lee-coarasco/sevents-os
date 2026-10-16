---
id: 95
title: "M11 — Tendering, Estimation & Commercials"
status: done
roles: [architect]
priority: 14
created: 2026-10-16
updated: 2026-10-16
---

Second Phase 4 module per the build order. Depends on M09 (done — a
tender/estimate ties to a project-to-be, via the opportunity) and M10
(now entirely `testing` as of ticket 0092 — a tender/bid/estimate
attaches to an `opportunity`, same way ticket 0091's
`tender_submissions` already does).

Reference: CLAUDE.md module table — "Tender document register, scope
matrix, quantity take-off inputs, estimate versions, labour/material/
equipment/subcontractor costs, overheads, contingency, taxes, risk
allowances, margin scenarios, exclusions, quote approvals and bid
submission evidence." BRD §7 row (line 437), owners "Estimator;
Commercial; Technical; Finance." BRD §8.5 FRs: FR-BID-001 (bid/no-bid
decision captures criteria, score/rationale, approvers and
conditions), FR-EST-001 (estimates are versioned and traceable to
quantities, rates, assumptions, inclusions, exclusions, taxes,
overheads, contingency and margin), FR-EST-002 (AI may extract
quantities or suggest rates only with source and confidence; a
qualified person validates before approval), FR-EST-003 (approved
estimate version is locked against silent edits). BRD §10.1
("Opportunity to project") steps 5-8 are this module's scope: tender
documents/deadline register, estimate and risk review, bid/no-bid
approval, proposal approval and submission. Step 9 onward (negotiation,
contract/legal review, award) is M23 (Contracts, Claims, Variations &
EOT), not here.

Phase 0 catalogue classification already covers two of this module's
named roles in full: ticket 0014 (Civil Estimator, 25 rows, #217-241)
and ticket 0015 (MEP Estimator) — both dispositioned "Configure
workflow." That confirms the day-to-day tender-to-estimate *process*
(queries, takeoff, RFQ, rate build-up, self-check, submission) is
expected to run through M06's Configuration Studio once this module's
underlying data model and FR-level gates exist, the same relationship
M09/M10 already have with the catalogue's Configure-workflow rows for
those modules — this ticket only needs to build the data model, the
approval gates (FR-BID-001, FR-EST-003's lock) and FR-CRM-003's
tender-deadline tie-in that already exists (ticket 0091), not a
bespoke UI for every catalogue row.

## Survey findings
No `tenders`/`bids`/`estimates`/`estimate_lines`-shaped table exists
yet (grep-checked across all 27 migration files). Ticket 0091 (M10b)
already built `tender_submissions` (deadline, submitted_at, evidence
reference) attached to an `opportunity` — that is the *deadline
calendar* row BRD §7 names for M10, not the tender *document register*
this module needs; M11a extends the same `opportunity_id` attachment
point with the actual document/scope-matrix detail, it does not
replace or duplicate ticket 0091's table.

## Split
Split the same way tickets 0059/0067/0089 were, into three
dependency-ordered sub-tickets:
- **0096 (M11a)** — Tender document register & scope matrix: document
  metadata, scope/clarification log, site-constraint notes tied to an
  opportunity's tender submission. No internal dependency beyond M10
  (ticket 0091's `tender_submissions`).
- **0097 (M11b)** — Estimate versions (FR-EST-001/002/003): quantity
  takeoff inputs, labour/material/equipment/subcontractor cost lines,
  overheads/contingency/taxes/risk allowances, margin scenarios,
  exclusions; versioned, approved-version-locked. Depends on 0096 (an
  estimate is built against a registered tender).
- **0098 (M11c)** — Bid/no-bid decision (FR-BID-001) and quote/proposal
  approval + bid submission evidence, approval-gated via the existing
  M08 `request_approval` seam — not a second approval mechanism.
  Depends on 0097 (the estimate is what gets bid or not).

## Progress
- 2026-10-16 13:25 UTC: Filed as the second Phase 4 module (M10 is now
  entirely `testing` as of ticket 0092). Surveyed the schema for any
  existing tender/bid/estimate table (none) and confirmed the
  catalogue-classification relationship via tickets 0014/0015. Closed
  this ticket with no code of its own, split into 0096/0097/0098 above.
- Approved by: agent (ticket classification/ordering and internal
  data-model split are explicitly agent-decidable per CLAUDE.md, same
  weight as every prior M06/M07/M09/M10/M31/M35 split; recorded in
  DECISIONS.md).
