---
id: 164
title: "M19: Quality, Inspection & NCR"
status: done
roles: [architect, backend-engineer, ui-designer, test-engineer]
priority: 1
created: 2026-10-18
updated: 2026-10-18
---

## Context
Per PRD Phase 5 (Procurement, Stores and Site Operations) and BRD M19 (Quality, Inspection & NCR, source catalogue rows #541-570 for QHSE Engineer):
Civil, MEP, architectural, and structural site execution requires rigorous quality assurance and quality control (QA/QC) governance. Quality control on construction projects operates through three core operational pillars:
1. **Inspection & Test Plans (ITP)**: Quality control plans specifying quality activities, trade discipline, acceptance criteria, inspection frequency, and hold/witness/review/surveillance points.
2. **Work Inspection Requests (WIR / RFI)**: Formal requests raised by site engineers or subcontractors for consultant/QA inspector sign-off at hold/witness points before work may proceed (covering grid location, trade, checklist criteria, pass/conditional/fail determination).
3. **Non-Conformance Reports (NCR) & CAPA**: Formal logging of non-conforming work or failed inspections, tracking severity (`minor`, `major`, `critical`), root cause categorization, immediate corrective containment, preventive action plans (CAPA), re-inspection verification, and formal sign-off closure.

## Scope & Implementation Plan

### 1. Database Schema (`supabase/migrations/20261018000008_m19_quality_inspection_ncr.sql`)
- Tables:
  - `quality_inspection_plans` (ITP master records):
    - `id`, `tenant_id`, `project_id`, `plan_number`, `title`, `trade_discipline` (`civil`, `mep`, `structural`, `finishes`, `piling`, `facade`), `version`, `status` (`draft`, `approved`, `archived`), `applicable_specifications`, `created_at`, `updated_at`.
  - `itp_inspection_items`:
    - `id`, `tenant_id`, `plan_id`, `item_sequence`, `activity_name`, `acceptance_criteria`, `point_type` (`hold_point`, `witness_point`, `surveillance`, `review`), `reference_standard`, `verifying_document`.
  - `work_inspection_requests` (WIR / RFI):
    - `id`, `tenant_id`, `project_id`, `plan_id` (optional reference to ITP), `wir_number`, `title`, `trade_discipline`, `location_or_grid`, `inspection_date`, `status` (`draft`, `submitted`, `in_progress`, `approved`, `conditionally_approved`, `rejected`), `contractor_representative`, `inspector_name`, `inspector_remarks`, `signed_off_at`, `created_at`, `updated_at`.
  - `wir_checklist_items`:
    - `id`, `tenant_id`, `wir_id`, `item_sequence`, `checkpoint_description`, `result` (`pending`, `pass`, `fail`, `na`), `comments`.
  - `non_conformance_reports` (NCR):
    - `id`, `tenant_id`, `project_id`, `wir_id` (optional link to failed inspection), `ncr_number`, `title`, `trade_discipline`, `location_or_grid`, `severity` (`minor`, `major`, `critical`), `status` (`open`, `under_review`, `containment_applied`, `capa_submitted`, `verified_closed`, `voided`), `issue_description`, `root_cause_category` (`workmanship`, `material_defect`, `design_clash`, `method_deviation`, `environmental`), `issued_by`, `issued_to`, `target_closure_date`, `containment_action`, `corrective_action_plan`, `preventive_action_plan`, `closed_by`, `closed_at`, `closure_remarks`, `created_at`, `updated_at`.
- RLS tenant isolation on all tables enforcing `tenant_id = public.current_tenant_id()`.
- Seed permissions in `public.permissions` using `(id, description)`:
  - `quality.itp.manage`
  - `quality.inspection.manage`
  - `quality.inspection.signoff`
  - `quality.ncr.manage`
  - `quality.ncr.close`
- Assign permissions to `role.platform_administrator` and `role.qhse_engineer` in `public.role_permissions`.

### 2. Backend Module (`backend/src/modules/quality/`)
- `types.ts`: Domain models and input types for ITP, WIR, checklist items, and NCR.
- `repository.ts`: Repository interface and Supabase implementation with tenant session support.
- `fakeQualityRepository.ts`: In-memory test fake tracking caller tenant sessions.
- `service.ts`: Business logic:
  - ITP creation, item management, and approval.
  - WIR creation, submission, checklist evaluation, and inspection sign-off.
  - Automatic NCR linking or standalone NCR generation.
  - NCR lifecycle progression: Open -> Containment -> CAPA Submission -> Verification & Closure.
- `routes.ts`: Fastify routes mounted with permission guards.
- `quality.routes.test.ts`: Integration test suite covering full ITP, WIR checklist pass/fail, NCR issuance & CAPA closure, and multi-tenant RLS isolation.
- App wiring in `backend/src/app.ts`.

### 3. Frontend Screen (`frontend/src/pages/QualityPage.tsx`)
- Project selector dropdown for multi-project navigation.
- 3 comprehensive tabs:
  1. **Inspection Requests (WIR / RFI)**: Filter by status and trade, list of WIRs with location/grid, inspection date, inspector sign-off status pills. Drawer/Modal for checklist execution with Pass/Fail/NA toggles and "+ New Inspection Request" modal.
  2. **Non-Conformance Reports (NCR)**: Severity badges (`critical`, `major`, `minor`), root cause category, status workflow (Open -> Containment -> CAPA -> Closed), and "+ Issue NCR" modal. Drawer to view evidence description, input CAPA response, and execute QA sign-off closure.
  3. **Inspection & Test Plans (ITP)**: Project quality plans, trade disciplines, list of hold & witness checkpoints, and "+ New ITP" modal.
- Mount route `/quality` in `frontend/src/App.tsx` and add "Quality & Inspection (M19)" to `AppLayout.tsx`.
- Unit test suite in `frontend/src/pages/QualityPage.test.tsx` and 0-error Vite build.

### 4. Acceptance Criteria
- [x] Database migration applies cleanly with RLS policies and permissions.
- [x] Backend routes for ITPs, WIRs, and NCRs pass all tests.
- [x] Inspection sign-off handles Pass, Conditional, and Fail (with NCR linkage).
- [x] NCR CAPA submission and closure workflow enforced.
- [x] Multi-tenant isolation verified across all endpoints.
- [x] Frontend workspace responsive, matching brand design tokens.
- [x] Clean builds and tests for backend and frontend.
- [x] Documentation updated in USER-GUIDE.md and daily-log.
