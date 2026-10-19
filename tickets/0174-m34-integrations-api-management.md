---
id: 174
title: "M34: Integrations & API Management"
status: done
roles: [architect, backend-engineer, ui-designer, test-engineer]
priority: 1
created: 2026-10-19
updated: 2026-10-19
---

## Context
Per PRD Phase 8 and BRD Section 7 & 8 M34 (Integrations & API Management, covering external REST API keys, outbound event webhooks, third-party connectors for accounting/banking/e-sign/OCR, and delivery audit logs):
As SEVENTS operates within a multi-entity construction ecosystem, integration with third-party software, submittals, external accounting ERPs (QuickBooks, Xero, Tally), bank payroll WPS, e-signature engines, and custom partner workflows is essential:
1. **API Keys & Scopes Management**:
   - Tenant-scoped API key issuance with SHA-256 hashed secret tokens and plain prefixes (`sev_live_...`).
   - Granular permission scopes (`projects.read`, `tasks.write`, `procurement.read`, `finance.read`, `reports.read`).
   - Per-key rate limiting (requests per minute) and revocation lifecycle.
2. **Outbound Webhooks Hub**:
   - Webhook subscriptions triggered on enterprise business events (`project.created`, `task.completed`, `po.approved`, `invoice.issued`, `ncr.opened`, `incident.reported`).
   - HMAC signing secret (`X-Sevents-Signature`), active/inactive toggle, failure counters, and test trigger simulation.
   - Comprehensive delivery logs tracking HTTP status code, request payload, response body, latency, and delivery timestamp.
3. **Third-Party Connectors & Service Integrations**:
   - Pre-configured connectors for Enterprise Accounting (Xero, QuickBooks, Zoho, Tally), E-Signature (DocuSign, Adobe Sign), Cloud Storage (AWS S3, Azure Blob), and Banking WPS.
   - Credentials management (masked tokens), connection health checks, and sync timestamps.
4. **Integration Audit & Logs Viewer**:
   - Inspect delivery traces, re-trigger failed webhooks, and review API usage.

## Scope & Implementation Plan

### 1. Database Schema (`supabase/migrations/20261019000008_m34_integrations_api_management.sql`)
- Tables:
  - `api_keys`: `id`, `tenant_id`, `name`, `key_prefix`, `key_hash`, `scopes`, `rate_limit_rpm`, `expires_at`, `revoked_at`, `last_used_at`, `created_by`, `created_at`.
  - `webhook_subscriptions`: `id`, `tenant_id`, `name`, `target_url`, `event_types`, `secret_key`, `is_active`, `failure_count`, `last_triggered_at`, `created_at`, `updated_at`.
  - `webhook_deliveries`: `id`, `tenant_id`, `webhook_id`, `event_type`, `payload`, `response_status`, `response_body`, `status`, `delivered_at`.
  - `service_connectors`: `id`, `tenant_id`, `connector_key`, `name`, `category`, `status`, `credentials_masked`, `settings`, `last_sync_at`, `created_at`, `updated_at`.
- Multi-tenant RLS isolation on all tables (`tenant_id = public.current_tenant_id()`).
- Permissions:
  - `integrations.api_key.manage`
  - `integrations.api_key.revoke`
  - `integrations.webhook.manage`
  - `integrations.webhook.test`
  - `integrations.connector.manage`
  - `integrations.log.view`
- Seeded into `public.role_definitions` for `role.platform_administrator`, `role.company_administrator`.

### 2. Backend Module (`backend/src/modules/integrations/`)
- Domain types, Supabase repository, test fake, and service layer.
- API Key generator producing secure prefixes and hashed secrets.
- Webhook dispatcher simulator and delivery logger.
- Service connector credentials manager and health check.
- Fastify routes mounted with permission guards.
- Route integration tests in `integrations.routes.test.ts`.

### 3. Frontend Screen (`frontend/src/pages/IntegrationsPage.tsx`)
- 4 Operational Tabs:
  1. **API Keys & Scopes**: Generate new API key modal with secret reveal, list active keys with scopes, revoke action.
  2. **Outbound Webhooks**: Create webhook modal with event checklist, test ping action, status toggle.
  3. **Third-Party Connectors**: Grid of accounting, banking WPS, and e-sign connectors with configure/connect modals.
  4. **Delivery & Audit Logs**: Real-time event log viewer with HTTP status pills, response details, and payload inspection.
- Routed at `/integrations` and linked in `AppLayout.tsx`.
- Unit tests in `frontend/src/pages/IntegrationsPage.test.tsx`.
