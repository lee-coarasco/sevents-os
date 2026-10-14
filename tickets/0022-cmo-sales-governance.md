---
id: 22
title: "Classify catalogue cluster: CMO sales governance and approval chain"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 30 Marketing & Sales rows
carrying "Chief Marketing Officer (CMO)" as `Who is Responsible`
(#851-880). First batch of the Marketing & Sales department pass
(ticket 0007). Same CXO skew to Configure approval/decision as CFO
(ticket 0016) and CLO (ticket 0019), with the same review/monitor split
for rows using "review," "sponsor" and "report" rather than "approve."

## Source rows covered

**A. Marketing & Sales strategy and governance framework** — trigger:
"the annual planning cycle, strategy review, policy update or material
brand/control issue requires direction."

| S.No. | Work item |
|---|---|
| 851 | Set Marketing & Sales strategy, policies and annual operating objectives |
| 852 | Define priority services, sectors, project types, markets and client segments |
| 853 | Approve company brand positioning, value proposition and core market messages |
| 854 | Approve sales governance, Delegation of Authority and ethical-conduct controls |
| 855 | Approve CRM ownership, data standards, stage definitions and access controls |

**B. Annual/quarterly targets, budget and capacity** — trigger: "the
annual/quarterly plan, budget, campaign cycle or capacity review becomes
due."

| S.No. | Work item |
|---|---|
| 856 | Approve annual revenue, qualified-lead, pipeline and conversion targets |
| 857 | Approve target-account, key-account and relationship-development strategy |
| 858 | Approve the annual marketing budget and channel allocation |
| 859 | Approve campaign, event, partnership, referral and business-development plans |
| 860 | Align sales targets and opportunity priorities with technical, delivery and financial capacity |

**C. Lead/bid/opportunity decision gate** — trigger: "a major lead,
tender invitation, bid request, credit concern or technical handover
reaches the decision gate."

| S.No. | Work item |
|---|---|
| 861 | Approve lead-scoring, qualification and opportunity-priority rules |
| 862 | Make Go, Hold or No-Go decisions for major opportunities |
| 863 | Approve tender and bid participation decisions |
| 864 | Approve strategic-client, credit or commercial exceptions through the required authority route |
| 865 | Approve qualified lead handover to Technical Engineering |

**D. Quotation release, negotiation and award** — trigger: "an approved
quotation/proposal, client negotiation, requirement change or award
decision requires CMO action."

| S.No. | Work item |
|---|---|
| 866 | Approve release of CTO-approved quotations and proposals to clients |
| 867 | Approve client-facing discount, clarification and negotiation boundaries |
| 868 | Lead senior client presentations, relationship meetings and negotiations |
| 869 | Approve changes to client requirements or commitments before downstream handover |
| 870 | Accept client award evidence and initiate Legal contract finalisation |

**E. Weekly/monthly pipeline and performance review** — trigger: "the
weekly/monthly review, client escalation, forecast cutoff or performance
exception occurs."

| S.No. | Work item |
|---|---|
| 871 | Review the weekly pipeline, probability, value and revenue forecast |
| 872 | Review conversion, sales-cycle, win-rate and stalled-opportunity performance |
| 873 | Review campaign, channel, lead-source and marketing-return performance |
| 874 | Review key-account health, client satisfaction, referrals and repeat-business potential |
| 875 | Resolve material client complaints, pre-contract disputes and reputation risks |

**F. Compliance, crisis, continuity and reporting** — trigger: "a
compliance review, public statement, absence, access review or
improvement need occurs."

| S.No. | Work item |
|---|---|
| 876 | Approve marketing privacy, consent, copyright, advertising and communication controls |
| 877 | Approve crisis, public-statement and reputation-response actions |
| 878 | Approve Marketing & Sales access, delegation, backup and continuity arrangements |
| 879 | Sponsor FirstBit CRM, analytics, workflow and sales-process improvements |
| 880 | Report performance, forecast, risks and corrective actions to the CEO |

All 30 rows: canonical `role.cmo` (already listed in
`docs/canonical-role-map.md`). Shared escalation throughout A-F: "A
CEO-approved commercial delegate may coordinate routine matters, but
bid/no-bid, major client negotiation, material commercial exception,
public statement, award acceptance and reserved decisions remain with
the CMO or escalate under the Delegation of Authority" — same
reserved-decision pattern as every other CXO role classified so far
(CTO/ticket 0008, CFO/ticket 0016, CLO/ticket 0019). Shared role-boundary
language throughout: "CTO controls technical quotation approval, CLO
controls client contracts and Finance controls credit, invoicing and
payment activation" — the CMO owns the commercial/client-relationship
decision, not the technical, legal or financial content behind it.

## Disposition

**Configure approval/decision** for 24 of 30 rows (all of A-D, plus
875, 876, 877, 878 in E/F): each has a named approver (CMO), a bounded
trigger and a recorded outcome ("approved strategy," "approved revenue
targets," "approved Go/Hold/No-Go," "controlled client release," etc.)
with no further recurring task — matches BRD §6.5's approval/decision
definition and the shared Output/Evidence text each cluster carries.
This includes 860 ("align sales targets... with capacity," part of B's
planning-approval output), 868 ("lead senior client
presentations...negotiations" — an action verb but still a bounded,
CXO-reserved decision, same precedent as CFO's row 736 "lead the annual
budget process" in ticket 0016), and 875 ("resolve material client
complaints... and reputation risks" — a bounded resolution, same
precedent as CFO's row 750).

**Periodic review/monitor** for 871, 872, 873, 874, 879, 880: six rows
that are explicitly scheduled reporting/oversight actions rather than
bounded decisions — "review the weekly pipeline... forecast" (871),
"review conversion... performance" (872), "review campaign... return
performance" (873), "review key-account health..." (874), "sponsor
FirstBit CRM, analytics, workflow and sales-process improvements" (879,
an ongoing improvement programme, not a bounded decision — same
reasoning as CLO's row 1218), and "report performance, forecast, risks
and corrective actions to the CEO" (880, an advisory/reporting output —
same reasoning as CFO's row 735 and CLO's row 1213). Same per-row split
discipline as every CXO cluster classified so far.

## Acceptance
- [x] All 30 CMO rows (#851-880) classified into 6 trigger-clusters with
      the 6 review/monitor rows (871, 872, 873, 874, 879, 880) split out
      from their decision-heavy siblings.
- [x] Confirmed `role.cmo` already exists in `docs/canonical-role-map.md`
      — no change needed there.
- [ ] Authority limits/signatory/delegation values referenced throughout
      (854, 858, 861, 864, 867, 878) are the same open PRD §8-9 decision
      as every other role — not re-litigated here.
- [ ] SLA: source `Timing` is "To be confirmed" for all 30 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 30 CMO rows — first role
  batch of the Marketing & Sales department pass (ticket 0007). 2 raw
  labels / 90 rows remain in Marketing & Sales (Marketing Manager (Lead),
  Business Development Executive).
