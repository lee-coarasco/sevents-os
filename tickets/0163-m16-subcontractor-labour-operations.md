---
id: 163
title: "M16: Subcontractor & Labour Operations"
status: done
roles: [architect, backend-engineer, ui-designer, test-engineer]
priority: 1
created: 2026-10-18
updated: 2026-10-18
---

## Context
Per PRD Phase 5 (Procurement, Stores and Site Operations) and BRD M16 (Subcontractor & Labour Operations):
Specialist construction works (MEP, piling, facade, waterproofing, finishes, steel fabrication) are predominantly executed through specialized subcontractors and trade labour gangs. Project execution requires robust subcontractor agreements/work packages, daily manpower attendance logs, measured work progress records, subcontractor payment claims with retention deductions (e.g. 5-10% retention), and performance tracking.

## Scope & Implementation Plan

### 1. Database Schema (`supabase/migrations/20261018000007_m16_subcontractor_labour.sql`)
- Tables:
  - `subcontractor_work_orders` (Work packages/subcontracts):
    - `id`, `tenant_id`, `project_id`, `vendor_id` (subcontractor reference to AVL), `work_order_number`, `title`, `trade_discipline` (`civil`, `mep`, `structural`, `finishes`, `piling`, `facade`, `landscape`), `contract_value`, `retention_rate_pct` (e.g., 10.0), `start_date`, `completion_date`, `status` (`draft`, `approved`, `active`, `completed`, `terminated`), `scope_of_work`, `created_at`, `updated_at`.
  - `work_order_milestones`:
    - `id`, `tenant_id`, `work_order_id`, `milestone_name`, `description`, `amount`, `planned_date`, `status` (`pending`, `completed`, `certified`).
  - `subcontractor_attendance_logs`:
    - `id`, `tenant_id`, `project_id`, `work_order_id`, `date`, `trade`, `skilled_count`, `unskilled_count`, `total_hours`, `supervisor_name`, `notes`, `created_at`.
  - `subcontractor_measured_works`:
    - `id`, `tenant_id`, `work_order_id`, `measurement_date`, `wbs_code`, `boq_item_reference`, `description`, `uom`, `quantity_measured`, `unit_rate`, `certified_amount`, `measured_by`, `status` (`draft`, `verified`, `certified`).
  - `subcontractor_payment_claims` (Payment certificates):
    - `id`, `tenant_id`, `project_id`, `work_order_id`, `claim_number`, `period_start`, `period_end`, `claimed_amount`, `certified_amount`, `retention_deducted`, `net_payable_amount`, `status` (`submitted`, `under_review`, `certified`, `paid`), `submitted_at`, `certified_at`, `notes`.
- Multi-tenant RLS isolation policies on all tables enforcing `tenant_id = public.current_tenant_id()`.
- Permissions seeded:
  - `subcontractor.workorder.manage`
  - `subcontractor.workorder.view`
  - `subcontractor.attendance.manage`
  - `subcontractor.claims.manage`
  - `subcontractor.claims.certify`

### 2. Backend Module (`backend/src/modules/subcontractors/`)
- `types.ts`: Domain entities and API request/response types.
- `repository.ts`: Repository interface and Supabase implementation with tenant session support.
- `fakeSubcontractorRepository.ts`: In-memory test fake tracking caller tenant sessions.
- `service.ts`: Business logic:
  - Work order creation, status transitions, milestone tracking.
  - Daily manpower attendance tracking per trade.
  - Measured work verification and certified value calculation.
  - Subcontractor payment claims generation: calculates retention percentage deduction (e.g. 10% retention), determines net payable amount, and handles certification workflows.
- `routes.ts`: Fastify routes mounted with permission guards.
- `subcontractors.routes.test.ts`: Integration test suite covering work packages, attendance logs, measured work, payment claims with retention calculation, and multi-tenant RLS isolation.
- App wiring in `backend/src/app.ts`.

### 3. Frontend Screen (`frontend/src/pages/SubcontractorsPage.tsx`)
- Project selector dropdown for multi-project navigation.
- 4 comprehensive tabs:
  1. **Work Packages & Agreements**: List of subcontractor work orders, contract values, retention rate, status badges, and "+ New Work Order" dialog. Drawer to view milestones and agreement details.
  2. **Daily Manpower & Attendance**: Filterable attendance logs by date and trade, total headcounts (skilled vs unskilled), and "+ Log Attendance" modal.
  3. **Measured Work & Progress**: Verification of field work against BOQ/WBS items, certified quantities, and "+ Record Measurement" modal.
  4. **Payment Claims & Retention**: Interim payment certificates, claimed amount vs certified amount, retention deduction (e.g. 10%), net payable calculation, and "Certify Claim" workflow.
- Mount route `/subcontractors` in `frontend/src/App.tsx` and add "Subcontractors & Labour" to `AppLayout.tsx`.
- Unit test suite in `frontend/src/pages/SubcontractorsPage.test.tsx` and 0-error Vite build.

### 4. Acceptance Criteria
- [x] Migration applies cleanly with RLS policies and permissions seeded.
- [x] Backend routes pass all test cases with 100% tenant isolation.
- [x] Payment claim auto-calculates retention deductions and net payable amounts.
- [x] Frontend page renders responsive UI, tab switching, drawers, and form dialogs.
- [x] Both backend and frontend tests and builds succeed with 0 errors.
- [x] Documentation updated in USER-GUIDE.md and daily-log.

