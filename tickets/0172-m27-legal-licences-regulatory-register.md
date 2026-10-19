---
id: 172
title: "M27: Legal, Licences & Regulatory Register"
status: done
roles: [architect, backend-engineer, ui-designer, test-engineer]
priority: 1
created: 2026-10-19
updated: 2026-10-19
---

## Context
Per PRD Phase 6 and BRD Section 7 & 8 M27 (Legal, Licences & Regulatory Register, covering corporate and site permits, legal matters/disputes, external counsel engagements, compliance obligations, privilege restrictions, and expiry deadline alerts):
Construction operations involve heavy statutory oversight, licensing compliance, and commercial/dispute legal matters:
1. **Corporate & Site Licences / Permits**:
   - Commercial trade licences, chamber of commerce registrations, civil defense certificates, municipal site permits, environmental discharge clearances, and industrial road transport permits.
   - Issuing authority, licence number, validity period (`issue_date`, `expiry_date`), renewal lead time days, status (`active`, `expiring_soon`, `expired`, `renewed`, `suspended`), document references, and renewal costs.
2. **Legal Matters & Disputes Register**:
   - Dispute and litigation matters (`arbitration`, `litigation`, `adjudication`, `mediation`, `labor_claim`, `regulatory_investigation`).
   - Claim amounts, forum/court, matter description, current status (`open`, `pleadings`, `hearing`, `settled`, `judgment_awarded`, `closed`), internal lead counsel, risk rating (`low`, `medium`, `high`, `critical`), and legal privilege classification (`public`, `internal`, `privileged_confidential`).
3. **External Counsel & Advisory Retainers**:
   - Retained law firms, counsel contact details, scope of engagement, billing structure (`hourly`, `fixed_fee`, `contingency`, `capped`), agreed budget, actual fees incurred, and engagement status (`active`, `concluded`, `terminated`).
4. **Regulatory Compliance Obligations & Filings**:
   - Statutory compliance calendar (e.g. corporate annual filings, wage protection system (WPS) compliance, economic substance filings, statutory audit, beneficial ownership declarations).
   - Frequency (`monthly`, `quarterly`, `semi_annual`, `annual`, `ad_hoc`), due dates, compliance officer owner, and filing status (`pending`, `filed`, `exempt`, `overdue`).

## Scope & Implementation Plan

### 1. Database Schema (`supabase/migrations/20261019000006_m27_legal_licences_regulatory_register.sql`)
- Tables:
  - `licences_permits`: `id`, `tenant_id`, `project_id`, `licence_name`, `licence_number`, `category` (`trade_licence`, `civil_defense`, `municipality_permit`, `environmental`, `road_transport`, `customs`, `other`), `issuing_authority`, `issue_date`, `expiry_date`, `renewal_lead_days` (default 30), `status` (`active`, `expiring_soon`, `expired`, `under_renewal`, `suspended`), `responsible_officer`, `renewal_cost`, `document_url`, `notes`, `created_at`, `updated_at`.
  - `legal_matters`: `id`, `tenant_id`, `project_id`, `matter_reference`, `title`, `matter_type` (`arbitration`, `litigation`, `adjudication`, `mediation`, `labor_claim`, `regulatory_investigation`), `court_or_tribunal`, `claim_amount`, `currency`, `opposing_party`, `risk_level` (`low`, `medium`, `high`, `critical`), `access_class` (`public`, `internal`, `privileged_confidential`), `internal_counsel`, `status` (`open`, `pleadings`, `hearing`, `settled`, `judgment_awarded`, `closed`), `summary`, `created_at`, `updated_at`.
  - `external_counsel`: `id`, `tenant_id`, `firm_name`, `lead_attorney`, `email`, `phone`, `specialization`, `fee_arrangement` (`hourly`, `fixed_fee`, `capped`, `contingency`), `budget_amount`, `billed_amount`, `currency`, `status` (`active`, `concluded`, `terminated`), `notes`, `created_at`, `updated_at`.
  - `compliance_obligations`: `id`, `tenant_id`, `obligation_name`, `regulatory_body`, `frequency` (`monthly`, `quarterly`, `semi_annual`, `annual`, `ad_hoc`), `deadline_date`, `compliance_owner`, `status` (`pending`, `filed`, `exempt`, `overdue`), `evidence_reference`, `filing_date`, `notes`, `created_at`, `updated_at`.
- Multi-tenant RLS isolation on all tables (`tenant_id = public.current_tenant_id()`).
- Permissions:
  - `legal.licence.manage`
  - `legal.licence.renew`
  - `legal.matter.manage`
  - `legal.matter.view_privileged`
  - `legal.counsel.manage`
  - `legal.compliance.manage`
- Seeded in `public.role_definitions` for `role.platform_administrator`, `role.clo`, `role.legal_counsel_lead`, `role.contracts_legal_assistant`.

### 2. Backend Module (`backend/src/modules/legal/`)
- Domain types, Supabase repository, and in-memory test fake.
- Service logic enforcing:
  - Automated calculation of licence expiry status (checks if expiry within renewal lead days -> `expiring_soon`, past expiry -> `expired`).
  - Licence renewal action updating validity dates and status to `active`.
  - Legal privilege access restrictions on `privileged_confidential` matters.
  - Compliance obligation filing confirmation with audit timestamp.
- Fastify routes mounted with permission guards.
- Route test suite (`legal.routes.test.ts`) covering all 4 domains, privilege filtering, and tenant isolation.

### 3. Frontend Screen (`frontend/src/pages/LegalPage.tsx`)
- 4 Operational Tabs:
  1. **Licences & Permits Register**: Commercial trade licences, municipality permits, civil defense clearances, renewal countdowns, "+ Register Licence / Permit" modal, and "Renew" action.
  2. **Legal Matters & Disputes**: Arbitration/litigation cases, claim amounts, risk levels, privileged badges, "+ Log Legal Matter" modal, and status updates.
  3. **External Counsel & Advisors**: Retained legal firms, fee arrangements, budget vs billed tracking, and "+ Add External Counsel" modal.
  4. **Compliance Obligations & Filings**: Statutory compliance checklist, filing deadlines, status pills, and "+ Add Obligation" modal.
- Wired route `/legal` in `frontend/src/App.tsx`, nav link in `AppLayout.tsx`.
- Component unit tests in `frontend/src/pages/LegalPage.test.tsx`.
- Documentation in `docs/USER-GUIDE.md` and `daily-log/2026-10-19.md`.
