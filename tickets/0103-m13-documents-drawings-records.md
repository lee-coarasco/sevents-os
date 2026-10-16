---
id: 103
title: "M13 — Documents, Drawings & Records"
status: done
roles: [architect]
priority: 15
created: 2026-10-16
updated: 2026-10-16
---

Third Phase 4 module per the build order. Depends on M02 (done) and M09
(done — a document attaches to a project). M13 does **not** depend on
M12 (Technical Engineering & Design Control) even though BRD lists them
adjacently — the build-order table has M12 depending on M13 (a drawing
register needs the document-control model to exist first), not the
other way round, so M13 goes first.

Reference: CLAUDE.md module table — "Versioned files, metadata, tags,
access classification, check-in/out where required, approval stamps,
superseded status, OCR/extraction, transmittals, revision comparisons,
document requests, retention and legal hold." Owners: "All permitted
roles; Document Controller." BRD §7 row (line 439). BRD §8.6 FRs:
FR-DOC-001 (documents have type, number, title, project, discipline,
revision, status, originator, reviewer, approver, access class),
FR-DOC-002 (superseded drawings are visibly marked and excluded from
current-for-construction views), FR-DOC-003 (IFC release requires
configured reviews and approvals), FR-DOC-004 (transmittals record
recipient, package, revision, purpose and delivery status).

Ticket 0031 (Phase 0 catalogue classification, Document Controller
role, 60 rows) already confirmed the day-to-day document-control
*process* (intake, classify, route, transmit, register, change-control,
closeout) is expected to run through M06's Configuration Studio once
this module's underlying data model and FR-level gates exist — same
relationship every other module has had with its catalogue rows. This
ticket only needs the data model and the two FR-level gates
(FR-DOC-002 supersession, FR-DOC-003 IFC approval), not a bespoke UI
per catalogue row.

## Survey findings
No general-purpose `documents`/`document_revisions`/`transmittals`
table exists yet (grep-checked across all 29 migration files). Two
module-specific precedents already exist and must NOT be duplicated:
- Ticket 0096 (M11a) built `tender_documents` — a tender-package
  document list scoped to one `tender_submissions` row. It is a
  narrower, tender-specific register, not this module's general
  document-control spine. Left as-is.
- Ticket 0079 (M35b) built `retention_policies` and `legal_holds`,
  both keyed by a free-text `entity_type` + nullable `entity_id` —
  already generic enough to cover a `document_type` value without any
  new code. M13 reuses these directly; no retention/legal-hold code is
  built in this module.

**AI-dependent PRD-prose items (OCR/extraction)** are explicitly out of
scope — M28/M29 (the AI modules) haven't started, and CLAUDE.md
prohibits inventing AI features ahead of that. Same scoping-down
precedent as ticket 0097's FR-EST-002 handling: no OCR call is built,
and no placeholder columns are added speculatively either (unlike
FR-EST-002, nothing here reads OCR output as a structured field yet,
so there is nothing to reserve a column for).

## Split
Split the same dependency-ordered way as tickets 0059/0067/0089/0095,
into three sub-tickets:
- **0104 (M13a)** — Document register & revision control (FR-DOC-001,
  FR-DOC-002): `documents` + `document_revisions` tables, metadata/
  tags, access classification, supersede marking excluded from
  "current" views, revision history/comparison. No internal dependency
  beyond M09 (a document attaches to a project).
- **0105 (M13b)** — Approval stamps & IFC release gate (FR-DOC-003):
  reuse the existing M08 `request_approval` workflow seam (same
  pattern as ticket 0097's FR-EST-003 lock-on-approve) to gate IFC
  release on configured reviews/approvals; approval stamp recorded on
  the revision. Depends on 0104 (a revision must exist before it can
  be released).
- **0106 (M13c)** — Transmittals & document requests (FR-DOC-004 +
  PRD's "document requests"): transmittal register (recipient,
  package, revision, purpose, delivery status) and an ad-hoc
  document-request record (someone asks for a controlled document;
  Document Controller fulfils or declines it). Depends on 0104 (a
  transmittal/request references a registered document/revision).

## Acceptance
- [x] Confirmed no general document-control table exists yet, and that
      `tender_documents` (M11a) and `retention_policies`/`legal_holds`
      (M35b) are distinct, reusable, not-to-duplicate precedents.
- [x] Split into 0104/0105/0106 in dependency order.

## Progress
- 2026-10-16 18:10 UTC: Filed as the third Phase 4 module (M11 is now
  entirely `done`/`testing`). Surveyed the schema for any existing
  general document/transmittal table (none) and confirmed the
  retention/legal-hold reuse path via ticket 0079. Closed this ticket
  with no code of its own, split into 0104/0105/0106 above.
- Approved by: agent (ticket classification/ordering and internal
  data-model split are explicitly agent-decidable per CLAUDE.md, same
  weight as every prior M06/M07/M09/M10/M11/M31/M35 split; recorded in
  DECISIONS.md).
