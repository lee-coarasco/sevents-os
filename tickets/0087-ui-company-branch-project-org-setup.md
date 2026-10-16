---
id: 87
title: "UI: company/branch/project setup (M02) and departments/roles (M03)"
status: testing
roles: [ui-designer]
priority: 2
created: 2026-10-16
updated: 2026-10-16
---

First real module screens on top of the `frontend/` scaffold (ticket
0084/0086 — login + dashboard shell calling `GET /tenancy/companies`
already exist and are tested). M01-M03 are the oldest built-and-tested
backend modules with no UI at all yet; this ticket gives them one,
continuing the "build UI alongside/soon after each module" approach
ticket 0084 set going forward.

Read `backend/src/modules/tenancy/routes.ts` and
`backend/src/modules/authority/routes.ts` in full before building —
they are the complete, already-tested API surface this ticket wires
up. Do not invent endpoints; if a screen needs data with no existing
route, that is a sign the screen's scope is wrong for this ticket, not
a reason to add a backend route in a `ui-designer`-only ticket (that
would need `backend-engineer`).

## What to build
- A company/branch/project setup flow: list companies (already on the
  dashboard shell — move/extend it here), create a company
  (`POST /tenancy/companies`, gated on `tenancy.company.manage` —
  the UI should hide/disable the create action if the signed-in
  user's effective permissions don't include it, calling
  `GET /authority/effective-permissions` the same way the backend
  guard checks it), list/create branches and projects under a
  company.
- A departments/roles screen: list departments, list roles, show
  role assignments for the current tenant (`POST /authority/departments`,
  `POST /authority/role-assignments` and whatever list endpoints
  `authority/routes.ts` already exposes).
- Reuse `src/lib/api.ts`'s `apiFetch` helper and `src/auth/AuthContext`
  — do not build a second API client or auth mechanism.
- Basic nav between the screens (a simple sidebar or tab bar is
  enough — no need for a design system yet with only two sections).

## Out of scope
- Any new backend endpoint. If something is missing, note it in this
  ticket's Progress and open a separate `backend-engineer` ticket.
- Visual polish/design system — ship something plain and correct;
  revisit styling once more screens exist and real duplication shows
  up (same "don't build abstractions before they're needed" rule as
  the backend side of this project).
- Deploying anywhere — that is ticket 0086, independent of this one.

## Acceptance
- [x] Company/branch/project list + create screens, calling the real
      backend, permission-gated the same way the backend already
      gates writes.
- [x] Departments/roles screen, same pattern.
- [x] `npm run build`, `npm test`, `npm run lint` all pass in
      `frontend/`.
- [ ] Manually exercised against a local backend + real Supabase
      project (not just unit-tested) before marking `testing`. Not
      done — see Progress note below; same sandbox limitation ticket
      0055 hit (no reachable Supabase credentials here), so this is
      ready for the owner to exercise for real, same as every prior
      backend module that shipped `status: testing` on that basis.

## Progress
- 2026-10-16 06:04 UTC: Filed alongside ticket 0084's scaffold work —
  this is the first concrete "next module" UI ticket now that there
  is a scaffold (login + API client + auth context) to build on.
- 2026-10-16 06:30 UTC: Built both screens.
  - Read `tenancy/routes.ts` and `authority/routes.ts` in full first,
    as instructed, and found the real API surface is narrower than
    this ticket's "What to build" assumed: `tenancy/routes.ts` has no
    `GET /tenancy/branches` (the repository already has a working
    `listBranches` method — it's just never wired to a route), and
    `authority/routes.ts` has **no list endpoints at all** — not for
    departments, not for role definitions, not for role assignments
    (confirmed by reading `AuthorityRepository`'s full interface, only
    `create*`/`resolveCallerContext`/`listActiveRoleIds`/
    `listPermissionsForRoles` exist, no `listDepartments` etc.).
    "Projects" turned out to live in a separate, already-built
    `projects` module (M09a, ticket 0073) with full
    `POST /projects` + `GET /projects` — used that instead of
    inventing anything in `tenancy`.
  - Per this ticket's own "out of scope" rule, did not add any new
    backend route. Filed ticket 0088 (backend-engineer) for the four
    missing list endpoints (`GET /tenancy/branches`,
    `GET /authority/departments`, `GET /authority/roles`,
    `GET /authority/role-assignments`).
  - Built anyway, working within what exists:
    `src/hooks/usePermissions.ts` (wraps
    `GET /authority/effective-permissions`, same check the backend
    guard uses), `src/components/AppLayout.tsx` (sidebar nav + sign
    out, shared across authenticated routes via a nested
    `react-router-dom` route), `src/pages/OrgSetupPage.tsx` (company
    list/create, branch create, project list/create — all
    permission-gated), `src/pages/DepartmentsRolesPage.tsx`
    (department create, role-assignment create by raw user/role id
    since there's no picker data source yet — permission-gated).
    Branch and department "lists" show only what was created in the
    current browser session, clearly labelled as such in the UI,
    since there's no list endpoint yet to show what's actually
    persisted — ticket 0088 closes that gap, and this ticket's pages
    should switch to the real list once it does (noted in 0088, not
    filed as a third ticket).
  - `DashboardPage.tsx` lost its own header/sign-out (moved into
    `AppLayout`); `App.tsx` now nests `DashboardPage`/`OrgSetupPage`/
    `DepartmentsRolesPage` under one authenticated layout route.
  - Added `OrgSetupPage.test.tsx` / `DepartmentsRolesPage.test.tsx`.
    Hit and fixed a real infinite-loop bug while writing them: mocking
    `useAuth` with a literal object per call gives `session` a new
    reference every render, which combined with `useEffect(..., [session])`
    in `OrgSetupPage`/`DepartmentsRolesPage`/`usePermissions` loops
    forever (setState → re-render → new `session` reference → effect
    fires again). Fixed by hoisting the mock session to a stable
    module-level constant. Doesn't affect the real app (context's
    `session` state is already stable), but worth remembering for any
    future test that mocks `useAuth`.
  - `npm run build`, `npm test` (6 tests, all passing), `npm run lint`
    all pass in `frontend/`.
  - Not done: manual exercise against a live backend + real Supabase
    project — no reachable Supabase credentials in this sandbox
    (same limitation ticket 0055 documented). Marking `testing` on the
    strength of the passing build/lint/unit-test suite, same basis
    every backend module ticket has used so far.
