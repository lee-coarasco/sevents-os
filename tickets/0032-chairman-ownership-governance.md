---
id: 32
title: "Classify catalogue cluster: Chairman reserved-matter and ownership governance"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 20 Company/Leadership rows
carrying "Chairman" as `Who is Responsible` (#1-20). First of 2 roles in
Company/Leadership (ticket 0007) — the last department in the catalogue.
The other role is CEO (50 rows, not started).

Per ticket 0007's note on "Leadership and paper-based items" (BRD §22),
this role was expected to skew heavily toward Reference/policy only or
Configure approval/decision rather than Configure workflow. The actual
result is sharper than expected: **all 20 rows are Configure
approval/decision, zero Configure workflow, zero Reference/policy
only.** Every row has the BRD §6.5 approval-disposition shape exactly —
a clear trigger, a named accountable approver (Chairman), a recorded
decision output, and an explicit escalation/continuity rule — not the
vaguer "general responsibility... with no discrete task outcome" that
would point to Reference/policy only. The Chairman's entire catalogue
footprint is reserved-matter sign-off; there is no operational
execution step anywhere in these 20 rows (execution stays with the CEO
and functional chiefs per every row's Control/Handoff text).

## Source rows covered (4 clusters of 5 rows, by shared Trigger)

| Cluster | S.No. range | Shared trigger (abbreviated) | Output/Evidence shape |
|---|---|---|---|
| A. Vision, strategy & ownership governance | 1-5 | Annual governance cycle, ownership review, company-structure proposal or reserved ownership matter requires a decision | Signed ownership decision, governance direction, Board/ownership resolution, reserved-matter record |
| B. CEO appointment & performance | 6-10 | CEO appointment cycle, annual objective setting, scheduled performance review, succession review or executive-accountability deadlock | Approved CEO mandate, objective/KPI decision, performance record, succession direction |
| C. Budget, capital & financial exposure | 11-15 | Annual budget, audited accounts, capital request, borrowing proposal, guarantee, shareholder-funding need or material financial exposure requires ownership review | Approved budget/capital decision, financing resolution, signed financial-statement review, shareholder-funding direction |
| D. Strategic portfolio, crisis & board oversight | 16-20 | Scheduled ownership review, strategic-market decision, major legal/reputation matter, enterprise crisis or Board/ownership meeting requires oversight | Ownership performance direction, strategic entry/exit decision, crisis mandate, Board/ownership minutes |

All 20 rows: canonical `role.chairman` (already in
`docs/canonical-role-map.md`, no change needed).

## Disposition

**Configure approval/decision** for all 20 rows: each cluster's
Control/Handoff text names the CEO as the one who "owns the complete
submission and implementation plan," with CFO/CLO/CPCO providing
domain confirmation and the Chairman as the sole approval authority for
a defined set of reserved matters (vision/strategy, CEO mandate/
succession, budget/capital/financing, strategic portfolio/crisis/board
governance). This is BRD §6.5's approval/decision definition ("a
decision with an approver, inputs, recorded outcome and follow-up")
applied with no exceptions — unlike every other C-suite ticket so far
(CFO/CLO/CMO/CRO), which each had a workflow or review/monitor slice,
the Chairman's raw-label rows contain none.

Do not read this as establishing the Chairman's actual authority limits
(approval thresholds, reserved-matter definitions) — those remain the
open decision tracked in `docs/PRD.md` §8-9 and BRD §21 item 6, same
caveat as `docs/canonical-role-map.md`'s standing note.

## Acceptance
- [x] All 20 Chairman rows (#1-20) classified into 4 trigger clusters,
      all Configure approval/decision.
- [x] Confirmed `role.chairman` already exists in
      `docs/canonical-role-map.md`.
- [ ] SLA: source `Timing` column for this role is unusually specific
      (e.g. "within three working days... urgent matters... same working
      day") rather than "To be confirmed" like most of the catalogue —
      still `TBD` for build purposes since no owner has confirmed these
      source-text timings as the actual contracted SLA, but flagged here
      because it differs from the catalogue's usual pattern.

## Progress
- 2026-10-14: Architect session. Classified all 20 Chairman rows — first
  of 2 Company/Leadership roles, all Configure approval/decision with no
  workflow/review slice (sharper skew than the CFO/CLO/CMO/CRO C-suite
  tickets). 840/1,308 rows classified overall, 468 remain. Next: CEO (50
  rows), the last role in the last department.
