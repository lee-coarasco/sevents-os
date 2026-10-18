---
id: 165
title: "M20: Safety, Incidents & Compliance"
status: done
roles: [architect, backend-engineer, ui-designer, test-engineer]
priority: 1
created: 2026-10-18
updated: 2026-10-18
---

## Context
Per PRD Phase 5 (Procurement, Stores and Site Operations) and BRD M20 (Safety, Incidents & Compliance, source catalogue rows #541-570 for QHSE Engineer):
Construction site operations carry strict regulatory, statutory, and life-safety obligations. Zero-harm culture and HSE governance operate through four essential pillars:
1. **Permits to Work (PTW)**: Pre-work authorization gating for high-risk activities (hot work, working at height, confined space, lifting & rigging, deep excavation, electrical isolation) with pre-start risk assessment checklist and safety officer authorization.
2. **HSE Incident & Emergency Control**: Logging and investigation of incidents (near miss, first aid, medical treatment case, lost time injury - LTI, dangerous occurrence, environmental spill), calculating lost days, root cause analysis, and preventive actions. **PRD rule: Safety decisions remain strictly human-controlled.**
3. **Hazard Observations & Stop-Work Directives**: Proactive site hazard reporting (unsafe condition, unsafe act, positive intervention) with risk matrix priority (`low`, `medium`, `high`, `imminent_danger`) and immediate stop-work authority.
4. **Toolbox Talks (TBT) & HSE Audits**: Daily/weekly safety briefings tracking topic, trade gang, attendee counts, and periodic site compliance audit checklists.

## Scope & Implementation Plan

### 1. Database Schema (`supabase/migrations/20261018000009_m20_safety_incidents_compliance.sql`)
- Tables:
  - `safety_permits_to_work` (PTW):
    - `id`, `tenant_id`, `project_id`, `permit_number`, `permit_type` (`hot_work`, `working_at_height`, `confined_space`, `lifting_operations`, `deep_excavation`, `electrical_isolation`), `title`, `location_or_grid`, `start_time`, `expiry_time`, `status` (`draft`, `pending_approval`, `active`, `suspended`, `closed`, `cancelled`), `contractor_name`, `supervisor_name`, `safety_officer_name`, `precautions_taken`, `gas_test_required` (boolean), `gas_test_results` (text), `created_at`, `updated_at`.
  - `safety_incidents`:
    - `id`, `tenant_id`, `project_id`, `incident_number`, `incident_date`, `incident_type` (`near_miss`, `first_aid`, `medical_treatment`, `lost_time_injury`, `dangerous_occurrence`, `environmental_spill`), `severity` (`minor`, `moderate`, `major`, `critical`, `fatal`), `status` (`reported`, `under_investigation`, `capa_assigned`, `closed`), `location_or_grid`, `description`, `injured_person_name`, `injury_details`, `lost_workdays` (integer default 0), `immediate_action_taken`, `root_cause_analysis`, `corrective_preventive_action`, `reported_by`, `investigated_by`, `closed_by`, `closed_at`, `created_at`, `updated_at`.
  - `safety_hazard_observations`:
    - `id`, `tenant_id`, `project_id`, `observation_number`, `observation_type` (`unsafe_condition`, `unsafe_act`, `positive_intervention`), `risk_level` (`low`, `medium`, `high`, `imminent_danger`), `stop_work_issued` (boolean default false), `location_or_grid`, `description`, `action_required`, `status` (`open`, `in_progress`, `rectified`, `closed`), `reported_by`, `assigned_to`, `rectification_evidence`, `target_rectification_date`, `rectified_at`, `created_at`, `updated_at`.
  - `safety_toolbox_talks`:
    - `id`, `tenant_id`, `project_id`, `tbt_number`, `talk_date`, `topic`, `conducted_by`, `trade_discipline` (`civil`, `mep`, `structural`, `finishes`, `piling`, `facade`, `general`), `attendee_count` (integer not null default 0), `key_points_discussed`, `notes`, `created_at`, `updated_at`.
- Multi-tenant RLS isolation on all tables enforcing `tenant_id = public.current_tenant_id()`.
- Seed permissions in `public.permissions` using `(id, description)`:
  - `safety.ptw.manage`
  - `safety.ptw.approve`
  - `safety.incident.manage`
  - `safety.incident.investigate`
  - `safety.hazard.manage`
  - `safety.tbt.manage`
- Assign permissions to `role.platform_administrator` and `role.qhse_engineer` in `public.role_permissions`.

### 2. Backend Module (`backend/src/modules/safety/`)
- `types.ts`: Domain models and input types for PTWs, Incidents, Hazard Observations, and Toolbox Talks.
- `repository.ts`: Repository interface and Supabase implementation with tenant session support.
- `fakeSafetyRepository.ts`: In-memory test fake tracking caller tenant sessions.
- `service.ts`: Business logic:
  - PTW lifecycle: Draft -> Pending -> Approved/Active -> Closed/Suspended.
  - Incident management: Incident logging -> Investigation & Root Cause -> CAPA Assignment -> Closure with lost workday metrics.
  - Hazard reporting & immediate Stop-Work activation.
  - Toolbox talk tracking and attendance rollups.
- `routes.ts`: Fastify routes mounted with permission guards.
- `safety.routes.test.ts`: Integration test suite covering all PTW workflows, incident investigation lifecycle, hazard stop-work gating, TBT attendance, and multi-tenant RLS isolation.
- App wiring in `backend/src/app.ts`.

### 3. Frontend Screen (`frontend/src/pages/SafetyPage.tsx`)
- Project selector dropdown for multi-project navigation.
- 4 comprehensive tabs:
  1. **Permits to Work (PTW)**: High-risk permit register, permit type badges (Hot Work, Working at Height, Confined Space, Lifting), active status pills, "+ Issue Permit" modal, and safety authorization drawer.
  2. **Incidents & Emergency Log**: Incident register with incident types (Near Miss, First Aid, Lost Time Injury - LTI), lost days counter, investigation status, "+ Report Incident" modal, and investigation drawer.
  3. **Hazard Observations & Stop-Work**: Safety cards with risk levels (`imminent_danger`, `high`, `medium`), Stop-Work alert banners, quick rectification updates, and "+ Log Hazard Observation" modal.
  4. **Toolbox Talks (TBT)**: Daily safety briefings log with trade gang attendee counts, topics, and "+ Record Toolbox Talk" modal.
- Mount route `/safety` in `frontend/src/App.tsx` and add "Safety & HSE (M20)" to `AppLayout.tsx`.
- Unit test suite in `frontend/src/pages/SafetyPage.test.tsx` and 0-error Vite build.

### 4. Acceptance Criteria
- [x] Database migration applies cleanly with RLS policies and permissions.
- [x] Backend routes for PTWs, Incidents, Hazards, and TBTs pass all tests.
- [x] Human-controlled safety approvals strictly enforced.
- [x] Multi-tenant isolation verified across all endpoints.
- [x] Frontend workspace responsive, matching brand design tokens.
- [x] Clean builds and tests for backend and frontend.
- [x] Documentation updated in USER-GUIDE.md and daily-log.
