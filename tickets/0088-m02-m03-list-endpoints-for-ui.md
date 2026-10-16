---
id: 88
title: "Add missing list endpoints for M02/M03 (branches, departments, roles, role assignments)"
status: testing
roles: [backend-engineer]
priority: 2
created: 2026-10-16
updated: 2026-10-16
---

Found while building ticket 0087 (UI for company/branch/project setup and
departments/roles). `backend/src/modules/tenancy` and
`backend/src/modules/authority` have **create** endpoints for branches,
departments and role assignments, but no way to **list** any of them,
so ticket 0087's UI can only show what was created in the current
browser session (not what's actually persisted). Specifically:

- `GET /tenancy/branches?companyId=` — missing a route only.
  `TenancyRepository.listBranches(accessToken, companyId)` already
  exists and is implemented (`backend/src/modules/tenancy/repository.ts`
  line ~95) — `routes.ts` just never exposes it. This one is a small,
  low-risk addition.
- `GET /authority/departments?companyId=` — needs a new repository
  method (no `listDepartments` exists in `AuthorityRepository` at all)
  plus a route, same `requirePermission` pattern as
  `POST /authority/departments` (or a lighter read-scoped permission —
  architect/backend-engineer judgment call, consistent with how
  `GET /authority/effective-permissions` is self-service-only today).
- `GET /authority/roles` — there is no way for a caller to discover
  what `RoleDefinition` rows (`backend/src/modules/authority/types.ts`)
  exist at all today, platform or tenant-scoped. Ticket 0087's
  role-assignment form had to fall back to a raw-text roleId input
  because of this. Needed for any role picker.
- `GET /authority/role-assignments?companyId=` (or `?userId=`) — same
  gap as departments; no way to see who holds what role today.

## Why this matters now
Ticket 0087 shipped working **create** flows for all four (branch,
department, role assignment, project — project already had both
`GET /projects` and `POST /projects`, so that one needed nothing new),
gated by the same `effective-permissions` check the backend uses. But
without list endpoints the UI cannot show real persisted state after a
page reload — it only remembers what was created in the current tab,
which is clearly labelled in the UI as a stopgap, not a finished
feature.

## What to build
- `GET /tenancy/branches?companyId=<id>` in `tenancy/routes.ts`,
  wrapping the existing `listBranches` repository method. No new
  permission needed — same read-is-open pattern `GET /tenancy/companies`
  already uses (no `requirePermission` on that GET today).
- `listDepartments` in `AuthorityRepository` (+ fake in tests) and
  `GET /authority/departments?companyId=<id>` route.
- A way to list `RoleDefinition` rows — repository method +
  `GET /authority/roles` route. Scope question: tenant-scoped roles vs.
  platform roles (`is_platform_role`) — both should probably be
  visible to a caller deciding what role to assign; follow whatever
  `RoleDefinition.is_platform_role` already implies about visibility
  (read the type and any seed data under `supabase/migrations/` before
  assuming).
- `listRoleAssignments` in `AuthorityRepository` + a route, scoped by
  company or user as makes sense once you've read how
  `role_assignments` rows are stored (tenant_id filtering already
  happens via RLS/the fake-repo contract other methods follow — reuse
  that, don't invent a new scoping rule).

## Out of scope
- Any new UI — ticket 0087 already consumes these once they exist; no
  new ticket needed for that, just update 0087's pages to fetch real
  lists instead of session-only state (note for whoever picks this up:
  leave that follow-up as a note here or a tiny addendum, don't require
  a third ticket for it unless it turns out to be non-trivial).

## Acceptance
- [x] `GET /tenancy/branches?companyId=` returns branches for that
      company, tenant-isolated like every other tenancy read.
- [x] `GET /authority/departments?companyId=` returns departments for
      that company.
- [x] `GET /authority/roles` returns visible role definitions.
- [x] `GET /authority/role-assignments` (scoped as decided above)
      returns assignments.
- [x] Tests for all four, following this codebase's existing
      fake-repository-backed route test pattern.

## Progress
- 2026-10-16 06:21 UTC: Filed while building ticket 0087 — the UI
  ticket's "out of scope: any new backend endpoint" rule meant these
  gaps get written up here instead of being added inline.
- 2026-10-16 07:10 UTC: Built all four endpoints.
  `GET /tenancy/branches?companyId=` wraps the existing
  `listBranches` repository method (no new repository code needed).
  `AuthorityRepository` gained `listDepartments`, `listRoleDefinitions`
  and `listRoleAssignments`, each implemented against the real
  user-scoped Supabase client (RLS does the tenant/platform filtering)
  and against `FakeAuthorityRepository` for tests. All four routes
  require only a valid session, no extra permission — see
  DECISIONS.md for why (matches `GET /tenancy/companies`'s existing
  no-permission precedent). `listRoleAssignments` filters by `userId`
  only, not `companyId` (`role_assignments` has no company column —
  see DECISIONS.md). Added route tests for all four
  (`tenancy/routes.test.ts`, `authority/routes.test.ts`) covering
  the 400/401 cases and tenant isolation. Full backend suite: 375/375
  passing.
  As a same-session follow-up (pre-approved by this ticket's own "tiny
  addendum" note), updated ticket 0087's `OrgSetupPage.tsx` and
  `DepartmentsRolesPage.tsx` to fetch these real lists instead of
  session-only state, and turned the role-assignment form's free-text
  role/department id inputs into `<select>`s populated from
  `GET /authority/roles` / the company's departments. Updated both
  pages' tests to match (frontend suite: 6/6 passing, typecheck clean).
  Set to `testing` — this is user-visible in the UI: reload
  `/org-setup` or `/departments-roles` after creating a branch/
  department/role assignment and it should now still be there, and the
  role-assignment form should show a dropdown of real role names
  instead of a blank text box.
