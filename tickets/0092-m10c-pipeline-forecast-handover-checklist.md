---
id: 92
title: "M10c — Pipeline forecast & won-opportunity handover checklist (approval-gated)"
status: next
roles: [backend-engineer]
priority: 13
created: 2026-10-16
updated: 2026-10-16
---

Third of three M10 sub-tickets (see ticket 0089 for the split
rationale). Depends on ticket 0090 (M10a — pipeline data to report
over) and M08 (ticket 0066 — the `request_approval` workflow seam this
ticket's handover gate plugs into, same "no parallel approval
mechanism" rule every M09/M35/M31 sub-ticket already followed). Covers
BRD §8.5 FR-CRM-004.

## What to build
- Pipeline forecast: a read endpoint that aggregates ticket 0090's
  opportunities by `stage`/`expected_value`/`probability` (e.g.
  weighted pipeline value = sum(expected_value * probability) grouped
  by stage, owner, or due-date window) — plain aggregation logic over
  existing rows, same "pure function, no mocked client" pattern
  `filterAndPaginate` in ticket 0078's audit module used. No new
  forecasting/ML model; "forecast" here means a rollup of what's
  already in the pipeline, per BRD §7's plain phrase "pipeline
  forecast."
- Handover checklist (FR-CRM-004): when an opportunity's `stage`
  becomes `won`, a configurable set of mandatory fields must be
  present before "handover" can complete — look at what ticket 0077
  (M09e closeout checklist) built for its own checklist-gate shape
  before inventing a new one; this is very likely the same
  `CLOSEOUT_ITEM_KEYS`-style fixed-key-checklist pattern, not a
  freeform one. "Unless an authorized exception is recorded" — an
  exception needs its own approval, via the same M08 seam (someone
  with authority approves proceeding despite a missing field,
  recorded with a reason) — do not let any caller silently bypass the
  checklist themselves.
- Do not auto-create a `projects` row (ticket 0073) on handover
  completion — FR-CRM-004 only requires the checklist gate, not an
  automatic project-creation pipeline; that would be unrequested
  machinery per CLAUDE.md's standing principle used throughout M06-M10's
  decisions so far. A human creates the project afterward through
  ticket 0073's existing `POST /projects`.

## Out of scope
- Automatic project creation from a won opportunity.
- Tender documents, bid/no-bid, estimates — M11.

## Acceptance
- [ ] Pipeline forecast endpoint aggregates real stage/value/
      probability data from ticket 0090, tenant-scoped.
- [ ] Handover checklist blocks completion while mandatory fields are
      missing.
- [ ] An authorized exception (via the M08 approval seam) can let
      handover proceed despite a missing field, with a recorded reason.
- [ ] Tests cover tenant isolation, permission gating, the blocking
      checklist, and the exception-approval path.

## Progress
- 2026-10-16: Filed as the third of three M10 sub-tickets (see ticket
  0089's split).
