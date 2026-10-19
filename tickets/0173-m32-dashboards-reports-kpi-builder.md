---
id: 173
title: "M32: Dashboards, Reports & KPI Builder"
status: done
roles: [architect, backend-engineer, ui-designer, test-engineer]
priority: 1
created: 2026-10-19
updated: 2026-10-19
---

## Context
Per PRD Phase 8 and BRD Section 7 & 8 M32 (Dashboards, Reports & KPI Builder, covering role-specific executive dashboards, cross-module financial variance, operations & QHSE health, custom report builder, and CSV/tabular data export):
Now that modules M01 through M27 are operational, SEVENTS requires a unified analytics and reporting engine providing real-time visibility across all operational domains:
1. **Executive Command Center**:
   - Portfolio active contract sum, project health status distribution (on-track, at-risk, delayed), earned value / physical progress, pending executive approvals, and critical cross-module escalations.
2. **Financial & Commercial Intelligence**:
   - Budget vs. committed purchase orders vs. approved subcontractor claims vs. actual expenses.
   - Applications for payment, certified billings, cash collections, and overdue accounts receivable.
   - Variation requests quantum (approved vs. pending) and retention balances.
3. **Operations, Fleet & QHSE**:
   - Site workforce deployment (demanded vs. mobilized headcount).
   - Plant & fleet utilization rates, maintenance alerts, and active equipment counts.
   - Quality control metrics: Open Non-Conformance Reports (NCRs), inspection pass rate.
   - HSE safety scorecards: Safe man-hours recorded, active Permits to Work (PTW), incidents, and near-misses.
4. **Custom Report Builder & Data Export**:
   - Configurable reports across any entity: Projects, Purchase Orders, Invoices, Subcontractor Claims, NCRs, Incidents, Expenses.
   - Dynamic filtering by date range, project, status, and grouping.
   - Tabular preview, summary metric calculations, CSV export, and saving custom report configurations.

## Scope & Implementation Plan

### 1. Database Schema (`supabase/migrations/20261019000007_m32_dashboards_reports_kpi_builder.sql`)
- Table `dashboard_reports`:
  - `id`: UUID primary key.
  - `tenant_id`: UUID not null references `companies(id)`.
  - `name`: Text not null.
  - `description`: Text.
  - `category`: Text not null check in (`executive`, `financial`, `operational`, `qhse`, `custom`).
  - `config`: JSONB not null default `{}` (module, metrics, filters, group_by, sort).
  - `created_by`: UUID references `app_users(id)`.
  - `is_preset`: Boolean not null default false.
  - `created_at`: TIMESTAMPTZ not null default now().
  - `updated_at`: TIMESTAMPTZ not null default now().
- RLS policy enforcing `tenant_id = public.current_tenant_id()`.
- Permissions seeded in `public.permissions`:
  - `dashboard.executive.view`
  - `dashboard.financial.view`
  - `dashboard.operations.view`
  - `dashboard.reports.manage`
  - `dashboard.reports.export`
- Assigned in `public.role_definitions` for `role.platform_administrator`, `role.ceo`, `role.coo`, `role.cfo`, `role.project_director`, `role.senior_accountant`, `role.qhse_director`.

### 2. Backend Analytics Module (`backend/src/modules/dashboard/`)
- Domain types, Supabase repository, and in-memory test fake.
- Service functions:
  - `getExecutiveAnalytics(tenantId, projectId?)`: Aggregates active projects, total contract sum, average progress %, health indicators, pending approvals, and critical grievances/disputes.
  - `getFinancialAnalytics(tenantId, projectId?)`: Calculates total budget, committed POs, subcontractor claims certified, billed invoices, cash collections, and pending variation amounts.
  - `getOperationsAnalytics(tenantId, projectId?)`: Computes site manpower demand vs mobilized, equipment utilization %, quality NCR count and resolution rate, and HSE safe hours / PTWs.
  - `listReports(tenantId, category?)`, `createReport(tenantId, input)`, `deleteReport(tenantId, id)`.
  - `generateReportData(tenantId, entity, filters)`: Dynamically queries target module records, calculates summary metrics, and structures rows for tabular display and CSV export.
- Fastify routes mounted with permission guards.
- Comprehensive route tests in `dashboard.routes.test.ts`.

### 3. Frontend Screen (`frontend/src/pages/DashboardPage.tsx`)
- Modern executive analytics cockpit matching Syne & Inter amber design system:
  - Top header with Project filter dropdown ("All Projects" vs individual project).
  - 4 Operational Tabs:
    1. **Executive Command Center**: High-level KPIs, project delivery health distribution, quick action links, critical escalation banner.
    2. **Financial & Commercial**: Cost variance waterfall (Budget vs Committed vs Incurred), Billing vs Cash collections, and Variation quantum.
    3. **Operations, Fleet & QHSE**: Manpower efficiency, equipment uptime %, Quality NCRs, HSE safe man-hours and open PTWs.
    4. **Custom Reports & Export**: Preset reports list, custom report builder modal, dynamic table rendering, and instant CSV export button.
- Comprehensive unit tests in `frontend/src/pages/DashboardPage.test.tsx`.
