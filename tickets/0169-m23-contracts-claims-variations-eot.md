---
id: 169
title: "M23: Contracts, Claims, Variations & EOT"
status: done
roles: [architect, backend-engineer, ui-designer, test-engineer]
priority: 1
created: 2026-10-19
updated: 2026-10-19
---

## Context
Per PRD Phase 6 (Finance, billing and contracts) and BRD M23 (Contracts, Claims, Variations & EOT, source catalogue items #318, #532-#538, #1273-#1308):
Construction contractual governance, change management, and commercial claims protection:
1. **Contract Repository & Obligation Register**:
   - Master contracts (main contract, subcontracts, consultancy) with FIDIC contract provisions, original contract value, signed/commencement/completion dates, and revised completion dates.
2. **Variation Requests & Change Orders (VO)**:
   - Site instructions and scope change management (`identified` -> `pricing` -> `submitted` -> `approved` -> `rejected`).
   - Tracking cost impact (AED) and schedule delay impact (days).
   - Automatic updating of revised contract values.
3. **Claims & Extension of Time (EOT)**:
   - FIDIC Clause 20.1 / 8.4 time and prolongation cost claims.
   - Strict 28-day notice period compliance tracking.
   - Assessment and certification of claimed days and prolongation amounts.
4. **Bonds, Guarantees & Insurance (Securities Register)**:
   - Performance bonds (10%), Advance Payment Guarantees (APG), CAR insurance, and Third Party Liability.
   - Bank/insurer details, amounts, and expiry tracking with proactive renewals.

## Scope & Implementation Plan

### 1. Database Schema (`supabase/migrations/20261019000003_m23_contracts_claims_variations_eot.sql`)
- Tables:
  - `contracts`:
    - `id`, `tenant_id`, `project_id`, `contract_reference`, `title`, `contract_type` (`main_contract`, `subcontract`, `consultancy`, `joint_venture`), `counterparty_name`, `original_value`, `revised_value`, `signed_date`, `commencement_date`, `contractual_completion_date`, `revised_completion_date`, `governing_law`, `status` (`draft`, `executed`, `active`, `suspended`, `terminated`, `closed`), `notes`, `created_at`, `updated_at`.
  - `variation_orders`:
    - `id`, `tenant_id`, `contract_id`, `project_id`, `vo_number`, `title`, `description`, `reason` (`client_request`, `site_instruction`, `design_change`, `unforeseen_conditions`, `value_engineering`), `proposed_cost_amount`, `proposed_time_days`, `approved_cost_amount`, `approved_time_days`, `status` (`identified`, `pricing`, `submitted`, `approved`, `rejected`), `approved_by`, `approved_at`, `notes`, `created_at`, `updated_at`.
  - `contract_claims`:
    - `id`, `tenant_id`, `contract_id`, `project_id`, `claim_number`, `title`, `event_type` (`employer_delay`, `late_access`, `design_revision`, `adverse_weather`, `force_majeure`, `suspension`), `event_date`, `notice_date`, `notice_deadline_date`, `particulars_submitted_date`, `claimed_days`, `claimed_cost_amount`, `certified_days`, `certified_cost_amount`, `status` (`notice_issued`, `particulars_submitted`, `under_assessment`, `approved`, `partially_approved`, `rejected`, `disputed`), `assessment_notes`, `created_at`, `updated_at`.
  - `contract_securities`:
    - `id`, `tenant_id`, `contract_id`, `project_id`, `security_type` (`performance_bond`, `advance_payment_guarantee`, `retention_bond`, `car_insurance`, `third_party_liability`, `workmen_compensation`), `reference_number`, `issuing_institution`, `beneficiary`, `amount`, `currency` (default `AED`), `effective_date`, `expiry_date`, `status` (`active`, `expired`, `called`, `released`), `notes`, `created_at`, `updated_at`.
- Multi-tenant RLS isolation on all tables (`tenant_id = public.current_tenant_id()`).
- Permissions:
  - `contracts.contract.manage`
  - `contracts.variation.manage`
  - `contracts.variation.approve`
  - `contracts.claim.manage`
  - `contracts.claim.assess`
  - `contracts.security.manage`
- Granted to `role.platform_administrator`, `role.clo`, `role.legal_counsel_lead`, `role.contracts_legal_assistant`, `role.cfo`, `role.quantity_surveyor`, `role.project_engineer_lead` in `public.role_definitions`.

### 2. Backend Module (`backend/src/modules/contracts/`)
- Domain types, Supabase repository, in-memory test fake.
- Service logic enforcing:
  - Contract registration and lifecycle.
  - Variation orders lifecycle and auto-updating contract `revised_value` upon VO approval.
  - Claim management with 28-day notice deadline calculation and compliance verification.
  - Securities and bank guarantees tracking with active vs expired evaluation.
- Fastify routes mounted with permission guards.
- Route test suite (`contracts.routes.test.ts`) covering all endpoints, 28-day notice logic, VO value rollup, and multi-tenant RLS isolation.

### 3. Frontend Screen (`frontend/src/pages/ContractsPage.tsx`)
- 4 Operational Tabs:
  1. **Contract Repository & Obligations**: Master contract cards/table, FIDIC governing law, original vs revised value and completion dates, "+ Register Contract" modal.
  2. **Variation Orders (VO)**: Variations register, cost and schedule delay impacts, "+ Request Variation" modal, and approve/reject actions.
  3. **Claims & Extension of Time (EOT)**: Claims register, 28-day FIDIC notice period compliance badge, claimed vs certified days/costs, "+ Submit Claim / EOT" modal, and "Assess Claim" action.
  4. **Bonds, Guarantees & Insurance**: Securities register (Performance Bonds, APG, CAR Insurance), expiry tracker with days-remaining indicators, "+ Register Bond / Insurance" modal, and status updates.
- Wired route `/contracts` in `frontend/src/App.tsx`, nav link in `AppLayout.tsx`.
- Component unit tests in `frontend/src/pages/ContractsPage.test.tsx`.
- User Guide documentation in `docs/USER-GUIDE.md`.
