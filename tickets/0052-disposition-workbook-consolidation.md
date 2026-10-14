---
id: 52
title: "Build consolidated classification/disposition workbook from tickets 0001-0051"
status: done
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
- [x] `docs/catalogue/disposition-workbook.csv` exists with exactly 1,308
      data rows, one per S.No. 1-1308, no gaps, no duplicates.
- [x] Every row's Disposition is one of BRD §6.5's 7 values, taken from the
      owning ticket's `## Disposition` section (including per-row
      exceptions), not invented.
- [x] Every row references the ticket ID it was classified in, for
      traceability back to the reasoning.
- [x] Any row where the owning ticket's text is ambiguous about which
      disposition applies is flagged in a `review-needed` column rather
      than guessed. (0 rows flagged — every row resolved unambiguously.)
- [x] `docs/catalogue/README.md` updated to mention the new file.

## Progress
- 2026-10-14 18:31 UTC: Opened. All 1,308 rows already classified across
  tickets 0001-0051 (confirmed via `tickets.py check`, 51 tickets/0
  problems); this ticket only consolidates that existing work into one
  traceable file, it does not reclassify anything.
- 2026-10-14 18:39 UTC: Done. Built `docs/catalogue/disposition-workbook.csv`
  (1,308 rows) by reading all 51 ticket files' "Source rows covered" and
  "## Disposition" sections, including named per-row exceptions (e.g.
  ticket 0016's CFO rows 735/742/748 as Periodic review/monitor vs. the
  other 27 CFO rows as Configure approval/decision; row 525 attributed to
  ticket 0036's explicit resolution rather than ticket 0002's earlier
  deferral of the same row). Verified programmatically against
  `docs/catalogue/source-catalogue.json`: s_no is exactly 1-1308 with no
  gaps/duplicates; department and who_is_responsible match the source
  catalogue for all 1,308 rows exactly; every disposition is one of the 7
  BRD §6.5 values (Configure workflow 995, Configure approval/decision
  215, Periodic review/monitor 60, Track obligation/document 21, Defer
  17; Reference/policy only and Clarify/de-duplicate: 0 — no ticket used
  them); review_needed is empty for all 1,308 rows. Spot-checked several
  known tricky cases (CFO exceptions, row 525, Defer clusters in tickets
  0017/0018, CPO rows 582/584) directly against ticket source text — all
  match exactly. `docs/catalogue/README.md` updated with a description of
  the new file, its columns, and how to regenerate it if a ticket's
  classification ever changes (no script yet — requires reading ticket
  prose, not just structured fields).
