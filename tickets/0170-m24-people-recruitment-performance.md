---
id: 170
title: "M24: People, Recruitment & Performance"
status: done
roles: [architect, backend-engineer, ui-designer, test-engineer]
priority: 1
created: 2026-10-19
updated: 2026-10-19
---

## Context
Per PRD Phase 6 and BRD M24 (People, Recruitment & Performance, source catalogue rows covering manpower requisitions, candidate pipeline, site competency matrix, certifications, and performance appraisals):
Construction workforce mobilization, talent acquisition pipeline, site skill certification enforcement, and performance review governance:
1. **Manpower Mobilization & Site Requisitions**:
   - Project-level manpower demand requests (`role_title`, `quantity_required`, `skill_level`, `required_date`).
   - Approval workflows for hiring against project budgets.
2. **Recruitment Pipeline & Candidate Tracking**:
   - Job applicants and pipeline stages (`applied` -> `screening` -> `interview` -> `offered` -> `hired` -> `rejected`).
   - Candidate ratings (1-5), resume tracking, and hiring decisions.
3. **Site Competency Matrix & Certifications Register**:
   - Specialized trade credentials and safety certifications (e.g., Working at Height, Confined Space Entry, Heavy Rigging/Crane, First Aid).
   - Expiry monitoring and compliance readiness for site workers.
4. **Performance Objectives & Appraisals**:
   - Performance evaluation reviews with objective scoring, strengths, growth areas, and career development goals.

## Scope & Implementation Plan

### 1. Database Schema (`supabase/migrations/20261019000004_m24_people_recruitment_performance.sql`)
- Tables:
  - `manpower_requests`: `id`, `tenant_id`, `project_id`, `request_number`, `role_title`, `quantity_required`, `skill_level`, `required_date`, `status` (`draft`, `submitted`, `approved`, `fulfilled`, `cancelled`), `approved_by`, `approved_at`, `notes`, `created_at`, `updated_at`.
  - `recruitment_candidates`: `id`, `tenant_id`, `manpower_request_id`, `candidate_name`, `email`, `phone`, `position_applied`, `current_company`, `years_experience`, `stage` (`applied`, `screening`, `interview`, `offered`, `hired`, `rejected`), `rating`, `notes`, `created_at`, `updated_at`.
  - `site_competencies`: `id`, `tenant_id`, `employee_name`, `trade`, `certification_name`, `certifying_body`, `issue_date`, `expiry_date`, `status` (`valid`, `expiring_soon`, `expired`), `notes`, `created_at`, `updated_at`.
  - `performance_appraisals`: `id`, `tenant_id`, `employee_name`, `review_period`, `appraiser_name`, `score`, `strengths`, `growth_areas`, `goals`, `status` (`draft`, `submitted`, `completed`), `created_at`, `updated_at`.
- Multi-tenant RLS isolation on all tables (`tenant_id = public.current_tenant_id()`).
- Permissions:
  - `people.manpower.manage`
  - `people.manpower.approve`
  - `people.recruitment.manage`
  - `people.competency.manage`
  - `people.appraisal.manage`
- Seeded to `public.role_definitions` (`role.platform_administrator`, `role.hr_admin_lead`, `role.hr_admin_assistant`, `role.project_engineer_lead`).

### 2. Backend Module (`backend/src/modules/people/`)
- Domain types, Supabase repository, and in-memory test fake.
- Service logic enforcing:
  - Manpower request approval workflow and quantity fulfillment checks.
  - Candidate stage transitions (`applied` -> `screening` -> `interview` -> `offered` -> `hired` / `rejected`).
  - Automated calculation of competency certification status (checks if expiry within 30 days -> `expiring_soon`, or past expiry date -> `expired`).
  - Appraisal submission and final scoring.
- Fastify routes mounted with permission guards.
- Route test suite (`people.routes.test.ts`) covering all endpoints and tenant isolation.

### 3. Frontend Screen (`frontend/src/pages/PeoplePage.tsx`)
- 4 Operational Tabs:
  1. **Manpower Requisitions**: Project demand requests, headcount needed, approval status, "+ Request Manpower" modal.
  2. **Recruitment Pipeline**: Visual candidate stages, applicant profiles, ratings, "+ Add Candidate" modal, and stage advancement actions.
  3. **Site Competency Matrix**: Trade certifications, safety qualification status (Valid / Expiring / Expired), "+ Record Certification" modal.
  4. **Performance Appraisals**: Employee review cycles, ratings, "+ New Appraisal" modal.
- Wired route `/people` in `frontend/src/App.tsx`, nav link in `AppLayout.tsx`.
- Component unit tests in `frontend/src/pages/PeoplePage.test.tsx`.
- Documentation in `docs/USER-GUIDE.md` and `daily-log/2026-10-19.md`.
