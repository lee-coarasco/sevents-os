---
id: 104
title: "M13a — Document register & revision control"
status: next
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
- [ ] `documents` and `document_revisions` created, tenant-scoped, RLS
      enabled.
- [ ] Creating a revision on a document whose current revision is
      `approved` supersedes the old one in the same call (FR-DOC-002).
- [ ] List/get endpoints exclude `superseded`/`rejected` revisions by
      default; `includeSuperseded=true` returns them.
- [ ] Revision-history endpoint returns full ordered revision list.
- [ ] `documents.register.manage` gates all writes; reads are open to
      any permitted authenticated user.
- [ ] Tests cover tenant isolation, the auto-supersede-on-new-revision
      behavior, the default-excludes-superseded list behavior, and
      permission gating on writes.

## Progress
- 2026-10-16 18:10 UTC: Filed as the first of three M13 sub-tickets
  per ticket 0103's split.
