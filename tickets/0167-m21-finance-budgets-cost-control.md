---
id: 167
title: "M21: Finance, Budgets & Cost Control"
status: done
roles: [architect, backend-engineer, ui-designer, test-engineer]
priority: 1
created: 2026-10-18
updated: 2026-10-18
---

## Context
Per PRD Phase 6 (Finance, billing and contracts) and BRD M21 (Finance, Budgets & Cost Control, source catalogue items #737, #738, #739, #740):
Construction cost control requires tracking financial exposure across the project lifecycle:
1. **Project Cost Codes & Budget Baselines**:
   - Hierarchical cost code structure (`materials`, `labour`, `subcontractor`, `equipment`, `overhead`).
   - Approved budget baselines against which commitments (POs, Work Orders), actuals, and accruals are measured.
   - Variance calculation: Approved Budget vs. Estimate at Completion (EAC = Actuals + Estimate to Complete / ETC).
2. **Budget Revisions & Reallocations**:
   - Controlled budget adjustment workflows between cost codes or contingency release with justification and CFO approval.
3. **Expense Claims & Direct Site Costs**:
   - Staff expense claims, petty cash disbursements, and direct project costs with cost code allocation and approval lifecycle (`draft` -> `submitted` -> `approved` -> `paid`).
4. **Financial Period Controls**:
   - Fiscal periods with `open` and `closed` status to enforce financial governance and prevent retroactive alterations (FR-FIN-003).

## Scope & Implementation Plan

### 1. Database Schema (`supabase/migrations/20261019000001_m21_finance_budgets_cost_control.sql`)
- Tables:
  - `cost_codes`:
    - `id`, `tenant_id`, `code`, `name`, `category` (`materials`, `labour`, `subcontractor`, `equipment`, `overhead`), `description`, `created_at`, `updated_at`.
  - `project_budgets`:
    - `id`, `tenant_id`, `project_id`, `version_number`, `status` (`draft`, `submitted`, `approved`, `locked_baseline`), `total_original_budget`, `total_revised_budget`, `approved_by`, `approved_at`, `notes`, `created_at`, `updated_at`.
  - `project_budget_lines`:
    - `id`, `tenant_id`, `budget_id`, `cost_code_id`, `original_amount`, `revised_amount`, `committed_amount`, `actual_amount`, `accrued_amount`, `estimate_to_complete`, `created_at`, `updated_at`.
  - `budget_revisions`:
    - `id`, `tenant_id`, `project_id`, `revision_number`, `from_cost_code_id`, `to_cost_code_id`, `amount`, `reason`, `status` (`draft`, `approved`, `rejected`), `requested_by`, `approved_by`, `approved_at`, `created_at`, `updated_at`.
  - `expense_claims`:
    - `id`, `tenant_id`, `project_id`, `cost_code_id`, `claim_number`, `claimant_name`, `claim_date`, `amount`, `currency` (default `AED`), `description`, `receipt_reference`, `status` (`draft`, `submitted`, `approved`, `paid`, `rejected`), `approved_by`, `approved_at`, `paid_at`, `created_at`, `updated_at`.
  - `financial_periods`:
    - `id`, `tenant_id`, `period_name` (e.g. `2026-10`), `start_date`, `end_date`, `status` (`open`, `closing_in_progress`, `closed`), `closed_by`, `closed_at`, `created_at`, `updated_at`.
- Multi-tenant RLS isolation on all tables enforcing `tenant_id = public.current_tenant_id()`.
- Seed permissions in `public.permissions` using `(id, description)`:
  - `finance.budget.manage`
  - `finance.budget.approve`
  - `finance.forecast.manage`
  - `finance.expense.manage`
  - `finance.expense.approve`
  - `finance.period.manage`
- Assign permissions to `role.platform_administrator`, `role.chief_financial_officer_cfo`, `role.finance_manager`, and `role.project_manager` in `public.role_permissions`.

### 2. Backend API (`backend/src/modules/finance/`)
- Domain types, Supabase repository, and in-memory test fake.
- Service logic covering:
  - Cost code cataloguing and CRUD.
  - Project budget creation, budget lines management, baseline locking, and variance reporting (EAC & Variance auto-calculated).
  - Budget transfer / revision workflow with approval.
  - Expense claim lifecycle (`draft` -> `submitted` -> `approved` -> `paid`).
  - Financial period management with closed-period protection.
- Fastify routes mounted with permission guards.
- Route test suite (`finance.routes.test.ts`) covering all endpoints, variance computation, period locking, and multi-tenant RLS isolation.

### 3. Frontend Screen (`frontend/src/pages/FinancePage.tsx`)
- Project-aware finance and cost control dashboard with 4 tabs:
  1. **Budget & Cost Variance (EAC)**: Summary metrics (Approved Budget, Commitments, Actuals, EAC, Variance), budget line table with cost code breakdown, and "+ New Budget Line / Setup Budget" modal.
  2. **Budget Revisions & Transfers**: Reallocation requests between cost codes, transfer amounts, justification, approval actions, and "+ Request Budget Transfer" modal.
  3. **Expense Claims & Direct Costs**: Staff claims, receipt tracking, cost code assignment, "+ Submit Expense Claim" modal, and approval/payment actions.
  4. **Financial Periods & Controls**: Monthly accounting period ledger, open/closed status, and "Close Period" action for finance administrators.

### 4. Verification & Criteria
- Full test coverage across backend (`npm test` in `backend/`) and frontend (`npx vitest run` in `frontend/`).
- Clean production builds (`tsc` + `vite build`).
- Documentation updated in `docs/USER-GUIDE.md` and `daily-log/2026-10-18.md`.
