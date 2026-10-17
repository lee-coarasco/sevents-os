---
id: 149
title: Admin User Management screen (invite, role, deactivate, reset password)
module: M01
status: in-progress
priority: 1
created: 2026-10-17
updated: 2026-10-17
depends_on: [53, 54]
roles: [backend-engineer, ui-designer]
---

## Goal
A dedicated admin screen so a platform administrator can see all app users,
invite new ones, reassign their role, deactivate them, and trigger a password
reset — without having to run SQL queries.

## Background
The identity backend already has most of what's needed:
- `GET /admin/users` — list all users (ticket 0053)
- `POST /identity/invite` — invite a new user (ticket 0053)
- `POST /identity/deactivate` — deactivate a user (ticket 0053)

Missing endpoints:
- `PATCH /admin/users/:id` — update display_name and/or role assignment
- `POST /admin/users/:id/reset-password` — trigger Supabase password-reset email

## Acceptance criteria
- [ ] `GET /admin/users` returns all users with their current role assignment
- [ ] `PATCH /admin/users/:id` accepts `{ displayName?, roleId? }` and updates the user
- [ ] `POST /admin/users/:id/reset-password` triggers a Supabase password-reset email for the user
- [ ] `/admin/users` page in the frontend shows: user table (name, email, status, role), invite form, per-row actions (edit name/role, deactivate, send reset)
- [ ] All write actions gated on `identity.user.invite` permission via `<PermissionGate>`
- [ ] "Admin" section added to the AppLayout sidebar nav (visible to `identity.user.invite` holders only)
- [ ] Backend tests for both new endpoints
- [ ] Frontend tests for the new page (at least: table renders, invite form submits, permission gate hides actions)
- [ ] `docs/USER-GUIDE.md` M01 section updated

## Out of scope
- MFA management (separate ticket if needed)
- Audit log viewer (ticket 0136)
- Role definition CRUD (ticket 0073, M09a — already built)

## Progress
2026-10-17: In progress — being built by the session that applied the M33 migration.
