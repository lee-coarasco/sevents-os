---
id: 108
title: Ticket A — Complete partially-built module UIs (M03, M04, M07, M08, M09, M10)
status: in-progress
roles: [ui-designer, backend-engineer, test-engineer, architect]
priority: 1
created: 2026-10-16
updated: 2026-10-16
---

Scope — one gap per module:

M03 — Role Management
Add a user-picker / directory-lookup component so admins can assign roles by searching name/email rather than typing raw Supabase UUIDs.
Wire it to GET /admin/users (already returns app_users list with display names).
M04 — Employee Directory
Add a search/lookup field on the employee record form that lets the operator link an employee to their Supabase Auth account (populate app_user_id).
Currently only creates a standalone HR record; the link to auth is never set.
M07 — Task Inbox
The task drawer has Complete, Block, Unblock. Add two more actions:
Reassign → POST /tasks/:stepInstanceId/reassign (backend already exists)
Delegate → POST /tasks/:stepInstanceId/delegate (backend already exists)
Both need a user-picker to pick the target assignee.
M08 — Approval Queue
The approval drawer has Approve and Reject. Add:
Return for Correction → decision value returned_for_correction
Approve with Conditions → decision value approved_with_conditions
Backend POST /approvals/:instanceId/decide already accepts both values; only the UI buttons are missing.
M09 — Projects
The Projects page is read-only (list + detail view only). Add:
Create/edit project form (name, code, start/end dates, project manager)
Create/edit WBS node form
Create/edit milestone form
Create/edit activity form
Backend CRUD endpoints already exist for all four.
M10 — CRM
The CRM page only supports stage drag-and-drop. Add:
Create/edit client form
Create/edit contact form (with “primary contact” toggle)
Create/edit opportunity form (client picker, estimated value, BD owner)
Backend CRUD endpoints already exist for all three.

Acceptance:

 Each screen above has a working create form and edit form.
 User-picker component is shared/reused across M03, M04, M07, M08.
 No raw UUIDs exposed in any form field.

_Created by lee-coarasco in the AppYard dashboard._

## Progress
- 2026-10-16 21:45 UTC: Built the shared `<UserPicker>` piece this
  whole ticket depends on (M03/M04/M07/M08 all need it): backend
  `GET /admin/users` (identity module — lists the tenant's app_users by
  id/email/display_name, open to any signed-in tenant member, same
  broad-read convention as other modules), a new `app_users_select_
  same_tenant` RLS policy (migration `20261016000020`, additive/OR'd
  alongside the existing "own row" policy from ticket 0054 — **not yet
  applied live, Supabase MCP tools were unreachable this session, same
  intermittent gap ticket 0094 described**; next session with MCP
  access should apply it), `frontend/src/hooks/useUsers.ts`, and
  `frontend/src/components/UserPicker.tsx` (name/email typeahead,
  never exposes a raw UUID).
  M03 done: wired `<UserPicker>` into `DepartmentsRolesPage`'s role
  assignment form (replacing the raw user-ID text box) and resolved
  display names in the assignment list (was `user_id.slice(0,12)…`).
  Updated the test to drive the picker instead of typing a UUID.
  Backend: 61 identity tests pass (56 before + new `listUsers`
  coverage); frontend: 25 tests pass, `tsc --noEmit` and
  `vite build` both clean.
  M04/M07/M08/M09/M10 pieces not started yet — picking up M04 next
  (employee → auth-user link) since `<UserPicker>` is now reusable.
- 2026-10-16 21:50 UTC: M04 done. `PATCH /employees/:id` now accepts
  `appUserId` (previously only `POST /employees` could set the link —
  `UpdateEmployeeRecordInput`/route/test added, Supabase-backed repo
  needed no change since it passes the input object through
  generically). Frontend: `EmployeesPage`'s create form gained the
  `<UserPicker>` "link to auth account" field, and existing employees
  now show their linked account (or "—") in a new Account column —
  clicking it opens the same picker inline and PATCHes on selection.
  Backend: 586 tests pass (581 before + 5 new); frontend: 26 tests
  pass; both `tsc --noEmit` and `vite build` clean.
  **Stopping here for budget** (session cap) — M07 (reassign/delegate
  buttons + picker on the task drawer), M08 (return-for-correction /
  approved-with-conditions decision buttons), M09 (project/WBS/
  milestone/activity create+edit forms) and M10 (client/contact/
  opportunity create+edit forms) are still open. M09/M10 are
  the largest remaining pieces — each needs 3-4 new forms, not just a
  button + picker like M07/M08 will. Suggest the next session do M07
  and M08 first (same small shape as M03/M04 — existing backend,
  missing UI, both now have `<UserPicker>` to reuse) before tackling
  M09/M10's bigger form-building work. Left `status: in-progress`
  (not `testing`) since the ticket's acceptance criteria aren't met
  yet — only 2 of 6 modules are done.
- 2026-10-16 22:05 UTC: M07 done — Task Inbox drawer gained Reassign
  and Delegate buttons, each with its own `<UserPicker>` (distinct
  placeholders "Reassign to..."/"Delegate to..." so tests can tell
  them apart), calling the existing `POST /tasks/:id/reassign` and
  `/tasks/:id/delegate` endpoints. No backend change needed.
  M08 done — Approval Queue decision drawer gained "Approve with
  conditions" and "Return for correction" buttons (existing
  `POST /approvals/:id/decide` already accepts both decision values).
  Also replaced the drawer's raw-UUID delegate text input with
  `<UserPicker>` — a no-raw-UUIDs acceptance-criteria gap left over
  from before this ticket, now closed.
  Frontend: 30 tests pass (26 before + 4 new), `tsc --noEmit` and
  `vite build` both clean. No backend changes this round.
  Still open: M09 (project/WBS/milestone/activity create+edit forms)
  and M10 (client/contact/opportunity create+edit forms) — the two
  largest remaining pieces. Picking up M09 next.
  Also still pending from part 1: migration `20261016000020`
  (`app_users_select_same_tenant` RLS policy) has not been applied
  live yet — Supabase MCP tools were unreachable again this session.
  Next session with MCP access should apply it.
- 2026-10-16 22:15 UTC: M09 done. `ProjectsPage` gained a "New
  project" form (company picker, name, code, start/end dates, project
  manager via `<UserPicker>`). `ProjectDetailPage` gained an inline
  project-edit form, WBS node add/edit, milestone add/edit, and a
  brand new schedule-activities section (wasn't rendered at all
  before this ticket) with its own add/edit form. All reuse existing
  backend CRUD — no backend change needed for M09.
  Frontend: 35 tests pass (30 before + 5 new), `tsc --noEmit`/`vite
  build` clean.
  Along the way found M10's ticket description was wrong: "backend
  CRUD endpoints already exist for all three" undersold it — clients
  and contacts only had create+read, no update. Added
  `updateClient`/`updateContact` (service/repository/Supabase impl/
  fake repo) and `PATCH /crm/clients/:id` + `PATCH /crm/contacts/
  :contactId` first (591 backend tests pass, 586 + 5 new) so M10's
  edit forms have somewhere to PATCH to.
  Still open: M10 itself (client/contact/opportunity create+edit
  forms in `CrmPage.tsx`) — picking that up next.
