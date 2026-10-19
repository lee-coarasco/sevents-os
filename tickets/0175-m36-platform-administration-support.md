---
id: 175
title: "M36: Platform Administration & Support"
status: done
roles: [architect, backend-engineer, ui-designer, test-engineer]
priority: 1
created: 2026-10-19
updated: 2026-10-19
---

## Context
Per PRD Phase 8 and BRD Section 7 & 8 M36 (Platform Administration & Support, covering tenant configuration, system health monitoring, feature flag toggles, maintenance window banners, failed workflow job repair/replay, and support ticket management):
As SEVENTS enters multi-tenant commercial operations, platform administrators and DevOps engineers require central administrative governance to:
1. **Tenant Configuration & Governance**:
   - Organization branding, timezones, working day calendars, default currency, storage quotas, and security policies (session idle timeout, password rotation rules).
2. **Feature Flags & Experimental Capabilities**:
   - Fine-grained feature flag toggles per tenant (e.g., `ai_copilot_enabled`, `wps_banking_export`, `advanced_s_curves`, `mobile_offline_sync`).
3. **System Health & Job Queue Observability**:
   - Health status probes (Database, Storage, Auth, Realtime, Fastify backend, Worker queues), background job retry metrics, and queue processing latencies.
4. **Maintenance Banners & Incident Broadcasts**:
   - Tenant-wide and global scheduled maintenance banners with target maintenance windows and operational severity indicators.
5. **Support Tickets & Incident Management**:
   - In-app support request tickets submitted by tenant users with category, urgency, attachments, admin triage status, and resolution comments.

## Acceptance
- [ ] Database schema in `supabase/migrations/` creating:
  - `tenant_settings`: Tenant customization settings, storage quotas, session timeouts, and branding.
  - `feature_flags`: Feature flag keys, description, default state, and tenant overrides.
  - `system_maintenance_windows`: Scheduled maintenance announcements, banner messages, start/end windows, and active flag.
  - `platform_support_tickets`: Support requests with ticket number, reporter user, category, urgency, status, and resolution details.
  - RLS policies enforcing tenant isolation and permissions seeded in `public.permissions`.
- [ ] Backend Fastify module in `backend/src/modules/platform-admin/` with:
  - Tenant settings query & update.
  - Feature flag evaluation & toggles.
  - Health probe status checker (`/platform-admin/health`).
  - Maintenance window CRUD.
  - Support ticket creation, status progression, and triage notes.
  - Unit/integration test suite passing with clean TypeScript build.
- [ ] Frontend screen in `frontend/src/pages/PlatformAdminPage.tsx`:
  - Route `/platform-admin` in `App.tsx` and nav link in `AppLayout.tsx`.
  - 4 Operational Tabs:
    1. **Tenant Profile & Security Config**: Branding, timezone, fiscal year, session timeouts, and storage quotas.
    2. **Feature Flags**: Dynamic toggle table with descriptions, categories, and enabled status.
    3. **System Health & Maintenance**: Live component status probes (DB, Auth, Storage, API) and active maintenance banner broadcaster.
    4. **Support & Service Desk**: Helpdesk ticket register with priority badges, "+ Submit Support Ticket" modal, and resolution triage.
  - Unit tests in `frontend/src/pages/PlatformAdminPage.test.tsx` passing.
- [ ] Documentation updated in `docs/USER-GUIDE.md` and `daily-log/2026-10-19.md`.

## Progress
- 2026-10-19 11:22 IST: Created ticket #0175, starting schema migration and backend architecture.
