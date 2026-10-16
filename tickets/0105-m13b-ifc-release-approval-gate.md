---
id: 105
title: "M13b — Approval stamps & IFC release gate"
status: testing
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
- 2026-10-16 17:16 UTC (prior session): Built `submitRevisionForRelease`
  and `resolveRevisionApproval` in `modules/documents/service.ts`, routes
  `POST /documents/revisions/:id/submit-for-release` and
  `POST /documents/revisions/:id/resolve-approval`, migration
  `20261016000019_m13b_ifc_release_approval_gate.sql` (adds
  `workflow_instance_id`/`approved_at` to `document_revisions`), and
  tests — but left the ticket at `in-progress` with no progress note.
  Migration was applied live later the same evening (see
  daily-log/2026-10-16.md "applied all 31 pending Supabase migrations").
- 2026-10-16 21:35 UTC: Picked this up as the `next` ticket. Verified
  rather than rebuilt: ran the full backend suite
  (`npm --prefix backend run test`) — 56 files / 581 tests pass,
  including the documents module's 41; `npm --prefix backend run lint`
  (tsc --noEmit) clean. Confirmed against the acceptance list: submit
  only accepts `under_review` revisions (409 otherwise, tested),
  approval stamps `approved_at` and runs the supersede safety-net,
  rejection/returned-for-correction both land on the existing `rejected`
  status (no new vocabulary), tenant isolation covered, RLS already
  enabled on `document_revisions` by ticket 0104's migration (0105's
  migration only adds columns to that same table). Permission gate
  reuses `documents.register.manage`, same as every other write on this
  module — no new permission minted. Updated `docs/USER-GUIDE.md`'s M13
  entry with the new endpoints and status. Found a gap while checking
  the Definition of Done's notification checklist — see ticket 0122
  (filed separately rather than scope-creeping it into this one, since
  it spans every module built since M31, not just this ticket's code).
  Moving to `status: testing`.
