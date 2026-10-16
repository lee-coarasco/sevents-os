---
id: 99
title: Frontend UI screens for completed backend modules (M04, M07, M08, M09, M10)" module: "M04/M07/M08/M09/M10
status: in-progress
roles: [ui-designer]
priority: 1
created: 2026-10-16
updated: 2026-10-16
---

## Goal

Build frontend React screens for all backend modules that are already complete
and tested but have no UI yet. The backend APIs, DB schema and tests exist —
this ticket is purely frontend work.

## Screens to build (in this order)

1. **Employee Directory** (M04) — list of employees, add/edit employee form,
   department filter, status badge (active / on-leave / resigned)

2. **My Work / Task Inbox** (M07) — task list for the logged-in user, grouped
   by status (to-do / in-progress / blocked / done), open task detail drawer

3. **Approval Queue** (M08) — list of pending approvals assigned to the user,
   approve/reject with comment, delegation button

4. **Projects** (M09) — project register list, project detail page with WBS
   tree and milestone timeline

5. **Clients & CRM** (M10) — client list, contact list, opportunity kanban
   board (lead → qualified → tender → won/lost)

## Design system

Follow CLAUDE.md design tokens exactly:
- Amber `#F5B800` for CTAs, active nav, selected state
- Syne for headings, Inter for body
- Dark sidebar (`bg-zinc-900`), stone-50 page background
- Cards: `rounded-2xl border border-zinc-100 bg-white shadow-sm`

Reference: `frontend/src/components/AppLayout.tsx` and
`frontend/src/pages/LoginPage.tsx`

## API base URLs

All screens call the backend REST API at `VITE_API_URL`. Auth token comes from
`@supabase/supabase-js` session — pass it as `Authorization: Bearer <token>`
header on every request.

## Definition of done

- All five screen groups render without errors
- Navigation links in the sidebar reach each screen
- Empty states shown when no data
- `npm run build` in `frontend/` passes with no TypeScript errors
- Ticket marked `testing`

_Created by lee-coarasco in the AppYard dashboard._

## Progress
- 2026-10-16 17:05 UTC: Started. Found no `GET /employees` list endpoint
  existed (only `/employees/me` and `/employees/:id`) — added
  `listEmployeeRecords` across the workforce repository/fake-repository/
  service/route layers (tenant-scoped via RLS, optional companyId/
  departmentId filters, gated on the existing `employee.directory.manage`
  permission), same precedent ticket 0088 set for tenancy/authority list
  endpoints. Backend tests: 540/540 passing; build clean.
  Built **screen 1/5, Employee Directory (M04)**:
  `frontend/src/pages/EmployeesPage.tsx` — company/department filters,
  employee table with status badge, add-employee form gated on
  `employee.directory.manage`. Wired into `App.tsx`/`AppLayout.tsx` nav.
  Built **screen 2/5, My Work / Task Inbox (M07)**:
  `frontend/src/pages/TaskInboxPage.tsx` — tasks from `GET /tasks/my-work`
  grouped into To do/In progress/Blocked/Done, detail drawer with
  complete/block/unblock actions gated on `workflow.instance.act`. No
  comment thread in the drawer — `POST /workflow/steps/:stepId/comments`
  exists but there is no `GET` to list a step's comments yet; adding one
  was out of scope for this pass (flagged below, not silently dropped).
  Frontend tests for both new pages pass (6/6); `npm run build` clean.
  Pre-existing, unrelated failures in `LoginPage.test.tsx`,
  `OrgSetupPage.test.tsx` and `DepartmentsRolesPage.test.tsx` (stale
  text-content assertions that don't match current component markup —
  e.g. expects a label "Email" that the component renders as "Email
  address") were confirmed present before this session's changes too
  (verified via `git stash`); not fixed here since they're out of this
  ticket's scope and not something this session's work touched — worth
  their own quick ticket.
  **Stopping here for this session** (budget checkpoint, not a blocker):
  3/5 screens remain — Approval Queue (M08), Projects (M09, WBS tree +
  milestone timeline), Clients & CRM (M10, opportunity kanban). Each of
  those will likely need the same "check for a missing list endpoint
  first" step M04 needed (e.g. M08's approval queue may want a list of
  pending-approval tasks beyond the task-queue fields already shown
  here; M09/M10 need to be checked against `modules/projects`/
  `modules/crm`'s actual route surface before designing the screen).
  Left `status: in-progress` rather than `blocked` — nothing here is
  waiting on an answer, just unstarted.
- 2026-10-16 16:50 UTC: Built **screen 3/5, Approval Queue (M08)**:
  `frontend/src/pages/ApprovalQueuePage.tsx`. No missing list endpoint
  this time — `GET /tasks/my-work` (already used by My Work) carries a
  `nodeType` field per entry, so the queue is just that list filtered to
  `nodeType === "request_approval"` client-side; no backend change
  needed. Detail drawer calls `GET /approvals/:stepInstanceId` (ticket
  0066) for request context, prior decisions and the authority-limit
  check; Approve/Reject call `POST /approvals/:stepInstanceId/decide`
  (reason required for Reject, enforced client-side and by the backend);
  delegation calls the existing `POST /tasks/:stepInstanceId/delegate`
  (plain user-ID input — there's no user-picker/employee-to-auth-user
  lookup anywhere in this frontend yet, same gap `DepartmentsRolesPage`
  already lives with for role assignment, so this follows that
  precedent rather than inventing one here). Scoped to exactly what the
  ticket asked (approve/reject with comment, delegation button) —
  skipped the backend's third decision kind (`returned_for_correction`)
  and the "add a comment" thread (separate from the decision reason)
  since neither was in the ticket's screen spec. Wired into
  `App.tsx`/`AppLayout.tsx` nav as "Approvals" under the Work section.
  5 new tests, all passing; `npm run build` clean. Full frontend suite:
  same two pre-existing failures as last session (`LoginPage.test.tsx`,
  `DepartmentsRolesPage.test.tsx` — stale markup assertions, confirmed
  present before this session's changes), nothing new broken.
  **Stopping here for this session** (budget checkpoint): 2/5 screens
  remain — Projects (M09, WBS tree + milestone timeline), Clients & CRM
  (M10, opportunity kanban). Check `modules/projects`/`modules/crm`'s
  actual route surface before designing those two, same as M04/M07/M08
  needed. `status: in-progress` stands, nothing blocked.
