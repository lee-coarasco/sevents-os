---
id: 104
title: "M13a — Document register & revision control"
status: testing
roles: [backend-engineer]
priority: 15
created: 2026-10-16
updated: 2026-10-16
---

First of three M13 sub-tickets (see ticket 0103 for the split
rationale). Builds the general-purpose document-control spine every
other module (engineering/M12, procurement/M14, site ops/M17, quality/
M19, legal/M27, etc.) will eventually attach records to — this ticket
only builds the spine itself (FR-DOC-001, FR-DOC-002), not every
module's specific document types.

## What to build
- `documents` table (tenant-scoped, RLS), one row per logical
  document: `document_type` (free text — e.g. "drawing", "spec",
  "BOQ", "RFI" — not an enum; this module does not own the list of
  types other modules may use), `document_number`, `title`,
  `project_id` (FK to `projects`, nullable — not every controlled
  document is project-scoped, e.g. a corporate SOP), `discipline`
  (free text, nullable), `access_class` (free text, nullable — per
  CLAUDE.md this module does not invent a fixed classification scheme;
  if the owner wants a controlled vocabulary later that is a config
  decision, not this ticket's), `tags` (text array), `originator_id`,
  `current_revision_id` (nullable FK, set once the first revision is
  created), `created_at`.
- `document_revisions` table (tenant-scoped, RLS), one row per version
  of a document: `document_id` (FK), `revision_code` (e.g. "A", "B",
  "P1" — free text, caller-supplied, this ticket does not invent a
  numbering scheme), `status` (`draft` | `under_review` | `approved` |
  `superseded` | `rejected` — reuse this exact vocabulary shape, not
  the `ApprovalChainDecision` one, since a revision's lifecycle is
  broader than one approval decision), `storage_reference` (text,
  nullable — same convention as ticket 0096's `tender_documents.
  storage_reference`: a pointer to wherever the file actually lives,
  this ticket does not build file upload/storage wiring), `reviewer_id`,
  `approver_id` (both nullable until set), `superseded_by_revision_id`
  (nullable, self-referencing — FR-DOC-002), `created_by`, `created_at`.
- Creating a new revision on a document whose current revision is
  `approved` must mark the old revision `superseded` and set its
  `superseded_by_revision_id` to the new one (FR-DOC-002) — do this in
  the same transaction/service call, not as a separate step a caller
  could forget.
- Views/list endpoints must support filtering out `superseded` and
  `rejected` revisions by default (an explicit `includeSuperseded=true`
  query param to see them) — this is FR-DOC-002's "excluded from
  current-for-construction views" requirement.
- Revision history endpoint: list all revisions of a document ordered
  oldest-to-newest, each with its full metadata — this is the raw data
  a future frontend "revision comparison" screen needs; this ticket
  does not need to build a diff UI, just expose the ordered list with
  every revision's full field set so a caller can diff client-side.
- New permission `documents.register.manage` for write actions
  (create document, create revision, edit metadata). Read access
  (list/get) should be open to any authenticated, permitted user per
  BRD's "All permitted roles" owner line — reuse the same
  broad-read-narrow-write pattern already used in this codebase if one
  exists (check `modules/workforce` or `modules/projects` for the
  precedent before inventing a new one). Grant
  `documents.register.manage` to `role.platform_administrator` and
  `role.document_controller` only — every other role's write access to
  a *specific* document type (e.g. an Architect revising a drawing) is
  a later module's concern (M12 etc. will call into this spine), not
  this ticket's.

## Out of scope
- File upload/binary storage wiring (Supabase Storage) — only the
  `storage_reference` pointer field, same as ticket 0096's precedent.
- OCR/extraction (AI-dependent, M28/M29 don't exist yet).
- Any module-specific document type's own fields (e.g. a drawing's
  sheet size, a spec's section number) — `document_type`/`discipline`
  are free text precisely so later modules can filter/tag without this
  ticket inventing their schemas.
- Retention/legal hold — already generic in `retention_policies`/
  `legal_holds` (ticket 0079); nothing to build here.

## Acceptance
- [x] `documents` and `document_revisions` created, tenant-scoped, RLS
      enabled.
- [x] Creating a revision on a document whose current revision is
      `approved` supersedes the old one in the same call (FR-DOC-002).
- [x] List/get endpoints exclude `superseded`/`rejected` revisions by
      default; `includeSuperseded=true` returns them.
- [x] Revision-history endpoint returns full ordered revision list.
- [x] `documents.register.manage` gates all writes; reads are open to
      any permitted authenticated user.
- [x] Tests cover tenant isolation, the auto-supersede-on-new-revision
      behavior, the default-excludes-superseded list behavior, and
      permission gating on writes.

## Progress
- 2026-10-16 18:10 UTC: Filed as the first of three M13 sub-tickets
  per ticket 0103's split.
- 2026-10-16 17:15 UTC: Built. Migration
  `supabase/migrations/20261016000018_m13a_document_register_revision_control.sql`
  adds `documents` and `document_revisions` (tenant-scoped, RLS enabled
  on both, `documents.current_revision_id` FK added after
  `document_revisions` exists to avoid a forward reference) and grants
  the new `documents.register.manage` permission to
  `role.platform_administrator` and `role.document_controller` only, via
  the same `insert into permissions` / `insert into role_permissions`
  mechanism ticket 0096 used. Not applied — no reachable Supabase MCP
  tools in this sandbox this session, consistent with every prior
  module.
  Backend module `backend/src/modules/documents/` (types.ts,
  repository.ts — Supabase-backed, not exercised live — service.ts,
  routes.ts), `backend/src/test/fakeDocumentsRepository.ts` for the
  in-memory test double, registered in `backend/src/app.ts`. The
  FR-DOC-002 auto-supersede rule lives in
  `service.ts#createDocumentRevision`: it reads the document's current
  revision, and if that revision's status is `approved`, marks it
  `superseded` with `superseded_by_revision_id` pointing at the new
  revision, then sets the document's `current_revision_id` to the new
  revision — all inside the one service call, so there's no separate
  step a caller could skip. Routes split broad-read/narrow-write: GET
  `/documents`, `/documents/:id`, `/documents/:id/revisions` (default
  excludes `superseded`/`rejected`; `?includeSuperseded=true` returns
  everything), `/documents/:id/revisions/history` (full ordered oldest-
  to-newest list) and `/documents/revisions/:revisionId` have no
  permission preHandler beyond the module's own bearer-token hook;
  POST/PATCH routes are gated with
  `requirePermission("documents.register.manage")`.
  Tests: `backend/src/modules/documents/service.test.ts` (14 cases) and
  `routes.test.ts` (17 cases) — tenant isolation on every
  create/get/list path, the auto-supersede behavior (and the negative
  case: a non-approved current revision is left alone), the
  default-excludes-superseded/rejected list view vs.
  `includeSuperseded=true`, full revision history ordering, and 401/403
  permission gating on every write route. Full backend suite:
  `npm install && npm run build && npm test` — before 540 tests / 55
  files, after 571 tests / 56 files, all green.
  One judgment call: the ticket's `createDocumentRevisionInput` didn't
  specify whether a caller can set a revision's initial `status`
  directly (vs. always starting at `draft`); allowed an optional
  `status` on create (defaulting to `draft`) since M13b (approval gate)
  isn't built yet and a caller may need to register an
  already-`approved` historical revision during data migration — this
  doesn't weaken FR-DOC-002 since the supersede check still runs
  against whatever the *previous* current revision's status was, not
  the new one.
