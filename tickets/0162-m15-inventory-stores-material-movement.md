---
id: 162
title: "M15: Inventory, Stores & Material Movement"
status: done
roles: [architect, backend-engineer, ui-designer, test-engineer]
priority: 1
created: 2026-10-18
updated: 2026-10-18
---

## Context
Per PRD Phase 5 (Procurement, Stores and Site Operations) and BRD M15 (Inventory, Stores & Material Movement, work items #691-#730):
Construction execution requires robust site store and central warehouse inventory controls. Once purchase orders are issued to vendors (M14), materials delivered to the site or yard must be received against Goods Received Notes (GRNs), assigned warehouse/rack/bin storage locations, tracked across stock ledger balances, issued to site crews via Material Issue Notes (MIN) against authorised requisitions/cost codes, and dispatched via Material Gate Passes (inbound/outbound transfer & disposal).

## Scope & Implementation Plan

### 1. Database Schema (`supabase/migrations/20261018000006_m15_inventory_stores.sql`)
- Tables:
  - `store_locations`: Warehouses, site laydown yards, and storage zones per project/tenant with code, name, address, and type (`central_warehouse`, `site_store`, `laydown_yard`, `scrap_yard`).
  - `inventory_items`: Master catalog of stock items with item code, description, category, default UOM, reorder level, and unit cost.
  - `inventory_stock_balances`: Real-time stock balances per store location, rack/bin, and batch number.
  - `goods_received_notes` (GRN): Inbound receipts referencing PO (from M14), vendor, delivery note number, carrier, receiving status (`draft`, `inspected`, `accepted`, `rejected`), received date, notes.
  - `grn_items`: Items received, PO line reference, delivered quantity, accepted quantity, rejected quantity, reason, rack/bin location.
  - `material_issue_notes` (MIN): Outbound issues to site crews/subcontractors referencing project, cost code, requester, issue status (`draft`, `issued`, `returned`), issue date.
  - `material_issue_items`: Items issued, quantity issued, quantity returned, UOM, notes.
  - `material_gate_passes`: Gate pass directives (`inbound`, `outbound`, `transfer`, `returnable`, `disposal`) with vehicle number, driver name, driver contact, pass status (`draft`, `approved`, `dispatched`, `closed`), destination, gate exit timestamp.
- RLS tenant isolation on all tables enforcing `tenant_id = public.current_tenant_id()`.
- Permissions seeded: `inventory.store.manage`, `inventory.grn.manage`, `inventory.issue.manage`, `inventory.gatepass.manage`, `inventory.stock.view`.

### 2. Backend Module (`backend/src/modules/inventory/`)
- `types.ts`: Domain models for locations, stock balances, GRN, MIN, and gate passes.
- `repository.ts`: Repository interface and Supabase implementation.
- `fakeInventoryRepository.ts`: In-memory test fake tracking caller tenant sessions.
- `service.ts`: Business logic:
  - GRN acceptance automatically increments stock balances in the store location.
  - Rejection / damage quarantine logging.
  - Material issue verifies sufficient stock balance before deducting stock.
  - Material Gate Pass issuance and dispatch tracking.
- `routes.ts`: Fastify routes mounted with permission guards.
- `inventory.routes.test.ts`: Integration test suite verifying multi-tenant isolation and complete workflows.

### 3. Frontend Screen (`frontend/src/pages/InventoryPage.tsx`)
- Navigation item in `AppLayout.tsx` under Projects/Operations as "Inventory & Stores".
- Multi-tab workspace:
  - Tab 1: **Stock Balances & Stores**: Live inventory by store location, search by item code/description, reorder alerts, and "+ Add Store Location".
  - Tab 2: **Goods Received Notes (GRN)**: List of receipts, "+ New GRN" from Purchase Order, drawer to record accepted/rejected quantities and rack/bin placement.
  - Tab 3: **Material Issues (MIN)**: Material issue slips to site crews with cost code, quantity, and stock deduction.
  - Tab 4: **Material Gate Passes**: Security gate passes for inbound/outbound material transfers with vehicle/driver records.
- Vitest unit tests in `frontend/src/pages/InventoryPage.test.tsx` and 0-error Vite build.

### 4. Acceptance Criteria
- [x] Database migration applies cleanly with RLS policies and permissions.
- [x] Backend routes for stores, inventory, GRN, MIN, and gate passes pass all tests.
- [x] Automatic stock increment on GRN accept and decrement on Material Issue.
- [x] Tenant isolation verified across all operations.
- [x] Frontend workspace responsive, matching brand design tokens.
- [x] Clean builds and tests for backend and frontend.
- [x] Documentation updated in USER-GUIDE.md and daily-log.
