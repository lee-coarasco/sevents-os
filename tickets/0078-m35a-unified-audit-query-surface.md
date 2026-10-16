---
id: 78
title: "M35a — Unified audit query surface & auth_audit_log admin access"
status: testing
roles: [backend-engineer]
priority: 10
created: 2026-10-16
updated: 2026-10-16
---

First of three M35 sub-tickets (see ticket 0068 and DECISIONS.md for
the split rationale). Covers BRD §8.11 FR-AUD-001/002 — the only two
concrete, testable audit requirements the BRD actually states. (The
PRD's §7 module-row prose — encryption, incident handling, backup/
restore tests — is infrastructure/ops scope, not an application
feature; out of scope for this ticket and this module generally.)

## Survey findings (read before building)
Every module so far already writes its own append-only audit trail —
there is no missing *logging* mechanism, only a missing *unified read*
surface:
- `auth_audit_log` (ticket 0054/0056): `user_id`, `event_type`,
  `metadata` jsonb, `created_at`. **No `tenant_id` column at all**,
  and its only RLS policy is `auth.uid() = user_id` (a user can read
  their own rows, nobody else — not even a platform administrator).
  This is the one real gap: FR-AUD-002 says audit records must be
  "access-controlled," which today means *over*-restricted (no
  tenant-wide auditor access exists at all), not under-restricted.
- `configuration_changes` (ticket 0060): `tenant_id`, `entity_type`,
  `entity_id`, `change_type`, `diff` jsonb, `reason`, `changed_by`,
  `created_at`. Already the closest thing to a generic audit row in
  this codebase — tenant-scoped RLS, queryable today.
- `workflow_events` (ticket 0062): `tenant_id`, `workflow_instance_id`,
  `step_instance_id`, `event_type`, `payload` jsonb, `created_at`.
  Tenant-scoped RLS, queryable today. No explicit `actor` column —
  whoever triggered the event is wherever the calling code chose to
  put it inside `payload` (inconsistent key, don't assume one).
- `approval_decisions` / `approval_revocations` (ticket 0066):
  tenant-scoped RLS, queryable today, explicit `decided_by`/
  `revoked_by` actor columns and a required `reason` on revocations.
- `app_users.tenant_id` (ticket 0055) already exists and is non-null
  for every real user — resolving "which tenant does this
  `auth_audit_log` row belong to" is a plain join on `user_id`, no
  schema change to `auth_audit_log` needed for that part.

## What to build
- A new `audit.log.view` permission, deny-by-default like every other
  permission added so far.
- A new `backend/src/modules/audit/` module (cross-cutting read
  surface, doesn't belong inside any one of the modules it reads from)
  with `GET /audit/log` (filters: `entityType`, `actorId`, `from`,
  `to`; paginated). Normalizes rows from the four sources above into
  one shape matching FR-AUD-001's literal field list: actor (human/
  agent/system — today everything is human, `actorType` is always
  `"human"` until agents exist in M29/M30; do not invent an `"agent"`
  value ahead of that), action, entity type + id, timestamp,
  before/after (`diff`/`payload`/`metadata` as-is, never reshaped into
  a guessed common structure), and a `correlationId` field that is
  `null` for every source table today (none of them carry a
  request/correlation id yet — note this as a real gap in the ticket's
  Progress, do not invent an id).
- Because this needs a *cross-tenant-table, permission-gated* read
  that plain per-table RLS can't express without either loosening
  `auth_audit_log`'s policy (wrong — would let any tenant member read
  everyone's login history) or writing a service-role-bypassing route,
  this module's repository uses the **service-role Supabase client**
  for the merged read, with the tenant filter applied explicitly in
  application code (`tenant_id = caller's own tenant`, looked up via
  `app_users.tenant_id` for the caller) — same "service role, explicit
  tenant check in code" precedent as
  `backend/src/scripts/import-catalogue.ts` (ticket 0058) and the
  identity module's admin operations (ticket 0056). The route's own
  `requirePermission("audit.log.view")` guard is what actually gates
  this — the service-role bypass is why that guard matters here more
  than anywhere else in the codebase; get the permission check right
  before the data access.
- Add a tenant-aware admin read path for `auth_audit_log` itself (not
  just the merged view): either a dedicated repository method behind
  the same `audit.log.view` permission, reading via service role with
  an explicit `app_users` join on `tenant_id`, or folding it into the
  merged `/audit/log` endpoint above as one of its sources — do not
  add a new RLS policy that would let ordinary tenant members read
  each other's login events.

## Out of scope
- Encryption, incident handling, backup/restore tests (infrastructure/
  ops, not an application feature).
- A real request/correlation-id mechanism (none exists in this
  codebase; adding one is a bigger cross-cutting change than this
  ticket, and no FR demands it be invented here — only that it be
  surfaced *if present*).
- Retention/legal-hold (ticket 0079) and data export/deletion (ticket
  0080) — this ticket is read-only.

## Acceptance
- [x] `audit.log.view` permission exists, deny-by-default.
- [x] `GET /audit/log` merges all four existing audit-shaped tables
      into one normalized, paginated, filterable response; 403
      without the permission.
- [x] A platform administrator (or anyone holding `audit.log.view`)
      can read `auth_audit_log` rows for other users in their own
      tenant through this endpoint; a caller without the permission
      still cannot (ordinary per-table RLS is unchanged — no new
      "any tenant member can read" policy was added).
- [x] Tests cover: permission gating, tenant isolation (tenant B's
      `audit.log.view` holder never sees tenant A's rows), and that
      the merged response never fabricates an `actorType` other than
      `"human"` or a `correlationId` where the source row has none.

## Progress
- 2026-10-16: Filed as the first of three M35 sub-tickets (see ticket
  0068's split). Survey of existing audit-shaped tables done as part
  of filing this ticket — see "Survey findings" above; do not re-survey
  from scratch, extend this list if a later session finds another
  audit-shaped table this ticket missed.
- 2026-10-16 01:52 UTC: Built. New `backend/src/modules/audit/`
  (`types.ts`, `repository.ts`, `service.ts`, `routes.ts`) + migration
  `20261016000006_m35a_audit_log_view_permission.sql` (adds
  `audit.log.view`, granted to `role.platform_administrator`, no new
  table/column). `GET /audit/log` (filters: `entityType`, `actorId`,
  `from`, `to`, `limit`, `offset`) merges `auth_audit_log`,
  `configuration_changes`, `workflow_events`, `approval_decisions` and
  `approval_revocations` via a service-role client
  (`createSupabaseAuditRepository`), with the tenant filter applied
  explicitly in code (`tenant_id = tenantId` on the four tenant-scoped
  tables; for `auth_audit_log`, which has no `tenant_id` column, a
  service-role lookup of the caller's tenant's `app_users` ids, then
  `user_id in (...)`) — gated by the route's own
  `requirePermission("audit.log.view")`, same precedent as
  `import-catalogue.ts`/identity admin ops. Normalization never
  fabricates `actorType` (always `"human"`) or `correlationId` (always
  `null`) — both are real, documented gaps, not guesses.
  `workflow_events` rows normalize with `actorId: null` since that
  table has no actor column (tested explicitly: filtering by any
  `actorId` must exclude them, not match on null). Split the actual
  Supabase-fetch (repository) from the filter/sort/paginate logic
  (service, pure functions over plain arrays) so the normalization and
  filter-semantics tests (`service.test.ts`) don't need to mock a
  Supabase client; `routes.test.ts` covers 401/403 gating and
  cross-tenant isolation via `FakeAuditRepository`
  (`backend/src/test/fakeAuditRepository.ts`). Wired into
  `backend/src/app.ts` (`auditRoutes`, `getAuditRepository`
  override point, same pattern as every other module). `npm run
  lint` and `npm test` both clean (352/352 tests pass, including 14
  new ones). One known scale limitation worth flagging if audit
  volume ever grows large: `listAuditLogEntries` fetches all of a
  tenant's rows across all five source tables unfiltered-by-date in
  one call, then filters/paginates in application code — fine at
  current/expected volume, not fine if any tenant accumulates
  hundreds of thousands of audit rows; a future session should push
  the `from`/`to`/`entityType`/`actorId` filters down into each
  Supabase query instead of filtering after fetch, if that ever
  becomes the bottleneck. Status: `testing` (no UI; owner can
  exercise this by running `npm test` or hitting `/audit/log` against
  a real Supabase instance with a user holding `audit.log.view`, per
  CLAUDE.md's Phase 2 "no user-facing UI yet" testing note).
