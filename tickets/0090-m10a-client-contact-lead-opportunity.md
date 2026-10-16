---
id: 90
title: "M10a — Client/Contact/Lead/Opportunity core data model"
status: testing
roles: [backend-engineer]
priority: 13
created: 2026-10-16
updated: 2026-10-16
---

First of three M10 sub-tickets (see ticket 0089 for the split
rationale). Depends on M02 (tenancy — done) and M09 (projects exist
for an opportunity to eventually reference — done). Covers BRD
§8.5 FR-CRM-001 and FR-CRM-002. BRD §6.2 entities: `Client, Contact,
Lead, Opportunity`.

## What to build
- `clients`: tenant-scoped, name, trade license/registration fields
  (country-agnostic — do not hard-code a UAE-specific ID format, same
  rule as every tax/localization field in this project), primary
  contact reference, created_by/at.
- `contacts`: tenant-scoped, `client_id` FK, name, role/title, email,
  phone, is_primary.
- `leads`/`opportunities`: FR-CRM-001 says a lead/opportunity has
  **source, client, owner, stage, expected value, probability, next
  action and due date** — model every one of those as a real column,
  not a jsonb catch-all. `stage` is an enum you define from BRD §10.1's
  "Opportunity to project" step list (e.g. `lead`, `qualified`,
  `site_visit`, `tender`, `negotiation`, `won`, `lost`) — this ticket
  only needs the stages up through where M10b/M10c plug in; do not
  invent stages for M11/M12's later steps (feasibility, estimate,
  bid/no-bid) since those modules own that part of the lifecycle and
  may want to extend this enum themselves later.
- FR-CRM-002: duplicate client/contact detection. Keep this simple and
  real — e.g. a case-insensitive unique-ish check or a `GET
  /clients?search=` surfacing likely duplicates by name/email/phone
  for a human to resolve, not a fuzzy-matching ML feature nobody
  asked for. Do not invent an automatic merge; surfacing duplicates for
  a human decision satisfies the FR.
- Permission: a new `crm.lead.manage` (or similar) permission. BRD
  §7's module row names "Sales; Marketing; Technical" as this
  module's owners, and `docs/canonical-role-map.md`/ticket 0056's
  seed already has real roles for two of those three —
  `role.business_development_executive`, `role.marketing_manager_lead`,
  `role.cmo` (Marketing & Sales cluster). Grant the new permission to
  those three roles at bootstrap (plus `role.platform_administrator`,
  same as every permission), not just platform_administrator-only —
  unlike this project's compliance-sensitive permissions
  (audit/retention/data-request), this is an ordinary departmental
  CRUD action with real named owners already in the role catalogue, so
  deny-to-everyone-but-admin would just be unrequested friction.

## Out of scope
- Tender documents, bid/no-bid decisions, estimates — M11.
- Site visits, tender deadline tracking, communication log — ticket
  0091 (M10b).
- Pipeline forecast reporting, handover checklist — ticket 0092 (M10c).

## Acceptance
- [x] `clients`/`contacts`/`leads` (or `opportunities` — pick one name
      and be consistent; BRD uses both terms for what looks like the
      same entity progressing through `stage`) tables, tenant-scoped
      with RLS.
- [x] Every FR-CRM-001 field (source, client, owner, stage, expected
      value, probability, next action, due date) is a real column.
- [x] Duplicate client/contact detection surfaced via the API (FR-CRM-002).
- [x] Tests cover tenant isolation, permission gating, and duplicate
      detection.

## Progress
- 2026-10-16: Filed as the first of three M10 sub-tickets (see ticket
  0089's split).
- 2026-10-16 11:40 UTC: Built. Migration
  `supabase/migrations/20261016000012_m10a_crm_core.sql` adds
  `clients`/`contacts`/`opportunities` (tenant-scoped RLS, every
  FR-CRM-001 field as a real column, `stage` enum through
  lead/qualified/site_visit/tender/negotiation/won/lost) and the
  `crm.lead.manage` permission granted to
  `role.platform_administrator` plus the Marketing & Sales cluster
  (`role.business_development_executive`, `role.marketing_manager_lead`,
  `role.cmo`) per the ticket's own instruction. New `backend/src/modules/
  crm/` (types/repository/service/routes), `GET /crm/clients?search=`
  and `GET /crm/contacts?search=` for FR-CRM-002 duplicate surfacing,
  wired into `app.ts`. One naming judgment call recorded in
  `DECISIONS.md` (one `opportunities` table, not a separate `leads`
  table — the ticket's own text left this open). 18 new tests
  (service.test.ts: creation/search/duplicate-surfacing/tenant
  isolation/stage-advance; routes.test.ts: permission gating,
  tenant-isolated 404s, full create→read→list→patch lifecycle).
  `npm test`: 465/465 (447 prior + 18 new), `npm run build` clean,
  `scripts/tickets.py check` clean. Not yet applied to the real
  Supabase project — no reachable Supabase credentials in this
  sandbox, same gap flagged for every other migration in this repo.
  Status `testing`, not `done`: migration needs to actually run
  against live Supabase before this is usable. Next: ticket 0091
  (M10b — site visits, tender deadline tracking, communication log).
