---
id: 106
title: "M13c — Transmittals & document requests"
status: next
roles: [backend-engineer]
priority: 17
created: 2026-10-16
updated: 2026-10-16
---

Third of three M13 sub-tickets (see ticket 0103 for the split
rationale). Depends on ticket 0104 (M13a) — a transmittal or request
references a registered document/revision.

## What to build

**Transmittals (FR-DOC-004):** `document_transmittals` table (tenant-
scoped, RLS): `document_revision_id` (FK to ticket 0104's
`document_revisions`), `recipient` (text — a name/org, not necessarily
a system user; transmittals often go to external parties), `package`
(text, nullable — the batch/cover-letter grouping a transmittal belongs
to), `purpose` (text — e.g. "for approval", "for information", "for
construction" — free text, this ticket does not invent a fixed list),
`delivery_status` (`pending` | `sent` | `acknowledged` | `failed`),
`sent_at`/`acknowledged_at` (nullable), `sent_by`. CRUD-shaped routes:
create a transmittal, list transmittals for a document/revision, mark
delivery status.

**Document requests:** `document_requests` table (tenant-scoped, RLS):
someone asks the Document Controller for a controlled document they
don't have access to or that doesn't exist in the form they need.
Fields: `requested_by`, `document_id` (nullable FK — the ask may name
an existing document) or free-text `description` (if it doesn't),
`reason`, `status` (`open` | `fulfilled` | `declined`),
`resolved_by`/`resolved_at`/`resolution_note` (nullable until
resolved). CRUD-shaped routes: raise a request, list open requests,
fulfil/decline a request.

Both tables gated on a new permission `documents.transmittal.manage`
for the write/fulfil actions (same actor cluster as ticket 0104's
`documents.register.manage` — grant to `role.platform_administrator`
and `role.document_controller`); raising a document request should be
open to any authenticated permitted user (anyone can ask for a
document), same broad-read/narrow-write split as ticket 0104.

## Out of scope
- Actual file delivery (email/notification send) — `delivery_status`
  is a queryable fact the Document Controller sets, not an integration
  that sends anything. If M31 (Notifications) later wants to trigger a
  notification on transmittal creation, that is M31's integration to
  build, not this ticket's.

## Acceptance
- [ ] `document_transmittals` and `document_requests` created,
      tenant-scoped, RLS enabled.
- [ ] Transmittal/request write and fulfil/decline actions gated on
      `documents.transmittal.manage`; any authenticated permitted user
      can raise a document request.
- [ ] Tests cover tenant isolation, permission gating, and the
      request open → fulfilled/declined lifecycle.

## Progress
- 2026-10-16 18:10 UTC: Filed as the third of three M13 sub-tickets
  per ticket 0103's split. M13 (Documents, Drawings & Records) is now
  fully scoped into 0104/0105/0106.
