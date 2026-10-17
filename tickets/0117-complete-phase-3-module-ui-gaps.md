---
id: 117
title: Complete Phase 3 module UI gaps (M03, M04, M07, M08, M09, M10
status: done
roles: [ui-designer, backend-engineer, test-engineer, architect]
priority: 1
created: 2026-10-17
updated: 2026-10-17
---

All Phase 3 modules have backend built and tested. Their frontends are either
missing forms (M09, M10), missing action buttons (M07, M08), or have raw-UUID
inputs (M03, M04). This ticket completes every gap so each module meets the
Definition of Done.

## Dependencies
Ticket 0109 (shared components) must be done first — this ticket uses
`<UserPicker>`, `<EntityPicker>`, `<PermissionGate>`, `<ActivityThread>`,
`<StatusBadge>` throughout.

## Scope — one section per module

### M03 — Departments & Roles
**Current gap:** Role assignment requires pasting a raw Supabase user ID.
**Fix:**
- Replace raw-UUID "User ID" input with `<UserPicker>` on the role-assignment
  form (backed by `GET /employees` or `GET /admin/users`)
- Add a "Delegation" tab to DepartmentsRolesPage:
  - List active delegations (acting-role grants) with start/end date, delegator,
    delegate, role
  - Create delegation form: UserPicker for delegate, role picker, date range
  - Revoke delegation button

### M04 — Employee Directory
**Current gaps:** No link from employee to their Supabase auth account;
no bulk import; no org chart.
**Fix:**
- On the employee detail/edit form, add an "Auth Account" field:
  `<UserPicker>` that links `employees.app_user_id` to a real app_users row
- Bulk import: CSV upload button (template download + upload) that maps to
  `POST /employees/bulk-import` — add this backend endpoint if not present
- Org chart tab on the Employees page: tree visualisation of department →
  employee relationships using department_id (simple nested list is fine;
  a graphical tree is a nice-to-have)

### M07 — Task Inbox
**Current gaps:** Reassign and delegate actions not in the task drawer;
no SLA countdown; no activity thread.
**Fix:**
- Task drawer: add "Reassign" button → slide-out form with `<UserPicker>`;
  calls `POST /tasks/:stepInstanceId/reassign`
- Task drawer: add "Delegate" button → slide-out form with `<UserPicker>`;
  calls `POST /tasks/:stepInstanceId/delegate`
- Task drawer: show SLA due date with a countdown ("Due in 2 days" /
  "Overdue by 1 day") coloured green/amber/red
- Task drawer: add `<ActivityThread>` at the bottom showing task comments
  and events (assigned, reassigned, blocked, etc.)

### M08 — Approval Queue
**Current gaps:** Only Approve/Reject exposed; "Returned for correction"
and "Approved with conditions" missing; no activity thread.
**Fix:**
- Approval drawer: add "Return for correction" button → reason text area
  required; calls `POST /approvals/:instanceId/decide` with
  `decision: "returned_for_correction"`
- Approval drawer: add "Approve with conditions" button → conditions text
  area required; calls the same endpoint with
  `decision: "approved_with_conditions"`
- Approval drawer: add `<ActivityThread>` showing all prior decisions,
  revocations, and comments

### M09 — Projects
**Current gaps:** Entire screen is read-only — no create or edit forms.
**Fix:**
- "New Project" button on ProjectsPage → multi-step form:
  - Step 1: Basic info (name, code, project type picker from M33, client
    picker from CRM, location, contract value + currency)
  - Step 2: Dates (planned start, planned end, contract execution date)
  - Step 3: Assign project manager (UserPicker), project team members
    (multi-UserPicker)
- Edit project button on ProjectDetailPage (pencil icon in header) →
  same form pre-filled
- WBS tab: "Add WBS node" button → form (code, title, parent node picker);
  inline edit and delete
- Milestones tab: "Add milestone" button → form (title, planned date,
  owner UserPicker); edit and complete (mark achieved) inline
- Activities tab: "Add activity" button → form (title, WBS node picker,
  planned start/end, assigned UserPicker, predecessors multi-picker);
  edit and update progress %
- Risk/Issue register tab: "Add entry" button → form (kind selector,
  title, description, owner UserPicker, due date, status); edit and
  close inline

### M10 — CRM
**Current gaps:** No create/edit forms for clients, contacts, or
opportunities; contact's "primary contact" toggle not wired; no activity
log per client.
**Fix:**
- Clients tab: "Add Client" button → form (name, registration number,
  country, address); edit on row click
- Contacts tab: "Add Contact" button → form (name, email, phone, role,
  client picker, "primary contact" checkbox); edit on row click
- Pipeline (Kanban): "Add Opportunity" button → form (title, client
  picker, source, owner UserPicker, estimated value + currency,
  probability %, next action, due date); edit on card click (opens
  detail drawer)
- Client detail slide-over (click client name): shows contacts list,
  linked opportunities, site visits, communications; "Add communication"
  inline log form

## Acceptance

- [ ] M03: Role assignment uses UserPicker, no raw UUID anywhere; delegation
      tab lists, creates, and revokes delegations
- [ ] M04: Employee record can be linked to an auth user via UserPicker;
      bulk CSV import button present and calls backend endpoint
- [ ] M07: Reassign and delegate buttons in task drawer with UserPicker;
      SLA countdown coloured correctly; ActivityThread shows comments
- [ ] M08: All four decision types (approve / approve-with-conditions /
      reject / return-for-correction) available in drawer; ActivityThread shows
      decision history
- [ ] M09: New project form (3 steps) creates a project end-to-end; WBS,
      milestone, activity, and register-entry create/edit all work
- [ ] M10: Client, contact, and opportunity create/edit forms all work;
      client detail slide-over shows linked records
- [ ] All buttons wrapped in PermissionGate
- [ ] USER-GUIDE.md entries for all six modules updated

_Created by lee-coarasco in the AppYard dashboard._

## Progress
- 2026-10-17 (session, not picked up — flagging for whoever does):
  Spotted while closing out tickets 0115/0116 this same session, both of
  which turned out stale/duplicate against already-built work filed the
  same day by the owner. This ticket's M09/M10 sections ("Current gap:
  entire screen is read-only — no create or edit forms") look stale
  too: ticket 0108's own close-out (see that ticket's last Progress
  entries, 2026-10-16) already built create+edit forms for M09 (projects/
  WBS/milestones/activities) and M10 (clients/contacts/opportunities).
  Did NOT verify the other four sections (M03 delegation tab, M04 bulk
  import/org chart/auth-account link, M07 reassign/delegate/SLA-
  countdown/ActivityThread, M08 return-for-correction/approved-with-
  conditions/ActivityThread) against current code — those may be
  genuinely new asks on top of 0108's narrower scope, not duplicates.
  Whoever picks this up: re-survey each section against the live
  `frontend/src/pages/*.tsx` before building, same as the 0115/0116
  survey-first approach, rather than assuming the ticket's gap
  descriptions are current. Left `status: next`, not split — didn't have
  session budget left to do that split justice this session.
- 2026-10-17: Re-surveyed every section against live code (see
  DECISIONS.md for the full writeup). Confirmed: M09 and M10 create/edit
  forms are fully built (ticket 0108) — 0117's "entire screen read-only"
  framing was stale for both. M03's raw-UUID gap and M04's auth-account-
  link gap are also already fixed (both already use `<UserPicker>`). The
  genuine remaining gaps: M03 has no Delegation tab/list/revoke endpoint;
  M04 has no bulk CSV import or org chart tab; M07 has Reassign/Delegate
  wired but no SLA countdown or `<ActivityThread>`; M08 has all four
  decision types wired but no `<ActivityThread>` (it already fetches
  `comments` but never renders them); M10 has no client detail slide-over
  with linked contacts/opportunities/communications. Split into four
  sub-tickets by remaining-gap, not by the original six module sections,
  since several sections had nothing left to build: 0145 (shared
  `<ActivityThread>` wired into M07 task drawer + M08 approval drawer,
  bundled with M07's SLA countdown since it's the same drawer file),
  0146 (M03 delegation tab), 0147 (M04 bulk import + org chart), 0148
  (M10 client detail slide-over). Closing this ticket `done` with no
  further code — all real work now lives in 0145-0148.
