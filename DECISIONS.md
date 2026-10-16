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

## 2026-10-16 01:52 UTC - M35 split into three sub-tickets (0078-0080); found auth_audit_log has no tenant-wide admin read path at all
- Decision: Ticket 0068 (M35 — Audit, Security, Privacy & Retention)
  is closed with no code of its own and split, same pattern as
  tickets 0059/0065/0067: 0078 (M35a — unified read surface merging
  `auth_audit_log`/`configuration_changes`/`workflow_events`/
  `approval_decisions`+`approval_revocations` into one
  permission-gated `GET /audit/log`, plus fixing the one concrete gap
  found during the survey), 0079 (M35b — retention policy & legal
  hold, a framework with zero invented default values — every
  `retention_policies` row requires an explicit, caller-supplied
  period), 0080 (M35c — data export/deletion, approval-gated through
  the existing M08 `request_approval` seam, with its deletion-
  execution half left `blocked` pending an owner decision on which
  entity types are in scope and hard-delete vs. anonymize — logged as
  that ticket's own `## Needs approval` question, not guessed).
- Why: BRD §8.11 gives exactly two testable requirements for this
  module (FR-AUD-001/002); everything else attributed to M35 comes
  from the PRD's one-line module-row prose ("encryption... retention
  rules, legal hold, data export/deletion policy, incident handling,
  backup/restore tests"), which is not a specification — building
  retention periods or a deletion policy's exact scope from that prose
  alone would mean inventing production data-handling policy, which
  CLAUDE.md's standing rule forbids ("AI agents must not invent...
  SLA values, approval policies or production data"). Splitting lets
  the one FR-backed, fully-specifiable piece (0078) proceed without
  waiting on an owner answer, same reasoning ticket 0080 itself uses
  to stay `next`-in-substance on its non-deletion half despite being
  formally `blocked`.
- Separately, the survey (done while filing 0078) found
  `auth_audit_log` (ticket 0054) has no `tenant_id` column and its
  only RLS policy is `auth.uid() = user_id` — a user can read their
  own login/session history and nobody else can, including a platform
  administrator. This is not a new ticket on its own; ticket 0078
  fixes it as part of building the unified read surface (a
  service-role-backed admin path gated on a new `audit.log.view`
  permission, not a loosened RLS policy that would let any tenant
  member read anyone's login history).
- Approved by: agent (ticket classification/ordering is explicitly
  agent-decidable per CLAUDE.md; recorded here at the same weight as
  the M06/M07/M09 split entries, and because the auth_audit_log
  finding is a security-relevant gap worth a paper trail).

## 2026-10-16 01:52 UTC - M31 split into three sub-tickets (0081-0083); workflow runtime already declares escalation/notification event types nothing emits yet
- Decision: Ticket 0069 (M31 — Notifications, SLA & Escalations) is
  closed with no code of its own and split, same pattern as tickets
  0059/0065/0067/0068: 0081 (M31a — SLA definitions, escalation
  ladders and the runtime that starts actually emitting the
  already-declared-but-unused `timer_fired`/`escalated`
  `workflow_events`), 0082 (M31b — notification delivery core: a new
  `notifications`/`notification_templates` pair, dedup, retry/
  delivery-status bookkeeping, in-app read API — email-provider
  selection carved out as its own owner-approval question *if and
  when* that half is reached, so it doesn't block the dispatcher/
  dedup/retry logic, which has no such dependency), 0083 (M31c —
  per-user preferences, quiet hours, digest batching, ordered last
  because it has nothing to attach to until 0082's `notifications`
  table exists).
- Why: BRD §8.11 gives two testable requirements (FR-NOT-001/002:
  dedup+traceable, delivery-visible+retried); the rest of M31's scope
  comes from the PRD's one-line module-row prose (templates, digest,
  SLA timers, escalation ladders, quiet hours, preference management),
  which is broad enough that building it as one ticket would either
  take one session far too long or force guessing at scope boundaries
  a later session would have to undo. Splitting by what each piece
  depends on (SLA/escalation runtime -> delivery core -> preferences)
  lets each sub-ticket be built and tested independently, same
  reasoning as every prior module split.
- Separately, the survey (done while filing 0081) found that
  `workflow_nodes`' node-type enum and `workflow_events`'
  `WORKFLOW_EVENT_TYPES` already declare `escalate`/`send_notification`
  node types and `escalated`/`timer_fired`/`notification_sent` event
  types (from ticket 0060/0062, M06a/M06c) — declared in the type
  system, but no runtime code path emits or handles any of them today.
  This is not a bug in those tickets (M06 was explicitly scoped to the
  generic workflow engine, not to any one node type's business
  behaviour) but it does mean M31a/b are "finish wiring up a node type
  that was always meant to exist" rather than inventing one from
  scratch.
- Approved by: agent (ticket classification/ordering and internal
  API/data-model design are explicitly agent-decidable per CLAUDE.md,
  same weight as every prior M06/M07/M09/M35 split).

## 2026-10-16 07:41 GST - Answered: ticket #80 "M35c — Data export & deletion policy": Which entity types are in scope for real data deletion, and hard-delete or anonymize?
- Question: 2026-10-16 01:52 UTC — Which entity types are in scope for real data deletion, and hard-delete or anonymize?
- Answer: Choose whichever you recommend and that's good approach for this application
- Approved by: lee-coarasco (via AppYard dashboard)

> The PRD names this module's purpose as "data export/deletion policy"
> with no further detail, and CLAUDE.md is explicit that AI agents must
> not invent production data-handling policy. Before building the
> deletion-execution half (export is unambiguous and will be built
> regardless), I need:
> 1. Which entity types a deletion request can actually target —
>    starting candidates: `app_users` (a person's own account/PII),
>    or is this narrower (e.g. just HR records once M04/M24 exist)?
> 2. Hard-delete (row removed) or anonymize-in-place (PII fields
>    scrubbed, row and its audit trail survive)? BRD §6.1 elsewhere says
>    "never silently delete audit-relevant records" (the same rule
>    `banAuthUser`'s 100-year-ban workaround in ticket 0054 already
>    follows) — anonymize-in-place is my default recommendation for
>    that reason, but the owner should confirm since "right to erasure"
>    style requests sometimes require true removal.
> Recommendation: anonymize-in-place, scoped to `app_users` only for
> this first build, expand to other entity types in a later ticket once
> real categories of sensitive data (HR/legal/financial, per the PRD
> module row) actually exist as entities in this codebase.

## 2026-10-16 06:04 UTC - Frontend framework and hosting decided: Vite + React + TypeScript, Tailwind, Supabase JS client direct from browser, Vercel preview hosting
- Decision: This was deferred three times without ever being picked
  up — ticket 0053 (Phase 1 scaffold) deferred it "to a Phase 2 ticket
  when there's something to render/deploy"; `docs/PRD.md` §3 open
  question 5 said "architect to propose in NEEDS_APPROVAL.md during
  Phase 1"; neither Phase 1 nor Phase 2 ever filed that ticket, and
  the owner noticed via ticket 0084 ("so far only backend is
  created"). Deciding now rather than deferring again: **Vite + React
  18 + TypeScript** for the frontend build tool/framework, **Tailwind
  CSS** for styling (no heavy component library yet — add one only
  once a second/third screen shows real duplication), **React Router**
  for client routing, and the **`@supabase/supabase-js` client used
  directly from the browser with the anon key** for sign-in/sign-out
  (matches CLAUDE.md's "Auth | Supabase Auth | JWT-based" row — the
  backend has no password/session endpoints of its own, by design;
  `identity/routes.ts` only has sign-out/accept-invite/mfa-enroll/
  audit-log, confirmed by reading it). The resulting Supabase session
  JWT is sent as a bearer token to the Node/Fastify backend for every
  API call, which is what every existing route (e.g.
  `GET /tenancy/companies`) already expects. **Hosting: Vercel** for
  frontend preview deploys (devops-decidable per CLAUDE.md, zero
  committed cost at preview-deploy volume; production deploy still
  requires owner approval same as everything else under "Production
  deploys").
- Why: React was already the CLAUDE.md-stated preference ("React-based
  preferred but not locked"); Vite over Next.js because this frontend
  is a pure SPA against a separate REST API with no server-rendering
  requirement anywhere in the BRD/PRD, so Next.js's SSR machinery
  would be unused weight. Supabase-direct-from-browser (rather than
  proxying auth through the backend) avoids inventing a second,
  parallel auth mechanism the backend doesn't have — same
  "don't build unrequested machinery" principle used repeatedly in
  this project's M06-M09 decisions.
- Approved by: agent (CLAUDE.md lists "Frontend framework (architect
  proposes)" and "hosting target (architect proposes)" explicitly
  under what needs no owner approval; recorded here, not in
  NEEDS_APPROVAL.md, because it is agent-decidable, same weight as
  the Fastify framework choice in ticket 0053).

## 2026-10-16 07:10 UTC - M02/M03 list endpoints (ticket 0088) are self-service reads, no permission gate; role-assignment listing has no company filter
- Decision: The four new GET endpoints ticket 0088 asked for —
  `/tenancy/branches?companyId=`, `/authority/departments?companyId=`,
  `/authority/roles`, `/authority/role-assignments?userId=` — require
  only a valid bearer session, not a `*.manage` permission. Ticket 0088
  explicitly left this as a judgment call ("a lighter read-scoped
  permission — architect/backend-engineer judgment call"). Matched to
  the precedent `GET /tenancy/companies` already set (no
  `requirePermission` on that route either) and
  `GET /authority/effective-permissions`'s "self-service, own session is
  enough" reasoning. `listRoleDefinitions` goes through the user-scoped
  Supabase client so `role_definitions_select`'s RLS policy (tenant_id is
  null or = current tenant) does the platform-vs-tenant filtering for
  free, same pattern as every other read in this module. Separately,
  `listRoleAssignments` filters only by `userId`, not `companyId` —
  `role_assignments` has no `company_id` column (only `department_id`,
  and a department belongs to a company, not vice versa via the
  assignment row), so a company filter would require joining through
  `department_definitions`; ticket 0088 flagged company-or-user as "makes
  sense once you've read how role_assignments rows are stored," and the
  simpler, schema-true answer is user-id-or-nothing (nothing returns
  every assignment in the caller's tenant).
- Why: avoids inventing a new "read" permission tier with no caller yet
  that needs it gated tighter than self-service (same
  "don't build unrequested machinery" principle used throughout
  M06-M09's decisions), and avoids a cross-table join that the ticket
  didn't ask for and the schema doesn't support directly.
- Approved by: agent (ticket 0088 — internal API design, explicitly
  agent-decidable per CLAUDE.md; recorded here because the ticket itself
  flagged this as a decision worth documenting, not just an
  implementation detail).

## 2026-10-16 07:10 UTC - Ticket 0087's UI pages switched from session-only lists to the real list endpoints, including a role-id select populated from GET /authority/roles
- Decision: Updated `frontend/src/pages/OrgSetupPage.tsx` and
  `frontend/src/pages/DepartmentsRolesPage.tsx` (built in ticket 0087)
  to fetch real data from ticket 0088's new endpoints instead of only
  showing what was created in the current browser tab: branches now
  refetch per selected company from `GET /tenancy/branches`,
  departments from `GET /authority/departments`, and role assignments
  from `GET /authority/role-assignments` (tenant-wide, no company
  filter — matches the decision above). The role-assignment form's
  free-text "Role id" input became a `<select>` populated from
  `GET /authority/roles`, and a department `<select>` populated from the
  selected company's departments replaced the free-text department-id
  input, since both lists now exist to populate pickers from.
- Why: ticket 0088's own "out of scope" section pre-approved this as a
  "tiny addendum" to do inline rather than opening a third ticket,
  explicitly calling out that the role picker was blocked only by the
  missing list endpoint. Done in the same session since the backend
  change was small and the UI follow-up was the whole reason the
  backend ticket existed.
- Approved by: agent (ticket 0088's own text pre-authorized this
  follow-up without a new ticket; UI component structure is
  agent-decidable per CLAUDE.md).

## 2026-10-16 07:40 UTC - M35b (ticket 0079) extends the existing audit module rather than a new one; retention/legal-hold endpoints follow the accessToken/RLS convention, not audit/log's service-role convention
- Decision: Ticket 0079's `retention_policies`/`legal_holds` tables and
  their routes were added to the existing `backend/src/modules/audit`
  module (types/repository/service/routes), not a new module, since
  M35b is the same BRD module as M35a (ticket 0078). Within that
  module, the new methods (`createRetentionPolicy`,
  `listRetentionPolicies`, `placeLegalHold`, `releaseLegalHold`,
  `listLegalHolds`, `getLegalHold`) use the ordinary
  accessToken + user-scoped-client convention every other tenant-
  scoped-RLS table in this codebase uses (tenancy, authority) —
  deliberately not the service-role + explicit-tenantId convention
  `listAuditLogEntries` uses, which exists only because that one method
  merges reads across tables with inconsistent/narrower RLS policies
  (`auth_audit_log` in particular). `retention_policies`/`legal_holds`
  are plain single-table, fully-RLS'd tenant data with no such
  conflict, so there was no reason to bypass RLS for them.
- Why: avoids forking the audit module into two unrelated access
  patterns for no reason, and avoids inventing a reason to go
  service-role where ordinary RLS already does the job — same
  "don't build unrequested machinery" principle used throughout
  M06-M09's decisions.
- Approved by: agent (ticket 0079 — internal API design/module
  structure, explicitly agent-decidable per CLAUDE.md).

## 2026-10-16 08:05 UTC - M31b (ticket 0082): no email provider wired, built with a stub sender behind an interface; not raised as a blocking Needs-approval question
- Decision: Built the full notification dispatch/dedup/retry core
  (migration, module, routes, tests) with email delivery going through
  an injected `NotificationSender` interface whose production default
  is a no-op/stub — no real transactional email provider was chosen or
  wired in. Ticket 0082 itself said to ask the owner before wiring a
  live sender if a paid provider becomes necessary, but also said not
  to block the rest of the ticket on that question. Since every
  acceptance box in the ticket (tables/RLS, dedup, retry bookkeeping,
  in-app read API, tests with no live network call) is satisfiable
  with a stub sender, no question was actually reached — so this was
  recorded here as an open follow-on rather than filed as a `##
  Needs approval` block, which would have forced the ticket to
  `status: blocked` under `tickets/README.md`'s rule even though
  nothing in it is actually waiting on an answer.
- Why: CLAUDE.md requires owner sign-off before adopting a new paid
  service, but an unchosen provider isn't yet a decision to make — it's
  a decision to make later, when a real sender is needed. Blocking a
  fully-buildable, fully-testable ticket on a question nobody needs
  answered yet would be the same kind of unrequested caution ticket
  0080 avoided by building its export half unblocked.
- Approved by: agent (ticket 0082 — internal API design, explicitly
  agent-decidable per CLAUDE.md; recorded here because it's a direct
  reading of the ticket's own conditional instruction, not just an
  implementation detail).

## 2026-10-16 07:11 UTC - M31c (ticket 0083): `urgent` added as the single explicit urgency flag on dispatchNotification; `notification.preferences.manage` granted to every role, not just platform_administrator; digest batching releases the whole waiting group together rather than merging into one message body
- Decision: Three scoping calls while building ticket 0083's
  preferences/quiet-hours/digest layer, each diverging slightly from
  the ticket's own text as filed:
  1. The ticket assumed "whatever priority/severity field 0082's
     notifications already carry" could decide urgency. Ticket 0082's
     `notifications` table has no such field. Added `urgent?: boolean`
     as an explicit, caller-named parameter to `dispatchNotification`
     (default false) — the single urgency concept, not a second one
     layered on an existing field, since none existed.
  2. Every permission added by M06-M31 so far is deny-by-default,
     granted only to `role.platform_administrator`. `notification.
     preferences.manage` is different in kind: it gates a basic
     self-service action (manage your own notification settings) that
     every user should have, not an administrative one. Granted it to
     every row in `role_definitions` instead. RLS (`user_id =
     auth.uid()`), not the permission, is what actually prevents
     targeting another user.
  3. The ticket's "one delivery per user per interval" for digest
     batching was built as "release the whole waiting group together
     in one pass, gated by the interval" (one shared
     `last_digest_released_at` update) rather than merging every
     member notification's body into a single combined message —
     true body-merging would need a dedicated digest template/render
     step this ticket had no concrete requirement to invent.
- Why: (1)/(3) follow CLAUDE.md's "do not invent unrequested
  machinery" / "no invented defaults" principle applied to a case the
  ticket's own survey text got slightly wrong once the code was
  actually read; (2) follows the same principle in the other
  direction — deny-by-default is for administrative actions, and
  denying a basic self-service feature to every role by default would
  just be unrequested friction with no security benefit, since RLS
  already does the real access control.
- Approved by: agent (ticket 0083 — internal API/permission design,
  explicitly agent-decidable per CLAUDE.md; recorded here because each
  point is a divergence from the ticket's own filed text, not just an
  implementation detail).

## 2026-10-16 07:15 UTC - M35c (ticket 0080): real deletion execution scoped to `app_users` only, anonymize-in-place rather than hard-delete
- Decision: Ticket 0080 asked the owner which entity types are in
  scope for real data deletion and whether deletion means hard-delete
  or anonymize-in-place. The owner's answer (logged in the ticket) was
  to defer to the agent's recommendation. Recommendation adopted:
  (1) only `app_users` rows are in scope for the real deletion path —
  it is the one table that holds the kind of personal data a "right
  to erasure"-style request is actually about, and it is the only
  entity type this ticket's own export-half text names as a concrete
  example alongside `role_assignments`/`auth_audit_log` (which are
  linkage/history, not the subject of erasure). Any other entity type
  stays out of scope, per the ticket's own "Out of scope" line, until a
  future ticket asks the owner about it by name. (2) Deletion means
  anonymize-in-place, not hard-delete: `app_users.id` is referenced by
  `on delete` default-restrict foreign keys from ~49 columns across
  nearly every module built so far (role_assignments, workflow
  instances, approvals, baselines, tasks, audit rows...) — a hard
  delete would either fail outright or require cascading through
  history/audit tables the BRD explicitly protects (§6.1: "never
  silently delete audit-relevant records"). Anonymizing scrubs
  `email`/`display_name` and forces `status='deactivated'` while
  keeping the row (and therefore every foreign key into it) intact,
  mirroring the existing `deactivateAppUser` soft-deactivation already
  built for M01 (ticket 0054).
- Why: matches CLAUDE.md's "AI agents must not invent... production
  data" read the other way around — the safe default when the owner
  defers to the agent is the one that cannot destroy referential
  integrity or audit history across modules this project has already
  built and tested, not the one that happens to satisfy the ticket
  text most literally. A hard delete of `app_users` is the single
  hardest-to-reverse action available in this schema today.
- Approved by: owner (ticket 0080, 2026-10-16 07:41 GST, "choose
  whichever you recommend") — the scope/mechanism judgment itself is
  the agent's recommendation made under that delegation, recorded here
  per CLAUDE.md's rule that owner approvals affecting data deletion are
  documented in DECISIONS.md.

## 2026-10-16 08:05 UTC - Phase 4 opened: M10 (Client, CRM & Sales Pipeline) filed and split into tickets 0090/0091/0092
- Decision: Phase 3 (M04/M07/M08/M09/M35/M31) is now fully `testing`
  (ticket 0080 closed out M35). Per `docs/PRD.md`'s build-order table,
  the next module is M10, first in Phase 4. Filed parent ticket 0089,
  surveyed the schema (no CRM-shaped table exists yet — additive, not
  a rename of an existing one), and split it the same way every prior
  module (M06/M07/M09/M31/M35) was split: 0090 (M10a — Client/Contact/
  Lead/Opportunity core model, FR-CRM-001/002), 0091 (M10b — site
  visits, tender deadline tracking, client communication log,
  FR-CRM-003), 0092 (M10c — pipeline forecast reporting and the
  won-opportunity handover checklist gate, FR-CRM-004, reusing the
  M08 `request_approval` seam for its "authorized exception" path
  rather than inventing a second approval mechanism). Explicitly
  scoped Tender/Bid/Estimate/EstimateLine (also listed in BRD §6.2's
  entity list) out of all three — those belong to M11 (Tendering,
  Estimation & Commercials) per the module table and FR-BID-001/
  FR-EST-00x, so M10 only tracks the tender *deadline* ("tender
  calendar"), never the tender document or the bid/no-bid decision
  itself. No sub-ticket auto-creates a `projects` row on handover —
  FR-CRM-004 only requires the checklist gate, not an automatic
  project-creation pipeline nothing asked for.
- Why: same "don't build unrequested machinery," "reuse the existing
  approval seam," and "survey before designing a new mechanism"
  principles used throughout every M06-M10 decision so far; keeps M10
  from drifting into M11's (tendering/estimation) or M09's (project
  creation) scope.
- Approved by: agent (ticket classification/ordering and internal
  data-model split are explicitly agent-decidable per CLAUDE.md, same
  weight as every prior module split recorded here).

## 2026-10-16 11:40 UTC - M10a (ticket 0090): one `opportunities` table, not separate `leads`/`opportunities`
- Decision: BRD §6.2 lists `Client, Contact, Lead, Opportunity` as four
  entities, but §10.1's "Opportunity to project" step list and
  FR-CRM-001's single field set (source, client, owner, stage, expected
  value, probability, next action, due date) describe one thing
  progressing through a `stage` enum — a "lead" is just an opportunity
  at the `lead` stage, not a separate record a human promotes into a
  second table. Modeled as one `opportunities` table with
  `stage in ('lead','qualified','site_visit','tender','negotiation',
  'won','lost')`, defaulting new rows to `lead`. The ticket's own text
  explicitly left this choice open ("pick one name and be consistent"),
  so this isn't a scope deviation, just recording the naming call for
  the next session that builds M10b/M10c or M11/M12's later stages on
  top of this enum.
- Why: a second `leads` table would need its own promotion-to-
  opportunity migration step nothing in FR-CRM-001/§10.1 asks for, and
  would duplicate the source/client/owner fields across two tables for
  no behavioral difference.
- Approved by: agent (internal data-model detail, explicitly
  agent-decidable per CLAUDE.md; the ticket text itself delegated the
  naming choice to whoever built it).

## 2026-10-16 11:42 UTC - M10c (ticket 0092): handover checklist/exception routes reuse `crm.lead.manage`, not a new permission
- Decision: the new handover-checklist and handover-exception-request
  endpoints are gated on the existing `crm.lead.manage` permission
  (same as every other CRM route), not a new narrower permission —
  unlike ticket 0077's closeout checklist, which split out its own
  `project.closeout.manage` distinct from the broader
  `tenancy.project.manage`.
- Why: `tenancy.project.manage`/`project.closeout.manage` were already
  two different permissions for two different actor classes (broad
  project administration vs. a narrower closeout action) before ticket
  0077 — splitting closeout out kept that existing narrowing
  consistent. The CRM module (ticket 0090) deliberately has a single
  permission covering its whole surface (clients, contacts,
  opportunities, site visits, tender submissions, communications) for
  the same named Sales/Marketing/Technical owners; handover is part of
  the same opportunity lifecycle those roles already manage day to
  day, so adding a second CRM permission here would be an
  inconsistency with no actor-class boundary behind it, not extra
  safety.
- Also named the four fixed handover-checklist item keys
  (`client_confirmation`, `commercial_terms_locked`,
  `site_information_handed_over`, `technical_owner_assigned`) since the
  ticket named the CLOSEOUT_ITEM_KEYS-style mechanism to reuse but left
  the actual keys open — picked to match BRD §7's "sales-to-technical
  handoff" framing of this module, not BRD §8.4's project-closeout
  checklist (a separate, later gate owned by M09).
- Approved by: agent (internal permission/data-model detail, explicitly
  agent-decidable per CLAUDE.md; same weight as ticket 0077's own
  permission-split decision).

## 2026-10-16 11:44 UTC - Opened M11 (Tendering, Estimation & Commercials), split into three sub-tickets
- Decision: with M10 now entirely `testing` (ticket 0092), filed ticket
  0095 (M11 parent, closed with no code — survey + split only, same
  shape as ticket 0089) and split the build into 0096 (M11a — tender
  document register & scope matrix), 0097 (M11b — estimate versions &
  cost build-up, FR-EST-001/002/003), 0098 (M11c — bid/no-bid decision
  & quote/proposal approval, FR-BID-001). Order follows BRD §10.1 steps
  5-8 exactly (tender documents → estimate → bid/no-bid → proposal
  submission); step 9 onward (negotiation, contract/legal, award) is
  explicitly left to M23, not pulled in here.
- FR-EST-002 (AI-assisted quantity extraction/rate suggestion) is
  scoped down to reserving `source`/`confidence` columns on
  `estimate_lines` for M11b to build later, not an actual AI feature —
  M28/M29 (the AI modules) haven't started, and CLAUDE.md is explicit
  that agents must not invent AI features or authority limits ahead of
  that module existing.
- Why: same dependency-ordered-split precedent as every M06/M07/M09/
  M10/M31/M35 module before it; BRD §10.1's own numbered step list
  gives an unambiguous ordering so there's no new judgment call being
  made about sequence, only about where to draw each sub-ticket's
  boundary.
- Approved by: agent (ticket classification/ordering and internal
  data-model split are explicitly agent-decidable per CLAUDE.md, same
  weight as every prior module split recorded here).

## 2026-10-16 11:55 UTC - M11a (ticket 0096): new `tendering.document.manage` permission, not a reuse of `crm.lead.manage`
- Decision: the tender document register and scope matrix/
  clarification log routes are gated on a new
  `tendering.document.manage` permission, granted to
  `role.platform_administrator`, `role.civil_estimator`,
  `role.mep_estimator`, `role.quantity_surveyor`, `role.cto` and
  `role.cfo` — not a reuse of M10's `crm.lead.manage`.
- Why: `crm.lead.manage` covers one permission for the CRM module's
  single named owner cluster (BRD §7: Sales/Marketing/Technical).
  M11a's named owners (BRD §7 row 437: Estimator; Commercial;
  Technical; Finance) are a genuinely different actor cluster —
  Estimator/Commercial/Finance have no reason to hold a CRM lead/
  opportunity permission, and Sales/Marketing have no reason to manage
  tender documents or clarifications. Reusing `crm.lead.manage` here
  would grant each cluster the other's module surface for no actor-
  class reason, the same kind of inconsistency ticket 0092's decision
  explicitly avoided introducing in the other direction (keeping one
  permission where the actor class is actually the same). Verified the
  role IDs against `docs/canonical-role-map.md`: `role.civil_estimator`
  and `role.mep_estimator` (Estimator/Commercial Manager cluster,
  listed by ticket 0014/0015), `role.quantity_surveyor` (same
  cluster), `role.cto` (Technical) and `role.cfo` (Finance).
- Approved by: agent (internal permission/data-model detail, explicitly
  agent-decidable per CLAUDE.md; same weight as ticket 0090's and
  0092's own permission decisions).

## 2026-10-16 12:00 UTC - M11b (ticket 0097): new `estimating` module; `returned_for_correction` kept as its own estimate status, not collapsed into `draft`
- Decision 1 (module placement): built a new `backend/src/modules/estimating/`
  module rather than folding estimate versions/lines into
  `modules/tendering` (ticket 0096). Routes are gated on the existing
  `tendering.document.manage` permission (no new permission minted),
  but the code lives in its own module.
- Why: ticket 0096's tendering module owns child rows of
  `tender_submissions` itself (document register, clarification log) —
  simple CRUD with no lifecycle of its own. Estimates are a distinct
  lifecycle (versioned, workflow-approved via the request_approval
  seam, with their own child `estimate_lines` and server-computed
  totals) that matches the BRD's own module name split
  ("Tendering, Estimation & Commercials" = M11a tendering + M11b
  estimation + M11c commercials) — ticket 0095's own three-way ticket
  split already treats these as separate concerns. Sharing the
  permission (not the module) keeps ticket 0096's actor-cluster
  reasoning intact without conflating two different code lifecycles
  into one file set.
- Decision 2 (status enum): `estimates.status` includes
  `returned_for_correction` as its own value (not collapsed into
  `draft` on resolve), matching ticket 0066's
  `ApprovalChainDecision` value of the same name and ticket 0075's
  literal pass-through of it onto `project_baseline_change_requests.status`.
  A `returned_for_correction` estimate is treated as editable in place
  (same as `draft`) so the submitter can fix it and resubmit without
  creating a brand new version — ticket 0075 has no equivalent case
  since a rejected/returned baseline *change request* never touches
  the baseline itself, but an estimate version IS the thing being
  approved here, so "returned" has to mean something actionable on
  that same row.
- Approved by: agent (internal module/data-model detail, explicitly
  agent-decidable per CLAUDE.md; same weight as ticket 0096's and
  0092's own decisions).

## 2026-10-16 17:05 UTC - Opened M13 (Documents, Drawings & Records), split into three sub-tickets; M13 built before M12
- Decision: filed ticket 0103 (M13 parent, closed with no code — same
  survey + split shape as ticket 0095) and split the build into 0104
  (M13a — document register & revision control, FR-DOC-001/002), 0105
  (M13b — approval stamps & IFC release gate, FR-DOC-003, reusing the
  M08 `request_approval` seam), 0106 (M13c — transmittals & document
  requests, FR-DOC-004). Built M13 before M12 even though BRD lists
  M12 first — the build-order table has M12 depending on M13 (not the
  reverse), so M13's data model has to exist first.
- Confirmed two existing tables are NOT duplicated by this module:
  ticket 0096's `tender_documents` (a narrower, tender-package-scoped
  register, left as-is) and ticket 0079's `retention_policies`/
  `legal_holds` (already generic by free-text `entity_type`, so M13
  documents reuse them with zero new code — no retention/legal-hold
  work is in scope for 0104/0105/0106).
- OCR/extraction (PRD module-row prose, no BRD FR number) is scoped
  out entirely, same reasoning as every prior AI-dependent item
  (M28/M29 don't exist yet) — and unlike ticket 0097's FR-EST-002
  handling, no placeholder column is reserved either, since nothing in
  this module reads an OCR field yet.
- Why: same dependency-ordered-split precedent as every M06/M07/M09/
  M10/M11/M31/M35 module before it; BRD §8.6's own FR-DOC numbering
  gives an unambiguous scope boundary against M12's FR-ENG numbering,
  so no new judgment call is being made about what belongs in M13
  versus M12.
- Approved by: agent (ticket classification/ordering and internal
  data-model split are explicitly agent-decidable per CLAUDE.md, same
  weight as every prior module split recorded here).

## 2026-10-16 22:20 UTC - Ticket 0109 (M11/M13 frontend): new permission-light `GET /workflow/definitions/published`, and three UI scope narrowings to match what the backend actually exposes
- Decision 1 (backend addition): added `GET /workflow/definitions/published`
  — no permission guard beyond authentication, returns only
  `status: published` definitions' `id`/`key`/`name`/`capability_key`,
  optionally filtered by `?capabilityKey=`. Needed because every
  "submit for approval" button this ticket builds (M11b estimates, M11c
  bid/no-bid, M13b document release) has to let the caller pick a
  `definitionId`, but the existing `GET /workflow/definitions` is gated on
  `workflow.definition.manage`, which only `role.platform_administrator`
  holds by default (ticket 0060's migration) — estimators, document
  controllers, CTO/CFO never held it. Without this, none of those buttons
  could ever list a definition to submit against. Reads are not sensitive
  (name/id of an already-published definition), so no new permission was
  minted either.
- Decision 2 (Estimates tab fields): built the create-estimate-version and
  add-line forms against the real `estimating` module fields (assumptions/
  inclusions/exclusions text + taxes/overheads/contingency/margin
  percentages at the estimate level; item/quantity/unit/rate/costCategory
  per line) rather than ticket 0109's prose ("version label, scope
  summary" / "unit cost, markup %"), which don't exist as columns —
  version numbers are assigned automatically (ticket 0097) and there is no
  per-line markup, only the estimate-level margin.
- Decision 3 (tender submission detail page): `TenderSubmissionDetailPage`
  takes the tender submission id from the URL alone and drives M11a/b/c's
  sub-resources (documents/estimates/bid-decisions), all of which are
  keyed by that id directly. It does not fetch the tender submission's
  own row (deadline/evidence/notes) because no `GET
  /tendering/tender-submissions/:id` (singular) endpoint exists — only
  `GET /crm/opportunities/:id/tender-submissions` (list). The opportunity
  id is passed through as a `?opportunityId=` query param from the link
  on `OpportunityDetailPage` so the back-link works; no backend change was
  made for this since the page doesn't need the submission's own fields to
  function.
- Decision 4 (Supersede button, M13): PATCHes a revision's `status` to
  `superseded` only — does not set `superseded_by_revision_id`, because
  `PATCH /documents/revisions/:revisionId` never accepted that field (only
  the automatic create-revision and resolve-approval flows in
  `documents/service.ts` ever write it). Treated as an intentional scope
  boundary rather than new backend surface: a manual "point this old
  revision at that specific newer one" action isn't something any BRD
  FR-DOC requirement asks for outside the two automatic paths already
  built.
- Approved by: agent (internal API surface + UI scope decisions, all
  additive/non-destructive; explicitly agent-decidable per CLAUDE.md).

## 2026-10-16 22:50 UTC - Ticket 0110 (M06 Configuration Studio UI + M05 catalogue admin UI) split into 0125/0126/0127; `GET /catalogue/work-items` gains a joined summary shape and a working `search` filter
- Decision: Ticket 0110 is closed with no code of its own, split the
  same way every oversized module ticket has been (M06/M07/M09/M10/M11/
  M13/M31/M35): 0125 (M05 catalogue admin UI — browse/search/filter/
  edit/archive, buildable entirely on the existing `catalogue` module
  backend, picked up this session), 0126 (M05 item creation + bulk CSV
  import/export over HTTP — needs an architect decision on how a
  UI-created item gets a `source_work_item_id` given that table's
  service-role-only trust model from ticket 0058), 0127 (M06
  Configuration Studio UI — the full steps editor/version/validation/
  simulation surface over the already-built workflow engine).
- Survey found two real gaps fixed as part of 0125, not deferred: (1)
  `GET /catalogue/work-items` only ever returned bare
  `work_item_definitions` rows (disposition/status/priority/...), never
  the item name/description that live on the joined `source_work_items`
  row — no browse screen could show anything readable without an N+1
  detail fetch per row, so the endpoint now embeds those joined fields
  into a `WorkItemSummary` response shape; (2) `WorkItemFilters.search`
  was declared in `types.ts` since ticket 0058 but never read by the
  route, the Supabase query, or the in-memory filter fake used by every
  test — dead code wired up now to do a case-insensitive substring
  match against item name + description.
- Also found, surveying `modules/workflow` for ticket 0127: no code in
  that module calls `dispatchNotification` at all — submitting a
  definition for approval, publishing a version, or an SLA escalation
  firing notifies nobody today, despite M31's dispatch pipeline (ticket
  0082) existing before this module's latest tickets (0066, 0081).
  Logged in ticket 0127's own text as something its eventual sub-split
  must fix, not silently carried forward again.
- Why: same "too large for one ticket"/"survey before designing"
  precedent as every prior module split; the catalogue list endpoint
  fix is not scope creep — it's a precondition for ticket 0125's own
  acceptance criteria (a usable browse table), the same class of
  "found while building, fixed inline" call ticket 0077 made for its
  cross-tenant closeout-checklist write.
- Approved by: agent (ticket classification/ordering and internal API
  design are explicitly agent-decidable per CLAUDE.md, same weight as
  every prior module split recorded here).
