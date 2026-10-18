---
id: 168
title: "M22: Billing, Invoicing, Receivables & Payables"
status: done
roles: [architect, backend-engineer, ui-designer, test-engineer]
priority: 1
created: 2026-10-19
updated: 2026-10-19
---

## Context
Per PRD Phase 6 (Finance, billing and contracts) and BRD M22 (Billing, Invoicing, Receivables & Payables, source catalogue items #532, #533, #534, #535, #536, #766-#773, #811-#827):
Construction cashflow and revenue recognition require tight operational-financial integration:
1. **Client Applications for Payment / Interim Payment Certificates (IPC)**:
   - Measurement sheets, work completed valuation, advance recovery deduction, and standard retention withholding (typically 10% gross progress).
   - Certification workflow (`draft` -> `submitted` -> `certified` -> `invoiced` -> `paid`).
   - 5% UAE VAT calculation on net certified progress.
2. **Tax Invoices & Accounts Receivable (AR)**:
   - Official tax invoices linked to certified payment applications or standalone advance billings.
   - Client receipt allocation (bank transfers, cheques, unallocated funds).
   - Real-time AR aging analysis (current, 30, 60, 90+ days overdue) and dispute tracking.
3. **Vendor Bills & Accounts Payable (AP) with 3-Way Match**:
   - Supplier and subcontractor bill registration with project and cost code allocation.
   - Automated 3-way matching: Purchase Order (M14) + Material Movement GRN / Subcontractor Service Confirmation (M15/M16) + Vendor Tax Invoice.
   - Variance flags, verification, payment voucher generation, and payment scheduling.
4. **Retention Ledger & DLP Release Controls**:
   - Segregated tracking of client retentions (receivable) and subcontractor retentions (payable).
   - Two-stage milestone releases: 50% at Substantial / Practical Completion (Taking-Over Certificate / TOC) and 50% at Final Closeout / Defect Liability Period (DLP) expiry.

## Scope & Implementation Plan

### 1. Database Schema (`supabase/migrations/20261019000002_m22_billing_invoicing.sql`)
- Tables:
  - `payment_applications`:
    - `id`, `tenant_id`, `project_id`, `application_number`, `period_start`, `period_end`, `submission_date`, `gross_work_completed`, `advance_recovery_amount`, `retention_withheld_amount`, `net_certified_amount`, `tax_rate` (5.00), `tax_amount`, `total_amount`, `status` (`draft`, `submitted`, `certified`, `invoiced`, `paid`, `disputed`), `certified_by`, `certified_at`, `notes`, `created_at`, `updated_at`.
  - `payment_application_items`:
    - `id`, `tenant_id`, `application_id`, `cost_code_id`, `description`, `previous_claimed_amount`, `current_claimed_amount`, `certified_amount`, `notes`, `created_at`, `updated_at`.
  - `tax_invoices`:
    - `id`, `tenant_id`, `project_id`, `application_id`, `invoice_number`, `invoice_type` (`progress`, `advance`, `retention_release`, `direct`), `client_name`, `trn`, `issue_date`, `due_date`, `subtotal_amount`, `tax_amount`, `total_amount`, `paid_amount`, `status` (`unpaid`, `partially_paid`, `paid`, `overdue`, `disputed`), `notes`, `created_at`, `updated_at`.
  - `client_receipts`:
    - `id`, `tenant_id`, `invoice_id`, `receipt_number`, `receipt_date`, `amount`, `payment_method` (`bank_transfer`, `cheque`, `credit_card`), `reference_number`, `notes`, `created_at`, `updated_at`.
  - `vendor_bills`:
    - `id`, `tenant_id`, `project_id`, `vendor_id`, `cost_code_id`, `po_id`, `grn_id`, `bill_number`, `bill_date`, `due_date`, `subtotal_amount`, `tax_amount`, `total_amount`, `match_status` (`matched`, `variance_flagged`, `manual_override`), `status` (`received`, `verified`, `approved`, `scheduled`, `paid`, `disputed`), `paid_amount`, `payment_reference`, `paid_at`, `notes`, `created_at`, `updated_at`.
  - `retention_records`:
    - `id`, `tenant_id`, `project_id`, `retention_type` (`client_receivable`, `subcontractor_payable`), `party_name`, `reference_id`, `total_retained_amount`, `first_release_amount`, `first_release_date`, `first_release_status` (`pending`, `released`), `second_release_amount`, `second_release_due_date`, `second_release_status` (`pending`, `released`), `status` (`held`, `partially_released`, `fully_released`), `notes`, `created_at`, `updated_at`.
- Multi-tenant RLS isolation on all tables (`tenant_id = public.current_tenant_id()`).
- Permissions:
  - `billing.application.manage`, `billing.application.certify`, `billing.invoice.manage`, `billing.receipt.record`, `billing.vendor_bill.manage`, `billing.vendor_bill.approve`, `billing.retention.manage`.

### 2. Backend Module (`backend/src/modules/billing/`)
- Domain types (`types.ts`), Supabase repository (`repository.ts`), test fake (`fakeBillingRepository.ts`).
- Service logic (`service.ts`) enforcing:
  - Automatic retention calculation (10%) and net certified balance.
  - 5% UAE VAT computation for payment applications and tax invoices.
  - Client receipt allocations with partial/full paid status updates on invoices.
  - 3-way match validation comparing PO order value vs bill value, flagging variance > 2%.
  - Retention ledger tracking with practical completion and DLP release milestones.
- Fastify routes (`routes.ts`) with permission checks and error handling.
- App wiring in `backend/src/app.ts`.
- Integration tests (`billing.routes.test.ts`).

### 3. Frontend Screen (`frontend/src/pages/BillingPage.tsx`)
- 4 Operational Tabs:
  1. **Client Applications for Payment (IPC)**: Application cards/table, progress metrics, status badges, "+ New Payment Application" modal, and certification action.
  2. **Tax Invoices & Accounts Receivable (AR)**: Invoice register, aging metrics (Current, 30d, 60d, 90d+), "+ Create Tax Invoice" modal, and "+ Record Client Payment" receipt modal.
  3. **Vendor Bills & Accounts Payable (AP)**: 3-way match verification status, PO linkage, variance inspection, "+ Register Vendor Bill" modal, and bill approval/payment actions.
  4. **Retention & DLP Ledger**: Receivable vs Payable retention balances, TOC & DLP release stages, and "+ Release Retention" action.
- Route `/billing` in `frontend/src/App.tsx`, nav link in `AppLayout.tsx`.
- Component unit tests in `frontend/src/pages/BillingPage.test.tsx`.
- User Guide documentation in `docs/USER-GUIDE.md`.
