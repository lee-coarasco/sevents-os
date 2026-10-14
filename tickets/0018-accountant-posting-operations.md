---
id: 18
title: "Classify catalogue cluster: Accountant posting operations"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 45 Finance rows carrying
"Accountant" as `Who is Responsible` (#806-850). Third and final batch of
the Finance department pass (ticket 0007) — completes Finance (120/120
rows). This role is the posting/data-entry execution layer under Senior
Accountant (Lead) (ticket 0017), mirroring that role's clusters almost
one-for-one but one level more granular.

## Source rows covered

**A. Document intake and registration** — trigger: "a Finance transaction
or document package is submitted."

| S.No. | Work item |
|---|---|
| 806 | Receive and register Finance documents and transaction requests |
| 807 | Verify required approvals, supporting evidence and FirstBit references |
| 808 | Assign document numbers, project codes, cost codes and filing references |
| 809 | Return missing, duplicate, incorrect or unauthorised transaction packages |
| 810 | Maintain the daily posting queue and transaction-completion status |

**B. Customer billing and receipts** — trigger: "an approved contract,
billing milestone, payment, credit decision or customer-control activity
occurs."

| S.No. | Work item |
|---|---|
| 811 | Create the customer and project billing record from approved master data |
| 812 | Create proforma and advance invoices from approved agreements |
| 813 | Create tax invoices from approved billing or payment evidence |
| 814 | Create progress invoices from certified billing packages |
| 815 | Prepare credit-note entries from approved supporting documents |
| 816 | Post customer receipts and retain bank or cash evidence |
| 817 | Allocate receipts against invoices, advances and project balances |
| 818 | Prepare customer statements, collection logs and unapplied-receipt schedules |

**C. Supplier/subcontractor invoice and payment posting** — trigger: "a
supplier/subcontractor invoice, certified expense or approved payment
reaches Finance."

| S.No. | Work item |
|---|---|
| 819 | Register supplier invoices and verify invoice-control information |
| 820 | Match supplier invoices to purchase orders, GRNs and approvals |
| 821 | Post approved purchase invoices to the correct project and cost code |
| 822 | Record subcontractor invoices, certifications, retention and advances |
| 823 | Record approved employee expenses and reimbursement claims |
| 824 | Prepare payment vouchers with the complete supporting package |
| 825 | Post approved bank, cheque and online supplier payments |
| 826 | Prepare supplier-statement reconciliations and missing-invoice lists |
| 827 | Prepare debit-note, rejection and invoice-correction entries |

**D. Cash and bank** — trigger: "a bank transaction, cash movement,
petty-cash event or reconciliation cutoff occurs."

| S.No. | Work item |
|---|---|
| 828 | Download or receive bank statements and record bank transactions |
| 829 | Maintain petty-cash vouchers, limits and replenishment records |
| 830 | Record cash receipts, cash payments and controlled cash transfers |
| 831 | Perform petty-cash and physical-cash counts and reconcile differences |
| 832 | Prepare bank-reconciliation working papers and unmatched-item schedules |
| 833 | Record cheque deposits, returned cheques and bank charges |
| 834 | Retain payment-file, transfer and bank-confirmation evidence |

**E. Journal, tax and fixed-asset posting** — trigger: "an approved
journal, tax transaction, asset event or control-account reconciliation
requires posting."

| S.No. | Work item |
|---|---|
| 835 | Prepare and post approved journal entries with supporting schedules |
| 836 | Post accrual, prepayment and provision entries from approved calculations |
| 837 | Maintain customer, supplier, employee and clearing-account schedules |
| 838 | Apply correct VAT coding and validate tax-document fields |
| 839 | Prepare VAT input, output and exception schedules |
| 840 | Record fixed-asset additions, transfers, disposals and supporting documents |
| 841 | Post depreciation and fixed-asset reconciliation entries |
| 842 | Reconcile GRN, inventory, advance and deposit clearing accounts |
| 843 | Reconcile employee, payroll, loan and advance balances |

**F. Payroll posting, close, audit and retention** — trigger: "the
payroll posting, month-end, audit request or document-retention activity
becomes due."

| S.No. | Work item |
|---|---|
| 844 | Validate payroll source files and approved employee master-data changes |
| 845 | Post payroll, WPS, benefit, deduction and employer-cost entries |
| 846 | Record end-of-service and employee final-settlement transactions |
| 847 | Prepare monthly ledger, balance-sheet and expense schedules |
| 848 | Complete assigned month-end close tasks and correction entries |
| 849 | Prepare documents and schedules requested for audit or management review |
| 850 | Archive Finance records, approvals, returns and bank evidence by retention rule |

All 45 rows: canonical `role.accountant` (`docs/canonical-role-map.md`).

## Disposition

**A, B, D, E: Configure workflow**, all 29 rows — posting/data-entry
tasks each with a traceable next consumer (Senior Accountant review,
reconciliation, or CFO decision already classified in tickets 0016-0017).
Note E838/E839 (VAT coding/schedules) are the *data-preparation* step
feeding ticket 0017's row 797 (the VAT filing obligation itself) — kept
as workflow here, not Track obligation/document, because the obligation
is the filing output one role up, not this input-preparation step.

**C: Defer** (Phase 5 scope), all 9 rows (819-827). Same reasoning as
ticket 0017's cluster C: this is the execution layer of the vendor-bill
three-way-match-and-payment capability that DECISIONS.md (2026-10-14)
places after the pilot's material-request → PO → GRN → site-issue slice.
Consistent with Senior Accountant (Lead) being Deferred at this exact
same boundary one level up.

**F: split by output shape** — **Configure workflow** for 844-848
(payroll posting, ledger preparation, close tasks — ongoing with a
downstream consumer); **Track obligation/document** for 849 (audit-
request response, a deadline-bound evidence obligation) and 850
("archive ... by retention rule" — an explicit retention/compliance
obligation, not a recurring task with a next-step recipient).

## Acceptance
- [x] All 45 Accountant rows (#806-850) classified into 6 trigger-
      clusters with per-row splits recorded (E, F) where output shape
      differs.
- [x] Cluster C (819-827) marked **Defer**, confirming consistency with
      ticket 0017's Phase 5 boundary one level up in the same role chain.
- [x] Finance department now fully classified: 120/120 rows across 3
      roles (tickets 0016-0018).
- [ ] VAT rows (838-839) remain disposition-only; no rate or activation
      implied.
- [ ] SLA: source `Timing` is "To be confirmed" for all 45 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 45 Accountant rows — the
  third and final role in Finance. Department complete (120/120 rows,
  tickets 0016-0018), including two consistent Defer clusters (0017/0018)
  for the Phase 5 vendor-payment boundary. Next department: Legal (120
  rows, not started) per ticket 0007's table.
