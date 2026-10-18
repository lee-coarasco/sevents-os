---
id: 161
title: "M14: Procurement, Requisitions & Purchase Orders"
status: done
roles: [architect, backend-engineer, ui-designer, test-engineer]
priority: 1
created: 2026-10-18
updated: 2026-10-18
---

## Context
Per PRD Phase 5 and BRD M14 (Procurement & Vendor Management):
Construction supply chain and site execution require structured purchase requisitions (PR), vendor onboarding/directory, quotation comparison (RFQ), and controlled Purchase Orders (PO) with delivery and commitment tracking.

## Scope & Implementation Plan

### 1. Database Schema (`supabase/migrations/20261018000005_m14_procurement_po.sql`)
- Tables:
  - `vendors`: Approved Vendor List (AVL) with trade license, tax ID, rating, categories, and KYC status.
  - `purchase_requisitions`: Material requisitions with project linkage, dates, priority, status, and approval tracking.
  - `purchase_requisition_items`: Line items with quantities, UOM, estimated rates, cost codes, and schedule activity references.
  - `rfq_packages`: Request for Quotation packages with issue/due dates and scope.
  - `rfq_vendors`: Vendor quotation submissions, quoted amounts, compliance status.
  - `purchase_orders`: Legally binding purchase orders with payment terms, delivery dates, and tax/total calculations.
  - `purchase_order_items`: Ordered quantities, unit rates, line totals, and delivery status.
- RLS tenant isolation on all tables.
- Permissions: `procurement.vendor.manage`, `procurement.requisition.manage`, `procurement.requisition.approve`, `procurement.po.manage`, `procurement.po.approve`.

### 2. Backend Module (`backend/src/modules/procurement/`)
- `types.ts`: Domain models and inputs.
- `repository.ts`: Repository interface and Supabase implementation.
- `fakeProcurementRepository.ts`: In-memory test fake.
- `service.ts`: Business logic for PR submissions, PO generation from PRs/RFQs, approval value validations, and vendor KYC.
- `routes.ts`: Fastify routes mounted with permission guards.
- `routes.test.ts`: Integration test suite verifying multi-tenant isolation and complete workflows.

### 3. Frontend Screen (`frontend/src/pages/ProcurementPage.tsx`)
- Navigation item in `AppLayout.tsx` under Projects/Operations.
- Multi-tab workspace:
  - Tab 1: **Purchase Requisitions (PR)** — Filterable list, new PR wizard with line items, submit & approve workflows.
  - Tab 2: **Purchase Orders (PO)** — Active orders, generate PO from approved PR, vendor picker, line items, issue & delivery tracking.
  - Tab 3: **Vendor Directory (AVL)** — Approved vendor list, KYC status pills, categories, add/edit vendor modal.
- Clean Vite build and unit tests in `frontend/src/pages/ProcurementPage.test.tsx`.

### 4. Acceptance Criteria
- [x] Database migration applies cleanly with RLS policies and permissions.
- [x] Backend routes for vendors, requisitions, RFQs, and POs pass all tests.
- [x] Tenant isolation verified across all operations.
- [x] Frontend workspace responsive, matching brand design tokens.
- [x] Clean builds and tests for backend and frontend.
- [x] Documentation updated in USER-GUIDE.md and daily-log.
