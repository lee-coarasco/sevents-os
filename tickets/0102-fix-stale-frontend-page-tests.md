---
id: 102
title: Fix stale frontend page tests (LoginPage, OrgSetupPage, DepartmentsRolesPage)
status: next
roles: [ui-designer]
priority: 10
created: 2026-10-16
updated: 2026-10-16
---

Found while working ticket 0099 (frontend UI screens): `frontend/src/pages/LoginPage.test.tsx`,
`OrgSetupPage.test.tsx` and `DepartmentsRolesPage.test.tsx` fail against the current component
markup — `npm test` in `frontend/` currently reports these 3 files / 4 tests failing. Confirmed
via `git stash` that this predates ticket 0099's changes (not something that session introduced).

Examples:
- `LoginPage.test.tsx` queries `getByLabelText("Email")`; the component's actual label text is
  "Email address".
- `OrgSetupPage.test.tsx` expects a single text node `"Branches — Acme Construction"`; the
  component renders the section heading and company name as two separate elements (`<h2>Branches</h2>`
  + `<p>Acme Construction</p>`), no em-dash.
- `DepartmentsRolesPage.test.tsx` expects a department name to appear in an `li` element; the
  component renders department rows as `div`s, not a list.

The components themselves look fine on inspection — these are stale assertions from an earlier
markup version, not real UI bugs. Fix is almost certainly just updating the test queries/selectors
to match current markup (same `getByRole`/flexible-matcher fixes ticket 0099 had to apply to its
own new `TaskInboxPage.test.tsx`), not changing the pages.

## Acceptance
- [ ] `npm test` in `frontend/` passes with 0 failures.
- [ ] No production component markup changed just to satisfy a test (fix the test unless the
      current markup is actually wrong on inspection).

## Progress
- 2026-10-16 17:05 UTC: Filed while working ticket 0099 — found but out of that ticket's scope.
