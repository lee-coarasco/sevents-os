---
id: 56
title: "M03 — Organization, Departments, Roles & Authority"
status: next
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
- [ ] Migration creates DepartmentDefinition, RoleDefinition,
      RoleAssignment, Permission, Delegation, ApprovalLimit, all
      tenant-scoped with RLS.
- [ ] RoleDefinition seeded from the 44 canonical roles in
      `docs/canonical-role-map.md` (migration or seed script, not hand
      enumerated twice).
- [ ] "Effective permissions for user X at time T" query/service exists
      and is unit-tested, including an effective-dated case (role
      assignment that hasn't started yet / already ended is excluded).
- [ ] Ticket 0054 and 0055 endpoints that were previously unauthenticated-
      beyond-"is this your own row" now call this module's permission
      check; existing tests from those tickets still pass.
- [ ] A permission check against an `ApprovalLimit`-gated action with no
      matching limit row denies by default (test asserts deny-by-default,
      never allow-by-default).
- [ ] Role/assignment/delegation/limit changes produce an audit row (test
      asserts this).
- [ ] `npm test` passes, including a cross-tenant authorization test
      (user in tenant A cannot be granted or exercise a role scoped to
      tenant B).

## Progress
- 2026-10-15: Architect session. Filed as the third Phase 1 ticket,
  closing the loop on deferred authorization checks left open in tickets
  0054/0055. This completes the Phase 1 module set (M01-M03); Phase 2
  (M05/M06) should not start until this ticket is done per CLAUDE.md's
  build order.
