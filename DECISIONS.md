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
