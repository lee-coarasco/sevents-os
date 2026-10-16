---
id: 76
title: "M09d — Issue, risk, decision, assumption, dependency & change-request register"
status: next
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
- [ ] `project_register_entries` created, tenant-scoped, RLS enabled,
      `kind` constrained to the six FR-PROJ-005 categories.
- [ ] CRUD routes gated on `tenancy.project.manage`; list is
      filterable by kind and status.
- [ ] Tests cover all six kinds, tenant isolation, permission gating.
- [ ] `docs/BRD.md` FR-PROJ-005 is satisfied.

## Progress
- 2026-10-16: Filed as the fourth of five M09 sub-tickets — ticket
  0073/0074/0075 all referenced this ticket number in their "out of
  scope" sections before it existed as a file; filing it now to close
  that gap (see DECISIONS.md).
