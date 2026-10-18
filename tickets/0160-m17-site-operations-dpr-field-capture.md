---
id: 160
title: "M17: Site Operations, DPR & Field Capture"
status: done
roles: [architect, backend-engineer, ui-designer, test-engineer]
priority: 1
created: 2026-10-18
updated: 2026-10-18
---

## Context
Per PRD Phase 5 and BRD M17 (Site Operations, DPR & Field Capture):
Site engineers and project managers require daily field capture covering site diaries, daily progress reports (DPR), trade manpower headcounts, machinery/equipment utilisation, work executed quantities tied to schedule activities, weather conditions and impacts, site blockers, and site instructions.

## Scope & Implementation Details

### 1. Database Schema
- Migration `supabase/migrations/20261018000004_m17_site_operations_dpr.sql`
- Tables created:
  - `daily_progress_reports`: project_id, report_date, status ('draft', 'submitted', 'approved', 'rejected'), weather condition, temperature, general notes, site engineer, supervisor signoff, rejection reason, unique constraint on `(project_id, report_date)`.
  - `dpr_manpower_entries`: dpr_id, trade, headcount, hours_worked, subcontractor_name, notes.
  - `dpr_equipment_entries`: dpr_id, equipment_type, quantity, operating_hours, idle_hours, notes.
  - `dpr_work_progress_entries`: dpr_id, schedule_activity_id, location_or_grid, description, quantity_executed, uom, notes.
  - `dpr_site_instructions`: project_id, dpr_id, instruction_number, issued_by, recipient, instruction_text, priority, status ('open', 'in_progress', 'completed', 'acknowledged'), target_completion_date.
  - `dpr_blockers`: dpr_id, category, description, impact_hours, resolution_action, status.
- RLS tenant isolation enforced on all tables (`tenant_id = public.current_tenant_id()`).
- Permissions seeded: `site.dpr.manage`, `site.dpr.approve`, `site.instruction.manage`.

### 2. Backend Module (`backend/src/modules/site/`)
- `types.ts`: DPR statuses, weather conditions/impacts, blocker categories, site instruction statuses/priorities, and domain interfaces.
- `repository.ts`: `SiteRepository` interface and Supabase-backed implementation.
- `fakeSiteRepository.ts`: In-memory multi-tenant test fake with access token session tracking.
- `service.ts`: Business logic for DPR creation, draft/submitted/approved/rejected lifecycle state machine, immutability of approved records, validation of headcounts/hours/dates, child entries management, and site instructions.
- `routes.ts`: Fastify routes mounted under `/projects/:projectId/site/dprs`, `/site/dprs/:dprId`, `/site/instructions`, with permission guards:
  - `site.dpr.manage` for DPR creation, updates, and child entries.
  - `site.dpr.approve` for supervisor approval and rejection.
  - `site.instruction.manage` for site instructions.
- `routes.test.ts`: Integration test suite with 6 tests verifying full lifecycle, entry additions/removals, approval guards, rejection reasons, and cross-tenant isolation.
- `backend/src/app.ts`: Registered `siteRoutes` with `getSiteRepository` and default Supabase repository cache.

### 3. Frontend UI (`frontend/src/pages/SiteOperationsPage.tsx`)
- Navigation item "Site Operations & DPR" (`/site`) in `AppLayout.tsx` under Projects section with permission gate.
- Project selector dropdown for multi-project switching.
- DPR List View:
  - Status filter chips (all, draft, submitted, approved, rejected).
  - List table with date, weather badge with emoji & temperature, status pill, impact, notes, and actions ("Open Workspace →", "Delete" for draft).
  - New DPR modal wizard with weather dropdown, temperature °C, weather impact, and notes.
- Detailed DPR Workspace:
  - Header with date, status badge, supervisor approval badge / return reason banner.
  - Summary metric cards: Total Manpower, Equipment Running hours, Work Items count, Open Blockers count.
  - Workflow buttons: "Submit DPR for Approval", "✓ Approve DPR", "✕ Return / Reject" with feedback reason modal.
  - Tab 1: Manpower Log (Trade, Headcount, Hours, Subcontractor, Notes, Add form, Remove action).
  - Tab 2: Equipment Log (Type, Qty, Operating hours, Idle hours, Notes, Add form, Remove action).
  - Tab 3: Work Progress Log (Description, Location / Grid, Qty executed, UOM, Notes, Add form, Remove action).
  - Tab 4: Site Blockers & Delays (Category dropdown, Description, Impact hours, Resolution action, Open/Resolved toggle).
- Site Instructions Register Tab:
  - Table of official field directives: SI number, priority badge, From → To, instructions text, target date, status badge, status update select.
  - "Issue Site Instruction" modal form.
- `frontend/src/pages/SiteOperationsPage.test.tsx`: 4 Vitest unit tests verifying render, workspace switching, child tabs, and instructions tab.
- 0 TypeScript errors and clean Vite production build.

### 4. Acceptance Criteria
- [x] Database migration applies cleanly with RLS policies and permissions.
- [x] Backend routes for DPRs, entries, and site instructions pass all unit and integration tests.
- [x] Multi-tenant isolation verified with wrong-tenant requests failing closed.
- [x] Frontend page renders responsive UI with brand design tokens.
- [x] Full test coverage and clean builds for backend and frontend.
- [x] USER-GUIDE.md and daily-log updated.
