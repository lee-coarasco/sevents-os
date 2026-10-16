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

**Status:** testing (ticket 0056)

**What's built:** Backend `authority` module — departments (tree structure),
role assignments, delegations (temporary acting-role grants), and approval
spending limits; also the `effective-permissions` endpoint every other
module's UI uses to show/hide buttons. Frontend: `DepartmentsRolesPage`, nav
label "Departments & Roles", at `/departments-roles`.

**How to use it:** Create departments, assign a role to a user by pasting
in their user ID (no user picker yet — there's no directory lookup UI for
raw auth user IDs anywhere in this frontend, see M04's note below), and set
up approval limits. Effective-permission checks gate every "can I act on
this" button across every other screen.

## M05 — Work-Item Catalogue & Disposition

**Status:** testing (ticket 0058)

**What's built:** Backend `catalogue` module only — the 1,308-row source
catalogue imported and classified (995 configure-workflow rows, 215
configure-approval rows, etc.). No REST API meant for end users; it's
configuration input for M06's workflow definitions, not a thing you browse
directly.

**How to use it:** Nothing to click — this is internal data, not a screen.

## M06 — Configuration Studio & Workflow Engine

**Status:** testing (tickets 0059 → split into 0060 definition/version CRUD +
publish/rollback, 0061 validation/simulation, 0062 runtime/instance engine,
0063 migration of running instances)

**What's built:** Backend `workflow` module — the single largest module.
Covers workflow definitions and versions (draft → validate → publish →
rollback), the validation/simulation engine that gates publishing, the
runtime engine that actually runs instances and advances steps, and audited
migration of in-flight instances to a newer published version. No
"Configuration Studio" UI exists yet — there is no screen to visually build a
workflow definition.

**How to use it:** Nothing to click yet for authoring workflows — that needs
a designer screen that hasn't been built. What you *can* reach today is the
runtime output of workflows that already exist: the My Work queue (M07) and
Approval queue (M08) below are both reading from this engine's step
instances.

## M04 — Employee Directory & Workforce

**Status:** testing (ticket 0064); frontend screen added ticket 0099

**What's built:** Backend `workforce` module — employee records
(create/list/update/deactivate), skills, certifications, training, and
project allocations with effective dates; `GET /employees/me` for
self-service profile lookup. Frontend: `EmployeesPage`, nav label "Employee
Directory", at `/employees`.

**How to use it:** On Employee Directory, filter by company/department, see
each employee's code/name/department/status, and add a new employee with
the add-employee form (only shown if you hold the
`employee.directory.manage` permission). There is still no lookup from an
employee record to their Supabase auth user ID — anywhere a screen needs a
"delegate to" or "assign role to" user, you type a raw user ID (see M03,
M07, M08).

## M07 — Tasks, My Work & Work Queues

**Status:** done (ticket 0071); frontend screen added ticket 0099

**What's built:** Backend, same `workflow` module as M06 — seven queue views
(my-work, team-work, due-soon, overdue, blocked, waiting-approval,
completed) over `workflow_step_instances`, plus step actions: complete,
reassign, delegate, block (reason required), unblock, and comments.
Frontend: `TaskInboxPage`, nav label "My Work", at `/my-work`.

**How to use it:** My Work groups your assigned tasks into To do / In
progress / Blocked / Done. Click a task to open its detail drawer: mark it
complete, block it with a reason, or unblock it. Reassign/delegate exist on
the backend but aren't wired into this screen yet — only complete/block/
unblock are.

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
Approve or reject (reject requires a comment) or delegate it to another
user by their raw user ID. "Returned for correction" and "approved with
conditions" exist on the backend but this screen only exposes
approve/reject, matching what ticket 0099 scoped for this screen.

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
contract value and status; click one to see its full detail — a WBS tree
and a milestone timeline with status badges. This screen is read-only
(no create/edit forms yet): it was scoped as a register + detail view only,
not a project-setup wizard.

## M10 — Client, CRM & Sales Pipeline

**Status:** done (ticket 0089 onward); frontend screen added ticket 0099

**What's built:** Backend `crm` module — clients and contacts (with
duplicate-detection search), opportunities (source/owner/value/
probability/stage), site visits, tender submissions, a pipeline forecast
endpoint, client communications, and a won-opportunity handover checklist
(with an exceptions process that itself needs approval). Frontend:
`CrmPage`, nav label "Clients & CRM", at `/crm`.

**How to use it:** Clients & CRM has three tabs: Clients (searchable list),
Contacts (searchable list, each resolved to its client's name), and
Pipeline — a Kanban board across all seven opportunity stages (lead,
qualified, site visit, tender, negotiation, won, lost). Each card has a
dropdown to move it to a different stage. No create-client/contact/
opportunity forms yet — same read-only-plus-the-core-interaction scope
decision as M09's screens.

## M11 — Tendering, Estimation & Commercials (ahead of the official build order)

**Status:** backend built, `testing` — not yet owner-verified (tickets
0096/0097/0098); the umbrella ticket 0095 is `done` in the sense that its
architect breakdown work is finished, not that the module is verified end
to end.

**What's built:** Backend `tendering` module (tender document register,
scope matrix, clarification log) and `bidding` module (estimate versions
with cost build-up, bid/no-bid decisions with scored criteria, approval
routing through M08). No frontend at all.

**How to use it:** Nothing to click — backend only. Flagged here so this
guide doesn't silently omit built code just because M11 comes later than
M04-M10 in CLAUDE.md's official build order.

---

## M13 — Documents, Drawings & Records

**Status:** backend built, `testing` — not yet owner-verified (ticket
0104/M13a only). The umbrella ticket 0103 is `done` in the sense that
its architect breakdown work is finished; M13b (approval stamps/IFC
release gate, ticket 0105) and M13c (transmittals/document requests,
ticket 0106) are not built yet.

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
`legal_holds`), approval-stamp/IFC release gating (M13b), transmittals
and document requests (M13c).

**How to use it:** Nothing to click yet — backend only, no frontend.

---

## Not started yet

Everything from M12 onward in CLAUDE.md's build order table except M13a
above (M12 Technical Engineering, M13b/M13c Documents/Drawings remainder,
M14 Procurement, M15 Inventory, … through M38) has no code. Don't assume
otherwise just because a module number is skipped above — check
`tickets/` and this file before relying on a module existing.
