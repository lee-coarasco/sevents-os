---
id: 52
title: "Build consolidated classification/disposition workbook from tickets 0001-0051"
status: in-progress
roles: [architect]
priority: 1
created: 2026-10-14
updated: 2026-10-14
---

Implementation Plan §3 Phase 0 lists "classification/disposition workbook"
as its own deliverable, separate from "catalogue import," and the Phase 0
exit criteria requires "classification status visible." Right now the
classification decisions (disposition, canonical role, ticket) for all
1,308 rows exist, but only scattered across 51 ticket files in prose —
there is no single place to see, per row, what was decided. The source
workbook itself already has the right columns for this
(`Normalized Role ID`, `Disposition`, `Process Owner`, `Mapping Status`
etc. in `docs/catalogue/source-catalogue.json`), currently all empty.

This ticket produces a derived file,
`docs/catalogue/disposition-workbook.csv`, with one row per S.No. (1-1308):
S.No., Department, Who is Responsible (raw), Canonical Role ID, Disposition,
Ticket ID, Mapping Status. Built by reading every ticket's "Source rows
covered"/cluster table and "## Disposition" section (including its named
per-row exceptions, e.g. ticket 0016's 735/742/748) and cross-checking
coverage against `docs/catalogue/source-catalogue.json` so every S.No. gets
exactly one disposition and none are missed or duplicated.

This is pure synthesis of decisions already recorded in the tickets — no
new classification judgment calls, no owner approval needed.

## Acceptance
- [ ] `docs/catalogue/disposition-workbook.csv` exists with exactly 1,308
      data rows, one per S.No. 1-1308, no gaps, no duplicates.
- [ ] Every row's Disposition is one of BRD §6.5's 7 values, taken from the
      owning ticket's `## Disposition` section (including per-row
      exceptions), not invented.
- [ ] Every row references the ticket ID it was classified in, for
      traceability back to the reasoning.
- [ ] Any row where the owning ticket's text is ambiguous about which
      disposition applies is flagged in a `review-needed` column rather
      than guessed.
- [ ] `docs/catalogue/README.md` updated to mention the new file.

## Progress
- 2026-10-14 18:31 UTC: Opened. All 1,308 rows already classified across
  tickets 0001-0051 (confirmed via `tickets.py check`, 51 tickets/0
  problems); this ticket only consolidates that existing work into one
  traceable file, it does not reclassify anything.
