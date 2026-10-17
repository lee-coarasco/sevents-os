---
id: 146
title: "M03 — Departments & Roles: Delegation tab (list, create, revoke)"
status: next
roles: [ui-designer, backend-engineer, test-engineer]
priority: 2
created: 2026-10-17
updated: 2026-10-17
---

Split from ticket 0117 (see that ticket's close-out note) after a fresh
survey. M03's raw-UUID gap from 0117 was already fixed — role assignment on
`frontend/src/pages/DepartmentsRolesPage.tsx` already uses `<UserPicker>`.
The only genuine remaining gap is the Delegation tab.

## Current state
- Backend has `POST /authority/delegations` (`backend/src/modules/authority
  /routes.ts` ~line 87) but **no GET endpoint to list delegations** and no
  revoke endpoint.
- Frontend `DepartmentsRolesPage.tsx` has no Delegation tab/section at all.

## What to build

### Backend
- `GET /authority/delegations` — list delegations for the caller's tenant,
  filterable by department/role/delegate/status (active/expired/revoked).
  Gate with a named permission (e.g. `authority.delegation.view`).
- `POST /authority/delegations/:id/revoke` — revoke an active delegation.
  Gate with `authority.delegation.manage` (same permission the existing
  create endpoint should already require — confirm it does).
- Ensure delegation revocation and creation both write to
  `workflow_events` or the module's own audit log, and both call
  `dispatchNotification` (or the `// TODO: dispatch notification` comment
  if M31 isn't wired for this event yet — check `docs/USER-GUIDE.md`/M31
  ticket status first).
- RLS: confirm the delegations table has a tenant-isolation policy (it
  should already, since the create endpoint exists — just verify, don't
  assume).

### Frontend
- Add a "Delegations" tab to `DepartmentsRolesPage.tsx`:
  - List: active delegations with start/end date, delegator, delegate
    (name, not UUID), role, status badge (`<StatusBadge>`)
  - "Show expired/revoked" filter toggle
  - Create delegation form: `<UserPicker>` for delegate, role picker
    (reuse whatever role-select exists elsewhere on this page), date range
    (start/end)
  - Revoke button per active row, with a confirmation step (this changes
    who can act in the delegate's name — not a silent action)
  - Wrap create/revoke buttons in `<PermissionGate>`

## Acceptance
- [ ] `GET /authority/delegations` and `POST /authority/delegations/:id/revoke`
      exist, permission-gated, tenant-isolated, audited
- [ ] Delegations tab lists active delegations with real names (no raw UUIDs)
- [ ] Create delegation form works end-to-end
- [ ] Revoke button works end-to-end with confirmation
- [ ] Tests for both new backend endpoints
- [ ] `docs/USER-GUIDE.md` M03 entry updated

## Progress
- 2026-10-17: Split from ticket 0117 after re-survey (see 0117's close-out
  and DECISIONS.md). Not yet picked up.
