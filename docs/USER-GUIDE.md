# SEVENTS User & Developer Guide

One page per BRD module, kept in sync with what's actually built. **Update this
file in the same commit as any change that finishes a module, adds/changes a
screen, or changes an API surface** — see CLAUDE.md's ground rules. If a
module's entry here goes stale, fix it before adding new ones.

Each entry has three parts:
- **Status** — from the module's ticket(s): `next` / `in-progress` / `testing`
  (built, not yet owner-verified) / `done` (owner-verified or no verification
  needed).
- **What's built** — backend module folder + REST surface (high level, not
  exhaustive — read `routes.ts` in that folder for the full list), and the
  frontend page(s)/nav label if any exist yet.
- **How to use it** — plain language: what you can actually click through and
  see today, or "nothing to click yet" if it's backend-only.

Build order (see CLAUDE.md for the authoritative table): M01 → M02 → M03 →
M05/M06 → M04/M07/M08/M09/M10 → ... Modules are documented below in that
order, not numeric order, so each entry's dependencies are already covered
above it.

---

## M01 — Identity, Authentication & Sessions

**Status:** testing (tickets 0053/0054/0149)

**What's built:** Backend `identity` module — sign-in/sign-out, user invite
and accept-invite, deactivation, an audit log, and MFA enrollment/verify, all
via Supabase Auth underneath. Backend `admin/users` module — full user
management CRUD (list, invite with role, update display name, change role,
deactivate, trigger password reset). Frontend: `LoginPage` at `/login`, and
`AdminUsersPage` at `/admin/users`.

**How to use it:**
- **Sign in:** Go to `/login`, sign in with an email/password Supabase account.
- **User Management** (`/admin/users`, requires `identity.user.invite` permission):
  - **List users:** See all users in the tenant with their name, email, status, current role, and invite date.
  - **Invite a user:** Fill in the email address and optional display name in the "Invite a new user" form at the top and click "Send invite". The user receives a Supabase magic-link email.
  - **Edit display name:** Click "Edit name" on any user row, type the new name, and click Save.
  - **Assign role:** Click "Assign role" on any user row, pick a role from the dropdown, and click Assign.
  - **Reset password:** Click "Reset pw" to send a password-reset email to that user.
  - **Deactivate:** Click "Deactivate" to block a user's sign-in (the account row is preserved for audit purposes). The button is hidden for already-deactivated accounts.

## M02 — Company, Branch, Project & Tenant Setup

**Status:** testing (ticket 0055)

**What's built:** Backend `tenancy` module — companies and branches
(create/list), plus the `projects` table stub that M09 later extends.
Frontend: `OrgSetupPage`, nav label "Company / Branch / Project", at
`/org-setup`.

**How to use it:** On the Company / Branch / Project screen, create a
company, then create branches under it. There's no project-creation form
here — that lives on the Projects screen (M09) once a company exists.

## M03 — Organization, Departments, Roles & Authority

**Status:** testing (tickets 0056, 0108)

**What's built:** Backend `authority` module — departments (tree structure),
role assignments, delegations (temporary acting-role grants), and approval
spending limits; also the `effective-permissions` endpoint every other
module's UI uses to show/hide buttons. Also backend `GET /admin/users`
(`identity` module, ticket 0108) — the tenant's user directory (id, email,
display name), open to any signed-in tenant member, backing the shared
`<UserPicker>` component. Frontend: `DepartmentsRolesPage`, nav label
"Departments & Roles", at `/departments-roles`.

**How to use it:** Create departments, assign a role to a user by typing
their name or email into the "Role assignments" search box and picking
them from the dropdown (no more raw user IDs), and set up approval limits.
Effective-permission checks gate every "can I act on this" button across
every other screen.

## M05 — Work-Item Catalogue & Disposition

**Status:** testing (ticket 0058 backend; ticket 0125 admin UI)

**What's built:** Backend `catalogue` module — the 1,308-row source
catalogue imported and classified (995 configure-workflow rows, 215
configure-approval rows, etc.) — plus a Work-Item Catalogue admin screen to
browse, search, filter, reclassify and retire those rows. `GET
/catalogue/work-items` now returns a joined summary (item name, description,
who's responsible, source department) instead of a bare definition row, and
its `search` querystring does a case-insensitive match against item name +
description. Adding a brand-new catalogue item or bulk CSV import/re-import
through the UI is still out of scope — see ticket 0126 — because there is no
authenticated INSERT path for either underlying table (import stays a
service-role CLI script).

**How to use it:** Platform Administrator (or anyone holding
`catalogue.workitem.manage`) → sidebar **Work-Item Catalogue**.
- Search box matches item name/description; Department, Disposition and
  Status dropdowns filter the list; retired items are hidden unless you tick
  **Show archived**.
- **Edit** opens a form for disposition, status, priority, risk tier, phase
  target, capability key, the linked published workflow (picked from a
  dropdown, not typed as an id) and an optional change note — saving bumps
  the item's version.
- **Retire** sets status to `retired` in one click; it then only shows up
  with **Show archived** ticked.
- Without `catalogue.workitem.manage` you can still browse and search, but
  the Edit/Retire actions are hidden.

## M06 — Configuration Studio & Workflow Engine

**Status:** testing (backend: tickets 0059 → split into 0060 definition/
version CRUD + publish/rollback, 0061 validation/simulation, 0062 runtime/
instance engine, 0063 migration of running instances. Frontend: ticket 0116
→ split into 0141 (built, this entry), 0142/0143/0144 still to come)

**What's built:** Backend `workflow` module — the single largest module.
Covers workflow definitions and versions (draft → validate → publish →
rollback), the validation/simulation engine that gates publishing, the
runtime engine that actually runs instances and advances steps, and audited
migration of in-flight instances to a newer published version.

A first slice of the "Configuration Studio" UI now exists at
`/config-studio`: browsing definitions, creating a new one, and managing
versions (drafting a new version from the current published one, rolling
back to any prior published version). The actual steps/graph editor
(adding the node-by-node logic inside a draft version), the validation
panel, and submit/approve/publish actions are not built yet — a version's
detail page currently just shows its metadata as a placeholder.

**How to use it:** New build needed. Sign in as a Platform Administrator or
Document Controller (holds `workflow.definition.manage`) and click
**Configuration Studio** in the sidebar.
1. The list page shows every workflow definition, its key, status and
   current published version. Filter by status with the dropdown.
2. **New Definition** opens a form for key/name/description — creates a
   draft definition with its first draft version.
3. Click a definition's name to open its detail page: header info plus a
   **Versions** table. **New Version** drafts a new version copying the
   current published one (if any). Clicking a version number opens a
   placeholder page with its metadata — the real steps editor lands in a
   follow-on ticket.
4. On a published version's row, **Rollback to this version** (needs
   `workflow.definition.publish`) asks for an optional reason, then makes
   that version active for all new instances again.

What you still can't do from the UI: actually define the steps inside a
draft version, run validation, or submit/approve/publish a version — those
all still require inserting rows directly, same as before this ticket.
The My Work queue (M07) and Approval queue (M08) below both read the
runtime output of workflows that already exist in the database.

## M04 — Employee Directory & Workforce

**Status:** testing (tickets 0064, 0108); frontend screen added ticket 0099

**What's built:** Backend `workforce` module — employee records
(create/list/update/deactivate), skills, certifications, training, and
project allocations with effective dates; `GET /employees/me` for
self-service profile lookup; `PATCH /employees/:id` now also accepts
`appUserId` (ticket 0108 — previously only `POST /employees` could set the
link). Frontend: `EmployeesPage`, nav label "Employee Directory", at
`/employees`.

**How to use it:** On Employee Directory, filter by company/department, see
each employee's code/name/department/status/linked account, and add a new
employee with the add-employee form (only shown if you hold the
`employee.directory.manage` permission) — the form includes an "Link to
auth account" search field (the shared `<UserPicker>`, optional at creation
time). For an employee created without a link, click their "—" in the
Account column to open the same search field and link them to an existing
Supabase Auth account after the fact.

## M07 — Tasks, My Work & Work Queues

**Status:** done (ticket 0071); frontend screen added ticket 0099

**What's built:** Backend, same `workflow` module as M06 — seven queue views
(my-work, team-work, due-soon, overdue, blocked, waiting-approval,
completed) over `workflow_step_instances`, plus step actions: complete,
reassign, delegate, block (reason required), unblock, and comments.
Frontend: `TaskInboxPage`, nav label "My Work", at `/my-work`.

**How to use it:** My Work groups your assigned tasks into To do / In
progress / Blocked / Done. Click a task to open its detail drawer: mark it
complete, block it with a reason, unblock it, reassign it to someone else,
or delegate it — both reassign and delegate use the shared name/email
`<UserPicker>` search, never a raw user ID. If the task has a due date, a
coloured countdown shows how much time is left (green: more than a day,
amber: under a day, red: overdue). Below that, an Activity panel lists
every comment on the task (newest at the bottom, author resolved to a real
name) with a box to post a new one — posting requires the same permission
as acting on the task.

## M08 — Approvals & Delegation

**Status:** testing (ticket 0066); frontend screen added ticket 0099

**What's built:** Backend, same `workflow` module — multi-approver chains
(sequential or parallel, with a required-approval count), approval
decisions (approved / approved with conditions / rejected / returned for
correction — a reason is mandatory for anything but a clean approve),
revocations, authority-limit checks against context amount/currency, and
segregation-of-duties enforcement. Frontend: `ApprovalQueuePage`, nav label
"Approvals", at `/approvals`.

**How to use it:** Approvals shows every `request_approval` step currently
assigned to you. Click one to see the request's context fields, any
decisions already recorded, and whether it's within your authority limit.
Approve, reject, approve with conditions, or return for correction (all but
a clean approve require a comment), or delegate it to another user via the
`<UserPicker>` search. Below the actions, an Activity panel merges every
prior decision and comment into one timeline (oldest first), with a box to
add a new comment.

## M09 — Project & Portfolio Management

**Status:** done (ticket 0073 onward); frontend screen added ticket 0099

**What's built:** Backend `projects` module — project setup (contract/
budget/baseline fields), work breakdown structure (WBS) nodes, milestones,
schedule activities with dependencies, baselines and baseline-change
requests (which route through an approval), progress entries, a risk/issue/
decision register, computed project health/forecast, and a closeout
checklist. Frontend: `ProjectsPage` (register list) at `/projects`, and
`ProjectDetailPage` at `/projects/:id`.

**How to use it:** Projects lists every project with client, location,
contract value and status; "New project" creates one (company, name, code,
start/end dates, project manager via `<UserPicker>`). Click a project to see
its full detail: "Edit project" updates the same fields plus status/client/
location; the WBS tree, milestone timeline and a schedule-activities table
each have their own add/edit forms (WBS node code+name+parent; milestone
name/target date plus actual date + status once created; activity name/
planned dates/percent complete).

## M10 — Client, CRM & Sales Pipeline

**Status:** done (ticket 0089 onward); frontend screen added ticket 0099

**What's built:** Backend `crm` module — clients and contacts (with
duplicate-detection search), opportunities (source/owner/value/
probability/stage), site visits, tender submissions, a pipeline forecast
endpoint, client communications, and a won-opportunity handover checklist
(with an exceptions process that itself needs approval). Frontend:
`CrmPage`, nav label "Clients & CRM", at `/crm`; plus `OpportunityDetailPage`
at `/crm/opportunities/:id` (ticket 0109).

**How to use it:** Clients & CRM has three tabs. Clients: searchable list,
"New client" form (name, trade license, registration country), per-row
Edit. Contacts: searchable list resolved to each client's name, "New
contact" form (client picked from a dropdown, name, title, email, phone,
primary-contact checkbox), per-row Edit. Pipeline: a Kanban board across
all seven opportunity stages — each card has a dropdown to move stages, an
Edit for owner/value/probability, and "New opportunity" creates one (client,
source, title, BD owner via `<UserPicker>`, estimated value, probability).
Clicking an opportunity's title opens its detail page: an overview card
(client, source, owner, expected value, probability), a "Tender
Submissions" tab (list + "New tender submission" form — deadline date,
submitted-at, evidence reference, notes; each row links into M11's tender
submission workspace), and a "Site Visits" tab (list + "Log site visit"
form using `<UserPicker>`).

## M11 — Tendering, Estimation & Commercials (ahead of the official build order)

**Status:** backend + frontend built, `testing` — not yet owner-verified
(tickets 0096/0097/0098 backend, 0109 frontend); the umbrella ticket 0095 is
`done` in the sense that its architect breakdown work is finished, not that
the module is verified end to end.

**What's built:** Backend `tendering` module (tender document register,
scope matrix, clarification log), `estimating` module (versioned estimates
with cost-build-up lines) and `bidding` module (bid/no-bid decisions with
scored criteria, bid submissions) — approval routing through M08's
`request_approval` seam. Frontend: `TenderSubmissionDetailPage` at
`/tendering/tender-submissions/:id` (reached from an opportunity's Tender
Submissions tab), with three tabs: Tender Documents, Estimates, Bid /
No-Bid.

**How to use it:**
- **Tender Documents tab:** list of uploaded documents (type, title,
  uploaded file, date) and an "Upload document" form (document type,
  title, document number, revision, received date, and a real file
  upload via `<FileAttachment>` — the uploaded file is stored via
  `/storage/upload` and displayed as a clickable link once attached).
  All create/delete actions require the `tendering.document.manage`
  permission (hidden via `<PermissionGate>` when absent).
- **Estimates tab:** list of estimate versions with a `<StatusBadge>`
  (draft/pending approval/approved/rejected/returned for
  correction/superseded) and `<CurrencyDisplay>` for the total amount
  (currency determined by the tenant's base currency from
  `/master-data/currencies`). "New estimate version" form captures
  assumptions/inclusions/exclusions text and taxes/overheads/
  contingency/margin percentages. "Manage lines" expands a line-items
  sub-table (item, qty, `<EntityPicker type="uom">` for the unit,
  `<CurrencyInput>` for unit rate, cost category — add and remove; all
  amounts display via `<CurrencyDisplay>`). "Submit for approval" picks
  a published workflow definition and starts the approval instance. A
  non-draft estimate shows a "New version" button.
- **Bid / No-Bid tab:** pick an estimate version, then create or manage
  the bid/no-bid decision — score criteria (five fixed criteria, score,
  rationale; add/remove while draft), "Submit for approval", and once
  approved a "Bid submissions" section (submitted-to, submitted-at,
  evidence reference). Decision status uses `<StatusBadge>`.

---

## M13 — Documents, Drawings & Records

**Status:** backend + frontend built, `testing` — not yet owner-verified
(tickets 0104/M13a and 0105/M13b backend, 0109 frontend). The umbrella
ticket 0103 is `done` in the sense that its architect breakdown work is
finished; M13c (transmittals/document requests, ticket 0106) is not built
yet.

**Frontend (ticket 0109/0118):** `DocumentsPage` at `/documents` (nav
label "Documents & Drawings") — a filterable list with four filters:
keyword title search (debounced 300 ms, client-side), free-text type
filter (client-side substring match), project picker (`<EntityPicker
type="project">` — filters server-side via `?projectId=`), and
free-text discipline filter. "New document" button is wrapped in
`<PermissionGate permission="documents.register.manage">`. The create
form uses `<EntityPicker type="document-type">` for document type and
`<EntityPicker type="project">` for optional project association.

Each row opens `DocumentDetailPage` at `/documents/:id`: a metadata
panel (type, document number, discipline, access class, project link),
a revisions list with `<StatusBadge>` per revision, reviewer name, and
"Current" tag. "Add revision" form uses `<FileAttachment>` (real file
upload to `/storage/upload`) plus `<AttachmentLink>` to display the
attached file, and `<UserPicker>` for reviewer. "Show superseded/
rejected" checkbox. Per-revision actions wrapped in `<PermissionGate
permission="documents.register.manage">` — "Submit for IFC release"
(pick a published workflow definition), "Check approval status" once
in-flight, "Supersede" on an older approved revision.

**What's built (M13a — document register & revision control):**
Backend `documents` module: a general-purpose document-control spine
other modules (M12 engineering, M14 procurement, M17 site ops, M19
quality, M27 legal, etc.) will attach records to.
- `documents`: one row per logical document — free-text
  `document_type` (e.g. "drawing", "spec", "BOQ", "RFI" — this module
  does not own the list of types other modules may use),
  `document_number`, `title`, optional `project_id` (not every
  controlled document is project-scoped, e.g. a corporate SOP),
  free-text `discipline` and `access_class` (no fixed classification
  scheme invented here), `tags`, `originator_id`, and
  `current_revision_id` (set once the first revision exists).
- `document_revisions`: one row per version of a document —
  caller-supplied `revision_code` (e.g. "A", "B", "P1"), `status`
  (`draft` → `under_review` → `approved` → `superseded`/`rejected` —
  its own vocabulary, distinct from the approval-chain decision enum
  used elsewhere), a `storage_reference` pointer only (no file
  upload/storage wiring — that's a separate concern), `reviewer_id`/
  `approver_id`, and `superseded_by_revision_id`.
- **Auto-supersede (FR-DOC-002):** creating a new revision on a
  document whose current revision is `approved` marks that old
  revision `superseded` and points it at the new one, in the same
  call — never a separate step.
- **Current-for-construction views:** listing a document's revisions
  excludes `superseded`/`rejected` by default; pass
  `?includeSuperseded=true` to see them. A separate revision-history
  endpoint always returns the full ordered (oldest-to-newest) list with
  every field, as the raw data a future revision-comparison screen
  needs.
- **Permission:** `documents.register.manage` gates all writes (create
  document, create revision, edit metadata) and is granted only to
  `role.platform_administrator` and `role.document_controller`. Reads
  (list/get documents, list/get revisions, revision history) are open
  to any authenticated user with no extra permission check, same
  broad-read/narrow-write split used elsewhere (e.g. `modules/projects`).

**Out of scope for M13a (left for later tickets or other modules):**
file upload/binary storage wiring, OCR/extraction, retention/legal hold
(already generic and reusable via ticket 0079's `retention_policies`/
`legal_holds`), transmittals and document requests (M13c).

**What's built (M13b — approval stamps & IFC release gate, FR-DOC-003):**
Reuses the exact M08 `request_approval` workflow seam already used for
baseline changes (ticket 0075), estimates (ticket 0097) and bid/no-bid
decisions (ticket 0098) — no second approval mechanism.
- `POST /documents/revisions/:id/submit-for-release` — starts a workflow
  instance against a caller-named published workflow definition (same
  "no automatic resolution" convention as the estimate/bid seams: this
  module does not guess which definition to run). Only a revision whose
  `status` is `under_review` may be submitted (409 otherwise); the
  instance id is recorded on the revision as `workflow_instance_id`.
- `POST /documents/revisions/:id/resolve-approval` — the polling half:
  re-reads the linked workflow instance's step outcome and applies it
  once. On approval: sets `status=approved`, stamps `approved_at`, makes
  the revision the document's `current_revision_id`, and supersedes the
  previously-approved revision if one exists (a safety net — M13a's
  create-time auto-supersede should already have done this). On
  rejection or "returned for correction": both land on the existing
  `rejected` status (no new rejection vocabulary) which, like `draft`, is
  editable in place.
- "IFC" (Issued For Construction) is not a separate flag or status — it
  is just "approved and current" for a drawing-type document; the
  workflow gate itself satisfies FR-DOC-003's review requirement.
- Configuring *which* reviews/approvals a document type needs is M06
  Configuration Studio's job, not hard-coded here.
- Gated by the same `documents.register.manage` permission as M13a's
  writes.

**Out of scope for M13b:** which approval workflow definition applies to
which document type (M06 configures that); an event feed/webhook for the
approval outcome (the caller polls `resolve-approval`, same as the
estimate/bid seams).

**How to use it:** See the Frontend section above — full UI is built and
available at `/documents`. All revision actions (submit for release,
check approval, supersede) require `documents.register.manage`.

---

## M31 — Notifications, SLA & Escalations

**Status:** backend `testing` (tickets 0081/0082/0083), frontend `testing`
(ticket 0128 — the bell is the first UI surface this module has had).

**What's built (backend):** `notifications`/`notification_templates`/
`notification_retry_policies` (in-app + stubbed email delivery,
deduplication by `(tenant, dedup_key, recipient)`, configurable retry
policy — never a hard-coded attempt count), SLA timers/escalation events
on `workflow_events`, and per-user `notification_preferences`/
`notification_schedule_settings` (opt-out, quiet hours, digest batching —
all off unless a user explicitly configures them). `dispatchNotification`
is the entry point other modules call directly; no event-bus auto-wiring
exists yet, so a module that doesn't call it produces no notifications
(see each module's section for whether it's wired in).

**Frontend (ticket 0128):** a bell icon in `AppLayout`'s header, visible
to every signed-in user (self-service, no permission gate — matches
`GET /notifications`' own RLS-only access rule). An unread-count badge
(red if any of the caller's notifications have `read_at = null`) refetches
on a 30-second poll and whenever the bell is opened. Clicking the bell
opens a dropdown inbox (subject + body, newest first, unread ones
visually distinct); clicking a notification marks it read via
`POST /notifications/:id/read` with an optimistic UI update. Empty state
reads "No notifications yet." Supabase Realtime push (instead of polling)
is a documented follow-on, not built — ticket 0128 didn't need it to meet
its acceptance criteria.

**Out of scope for ticket 0128:** the preferences/quiet-hours/digest
settings screen (backend exists per ticket 0083, no UI yet — a future
ticket if the owner wants users to self-configure those rather than
leaving everything at "immediate delivery, no quiet hours").

---

## M33 — Master Data & Configuration

**Status:** backend + frontend built (ticket 0114), `status: testing` —
**the migration that creates the five new tables (`uom`, `currencies`,
`cost_codes`, `document_types`, `numbering_schemes`) has not been applied
to the live database yet** (Supabase MCP tools were unreachable in every
session that touched this ticket so far). The UI will 404/error until a
session with MCP access runs `supabase/migrations/
20261017000001_m33_master_data_configuration.sql`.

**What's built:** six tenant-scoped master-data entities, each with full
list/create/edit/archive/restore in the UI — units of measure (`uom`),
currencies (`currencies`, exactly one base currency enforced per tenant,
with a "Set as base currency" checkbox in the UI), cost codes
(`cost_codes`, self-referencing hierarchy shown as an indented tree with
an "Add child" action per row), document types (`document_types`),
numbering schemes (`numbering_schemes`, atomic "issue next number" via
optimistic-concurrency retry, no Postgres function — the list screen
shows a live preview of each scheme's next formatted number), and project
types (already existed from ticket 0073/M09a — only the missing
`is_active` column and edit/archive endpoints were added, not a second
table). All writes gated by `master-data.manage` except project-types'
own pre-existing `tenancy.project.manage` (kept as-is rather than split
across two permissions for one entity). Reads open to any authenticated
tenant member. `documents.document_type_id` and `estimate_lines.cost_code_id`
nullable FKs added so those modules can move off free text once their
own forms gain a picker — no existing row is affected, the old text
columns are untouched. Restore (un-archive) is done via `PATCH … {
is_active: true }` on the same update endpoint each entity already had —
no separate `/restore` route was added, since the existing PATCH handler
only needed `is_active` added to its accepted body fields.

**Out of scope for this pass:** the "every monetary field gets a
companion `currency_code` column" instruction in the ticket was too
broad to act on without the owner naming which fields qualify beyond
what already exists (`projects.contract_currency`/`budget_currency`,
free text, from ticket 0073) — deferred rather than guessed at, per
CLAUDE.md's "don't invent" rule.

**How to use it:** Platform Administrators see a "Master Data" item in
the sidebar (hidden from everyone else via `<PermissionGate
permission="master-data.manage">` — Project Types' write actions instead
check `tenancy.project.manage`, matching its own permission). The page is
one screen with six tabs — Units of Measure, Currencies, Cost Codes,
Document Types, Project Types, Numbering Schemes. Each tab has its own
list (archived items hidden unless "Show archived" is ticked), an inline
edit-in-place row, and an "Add" form at the bottom. Cost Codes additionally
shows an "Add child" button per row that pre-fills the parent in the add
form. Archiving a cost code or document type that's still referenced by
an estimate line or a document returns the referencing count in the error
banner instead of silently failing.

---

## M18 — Schedule, Progress & Resource Planning

**Status:** done (ticket 0120)

**What's built:**
- Backend:
  - `GET /projects/:projectId/schedule/gantt` — full CPM (Critical Path Method) schedule calculation with Early Start, Early Finish, Late Start, Late Finish, Total Float days, Critical Path identification, and baseline comparison.
  - `POST /projects/:projectId/lookahead-plans` and `GET /projects/:projectId/lookahead-plans` — 2-week and 4-week lookahead plan creation and listing.
  - `GET /lookahead-plans/:planId` — detailed view of lookahead plan and its granular activity items.
  - `POST /lookahead-plans/:planId/activities` — add planned action items to a lookahead window, optionally linking to schedule activities.
  - `PATCH /lookahead-activities/:activityId` — update action status (`planned`, `in_progress`, `completed`, `delayed`) and site notes.
  - `POST /projects/:projectId/delays` and `GET /projects/:projectId/delays` — delay logging with duration, reason category (`client`, `design`, `procurement`, `subcontractor`, `weather`, `permits`, `other`), description, and mitigation plan.
  - `GET /projects/:projectId/schedule/variance` — schedule variance summary aggregating total delay days, critical path delays, and delay breakdown by category.
- Frontend: `ScheduleGanttSection` component in `ProjectDetailPage` (`/projects/:id`) with:
  - Schedule KPI header: Overall progress bar, critical path items count, approved baseline version, total delay days, and critical path delays.
  - Interactive Gantt chart with baseline overlay toggle and critical path filter.
  - Quick progress update drawer (reports percent complete and site observation note).
  - Lookahead Plans workspace with 2-week/4-week plan creation and action status workflows.
  - Delay Register & Variance breakdown cards and "Log Delay" modal with mitigation plans.

**How to use it:**
- Open any project at `/projects/:id`. The "Schedule, Progress & Resource Planning" section is displayed with three interactive tabs:
  1. **Interactive Gantt Schedule**: View planned vs frozen baseline bars. Toggle "Critical Path Only" to highlight zero-float critical activities, or click "% complete" on any activity row to quickly log a progress entry.
  2. **Lookahead Plans**: Select a 2-week or 4-week lookahead plan from the sidebar (or click "+ New" to create one), then click "+ Add Lookahead Action" to plan granular operational tasks and track their status.
  3. **Delay Register & Variance**: View the contractual delay breakdown by driver (Client, Design, Weather, etc.) and click "+ Log New Delay" to record impact days, root cause, and recovery mitigation plans.

## M17 — Site Operations, DPR & Field Capture

**Status:** done (ticket 0160)

**What's built:**
- Backend `site` module (`backend/src/modules/site/`):
  - Daily Progress Reports (DPR) with date, status ('draft', 'submitted', 'approved', 'rejected'), weather condition, temperature, impact, notes, and approval records.
  - Manpower log (trade, headcount, hours worked, subcontractor name, notes).
  - Equipment & plant log (equipment type, quantity, operating hours, idle hours, notes).
  - Executed work progress log (activity linkage, location/grid, description, quantity executed, UOM, notes).
  - Site blockers & delay tracker (categories, description, impact hours, resolution action, open/resolved status).
  - Site Instructions (SI) register (number, issued by, recipient, instruction directives, priority, status).
  - Multi-tenant RLS isolation on all tables and strict permission guards (`site.dpr.manage`, `site.dpr.approve`, `site.instruction.manage`).
- Frontend screen `SiteOperationsPage` at `/site`:
  - Project switcher dropdown for instant multi-project site logging.
  - DPR list table with status filter chips, weather emojis, temperatures, and actions.
  - "New DPR" modal wizard for logging the day's conditions.
  - Detailed DPR Workspace with real-time metrics (total manpower, equipment operating hours, work locations, open blockers), supervisor submission/approval/return buttons, and 4 specialized logs (Manpower, Equipment, Work Progress, Blockers).
  - Site Instructions Register tab for issuing and updating formal directives.

**How to use it:**
- Navigate to "Site Operations & DPR" from the sidebar navigation (under Projects) or go to `/site`.
- Select your project from the top dropdown.
- **Log Daily Progress**: Click "+ New DPR", specify the date, weather conditions (e.g. Sunny 32°C), and operational notes.
- **Record Site Resources & Progress**: Click "Open Workspace →" on any draft DPR to log:
  1. **Manpower**: Trade, worker headcount, hours worked, and subcontractor.
  2. **Equipment**: Equipment type, units, operating vs idle hours.
  3. **Work Progress**: Specific grid location, description of executed work, and quantities with UOM.
  4. **Site Blockers**: Issues causing delay (e.g. material shortage, safety stop) with impact hours and resolution plans.
- **Review & Sign-Off**: Click "Submit DPR for Approval". Supervisors review the comprehensive summary cards and click "Approve DPR" to lock it as immutable evidence, or "Return / Reject" with corrective feedback.
- **Site Instructions**: Switch to the "Site Instructions Register" tab to issue formal numbered directives (e.g. SI-001) with urgent/normal priority and target completion dates.

---

## M14 — Procurement, Requisitions & Purchase Orders

**Status:** done (ticket 0161)

**What's built:** Backend `procurement` module (`/procurement/vendors`, `/procurement/requisitions`, `/procurement/orders`, `/projects/:projectId/procurement/...`) with multi-tenant RLS isolation and permission enforcement.
Frontend: `ProcurementPage`, nav label "Procurement & Orders" under Projects at `/procurement`.

**How to use it:**
- Navigate to "Procurement & Orders" from the sidebar navigation (under Projects) or go to `/procurement`.
- **Approved Vendor List (AVL)**: Switch to the "Approved Vendor List (AVL)" tab to view and filter registered suppliers by category (`materials`, `plant_machinery`, `services`, `specialist_contractor`) or KYC status (`active`, `pending_kyc`, `suspended`, `blacklisted`). Click "+ Register New Vendor" to onboard vendors with trade license (TL), tax registration number (TRN), contact details, and performance star ratings.
- **Purchase Requisitions (PR)**:
  - View project requisitions with priority badges (`low`, `normal`, `urgent`) and status pills.
  - Click "+ New Requisition" to draft a material requirement with required delivery date.
  - Click "View Items" to open the requisition drawer, add line items with cost codes, quantities, and estimated unit rates (which auto-computes line totals and requisition total estimated value).
  - Click "Submit for Approval" when items are finalized. Authorizers can click "Approve Requisition" or "Return / Reject" with specific revision feedback.
- **Purchase Orders (PO)**:
  - View official purchase orders issued to approved vendors with subtotal, 5% UAE VAT, and total order amounts.
  - Click "+ New Purchase Order" to generate an order linked to an approved vendor and delivery address.
  - Click "Manage" to open the PO drawer, add order line items (which automatically updates order subtotal, adds 5% VAT, and recalculates total amount), and issue the PO.
  - Update line-level delivery status (`pending` → `partial` → `delivered`) to track material deliveries to the project site. When all line items are delivered, the PO status automatically transitions to `delivered`.

---

## M15 — Inventory, Stores & Material Movement

**Status:** done (ticket 0162)

**What's built:** Backend `inventory` module (`/inventory/locations`, `/inventory/items`, `/inventory/stock-balances`, `/projects/:projectId/inventory/grns`, `/projects/:projectId/inventory/issues`, `/projects/:projectId/inventory/gate-passes`) with multi-tenant RLS isolation and permission enforcement.
Frontend: `InventoryPage`, nav label "Inventory & Stores" under Projects at `/inventory`.

**How to use it:**
- Navigate to "Inventory & Stores" from the sidebar navigation (under Projects) or go to `/inventory`.
- **Store Locations & Catalog**:
  - Switch to the "Stock Balances & Stores" tab to view established warehouses, site laydown yards, and current stock ledger.
  - Click "+ New Store Location" to set up a central warehouse, site store, laydown yard, or scrap yard with designated code and physical address.
  - Click "+ Add Catalog Item" to register stock master records with item code, item description, category (`materials`, `plant_spares`, `consumables`, `tools_ppe`, `safety_equipment`), default unit of measure (UOM), unit cost, and minimum reorder threshold.
- **Goods Received Notes (GRN)**:
  - Switch to the "Goods Received Notes (GRN)" tab to record inbound shipments from suppliers or central warehouses.
  - Click "+ New GRN", link the receipt to a store location, supplier delivery note number, carrier, and vehicle number.
  - Click "View Items" on any draft GRN to open the inspection drawer. Add delivered line items specifying delivered, accepted, and rejected quantities, rack/bin placement, and rejection rationale if damaged.
  - Click "Accept & Update Stock" — this marks the GRN as accepted and **automatically increments the on-hand stock balance** in the store ledger for all accepted line items.
- **Material Issue Notes (MIN)**:
  - Switch to the "Material Issues (MIN)" tab to record outbound dispatches to site gangs, work crews, or subcontractors.
  - Click "+ New Issue Note", selecting the issuing store location, recipient crew name, and WBS/cost code (e.g. `04-ELEC`).
  - Click "Manage Issue" to open the issue drawer, select catalog items, and specify issued quantities.
  - Click "Dispatch & Deduct Stock" — this verifies sufficient on-hand quantity and **automatically decrements the stock ledger**, transitioning the issue note status to `issued`.
- **Material Gate Passes**:
  - Switch to the "Material Gate Passes" tab to issue security gate passes (`inbound`, `outbound`, `transfer`, `returnable`, `disposal`).
  - Click "+ New Gate Pass" with transporter vehicle number, driver name, contact number, and destination.
  - Click "Approve" to authorize gate security exit, and click "Dispatch Exit" when the vehicle passes the security gate to record the official gate exit timestamp.

---

## M16 — Subcontractor & Labour Operations

**Status:** done (ticket 0163)

**What's built:** Backend `subcontractors` module (`/projects/:projectId/subcontractors/work-orders`, `/subcontractors/work-orders/:id/milestones`, `/projects/:projectId/subcontractors/attendance`, `/subcontractors/work-orders/:id/measured-works`, `/projects/:projectId/subcontractors/payment-claims`) with multi-tenant RLS isolation and permission enforcement.
Frontend: `SubcontractorsPage`, nav label "Subcontractors & Labour" under Projects at `/subcontractors`.

**How to use it:**
- Navigate to "Subcontractors & Labour" from the sidebar navigation (under Projects) or go to `/subcontractors`.
- **Work Packages & Agreements**:
  - Switch to the "Work Packages & Orders" tab to view all subcontractor packages, contract values, trade disciplines (`civil`, `mep`, `structural`, `finishes`, `facade`, `piling`, `landscape`), and retention rates (default 10%).
  - Click "+ New Work Order" to create a subcontract package linked to an approved vendor from the AVL, specifying start/completion dates and scope.
  - Click "View Package →" on any work order to open the contract drawer and manage milestone schedule payments.
- **Daily Manpower & Attendance**:
  - Switch to the "Daily Manpower & Attendance" tab to view trade labour gang records by date.
  - Filter logs by date and click "+ Log Daily Attendance" to record skilled vs unskilled headcounts, total working hours, and site supervisor notes.
- **Measured Work & Field Progress**:
  - Switch to the "Measured Work & Progress" tab to track physical field measurements against BOQ line items and WBS codes.
  - Click "+ Record Measured Work" specifying quantities and agreed unit rates (which auto-computes the certified value).
- **Payment Claims & Retention Deductions**:
  - Switch to the "Payment Claims & Retention" tab to view Interim Payment Certificates (IPC).
  - Click "+ Submit Payment Claim" specifying claim period and gross claimed amount. The system **automatically calculates and deducts the agreed retention percentage** (e.g. 10%) to determine the net payable amount.
  - Quantity Surveyors and Project Managers can click "Certify IPC →" to certify the valuation on site measurement validation.

---

## M19 — Quality, Inspection & NCR

**Status:** done (ticket 0164)

**What's built:** Backend `quality` module (`/projects/:projectId/quality/plans`, `/quality/plans/:id`, `/projects/:projectId/quality/wirs`, `/quality/wirs/:id/sign-off`, `/projects/:projectId/quality/ncrs`, `/quality/ncrs/:id/capa`, `/quality/ncrs/:id/close`) with multi-tenant RLS isolation and permission enforcement.
Frontend: `QualityPage`, nav label "Quality & Inspection" under Projects at `/quality`.

**How to use it:**
- Navigate to "Quality & Inspection" from the sidebar navigation (under Projects) or go to `/quality`.
- **Work Inspection Requests (WIR / RFI)**:
  - View all formal site inspection requests submitted by subcontractors or site engineers.
  - Click "+ New Inspection Request" to request an inspection specifying grid location, trade discipline (`civil`, `mep`, `structural`, `finishes`, `piling`, `facade`), contractor representative, and inspection checkpoints. You can optionally link to an approved ITP to auto-populate inspection criteria.
  - Click "Review & Sign-off →" to open the inspection drawer: evaluate checklist items (Pass/Fail/NA), select verdict (Pass / Approved, Conditionally Approved, or Reject / Fail), and enter inspector remarks.
  - If a rejection occurs, checking "Automatically issue Non-Conformance Report (NCR)" automatically creates a linked NCR with root cause tracking.
- **Non-Conformance Reports (NCR) & CAPA**:
  - Filter and review defect records categorized by severity badges (`critical`, `major`, `minor`), root cause (`workmanship`, `material_defect`, `design_clash`, `method_deviation`, `environmental`), and target closure dates.
  - Click "+ Issue NCR" for standalone quality defects observed on site with immediate containment action.
  - Click "Manage CAPA →" to open the resolution drawer: contractors log the Corrective Action Plan and Preventive Action Plan.
  - Once CAPA is submitted, QA/QC inspectors can conduct re-inspection and click "✓ Verify & Formally Close NCR".
- **Inspection & Test Plans (ITP)**:
  - View project quality assurance standards and specifications.
  - Click "+ New Quality Plan" to define inspection hold points, witness points, surveillance, and review checkpoints with standard tolerances.

---

## Shared frontend components (not a module — reused across all of them)

These live in `frontend/src/components/` and aren't a screen of their own,
but every module above uses one or more of them:

- `<PermissionGate permission="x.y.z">` — hides an action button when the
  signed-in user lacks the named permission.
- `<UserPicker>` — name/email search-to-user-id picker. Used anywhere a
  form needs to reference a person (assignee, reviewer, approver, owner).
- `<EntityPicker type="project|client|document|cost-code|document-type|
  currency|uom">` — same search pattern as `<UserPicker>`, for referencing
  another entity instead of a person. New forms should reach for this
  instead of a raw `<select>` or, worse, a text box expecting a UUID.
- `<StatusBadge status="...">` — colour-coded status pill covering every
  status string used across the built modules (project, milestone,
  document revision, estimate/bid, workflow/task, employment, CRM
  opportunity stage). Unknown statuses render as a neutral grey pill with
  the status text, rather than breaking.
- `<NotificationBell>` — header bell with unread count and a drawer; see
  M31 above.

---

## Not started yet

Everything from M20 onward in CLAUDE.md's build order table (M20 Safety, Incidents & Compliance, M21 Finance, Budgets & Cost Control, … through M38) has no code. Don't assume
otherwise just because a module number is skipped above — check
`tickets/` and this file before relying on a module existing.
