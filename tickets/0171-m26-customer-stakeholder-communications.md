---
id: 171
title: "M26: Customer / Stakeholder Communications"
status: done
roles: [architect, backend-engineer, ui-designer, test-engineer]
priority: 1
created: 2026-10-19
updated: 2026-10-19
---

## Context
Per PRD Phase 6 and BRD Section 7 & 8 M26 (Customer / Stakeholder Communications, covering stakeholder directory, communication logs, meeting minutes (MOM) with action tracking, and client feedback/complaint management):
Construction project coordination requires structured external and internal communications with clients, supervising consultants, government statutory authorities, and community stakeholders:
1. **Stakeholder Directory**:
   - Register of key project contacts across roles (`client`, `consultant`, `subcontractor`, `authority`, `community`, `utility`).
   - Engagement levels, contact details, organization names, and influence ratings.
2. **Communication Logs & Formal Notices**:
   - Tracking formal correspondence (`letter`, `email`, `site_instruction`, `transmittal`, `notice`, `circular`).
   - Inbound and outbound tracking, response deadlines, reference numbers, and attachments/links.
3. **Meeting Minutes (MOM) & Action Items**:
   - Meeting details (`site_coordination`, `client_review`, `technical_clarification`, `progress_meeting`), structured attendees list, discussion highlights, and extracted actionable items (`task`, `assignee`, `due_date`, `status`).
4. **Client Feedback & Complaints Register**:
   - Client issue log with priority/severity scoring (`low`, `medium`, `high`, `critical`), resolution status (`received`, `investigating`, `resolved`, `closed`), corrective action plan, and escalation workflows.

## Scope & Implementation Plan

### 1. Database Schema (`supabase/migrations/20261019000005_m26_customer_stakeholder_communications.sql`)
- Tables:
  - `stakeholders`: `id`, `tenant_id`, `project_id`, `name`, `organization`, `stakeholder_type` (`client`, `consultant`, `subcontractor`, `authority`, `community`, `utility`), `role_title`, `email`, `phone`, `engagement_level` (`low`, `medium`, `high`), `notes`, `created_at`, `updated_at`.
  - `communication_logs`: `id`, `tenant_id`, `project_id`, `reference_number`, `channel` (`letter`, `email`, `site_instruction`, `transmittal`, `notice`, `circular`), `direction` (`inbound`, `outbound`), `sender_name`, `recipient_name`, `subject`, `summary`, `requires_response`, `response_due_date`, `status` (`draft`, `sent`, `received`, `closed`), `created_at`, `updated_at`.
  - `meeting_minutes`: `id`, `tenant_id`, `project_id`, `meeting_title`, `meeting_type` (`site_coordination`, `client_review`, `technical_clarification`, `progress_meeting`), `meeting_date`, `location`, `attendees`, `summary`, `action_items` (JSONB array of `{ id, task, assignee, due_date, status }`), `status` (`draft`, `published`), `created_at`, `updated_at`.
  - `client_complaints`: `id`, `tenant_id`, `project_id`, `complaint_number`, `client_name`, `contact_info`, `severity` (`low`, `medium`, `high`, `critical`), `category` (`quality`, `schedule`, `safety`, `billing`, `conduct`, `other`), `description`, `resolution_plan`, `status` (`received`, `investigating`, `resolved`, `closed`), `assigned_to`, `resolved_at`, `created_at`, `updated_at`.
- Multi-tenant RLS isolation on all tables (`tenant_id = public.current_tenant_id()`).
- Permissions:
  - `communications.stakeholder.manage`
  - `communications.log.manage`
  - `communications.minutes.manage`
  - `communications.complaint.manage`
  - `communications.complaint.resolve`
- Seed permissions to `public.role_definitions` (`role.platform_administrator`, `role.project_engineer_lead`, `role.business_development_executive`, `role.cmo`).

### 2. Backend Module (`backend/src/modules/communications/`)
- Domain types, Supabase repository, and in-memory test fake.
- Service logic enforcing:
  - Validation of communication references and response deadlines.
  - MOM action items validation and extraction.
  - Complaint escalation rules for `critical` / `high` severity.
  - Resolution audit timestamps.
- Fastify routes mounted with permission guards.
- Route test suite (`communications.routes.test.ts`) covering all endpoints and tenant isolation.

### 3. Frontend Screen (`frontend/src/pages/CommunicationsPage.tsx`)
- 4 Operational Tabs:
  1. **Stakeholder Directory**: Searchable list of clients, consultants, and authorities with contact info, engagement level badges, "+ Add Stakeholder" modal.
  2. **Communication Logs**: Formal notices, inbound/outbound register, response due countdowns, "+ Log Correspondence" modal.
  3. **Meeting Minutes (MOM)**: Recorded meetings, attendee lists, actionable items checklist with status toggle, "+ Record MOM" modal.
  4. **Client Complaints & Escalations**: Complaint log, severity markers, resolution workflows, "+ Log Complaint" modal and Resolve dialog.
- Wired route `/communications` in `frontend/src/App.tsx`, nav link in `AppLayout.tsx`.
- Component unit tests in `frontend/src/pages/CommunicationsPage.test.tsx`.
- Documentation in `docs/USER-GUIDE.md` and `daily-log/2026-10-19.md`.
