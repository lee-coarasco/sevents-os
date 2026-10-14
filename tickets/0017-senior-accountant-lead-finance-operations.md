---
id: 17
title: "Classify catalogue cluster: Senior Accountant (Lead) finance operations"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 45 Finance rows carrying "Senior
Accountant (Lead)" as `Who is Responsible` (#761-805). Second batch of
the Finance department pass (ticket 0007) — this role executes the
operational finance work that CFO (ticket 0016) approves/decides on, the
same CTO/Architect-style split already established in Technical
Engineering.

## Source rows covered

**A. Daily Finance control calendar** — trigger: "the daily Finance
cycle, master-data request, posting review or control-calendar activity
becomes due."

| S.No. | Work item |
|---|---|
| 761 | Plan the Finance operating calendar, cutoffs and recurring control timetable |
| 762 | Control customer, supplier, project, bank and cost-code master-data changes |
| 763 | Review daily FirstBit posting quality, document completeness and exception status |
| 764 | Maintain the Finance issue, correction and overdue-action register |
| 765 | Allocate accounting work and verify completion of daily Finance controls |

**B. Billing and receivables** — trigger: "a project activation, billing
milestone, certified quantity, receipt, ageing review or retention date
occurs."

| S.No. | Work item |
|---|---|
| 766 | Verify the project financial-activation file and contractual billing terms |
| 767 | Review proforma and advance invoices before controlled issue |
| 768 | Prepare progress billing from certified quantities, milestones and contract terms |
| 769 | Review tax-invoice and credit-note basis before approval or issue |
| 770 | Maintain customer receivables, ageing and overdue-invoice status |
| 771 | Coordinate client collection follow-up and document payment commitments |
| 772 | Track retention balances, due dates, release conditions and recovery actions |
| 773 | Reconcile customer accounts, disputed balances and unapplied receipts |

**C. Supplier/subcontractor payables** — trigger: "a supplier,
subcontractor, expense or payment package is received or reaches due
date."

| S.No. | Work item |
|---|---|
| 774 | Control the supplier and subcontractor invoice register and period cutoff |
| 775 | Review the PO, GRN, invoice and approval three-way match |
| 776 | Review subcontractor certification, retention and advance-recovery calculations |
| 777 | Validate supplier bank, tax and master-data changes before payment |
| 778 | Review expense, petty-cash and employee-reimbursement packages |
| 779 | Prepare the payment proposal by due date, priority, cash availability and approval |
| 780 | Review payment vouchers, bank-upload files and authorisation evidence |
| 781 | Reconcile supplier statements, disputed invoices and debit balances |

**D. Reconciliation and monthly close** — trigger: "the daily
reconciliation or monthly/year-end closing cutoff becomes due."

| S.No. | Work item |
|---|---|
| 782 | Review daily bank, cash, receipt and payment posting status |
| 783 | Prepare and review monthly bank reconciliations |
| 784 | Review customer, supplier, employee and related control-account reconciliations |
| 785 | Reconcile general-ledger balances to subledgers and supporting schedules |
| 786 | Review accruals, prepayments, provisions and cutoff adjustments |
| 787 | Review project revenue, cost, work-in-progress and margin-recognition schedules |
| 788 | Lead the month-end closing checklist and close unresolved posting exceptions |
| 789 | Prepare the trial balance, financial statements and management-account schedules |

**E. Payroll** — trigger: "the monthly payroll cutoff, employee change,
leave salary or termination settlement is approved by People & Culture."

| S.No. | Work item |
|---|---|
| 790 | Issue the payroll timetable and verify the approved HR-to-Finance handover |
| 791 | Review attendance, overtime, leave, salary and deduction inputs |
| 792 | Prepare and review the monthly payroll calculation |
| 793 | Control employee advances, loans, deductions and recovery balances |
| 794 | Prepare end-of-service, leave-salary and final-settlement calculations |
| 795 | Prepare WPS or bank payroll files and reconcile payroll payments |

**F. Tax, fixed assets, reporting, audit, closeout** — trigger: "a tax,
fixed-asset, management-reporting, audit or project-closeout cycle
becomes due."

| S.No. | Work item |
|---|---|
| 796 | Review VAT coding, tax invoices and recoverability documentation |
| 797 | Prepare VAT reconciliations, return schedules and filing package |
| 798 | Maintain the corporate-tax compliance file and return-support schedules |
| 799 | Maintain the fixed-asset register, depreciation and disposal controls |
| 800 | Control prepayments, deposits, guarantees and other long-term balance schedules |
| 801 | Prepare project cost, revenue, margin and forecast-at-completion reporting |
| 802 | Prepare the weekly and monthly company cash forecast |
| 803 | Prepare the monthly Finance management pack and variance commentary |
| 804 | Prepare audit schedules and coordinate responses to audit queries |
| 805 | Control final billing, final account, retention and DLP financial tracking |

All 45 rows: canonical `role.senior_accountant_lead`
(`docs/canonical-role-map.md`).

## Disposition

**A: Configure workflow** (761, 762, 764, 765) **+ Periodic
review/monitor** (763 — "review daily posting quality... exception
status" is a scheduled check with a measurable output, not a bounded
task).

**B: Configure workflow**, all 8 rows. This is BRD §7 module M22
(billing/receivables) and is in-scope for the pilot per
`docs/PRD.md`/DECISIONS.md — progress billing, retention and ageing are
all named pilot-adjacent capabilities.

**C: Defer** (Phase 5 scope), all 8 rows. This cluster is literally the
vendor-bill three-way-match-and-payment capability that the 2026-10-14
DECISIONS.md entry ("Pilot flow confirmed...") explicitly places in
Phase 5, after the pilot's material-request → PO → GRN → site-issue
slice. Classifying as Defer (not Configure workflow) records that these
are real, valid work items that should not be scheduled into the pilot's
build order — distinct from Reference/policy-only, which would wrongly
imply they're not real capabilities at all.

**D: Configure workflow**, all 8 rows — a sequential close pipeline
(daily postings → reconciliations → accrual review → month-end close →
trial balance) that directly feeds CFO's close approval (ticket 0016,
cluster E), not a standalone periodic check.

**E: Configure workflow**, all 6 rows — payroll processing pipeline
feeding CFO's payroll-payment approval (ticket 0016, row 757).

**F: split by output shape** —
- **Track obligation/document:** 797 (VAT return/filing package), 798
  (corporate-tax compliance file), 804 (audit-query response schedules) —
  each is a filing/evidence obligation with a deadline, BRD §6.5's
  definition verbatim.
- **Periodic review/monitor:** 801 (project margin/forecast reporting),
  802 (cash forecast), 803 (management pack/variance commentary) — each
  is a scheduled report feeding a CFO review (ticket 0016 rows 748,
  741-745, 752 respectively), not a bounded task.
- **Configure workflow:** 796, 799, 800, 805 — ongoing record/register
  maintenance (VAT coding, fixed-asset register, prepayment schedules,
  final-account/DLP tracking) with a clear next consumer.

## Acceptance
- [x] All 45 Senior Accountant (Lead) rows (#761-805) classified into 6
      trigger-clusters with per-row splits recorded (A, F) where output
      shape differs within a cluster.
- [x] Cluster C (774-781) explicitly marked **Defer** against the
      existing Phase 5 boundary already recorded in DECISIONS.md, rather
      than silently calling it workflow or inventing a new phase
      decision.
- [ ] VAT rows (796-798) remain disposition-only; no rate or activation
      implied — finance owner sign-off still required per CLAUDE.md.
- [ ] SLA: source `Timing` is "To be confirmed" for all 45 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 45 Senior Accountant
  (Lead) rows; second role batch of the Finance department pass. First
  use of the **Defer** disposition (cluster C, Phase 5 vendor-payment
  scope) in this catalogue pass. 1 raw label / 45 rows remain in Finance
  (Accountant).
