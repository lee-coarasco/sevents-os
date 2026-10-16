---
id: 105
title: "M13b — Approval stamps & IFC release gate"
status: in-progress
roles: [backend-engineer]
priority: 16
created: 2026-10-16
updated: 2026-10-16
---

Second of three M13 sub-tickets (see ticket 0103 for the split
rationale). Depends on ticket 0104 (M13a) — a revision must exist
before it can be reviewed/released.

## What to build (FR-DOC-003)
- "Submit for IFC release" action on a `document_revisions` row:
  reuse the exact M08 `request_approval` workflow seam already used by
  ticket 0075 (baseline change), ticket 0097 (estimate approval) and
  ticket 0098 (bid/no-bid) — do not build a second approval mechanism.
  Only a revision in `under_review` status may be submitted; submitting
  starts a workflow instance and records its id on the revision (same
  nullable `workflow_instance_id` column shape ticket 0097 used on
  `estimates`).
- On approval: set the revision's `status` to `approved`, stamp
  `reviewer_id`/`approver_id` (if not already set from ticket 0104's
  fields) and an `approved_at` timestamp (new column) — this is the
  "approval stamp." Also run ticket 0104's existing
  supersede-the-previous-approved-revision behavior if it wasn't
  already triggered at creation time (it should have been — this is a
  safety-net check, not a new code path).
- On rejection: set `status` back to `draft` or leave at a distinct
  `rejected` status (ticket 0104 already lists `rejected` in the enum)
  — pick whichever matches ticket 0097's `returned_for_correction`
  precedent (editable-in-place, not a dead end) and record the
  decision; do not invent a second rejection vocabulary.
- "IFC" (Issued For Construction) is itself just a specific instance of
  "approved and current" for drawing-type documents — do not add a
  separate `is_ifc` flag or parallel status; FR-DOC-003's "requires
  configured reviews and approvals" is satisfied by the workflow gate
  itself, same reasoning ticket 0097 used for not inventing parallel
  concepts beyond what FR text requires.

## Out of scope
- Configuring *which* reviews/approvals a given document type needs —
  that is M06's Configuration Studio's job (an admin designs the
  workflow definition the `request_approval` call resolves against),
  not something this ticket hard-codes.

## Acceptance
- [ ] Submitting a revision for release starts a workflow instance via
      the existing `request_approval` seam; only `under_review`
      revisions may be submitted.
- [ ] Approval sets `status=approved`, stamps approver and
      `approved_at`, and supersedes the prior approved revision if one
      exists.
- [ ] Rejection records the decision without inventing a new
      vocabulary beyond ticket 0104's existing enum.
- [ ] Tests cover the full submit → approve and submit → reject paths,
      tenant isolation, and that only `under_review` revisions can be
      submitted.

## Progress
- 2026-10-16 18:10 UTC: Filed as the second of three M13 sub-tickets
  per ticket 0103's split.
