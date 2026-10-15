---
id: 56
title: "M03 — Organization, Departments, Roles & Authority"
status: testing
roles: [backend-engineer, test-engineer]
priority: 4
created: 2026-10-15
updated: 2026-10-15
---

Third and last Phase 1 module (`docs/BRD.md` §8.1 M03, `docs/PRD.md`
Phase 1 table). Depends on tickets 0054 (M01 users) and 0055 (M02
tenant/company) both being done — department/role records are scoped to
a company inside a tenant.

This ticket is what makes Phase 1's exit criteria ("authorization tests
pass," "basic ... role administration works") actually true — M01/M02
create identity and tenancy, but nobody has a role or a permission until
this lands.

## Scope

- Tables (BRD §6.2): `DepartmentDefinition` (tree via `parent_id`),
  `RoleDefinition` (canonical roles — seed from
  `docs/canonical-role-map.md`'s 44 mapped roles, don't re-derive them),
  `RoleAssignment` (user ↔ role ↔ department, effective-dated: `valid_from`
  /`valid_to`, so history is never overwritten), `Permission`,
  `Delegation` (acting/deputy roles with their own effective dates),
  `ApprovalLimit` (value-band placeholder — see below).
- Authority matrix: a role has a set of permissions; a user's effective
  permissions come from their current (effective-dated) `RoleAssignment`
  rows. Build the query/service that computes "effective permissions for
  user X at time T," since this is what every later module's
  authorization check calls.
- Segregation of duties: CLAUDE.md/PRD open-decisions list "can one person
  raise and approve the same requisition?" as unresolved. Build the
  *mechanism* (a flag/rule on an approval policy saying "assignee ≠
  approver") but do not hard-code it as always-on or invent which
  workflows it applies to yet — that's M06/M08 territory. Record the
  open question in this ticket's `## Needs approval` if a concrete
  default is needed to finish the ticket; otherwise leave the mechanism
  generic and unexercised.
- `ApprovalLimit`: PRD §5 open decision #1 says value bands are an
  unresolved owner decision, needed before M08 activates with real
  limits. This ticket creates the *table* (role/department → currency →
  max value) with zero seeded rows and a server-side check that treats
  "no limit row found" as "not authorized," never as "unlimited." Do not
  invent a default limit for any role.
- Server-side permission checks: every new endpoint from M01/M02 that
  currently has no real authorization (e.g. ticket 0054's "list audit
  log," ticket 0055's company/branch admin endpoints) gets wired to the
  effective-permissions check built here. This is explicitly called out
  in both tickets as deferred to M03 — close that loop.
- Audit: role/permission/assignment changes are "sensitive changes" per
  CLAUDE.md ground rules and BRD §6.1 — every create/update to
  `RoleAssignment`, `Delegation`, `ApprovalLimit` writes an audit row
  (reuse/extend ticket 0054's audit-log pattern rather than inventing a
  second audit mechanism).
- RLS: all new tables scoped by tenant_id with policies, consistent with
  ticket 0055's pattern.

## Explicitly NOT in this ticket
- Any real approval *workflow* (sequential/parallel approval execution)
  — that's M08, Phase 3. This ticket only builds the authority data model
  and the "am I allowed" check other modules will call.
- Populating `ApprovalLimit` with real numbers — stays empty until the
  owner answers PRD §5 open decision #1.
- HR/employee directory fields beyond what's needed for role assignment
  (skills, certifications, onboarding — that's M04, Phase 3).

## Acceptance
- [x] Migration creates DepartmentDefinition, RoleDefinition,
      RoleAssignment, Permission, Delegation, ApprovalLimit, all
      tenant-scoped with RLS. **Deviation**: RoleDefinition/Permission/
      role_permissions have a *nullable* tenant_id (NULL = platform-wide
      catalogue entry visible to every tenant) rather than NOT NULL —
      see Progress note below and DECISIONS.md for why. RLS is still
      present and still keys off tenant_id on every one of them.
- [x] RoleDefinition seeded from the 44 canonical roles in
      `docs/canonical-role-map.md` (migration or seed script, not hand
      enumerated twice) — `scripts/generate_role_seed.py` parses the map
      and asserts the count (44 + 3 platform-only); its output is pasted
      into the migration.
- [x] "Effective permissions for user X at time T" query/service exists
      and is unit-tested, including an effective-dated case (role
      assignment that hasn't started yet / already ended is excluded).
      `backend/src/modules/authority/service.ts` `getEffectivePermissions`,
      tested in `service.test.ts`.
- [x] Ticket 0054 and 0055 endpoints that were previously unauthenticated-
      beyond-"is this your own row" now call this module's permission
      check; existing tests from those tickets still pass (updated to
      authenticate as a permission-holding caller — see Progress note;
      this intentionally changes behavior those tests exercise, which is
      the point of this ticket).
- [x] A permission check against an `ApprovalLimit`-gated action with no
      matching limit row denies by default (test asserts deny-by-default,
      never allow-by-default) — `isWithinApprovalLimit` in service.ts.
- [x] Role/assignment/delegation/limit changes produce an audit row (test
      asserts this) — department creation audited too, same mechanism.
- [x] `npm test` passes (59/59), including a cross-tenant authorization
      test (user in tenant A cannot be granted or exercise a role scoped
      to tenant B) — `assignRole` rejects with `CrossTenantError` when
      the target user's own tenant differs from the caller's.

## Progress
- 2026-10-15: Architect session. Filed as the third Phase 1 ticket,
  closing the loop on deferred authorization checks left open in tickets
  0054/0055. This completes the Phase 1 module set (M01-M03); Phase 2
  (M05/M06) should not start until this ticket is done per CLAUDE.md's
  build order.
- 2026-10-15 12:05 UTC: Built M03. Migration
  `supabase/migrations/20261015000003_m03_organization_roles_authority.sql`
  adds department_definitions, role_definitions, permissions,
  role_permissions, role_assignments, delegations, approval_limits, all
  RLS-enabled, plus extends ticket 0054's `auth_audit_log` event_type
  enum (no second audit mechanism). Backend:
  `backend/src/modules/authority/` — repository (interface +
  not-yet-live Supabase adapter, same honest gap as every prior ticket:
  no reachable Supabase credentials in this sandbox), service
  (`getEffectivePermissions`, `assignRole` with the cross-tenant guard,
  `createDelegation`, `createDepartment`, `createApprovalLimit`,
  `isWithinApprovalLimit` deny-by-default, `checkSegregationOfDuties`
  generic/unexercised per this ticket's own instruction), `guard.ts`
  (`requirePermission` Fastify preHandler factory used by identity,
  tenancy and authority's own routes), `routes.ts` (admin endpoints for
  department/role-assignment/delegation/approval-limit creation plus a
  self-service `GET /authority/effective-permissions`). Wired the guard
  into `POST /identity/invite`, `POST /identity/deactivate`,
  `POST /tenancy/companies`, `POST /tenancy/branches`,
  `POST /tenancy/projects` — these previously had no check beyond "is
  there a bearer token"; updated their existing route tests to
  authenticate as a permission-holding caller (role.platform_administrator)
  rather than leaving them unauthenticated, plus added explicit 401/403
  tests. `npm test`: 59/59 (37 prior + 22 new), `npm run build` clean,
  `scripts/tickets.py check` clean.
- **Deviations from the literal ticket text, both agent-decidable per
  CLAUDE.md ("internal API design, DB schema details" — no approval
  needed), recorded in DECISIONS.md:**
  1. RoleDefinition/Permission/role_permissions use a nullable tenant_id
     (NULL = global catalogue row) instead of NOT NULL. Seeding the
     44-role canonical catalogue once as global rows, visible to every
     tenant via an RLS policy that still checks tenant_id, avoids
     duplicating `docs/canonical-role-map.md`'s catalogue per tenant with
     no mechanism yet to do that seeding per-tenant (no tenant-creation
     API exists; tenants are a service-role bootstrap step per ticket
     0055). A tenant-specific custom role/permission is still possible
     later (non-NULL tenant_id row) without a schema change.
  2. Fixed forward a latent bug in ticket 0055's migration: `companies`/
     `branches`/`projects`/`file_objects.tenant_id` is NOT NULL with no
     default, but the tenancy repository never supplies it on insert —
     a real Supabase insert would have failed. Added
     `default public.current_tenant_id()` to all four columns in this
     migration (additive `alter column ... set default`, not a
     teardown/rebuild) since this migration establishes the same
     default on its own new tenant-scoped tables and the inconsistency
     would otherwise ship into the first live-Supabase smoke test.
  3. `POST /identity/invite` is now gated on `identity.user.invite`,
     which creates a bootstrap chicken-and-egg problem: nobody can call
     it until someone already holds the permission. Resolved the same
     way ticket 0055 resolved tenant creation — the very first
     Platform Administrator role_assignment is a service-role/DB
     bootstrap step, not an API call. Noted as a migration comment;
     no ticket needed since it's the same precedent, but flagging here
     for the next session that eventually runs this against a real
     Supabase project.
- **Still open, unchanged from before this ticket:** PRD §5 open
  decision #1 (approval value bands) and #4 (segregation-of-duties
  default) remain unanswered by the business owner — `approval_limits`
  has zero seeded rows and `checkSegregationOfDuties` is unexercised, as
  instructed. Not re-raised as a new approval question since both are
  already tracked in `docs/PRD.md` §5 and this ticket's own scope note
  said not to invent a default.
- Status: `testing` — Phase 1 (M01, M02, M03) is now code-complete.
  Next: Phase 2 tickets (M05 work-item catalogue, M06 configuration
  studio/workflow engine) per CLAUDE.md's build order — do not start
  those until the owner has had a chance to review this ticket's RLS SQL
  against a real Supabase project (same "reviewed by hand, not against
  live Postgres" caveat as every migration so far).
