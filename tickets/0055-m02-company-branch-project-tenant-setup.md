---
id: 55
title: "M02 — Company, Branch, Project & Tenant Setup"
status: next
roles: [backend-engineer, test-engineer]
priority: 3
created: 2026-10-15
updated: 2026-10-15
---

Second module of Phase 1 (`docs/BRD.md` §8.1 M02, `docs/PRD.md` Phase 1
table). Depends on ticket 0054 (M01 identity) for `app_users` to exist —
company/branch records need `created_by`/`updated_by` referencing real
users. Do not start before 0054 is done.

This is where multi-tenancy actually gets designed into the schema.
Everything built from here on carries `tenant_id` (BRD §6.1).

## Scope

- Tables: `Tenant`, `Company`, `LegalEntity`, `Branch` (BRD §6.2 core
  entities). A `Tenant` is the top-level isolation boundary; a `Company`
  belongs to a `Tenant`; `LegalEntity` and `Branch` belong to a `Company`.
- `tenant_id` on every tenant-owned table from this point forward,
  including retrofitting it onto `app_users` from ticket 0054 (additive
  migration — add nullable column, do not drop/alter the existing PK or
  any existing data; this is the backfill ticket 0054 deliberately left
  open).
- RLS: every table gets a policy scoping rows to the caller's
  `tenant_id`, read AND write. This is the actual "tenant isolation"
  CLAUDE.md and the Phase 1 exit criteria require — write the test that
  proves tenant A can never read or write tenant B's rows, not just that
  the policy exists.
- Company profile fields (BRD §4.1 referenced fields): legal name,
  preferred language, reporting currency, fiscal year start, enabled
  modules (a config list — do NOT hard-code which modules are "enabled,"
  make it data so M33 Master Data can manage it later).
- Country-agnostic fields only: do not add a tax-rate or statutory-ID
  column with a default value anywhere in this ticket (CLAUDE.md
  business rules: "GST must NOT be assumed," "VAT is configurable — do
  not apply a default rate"). If a field is needed for later localization
  (e.g. `statutory_id`, `vat_registration_number`), the column may exist
  but must be nullable with no default and no validation tying it to a
  specific country's format.
- Project register: BRD §8.1 lists project numbering under M02 setup even
  though the full `Project`/`ProjectType`/WBS model is M09 (Phase 3). This
  ticket adds only a minimal `Project` row (id, tenant_id, company_id,
  name, numbering-scheme reference, status) — enough for Phase 1's exit
  criterion "basic project ... administration works" — not WBS, budgets,
  milestones, etc. Those are M09's job; do not build them here.
- File metadata/storage: per Implementation Plan Phase 1 "Build" list,
  add a minimal `FileObject` metadata table (tenant_id, bucket, path,
  content_type, size, uploaded_by) pointing at Supabase Storage objects.
  No actual file-upload UI — this is Phase 1 backend plumbing only, used
  later by document-heavy modules.

## Explicitly NOT in this ticket
- Departments/roles/authority (ticket 0056 — M03).
- Branch-level tax/VAT configuration or any UAE-specific localization
  pack content — country-agnostic structure only, no UAE data populated.
- Full project/WBS/budget model (M09, Phase 3).

## Acceptance
- [ ] Migration adds Tenant, Company, LegalEntity, Branch, minimal
      Project, FileObject tables, all with tenant_id (except Tenant
      itself) and RLS enabled.
- [ ] Cross-tenant isolation test: seed two tenants, assert a session
      scoped to tenant A gets zero rows and a permission error attempting
      to read/write tenant B's Company/Branch/Project/FileObject rows.
- [ ] `app_users.tenant_id` backfilled via additive migration; existing
      ticket-0054 tests still pass unmodified.
- [ ] No column anywhere in this migration has a country-specific default
      (tax rate, statutory ID format, etc.) — reviewed explicitly against
      CLAUDE.md business rules before marking done.
- [ ] `npm test` passes, including the new tenant-isolation suite.

## Progress
- 2026-10-15: Architect session. Filed as the second Phase 1 ticket.
  Deliberately keeps Project to a stub (full model is M09/Phase 3) and
  keeps all country-specific fields nullable/default-free per CLAUDE.md's
  tax/localization rules.
