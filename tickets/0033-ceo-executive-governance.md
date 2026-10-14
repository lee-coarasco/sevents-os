---
id: 33
title: "Classify catalogue cluster: CEO executive governance and company-wide decisions"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 50 Company/Leadership rows
carrying "Chief Executive Officer (CEO)" as `Who is Responsible`
(#21-70). Second and final role in Company/Leadership (ticket 0007) —
**this completes the entire 1,308-row work-item catalogue import.**

Same shape as Chairman (ticket 0032): the CEO's rows are all
decide/approve/review/resolve verbs over company-wide matters, with
every cluster's Control/Handoff text naming the specific functional
chief (COO, CFO, CLO, CMO, CPCO, CRO, CPO, QHSE) who owns the
operational execution and evidence, and the CEO as the integrating
decision-maker within a defined authority band, escalating to the
Chairman only above that band or for ownership-reserved matters. No
cluster describes the CEO personally executing a multi-step workflow.

## Source rows covered (10 clusters of 5 rows, by shared Trigger)

| Cluster | S.No. range | Shared trigger (abbreviated) | Output/Evidence shape |
|---|---|---|---|
| A. Strategy & annual plan | 21-25 | Ownership strategy, annual planning cycle, material forecast change or executive planning review requires company-wide direction | Approved strategy deployment, operating plan, company objectives/KPIs |
| B. Executive governance & authority | 26-30 | Annual governance review, organisation change, authority issue, scheduled executive meeting or cross-department ownership conflict | Executive-governance calendar, accountability assignment, authority/deputy decision, executive minutes |
| C. Performance dashboard & recovery | 31-35 | Daily exception review, weekly operating review, monthly performance close, project gate or corrective-action deadline | Executive performance decision, recovery mandate, portfolio direction, Chairman performance report |
| D. Bid/no-bid & commercial strategy | 36-40 | Strategic opportunity, major tender, commercial exception, executive client escalation or contract-award gate | Approved pursuit decision, commercial boundary, contract-award readiness decision |
| E. Budget, cash & investment | 41-45 | Budget cycle, monthly forecast, weekly cash review, above-limit commitment request or investment proposal | Approved management budget/forecast, cash action, above-limit authorisation, investment recommendation |
| F. Project mobilisation & critical review | 46-50 | Project award, mobilisation gate, critical project review, resource conflict, serious site exception or handover/closeout gate | Mobilisation direction, executive project priority, recovery/exception decision, handover gate decision |
| G. Workforce & succession | 51-55 | Annual workforce plan, organisation change, executive appointment, succession review, policy exception or culture/performance issue | Organisation/workforce decision, appointment objective, succession direction, policy exception |
| H. Enterprise risk & crisis | 56-60 | Enterprise risk review, high-risk contract/claim, regulatory matter, serious incident, crisis or compliance deadline | Enterprise-risk direction, legal/claim strategy, regulatory response mandate, crisis decision |
| I. Operating system & SOP sponsorship | 61-65 | Operating-model review, SOP approval cycle, FirstBit roadmap, master-data/control change, audit finding or innovation gate | Operating-system direction, ERP/change sponsorship decision, data/control mandate, pilot scale/defer/stop decision |
| J. Ownership reporting & continuity | 66-70 | Ownership submission, strategic stakeholder matter, corporate communication, executive reporting deadline or CEO continuity event | Chairman submission, stakeholder position, corporate communication, CEO decision/risk register, continuity record |

All 50 rows: canonical `role.ceo` (already in
`docs/canonical-role-map.md`, no change needed).

## Disposition

**Configure approval/decision** for all 50 rows, same reasoning as
Chairman/ticket 0032: every row has a named trigger, the CEO as the
accountable decision-maker, a recorded decision output, and an explicit
functional-chief/Chairman escalation structure — the BRD §6.5
approval/decision definition with no exceptions. Like ticket 0032, this
does not establish the CEO's actual authority thresholds (still open,
`docs/PRD.md` §8-9 / BRD §21 item 6).

## Acceptance
- [x] All 50 CEO rows (#21-70) classified into 10 trigger clusters, all
      Configure approval/decision.
- [x] Confirmed `role.ceo` already exists in
      `docs/canonical-role-map.md`.
- [x] Company/Leadership department now fully classified (70/70 rows,
      tickets 0032-0033).
- [ ] SLA: source `Timing` column for this role is specific (daily/
      weekly/monthly cadences, "within one/two working days", "same
      working day" for urgent matters) rather than "To be confirmed" —
      still `TBD` for build purposes pending owner/business confirmation,
      same flag as ticket 0032.

## Progress
- 2026-10-14: Architect session. Classified all 50 CEO rows — second
  and final Company/Leadership role. **Company/Leadership department
  now fully classified (70/70 rows, tickets 0032-0033).** 890/1,308
  rows classified overall, 418 remain — Projects (293 remain) and
  Procurement (125 remain) are the only departments still open; both
  were partially classified by the pilot-flow tickets (0001-0006) before
  this tracking ticket existed. See ticket 0007 for the full
  per-department ledger and next steps.
