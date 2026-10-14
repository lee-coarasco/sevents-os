---
id: 16
title: "Classify catalogue cluster: CFO finance governance and approval chain"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 30 Finance rows carrying "Chief
Financial Officer (CFO)" as `Who is Responsible` (#731-760). First batch
of the Finance department pass (ticket 0007) — the first non-Technical-
Engineering department. Unlike CTO (ticket 0008), nearly every CFO row is
a decision/approval, not a workflow step — confirming ticket 0007's
prediction that CXO rows skew toward Configure approval/decision.

## Source rows covered

**A. Finance strategy and control framework** — trigger: "the annual
planning cycle, a policy change, control review or material financial
event requires direction."

| S.No. | Work item |
|---|---|
| 731 | Set Finance strategy, policies and annual operating objectives |
| 732 | Approve the financial-control framework, chart-of-account governance and segregation of duties |
| 733 | Approve banking mandates, signatory limits and payment-authority controls |
| 734 | Establish financial KPIs, materiality thresholds, reporting standards and closing calendar |
| 735 | Report financial performance, liquidity, compliance and control risk to the CEO |

**B. Budget, forecast and capital** — trigger: "the annual budget,
rolling forecast, investment request or material variance cycle becomes
due."

| S.No. | Work item |
|---|---|
| 736 | Lead the annual budget and financial operating-plan process |
| 737 | Approve departmental budgets, project budgets and cost-control baselines |
| 738 | Approve the rolling forecast, cash-flow forecast and funding plan |
| 739 | Review capital expenditure, financing needs and major financial commitments |
| 740 | Approve budget-variance, reforecast and corrective-action decisions |

**C. Treasury and liquidity** — trigger: "the cash-planning cutoff,
payment cycle, facility requirement or liquidity exception occurs."

| S.No. | Work item |
|---|---|
| 741 | Approve weekly cash priorities and the controlled payment plan |
| 742 | Monitor bank balances, liquidity runway, facilities and cash concentration |
| 743 | Approve bank transfers, foreign-exchange transactions and financing drawdowns |
| 744 | Govern bank guarantees, letters of credit and project security instruments |
| 745 | Approve emergency liquidity, funding and collection-recovery actions |

**D. Project financial control** — trigger: "a project activation,
quotation, cost update, billing event or margin/cash exception requires
Finance control."

| S.No. | Work item |
|---|---|
| 746 | Approve project financial activation and work-before-payment exceptions |
| 747 | Approve quotation margins, commercial assumptions and financial deviations |
| 748 | Review project committed cost, actual cost, revenue, margin and forecast-at-completion |
| 749 | Approve material credit notes, write-offs, provisions and retention strategy |
| 750 | Resolve project cost, revenue, cash and collection exceptions with functional chiefs |

**E. Close, tax and audit** — trigger: "the monthly/year-end close, tax
deadline, audit request or material control concern becomes due."

| S.No. | Work item |
|---|---|
| 751 | Approve monthly and year-end financial close |
| 752 | Approve management accounts, cash-flow reporting and executive financial pack |
| 753 | Approve VAT and corporate-tax returns, positions and payments |
| 754 | Oversee external audit, statutory reporting and regulator or bank submissions |
| 755 | Direct response to suspected fraud, financial-control breach and material misstatement |

**F. Final payment and closeout authority** — trigger: "an approved
payment batch, payroll file, exceptional transaction or financial-
closeout package reaches final authority."

| S.No. | Work item |
|---|---|
| 756 | Approve supplier, subcontractor and employee-expense payments within authority |
| 757 | Approve payroll, WPS, end-of-service and employee-settlement payments |
| 758 | Approve owner-related, exceptional and restricted payments under delegated authority |
| 759 | Approve final account, retention release and project financial closeout |
| 760 | Approve Finance continuity, access-control, backup and recovery arrangements |

All 30 rows: canonical `role.cfo` (`docs/canonical-role-map.md`). Shared
escalation throughout A-F: "A CEO-approved finance delegate may
coordinate routine matters, but banking authority, tax positions,
material payments, funding, financial statements and reserved decisions
remain with the CFO or escalate to the CEO" — reserved-decision language
even stronger than CTO's (ticket 0008), consistent with Finance being a
segregation-of-duties-heavy domain.

## Disposition

**Configure approval/decision** for 27 of 30 rows (all of A-F except
735, 742, 748): each has a named approver (CFO), a bounded trigger and a
recorded outcome ("approved Finance policy," "authorised payment,"
etc.) with no further recurring task — this is BRD §6.5's approval/
decision definition almost verbatim, and matches the shared Output/
Evidence text each cluster carries.

**Periodic review/monitor** for 735, 742, 748: these three are
explicitly *reporting/monitoring* actions embedded inside otherwise
decision-heavy clusters — "report financial performance... to the CEO"
(735), "monitor bank balances, liquidity runway" (742), "review project
committed cost... forecast-at-completion" (748) — scheduled reviews with
a measurable output, not a bounded decision. Same per-row split
discipline as ticket 0002 (row 518) and ticket 0008 (row 74).

**Note — does not activate anything:** row 753 ("approve VAT and
corporate-tax returns") is classified here as a disposition only. Per
CLAUDE.md, VAT/tax posting must never be activated without finance owner
sign-off and no rate is assumed; this ticket does not touch that decision
— it only records that the *workflow/approval capability* for this row
exists and needs configuring later, same as every other row.

## Acceptance
- [x] All 30 CFO rows (#731-760) classified into 6 trigger-clusters with
      the 3 reporting/monitoring rows (735, 742, 748) split out from
      their decision-heavy siblings.
- [x] Confirmed the CXO-skews-to-approval/decision pattern predicted in
      ticket 0007, with reasoning (vs. CTO/Technical Engineering roles,
      which skewed to Configure workflow because they execute a
      multi-step pipeline with a downstream recipient).
- [x] Flagged row 753 as disposition-only — no VAT activation implied.
- [ ] Authority limits/signatory/delegation values referenced throughout
      (732, 733, 756-760) are the same open PRD §8-9 decision as every
      other role — not re-litigated here.
- [ ] SLA: source `Timing` is "To be confirmed" for all 30 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 30 CFO rows — first role
  batch of the Finance department pass (ticket 0007). 2 raw labels / 90
  rows remain in Finance (Senior Accountant (Lead), Accountant).
