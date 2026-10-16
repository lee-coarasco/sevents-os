---
id: 76
title: "M09d — Issue, risk, decision, assumption, dependency & change-request register"
status: testing
roles: [backend-engineer]
priority: 9
created: 2026-10-16
updated: 2026-10-16
---

Fourth of five M09 sub-tickets (see ticket 0073 and DECISIONS.md for
the split rationale). Depends on ticket 0073 (needs a real `projects`
row to attach register entries to). Covers BRD §8.4 FR-PROJ-005 only.
BRD §6.2 lists no dedicated entities for this register beyond the
generic `Project` relationship — this ticket defines the minimal
schema itself.

## What to build
- One tenant-scoped `project_register_entries` table under
  `backend/src/modules/projects/`, `project_id` FK, a `kind` enum
  covering exactly the six FR-PROJ-005 categories (`issue`, `risk`,
  `decision`, `assumption`, `dependency`, `change_request`) rather
  than six separate tables — they share the same fields (title,
  description, status, owner, due_date, raised_by, raised_at,
  resolved_at, resolution_note) and splitting them into six tables
  would be premature normalization for what BRD only asks to be
  "tracked."
- Risk entries additionally carry nullable `likelihood`/`impact`
  (free-text or small enum, tenant-configurable — do not invent a
  numeric risk-scoring formula; FR-PROJ-006 explicitly bans an
  unexplained AI/computed score, and a risk matrix score is exactly
  that kind of computed value).
- Change-request entries reuse the same table but do NOT trigger
  workflow/approval automatically in this ticket — that would
  duplicate ticket 0075 (M09c)'s baseline-change-request path, which
  is the one BRD actually names for approval (FR-PROJ-004). A
  register-level "change request" here is a logged intent/record,
  not itself an approval workflow; if it later needs baselining, the
  user links it to a ticket-0075 baseline change request by
  reference, not by this table re-implementing approval.
- `POST /projects/:projectId/register`, `GET
  /projects/:projectId/register` (filterable by `kind`/`status`),
  `PATCH /projects/:projectId/register/:entryId` routes, gated on
  `tenancy.project.manage` (reuse, consistent with ticket 0073 — this
  is project administration, not a new actor class).

## Out of scope
- Health/forecast/closeout — ticket 0077 (M09e).
- Risk scoring/heat-map computation — none exists anywhere in this
  codebase; do not invent one here.
- Auto-generating tasks/workflow instances from a register entry — a
  future seam, not required by FR-PROJ-005's literal text ("track").

## Acceptance
- [x] `project_register_entries` created, tenant-scoped, RLS enabled,
      `kind` constrained to the six FR-PROJ-005 categories.
- [x] CRUD routes gated on `tenancy.project.manage`; list is
      filterable by kind and status.
- [x] Tests cover all six kinds, tenant isolation, permission gating.
- [x] `docs/BRD.md` FR-PROJ-005 is satisfied.

## Progress
- 2026-10-16: Filed as the fourth of five M09 sub-tickets — ticket
  0073/0074/0075 all referenced this ticket number in their "out of
  scope" sections before it existed as a file; filing it now to close
  that gap (see DECISIONS.md).
- 2026-10-16 (same session, ~01:33 UTC): Built. One migration
  (`20261016000004_m09d_project_register.sql`) adds
  `project_register_entries` (tenant-scoped, RLS, `kind` check
  constrained to issue/risk/decision/assumption/dependency/
  change_request, generic status open/in_progress/resolved/closed,
  nullable free-text `likelihood`/`impact` with no CHECK — tenant-
  configurable, never a computed score per FR-PROJ-006). Extended the
  existing `projects` module's four files in place (same "CRUD over
  one table doesn't need a new module" call ticket 0074 made) —
  `createRegisterEntry`/`listRegisterEntries`/`updateRegisterEntry` in
  service.ts, `POST/GET /projects/:projectId/register` +
  `PATCH /projects/:projectId/register/:entryId` in routes.ts, gated
  on the existing `tenancy.project.manage` permission (no new
  permission — this is project administration like ticket 0074's WBS/
  milestone/activity routes). `change_request` rows are a logged
  record only — `createRegisterEntry` never calls into ticket 0075's
  `startWorkflowInstance`/approval path, confirmed by a dedicated test
  asserting no `workflow_instance_id` appears on a created entry.
  Tests: `register.test.ts` (7 cases — one per kind via `it.each`,
  risk likelihood/impact, change_request-is-just-a-record, kind/status
  filtering, resolution with a note, tenant isolation) and
  `register.routes.test.ts` (3 cases — create permission gating/
  validation, filtered GET, PATCH permission gating/404). `npm test`:
  323/323 across 33 files (was 309). `npm run build`/`lint` clean.
  `scripts/tickets.py check` clean. Status set to `testing`. Next:
  ticket 0077 (M09e — health/forecast-vs-baseline/closeout checklist),
  the last M09 sub-ticket.
