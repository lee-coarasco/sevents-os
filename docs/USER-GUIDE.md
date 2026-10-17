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

**Status:** testing (ticket 0053/0054)

**What's built:** Backend `identity` module — sign-in/sign-out, user invite
and accept-invite, deactivation, an audit log, and MFA enrollment/verify, all
via Supabase Auth underneath. Frontend: `LoginPage` at `/login` — the only
screen this module needs.

**How to use it:** Go to `/login`, sign in with an email/password Supabase
account. That's the full UI surface — creating other users' accounts,
assigning them roles, etc. happens in M03/M08, not here.

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
  storage reference, uploaded date) and an "Upload document" form
  (document type, title, document number, revision, received date,
  storage reference — a pointer string, not a real file upload).
- **Estimates tab:** list of estimate versions with a status badge
  (draft/pending approval/approved/rejected/returned for
  correction/superseded) and total amount. "New estimate version" form
  captures assumptions/inclusions/exclusions text and taxes/overheads/
  contingency/margin percentages (the backend has no separate "version
  label" or "scope summary" field — version numbers are assigned
  automatically and scope lives in inclusions/exclusions). "Manage lines"
  on a row expands a line-items sub-table (item, qty, unit, unit rate,
  cost category — add and remove; there is no per-line markup %, only the
  estimate-level margin). "Submit for approval" picks a published
  workflow definition from a dropdown (`GET
  /workflow/definitions/published`, ticket 0109's addition — the existing
  `GET /workflow/definitions` needs `workflow.definition.manage`, which
  estimators don't hold) and starts the approval instance. A non-draft
  estimate shows a "New version" button (FR-EST-003's only legal way to
  change a locked estimate).
- **Bid / No-Bid tab:** pick an estimate version from a dropdown, then
  either create a decision (recommendation: bid/no bid) or manage the
  existing one — score criteria (one of five fixed criteria, a score, a
  rationale; add/remove while draft), "Submit for approval" (same
  published-definition picker as Estimates), and once the decision is
  approved, a "Bid submissions" section appears (submitted-to,
  submitted-at, evidence reference).

---

## M13 — Documents, Drawings & Records

**Status:** backend + frontend built, `testing` — not yet owner-verified
(tickets 0104/M13a and 0105/M13b backend, 0109 frontend). The umbrella
ticket 0103 is `done` in the sense that its architect breakdown work is
finished; M13c (transmittals/document requests, ticket 0106) is not built
yet.

**Frontend (ticket 0109):** `DocumentsPage` at `/documents` (nav label
"Documents & Drawings") — a filterable list (type, project, discipline)
with a "New document" form (title, type, document number, project picker,
discipline, access class). Each row opens `DocumentDetailPage` at
`/documents/:id`: a metadata panel, a revisions list (revision code,
status badge, reviewer, "Current" tag on the document's current
revision), an "Add revision" form (revision code, storage reference,
reviewer via `<UserPicker>`), a "Show superseded/rejected" checkbox, and
per-revision actions — "Submit for IFC release" (pick a published
workflow definition, same `GET /workflow/definitions/published` picker as
M11) on an `under_review` revision, "Check approval status" once a
submission is in flight, and "Supersede" on an older `approved` revision
(PATCHes its status to `superseded` directly — manually pointing
`superseded_by_revision_id` at a specific newer revision is not exposed by
the API; that field is only ever set by the automatic create-a-new-
revision and approval-resolution flows, so a manual supersede here is a
status-only override, scoped out of this ticket rather than adding new
backend surface for it).

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

**How to use it:** Nothing to click yet — backend only, no frontend (the
UI is tracked separately in ticket 0118).

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

Everything from M12 onward in CLAUDE.md's build order table except M13a
above (M12 Technical Engineering, M13b/M13c Documents/Drawings remainder,
M14 Procurement, M15 Inventory, … through M38) has no code. Don't assume
otherwise just because a module number is skipped above — check
`tickets/` and this file before relying on a module existing.
