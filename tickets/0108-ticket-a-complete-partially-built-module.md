---
id: 108
title: Ticket A — Complete partially-built module UIs (M03, M04, M07, M08, M09, M10)
status: next
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
