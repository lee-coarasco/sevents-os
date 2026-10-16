---
id: 87
title: "UI: company/branch/project setup (M02) and departments/roles (M03)"
status: next
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
- [ ] Company/branch/project list + create screens, calling the real
      backend, permission-gated the same way the backend already
      gates writes.
- [ ] Departments/roles screen, same pattern.
- [ ] `npm run build`, `npm test`, `npm run lint` all pass in
      `frontend/`.
- [ ] Manually exercised against a local backend + real Supabase
      project (not just unit-tested) before marking `testing`.

## Progress
- 2026-10-16 06:04 UTC: Filed alongside ticket 0084's scaffold work —
  this is the first concrete "next module" UI ticket now that there
  is a scaffold (login + API client + auth context) to build on.
