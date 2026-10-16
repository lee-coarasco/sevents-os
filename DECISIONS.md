# Decisions Log

Append-only. Newest at the bottom. Each entry: timestamp (with time zone, not
just date — the project runs multiple sessions/day), decision, why, who
approved (agent-autonomous or you).

---

<!-- Example entry format:
## 2026-09-16 09:14 IST - Use PostgreSQL over MongoDB for bookings
- Decision: Use PostgreSQL over MongoDB for the booking system.
- Why: Bookings/payments need relational integrity and transactions.
- Approved by: agent (falls under "internal architecture", no approval needed)
-->

## 2026-10-14 18:43 IST - Cluster catalogue rows by shared trigger, not one ticket per row
- Decision: Classify the 1,308-row source catalogue into tickets by
  grouping rows that share Department + Role + near-identical source
  `Trigger` text into one ticket per cluster, rather than one ticket per
  row.
- Why: BRD §6.3/Implementation Plan §1 are explicit that the catalogue
  "does not define module boundaries" and the system must not become
  "1,308 separate features." Row-level traceability is preserved inside
  each ticket (a table listing every source S.No.).
- Approved by: agent (ticket classification/ordering is explicitly listed
  in CLAUDE.md as an agent decision needing no owner approval).

## 2026-10-14 18:43 IST - Do not commit the full catalogue JSON extract to git
- Decision: `scripts/xlsx_to_json.py` converts the source workbook to JSON
  for processing; the small sheets are committed, but
  `docs/catalogue/source-catalogue.json` (~5.5MB, regenerable in seconds
  from the xlsx already in the repo) is gitignored.
- Why: avoid repo bloat from a fully derived/regenerable artifact; the
  xlsx is the actual source of truth per BRD §6.3.
- Approved by: agent (internal tooling/repo-hygiene decision).

## 2026-10-15 IST - Build in BRD module order, not material-request pilot first
- Decision: Build all 38 BRD modules in dependency order (M01 → M02 → M03
  → … → M14 → M15 …). The earlier "pilot = material request" framing is
  superseded. Procurement/stores (M14/M15) are Phase 5 — they depend on
  identity, tenancy, roles, workflow engine, projects and tasks being solid
  first. PRD rewritten to cover all phases.
- Why: Skipping to M14 would mean building procurement on top of no real
  platform — no auth, no tenant isolation, no workflow engine. Every later
  module would have to be rebuilt. The BRD module dependency order is the
  correct build sequence.
- Approved by: owner (2026-10-15).

## 2026-10-15 IST - Tech stack locked: Supabase + Node.js/TypeScript
- Decision: Supabase (PostgreSQL + Auth + Storage + Realtime) for the data
  layer. Node.js + TypeScript for the backend API. Frontend framework TBD
  (architect proposes in Phase 1).
- Why: Supabase provides tenant isolation via RLS, built-in auth, file
  storage and realtime — matches the project's needs without additional
  infrastructure. Node.js/TypeScript is the owner's preference and aligns
  with the existing AppYard dashboard stack.
- Approved by: owner (2026-10-15).

## 2026-10-15 11:10 UTC - Backend framework: Fastify; test runner: Vitest
- Decision: Use Fastify for the Node.js/TypeScript backend (ticket 0053,
  Phase 1 scaffold). Use Vitest as the test runner.
- Why: Fastify has first-class TypeScript types and a low-overhead plugin
  model that fits a config-first API surface where most endpoints are
  thin wrappers over Supabase calls plus permission checks; NestJS's
  heavier DI/module ceremony (the BRD §5.1 suggestion, written before the
  Supabase decision) isn't needed on top of Supabase already owning
  auth/DB/storage. Vitest is fast, has native ESM/TS support with no
  extra config, and its `vi`-based mocking is enough for the service-role
  Supabase client we inject into routes for testing. Both are
  CLAUDE.md-delegated choices ("Node.js framework choice", "Which testing
  framework/library to use" — no approval needed).
- Approved by: agent (ticket 0053, falls under explicit agent-decidable
  items in CLAUDE.md).

## 2026-10-15 11:10 UTC - Supabase CLI not installed; config.toml hand-written
- Decision: The `supabase` CLI binary isn't available in this session's
  sandbox. Rather than block the Phase 1 scaffold on installing it,
  `supabase/config.toml` and `supabase/migrations/` were created by hand
  to match the CLI's own `supabase init` output, so the real CLI can be
  installed and pointed at this project later without redoing structure.
- Why: ticket 0053 (and every migration-writing ticket after it) needs
  `supabase/migrations/` to exist now; waiting on CLI installation would
  block the whole Phase 1 chain for no schema benefit.
- Approved by: agent (internal tooling decision, no business-rule or
  cost impact).

## 2026-10-15 12:05 UTC - RoleDefinition/Permission catalogue is platform-wide, not per-tenant
- Decision: `role_definitions`, `permissions` and the `role_permissions`
  join table (ticket 0056, M03) use a *nullable* `tenant_id` rather than
  the NOT NULL tenant_id every other tenant-owned table in this project
  uses. A NULL row is a platform-wide catalogue entry visible to every
  tenant (RLS policy: `tenant_id is null or tenant_id = current_tenant_id()`);
  a non-NULL row is reserved for a future tenant-specific custom
  role/permission. The 44 canonical roles from
  `docs/canonical-role-map.md` and the minimal permission catalogue are
  seeded once, as global rows.
- Why: ticket 0056's acceptance text says "all tenant-scoped with RLS,"
  but there is no mechanism yet to seed a fresh copy of the 44-role
  catalogue every time a new tenant is created (no tenant-creation API
  exists — ticket 0055 made tenant creation a service-role bootstrap
  step, not self-service). Making these three tables NOT NULL tenant_id
  would mean either duplicating the canonical catalogue by hand per
  tenant (contradicts BRD §6.3: canonical role records are a shared
  taxonomy, not per-company) or leaving them empty for every tenant
  except whichever one got the migration-time seed. RLS still checks
  tenant_id on every one of them, so the "tenant-scoped" intent (no
  tenant can see another tenant's private data through these tables) is
  preserved; it's the catalogue's *shared* rows, not isolation, that
  changed.
- Approved by: agent (ticket 0056, DB schema detail — CLAUDE.md
  "Internal API design, DB schema details, additive/non-destructive
  migrations" is explicitly agent-decidable). Recorded here because it
  deviates from the ticket's own acceptance wording; flagged in ticket
  0056's Progress for the next session/owner review.

## 2026-10-15 12:05 UTC - Fixed forward: tenant_id default missing on M02 tables
- Decision: Added `alter column tenant_id set default public.current_tenant_id()`
  for `companies`, `branches`, `projects` and `file_objects` in ticket
  0056's migration (additive, same migration that introduces
  `current_tenant_id()`-defaulted columns on its own new tables).
- Why: ticket 0055's migration declared `tenant_id` NOT NULL with no
  default on those four tables, but `modules/tenancy/repository.ts`
  never supplies `tenant_id` on insert (relying on RLS's `with check`
  alone, which does not fill in a NOT NULL column). A real insert
  against live Supabase would have failed with a not-null violation —
  never caught because no session so far has had reachable Supabase
  credentials. Fixing forward while already establishing the same
  default pattern for ticket 0056's own tables, rather than opening a
  separate ticket for a one-line four-table default fix.
- Approved by: agent (non-destructive additive migration, explicitly
  agent-decidable per CLAUDE.md).

## 2026-10-15 12:05 UTC - First Platform Administrator role_assignment is a service-role bootstrap step
- Decision: `POST /identity/invite` now requires `identity.user.invite`
  (ticket 0056). The very first such permission grant — assigning
  `role.platform_administrator` to the first real user — is done by a
  service-role/DB operation, not through the API, since by definition
  nobody holds `authority.role_assignment.manage` before that happens.
- Why: same bootstrapping precedent ticket 0055 already set for tenant
  creation ("admin operation, not self-service"). Avoids inventing an
  unauthenticated-by-design "first invite" API carve-out, which would
  reopen the exact gap this ticket exists to close.
- Approved by: agent (consistent with an existing precedent, no new
  product decision).

## 2026-10-15 13:30 UTC - M05 catalogue import is a service-role CLI script, not an HTTP endpoint
- Decision: Ticket 0058 (M05, Work-Item Catalogue & Disposition) does not
  expose a `POST /catalogue/import` HTTP route. The 1,308-row bulk import
  is a CLI script (`backend/src/scripts/import-catalogue.ts`, `npm run
  import:catalogue`) that reads `docs/catalogue/source-catalogue.json`
  and `docs/catalogue/disposition-workbook.csv` from disk and writes via
  the service-role Supabase client. `source_work_items` and
  `work_item_definitions` have no authenticated INSERT policy — only
  this script and migrations can create rows; authenticated users can
  only UPDATE an existing `work_item_definitions` row's normalized
  fields (disposition/priority/risk/etc.), gated on
  `catalogue.workitem.manage`.
- Why: there's no file-upload UI yet (Phase 2 is backend-only), and
  1,308 rows of raw+normalized fields as one JSON HTTP body has no real
  caller in this phase. Same "admin operation via service-role, not
  self-service API" precedent as ticket 0055's tenant creation and
  ticket 0056's first role assignment.
- Approved by: agent (ticket 0058, internal API design — CLAUDE.md
  "Internal API design, DB schema details" is explicitly agent-decidable).

## 2026-10-15 14:30 UTC - M06 split into four sequential sub-tickets; workflow tables use NOT NULL tenant_id (unlike M03/M05's shared catalogues)
- Decision: Ticket 0059 (M06 — Configuration Studio & Workflow Engine)
  is closed with no code of its own and split into tickets 0060 (M06a,
  definition/version/node/transition/condition CRUD + publish/rollback
  lifecycle), 0061 (M06b, validation + simulation), 0062 (M06c, runtime/
  instance engine) and 0063 (M06d, migration of active instances to a
  newer version). Each depends on the one before it. Separately:
  `workflow_definitions`/`workflow_versions`/`workflow_nodes`/
  `workflow_transitions`/`workflow_conditions` and the governance tables
  (`configuration_changes`, `configuration_approvals`,
  `published_configurations`, `configuration_rollback_events`) use a
  plain **NOT NULL** `tenant_id`, the same isolation pattern as
  `companies`/`branches`/`projects` — not the nullable-tenant
  shared-catalogue pattern used for `role_definitions` (ticket 0056) and
  the work-item catalogue tables (ticket 0058).
- Why: ticket 0059 itself said this was too large for one ticket and
  that the architect should split it, same as M01-M03 were separate
  tickets rather than one Phase-1 ticket. On the tenant_id question —
  `role_definitions` and the work-item catalogue are shared taxonomies
  (BRD §6.3: the same 44 canonical roles and the same 1,308-row
  catalogue apply to every tenant; a NULL row is the one shared
  platform-wide copy). A workflow definition is the opposite: BRD
  §5.4.1 item 3 describes workflow configuration as each company's own
  steps/branching/assignments/forms — there is no single shared
  "the" material-request workflow every tenant must use identically.
  Making it NOT NULL from the start avoids having to migrate a nullable
  column to NOT NULL later once real tenant-specific workflows exist,
  and matches the ordinary tenant-scoped pattern every non-catalogue
  table in this project already uses.
- Approved by: agent (ticket classification/ordering and DB schema
  details are both explicitly agent-decidable per CLAUDE.md).

## 2026-10-15 21:05 UTC - M07 split into three sequential sub-tickets; reuses workflow_step_instances as the task record
- Decision: Ticket 0065 (M07 — Tasks, My Work & Work Queues) is closed
  with no code of its own and split into tickets 0070 (M07a — task
  metadata: owner/reviewer/due date/priority/blocked-reason columns on
  `workflow_step_instances`, plus a new `task_comments` table and a
  nullable evidence FK on `file_objects`), 0071 (M07b — the seven
  BRD-named queue views: My Work/Team Work/Due Soon/Overdue/Blocked/
  Waiting Approval/Completed, read-only queries/routes) and 0072 (M07c
  — reassignment/delegation, audited). Each depends on the one before
  it. None of the three create a second task table — all build on
  `workflow_step_instances`, the table ticket 0062 (M06c) already
  documented as the hand-off seam for this module.
- Why: BRD §8.3 is only five requirements (FR-TASK-001 through 005) but
  touches a lot of surface (seven distinct queue views, a new blocking/
  comment/evidence mechanism, reassignment audit) — same "too large for
  one ticket" shape ticket 0059 (M06) hit, same fix (split along natural
  seams: schema first, then the read-only views that depend on that
  schema, then the mutation/audit actions). Confirmed via ticket 0062's
  Progress note and `WorkflowStepInstance.assigned_to`'s doc comment
  that the task record already exists (a `workflow_step_instances` row
  with `status='waiting'` and a human-handoff `node_type`) — building a
  parallel `tasks` table would duplicate that and fork the two systems'
  status semantics.
- Approved by: agent (ticket classification/ordering and DB schema
  details are both explicitly agent-decidable per CLAUDE.md).

## 2026-10-15 20:37 UTC - M07b "Team Work" defaults to tenant-wide, not department/reporting-line scoped
- Decision: Ticket 0071's Team Work queue (and the other five
  permission-gated views — Due Soon/Overdue/Blocked/Waiting Approval/
  Completed) show every open/completed task in the caller's tenant,
  gated on a new `workflow.task.view_team` permission, not a
  department- or reporting-line-scoped subset. Ticket 0071 itself
  specified this default explicitly rather than leaving it to the
  architect to invent.
- Why: BRD §8.3/PRD don't define what "team" means (department? direct
  reports? project?), and inventing an authority-limit-shaped answer
  would violate the standing rule that AI agents must not invent
  approval/authority scoping. Tenant-wide is the one boundary that's
  already unambiguous (every table in this module is tenant-scoped by
  RLS) and the cheapest to narrow later — a department-scoped filter
  is an additive query param on the existing `listTaskQueue` read path,
  not a schema or permission change, once a future PRD session defines
  "team" for real.
- Approved by: agent (ticket 0071 — internal API design/DB-adjacent
  scoping detail, explicitly agent-decidable per CLAUDE.md; recorded
  here per the ticket's own instruction to document the default
  explicitly rather than let it pass silently).

## 2026-10-15 22:50 UTC - M07c task "delegation" is a reassignment with a different event type, not a second temporal entity
- Decision: Ticket 0072's `delegateTask` is mechanically identical to
  `reassignTask` (same open-step guard, same cross-tenant target
  check, same `assigned_to` update) and differs only in writing a
  `task_delegated` workflow_events row instead of `task_reassigned`.
  No new `task_delegations` table with its own `valid_from`/`valid_to`
  window (unlike ticket 0056's authority `delegations` table) was
  built.
- Why: BRD §8.3 FR-TASK-005 only requires reassignment/delegation to
  be audited — it doesn't ask for delegations to auto-expire and
  revert the way authority delegations do. Building a time-bound
  entity speculatively, with no requirement driving its expiry
  semantics, would be inventing scope the BRD doesn't ask for.
- Approved by: agent (ticket 0072 explicitly called this out as a
  scope decision to record, same weight as the M06 tenant_id/nullable
  calls).

## 2026-10-15 21:17 UTC - M08 approval chains: explicit approverUserIds (not role-resolved), any rejection short-circuits the whole chain, revocation never rewinds already-advanced workflow progress
- Decision: Ticket 0066 (M08 — Approvals & Delegation) built FR-APP-
  001..006 as a layer on top of ticket 0062's `request_approval`
  step/`workflow_step_instances` seam, with three scope calls: (1) a
  chain's approvers (`config.approverUserIds` on the `request_approval`
  node) are an explicit list of user ids, not role ids resolved to
  "whoever holds that role" — no such resolution mechanism exists
  anywhere in this codebase yet, so inventing one here would be scope
  creep beyond what FR-APP-001 asks for; (2) a rejection or
  return-for-correction from any single approver immediately resolves
  the whole chain (sequential or parallel) rather than waiting out the
  remaining approvers' decisions; (3) revoking a decision
  (FR-APP-006's compensating process) on a step that's already
  completed and whose workflow instance has already advanced past it
  only corrects the audit trail — it does not rewind the instance's
  subsequent progress. Revoking a decision on a still-open step does
  functionally re-open that approver's turn (the revoked decision is
  excluded when recomputing the chain's outcome), since that's a
  natural, low-risk consequence of "this decision no longer counts,"
  not a rewind of anything that already happened downstream.
- Why: (1) matches ticket 0056's own unresolved state — role-based
  task assignment (`assigned_to` holding a role id) already exists
  for the single-approver case but nothing anywhere resolves "which
  real users hold this role," so a multi-approver chain needing exact
  "has everyone decided yet" bookkeeping cannot rely on a mechanism
  that doesn't exist. (2) BRD §8.3 doesn't specify what happens when
  one approver in a chain rejects while others are still pending;
  short-circuiting is the conservative default (never silently let a
  request advance past a rejection) and symmetric with how ticket
  0062's FR-WI-010 gate already treats a blocked evidence/approval
  step as blocking by default. (3) Reversing already-advanced workflow
  execution (undoing whatever domain action a subsequent step already
  took) is a different, much larger problem than "record that this
  approval is no longer valid" — building that speculatively here
  would be the same kind of unrequested-machinery risk ticket 0072
  flagged for task delegation.
- Approved by: agent (ticket 0066 — internal API design/DB schema
  details, explicitly agent-decidable per CLAUDE.md; recorded here at
  the same weight as the M06/M07 scope calls per this project's own
  precedent for real scope decisions, not just implementation detail).

## 2026-10-16 00:30 UTC - M09 split into five sub-tickets (0073-0077), one shared register table for FR-PROJ-005, no AI health score
- Decision: Ticket 0067 (M09 — Project & Portfolio Management) is
  closed with no code, split the same way ticket 0059 (M06) and
  ticket 0065 (M07) were split: 0073 (M09a — project register &
  setup, extends ticket 0055's M02 stub `projects` table in place,
  FR-PROJ-001/002), 0074 (M09b — WBS/milestones/schedule activities/
  dependencies/progress, FR-PROJ-003), 0075 (M09c — baseline
  snapshots and approval-gated baseline-change control via the M08
  `request_approval` seam, FR-PROJ-004), 0076 (M09d — issue/risk/
  decision/assumption/dependency/change-request register,
  FR-PROJ-005), 0077 (M09e — health/forecast-vs-baseline/closeout
  checklist, FR-PROJ-006/007/008). Two scope calls recorded within
  that split: (1) ticket 0076's six FR-PROJ-005 categories
  (issue/risk/decision/assumption/dependency/change_request) share
  one `project_register_entries` table with a `kind` enum, not six
  separate tables — they share the same shape (title, description,
  status, owner, due date) and BRD only asks that each be "tracked,"
  not that they be structurally distinct entities; (2) ticket 0077's
  health endpoint computes and stores which recorded factors (overdue
  activities, open register entries, baseline status) fed its summary
  and never produces a bare AI/ML score, per FR-PROJ-006's explicit
  "never display an unexplained AI score as fact," and forecast vs.
  baseline are always returned as two distinct labelled fields, never
  merged, per FR-PROJ-007.
- Why: same "too large for one ticket" shape M06/M07 hit — BRD §8.4
  is eight requirements spanning register/setup, a real WBS/schedule
  model, approval-gated baselining, a multi-category tracking
  register and a health/forecast/closeout surface, each with its own
  natural seam and most with their own dependency ordering (0074
  needs 0073's project row; 0075 needs 0074's WBS to baseline and
  M08's approval chain; 0077 needs 0074's schedule data and 0075's
  approved baseline). The register-table consolidation in (1) follows
  the same "don't invent per-category tables BRD didn't ask for"
  principle ticket 0072 used for task delegation. The no-AI-score
  rule in (2) is not a new policy — it is FR-PROJ-006's literal text,
  restated here because a later session building 0077 could otherwise
  default to "just compute a 0-100 health score," which the BRD
  explicitly forbids.
- Correcting a process gap: the session that filed tickets 0073-0075
  (commit 03fc91f, 2026-10-15 21:22 UTC) did the actual split but
  left ticket 0067 at `status: next` and wrote no DECISIONS.md entry
  or daily-log entry for it — `tickets.py next` kept surfacing 0067
  as if unsplit. This entry and ticket 0067's Progress note close
  that gap; sub-tickets 0073-0075's content was reviewed and kept
  as-is (it matches this project's established M09 scope), only 0076
  and 0077 were newly filed.
- Approved by: agent (ticket classification/ordering and DB schema
  details are both explicitly agent-decidable per CLAUDE.md).

## 2026-10-16 01:26 UTC - M09c baseline changes: caller names an explicit published workflow definitionId, no auto-resolution; proposed snapshot is caller-supplied, never auto-computed; outcome is read back by polling the linked workflow instance's step output, not a new callback/event mechanism
- Decision: Ticket 0075 (M09c — baseline snapshots & baseline-change
  control) built FR-PROJ-004 as a thin layer on top of ticket 0066's
  `request_approval`/workflow-instance seam, with three scope calls:
  (1) `proposeBaselineChange` takes an explicit `definitionId` for an
  already-published approval workflow from the caller — there is no
  "the baseline-change-approval workflow for this tenant" lookup
  mechanism anywhere in this codebase, so this module does not invent
  one, same "no resolution magic, caller names it explicitly" spirit
  as ticket 0066's `approverUserIds`; (2) the proposer supplies
  `proposedSnapshot` directly in the request — it is never
  auto-computed from the project's current live WBS/milestone/budget
  state, because proposing a baseline change is explicitly proposing a
  *different* state than what is live today (auto-computing it from
  live state would silently propose "no change"); (3) since this
  codebase has no event bus or webhook mechanism, a change request's
  resolution is read back on demand by inspecting its linked workflow
  instance's step instances for the one whose `output.decision` key is
  set (only a resolved `request_approval` step's `completeStepInstance`
  call ever writes that key) — `GET /baseline-change-requests/:id`
  re-runs this check on every read and is idempotent once the request
  leaves `pending`, rather than building a new polling/callback table
  or background job.
- Why: (1)/(2) are both the same "don't invent an unrequested
  resolution mechanism" principle this project has applied repeatedly
  (ticket 0066's explicit approver list, ticket 0072's reassignment-
  not-delegation-entity call) — BRD §8.4 FR-PROJ-004 says baseline
  changes need reason/impact-analysis/approval, not that the system
  must guess which workflow or auto-diff the live state. (3) follows
  directly from how ticket 0062's runtime engine already works:
  `completeStepInstance`/`decideApprovalStep` are synchronous, and
  M07's own task queues are documented as polling
  `workflow_step_instances` rather than being pushed to — a baseline
  change request consuming that same seam the same way (read on
  demand) is consistent with the rest of the codebase, not a new
  pattern.
- Approved by: agent (internal API design/DB schema details are both
  explicitly agent-decidable per CLAUDE.md; recorded here at the same
  weight as the M06/M07/M08 scope calls per this project's own
  precedent).

## 2026-10-16 01:39 UTC - M09e closes the M09 split: health/forecast computed from recorded data only, cost forecast out of scope until M21, closeout completion is its own permission, and a cross-tenant write risk was found and guarded
- Decision: Ticket 0077 (M09e — project health, forecast-vs-baseline &
  closeout checklist, the fifth and last M09 sub-ticket) built
  FR-PROJ-006/007/008 with four scope calls: (1) `computeProjectHealth`
  derives `factors`/`summary` only from overdue schedule activities,
  overdue/missed milestones, open register-entry counts by kind
  (ticket 0076's table) and current baseline status (ticket 0075's
  table) — no AI/ML call, no numeric score column, ever, per
  FR-PROJ-006's explicit text; (2) `getProjectForecast`'s "forecast"
  is a completion-*date* projection only (naive: latest of each live
  schedule activity's actual-end-or-planned-end) — forecast *cost* is
  out of scope because no cost-actuals tracking exists anywhere in
  this codebase yet (that's M21, Finance, much later); building a
  cost forecast now would mean inventing cost-actual data that
  doesn't exist; (3) completing a closeout checklist item got its own
  new `project.closeout.manage` permission, while the health/
  forecast/closeout-list GETs reuse `tenancy.project.manage` — same
  "narrower administrative action gets its own permission" reasoning
  ticket 0075 used for `project.baseline.manage` vs. general project
  setup; (4) while implementing `listCloseoutChecklist`'s "auto-create
  the four fixed items as pending if missing" convenience, found that
  a GET with a project id outside the caller's tenant would otherwise
  have silently created `project_closeout_checklists` rows under the
  caller's own tenant that reference another tenant's project (the
  FK only checks the project id exists, not that it belongs to the
  caller — RLS's `tenant_id = current_tenant_id()` default stops
  cross-tenant *reads* but not this kind of cross-tenant-referencing
  *write* triggered by a plain read). Fixed by adding an explicit
  `getProject` ownership check before any closeout write in this
  ticket's own two functions (`listCloseoutChecklist`,
  `completeCloseoutItem`), which already throws `NotFoundError` for a
  project outside the caller's tenant.
- Why: (1)/(2) are FR-PROJ-006/007's literal text plus the standing
  "don't invent unrequested machinery" principle (same one ticket
  0072 used for task delegation, ticket 0075 used for baseline-change
  resolution) — there is no cost-actuals entity to forecast from, so
  inventing one here would be scope creep disconnected from any real
  data. (3) is the same weight-of-action reasoning already applied
  twice in this module (tickets 0074/0075) rather than a new policy.
  (4) is flagged because it's a real, if narrow, data-integrity gap
  this ticket's own new code could have introduced (not one that
  existed before it) — earlier M09 create-paths (WBS nodes,
  milestones, register entries) take an explicit project_id from an
  explicit POST the caller chose to make, whereas this ticket's
  checklist-list function performs a write as an implicit side effect
  of a GET, which is a meaningfully higher bar for "don't do this by
  accident." The same unguarded-project_id pattern on the older
  explicit-POST paths is a pre-existing gap, out of this ticket's
  scope to fix, but worth a future ticket if it's ever load-bearing
  (e.g. once cross-tenant project-sharing becomes a real feature
  request that would make the FK-only check actively wrong instead of
  just imprecise).
- Approved by: agent (ticket classification/ordering, internal API
  design and DB schema details are all explicitly agent-decidable per
  CLAUDE.md; recorded here at the same weight as the M06-M09 scope
  calls per this project's own precedent, and because (4) is a
  security-adjacent data-integrity finding worth a paper trail even
  though it was agent-decidable to just fix it inline).
