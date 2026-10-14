---
id: 7
title: Continue catalogue import/classification for remaining departments
status: next
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Tracking ticket for the rest of the 1,308-row work-item catalogue
(`docs/work-item-catalogue.xlsx`, Source Catalogue sheet). This is
multi-session work — each session should classify one more batch, update
the table below, and leave a clean handoff. Do not try to finish this in
one sitting; CLAUDE.md's own ground rules call for small, testable,
committed increments.

## Why this exists instead of 1,262 separate ticket files

Tickets 0001-0006 classified 46 rows as 6 ticket files by clustering rows
that share Department + Role + source `Trigger` text — the source data
itself shows multiple catalogue rows are sub-steps of one configured
capability (BRD §6.3: "multiple source items may reuse one workflow
template"; Implementation Plan §1: "Do not build 1,308 separate
features"). One ticket per raw row would mean ~1,308 near-duplicate files
for what the BRD explicitly says is not 1,308 separate features. Cluster
by shared trigger within the same department+role instead; use
`scripts/catalogue_lookup.py --department X --role Y` to pull a role's
rows and eyeball the Trigger/Output/Control text before deciding cluster
boundaries, the same way tickets 0001-0006 were built.

## Method (repeat per batch)

1. Regenerate the extract if missing: `python3 scripts/xlsx_to_json.py`.
2. Pick the next department/role below with status "not started".
3. `python3 scripts/catalogue_lookup.py --department "<Dept>" --role "<Role>"`
   and group rows by identical/near-identical `Trigger` text.
4. For each cluster, judge disposition per BRD §6.5 (default to the
   cluster's disposition, but split any row whose `Output/Evidence` shape
   genuinely differs — see tickets 0002-0005 for examples of when to
   split).
5. Write one ticket file per cluster (or small group of related clusters
   for the same role) with: source rows table, shared trigger/output/
   handoff/escalation text, canonical role (add to
   `docs/canonical-role-map.md` if the raw label is new), disposition,
   and an acceptance checklist distinguishing "classified now" from "needs
   owner/later-phase input" (SLA is almost always `TBD` — the source
   `Timing` field says "To be confirmed" for essentially every row seen so
   far; don't invent a number to fill the checkbox).
6. Update the table below: mark the department/role "done" with the ticket
   ID range, and note the row count actually covered (not estimated).
7. Commit. Leave remaining departments/roles for the next session.

## Progress by department

| Department | Total rows | Classified | Status |
|---|---:|---:|---|
| Projects | 304 | 11 (+1 reviewed/excluded: #525) | Partial — only the material-request slice (tickets 0001-0002); QHSE, QS billing/claims, COO, Foreman/Chargehand/labour rows, schedule/progress rows all untouched |
| Procurement | 160 | 35 | Partial — CPO strategy/governance rows (571-600 minus 582/584), vendor-management-beyond-RFQ rows untouched |
| Technical Engineering | 196 | 121 | Partial — CTO (0008), Architect (Lead) (0009), Structural Designer (0010), Civil Draftsman (0011), Electrical Draftsman (0012) done; HVAC&Plumbing Draftsman, Civil/MEP Estimator (75 rows, 3 raw labels) untouched |
| Finance | 120 | 0 | Not started |
| Legal | 120 | 0 | Not started |
| Marketing & Sales | 120 | 0 | Not started |
| People & Culture | 98 | 0 | Not started |
| Research & Development | 120 | 0 | Not started |
| Company / Leadership | 70 | 0 | Not started |
| **Total** | **1,308** | **167** | **1,141 rows remain** |

## A note on "Leadership and paper-based items" (BRD §22, "Leadership,
paper-based and broad-responsibility items")

Expect a meaningfully large share of Company/Leadership (70 rows) and the
C-level rows scattered through every other department (CEO, Chairman, COO,
CTO, CFO, CPO, CMO, CPCO, CRO, CLO — see `docs/canonical-role-map.md`) to
land as **Reference/policy only** or **Configure approval/decision** rather
than **Configure workflow**: BRD is explicit that "strategic leadership
statements without a discrete deliverable remain reference/policy
records" and only create a task when there's "a clear trigger, accountable
owner, output/decision/obligation and closure/follow-up." Don't force a
workflow disposition onto these just to make progress look bigger — a
large Reference/policy-only count is the correct, expected outcome for
that persona group, not a sign the import stalled.

## Acceptance
- [ ] All 1,308 rows have a ticket (individually or as part of a cluster
      ticket) recording at least: disposition, canonical role, and
      source-row list.
- [ ] Every row's disposition is one of the 7 BRD §6.5 values — none left
      unclassified silently.
- [ ] Table above reflects true per-department progress after each batch.

## Progress
- 2026-10-14: Architect session. Classified the pilot-flow slice (tickets
  0001-0006, 46 rows across Projects/Procurement) and opened this tracking
  ticket for the remaining 1,262 rows across 9 departments. Left `next`,
  priority 2 (behind nothing right now — tickets 0001-0006 are done), for
  whichever session picks up Phase 0 catalogue work next.
- 2026-10-14 (later session): Classified Technical Engineering's two
  largest roles — CTO (ticket 0008, 25 rows) and Architect (Lead)
  (ticket 0009, 30 rows), 55 rows total. 1,207 rows remain. Next: pick up
  Structural Designer (22 rows) within Technical Engineering, then the
  remaining 4 draftsman/estimator roles in that department before moving
  to Finance/Legal/etc.
- 2026-10-14 (same session, cont.): Classified Structural Designer
  (ticket 0010, 22 rows), Civil Draftsman (ticket 0011, 20 rows), then
  Electrical Draftsman (ticket 0012, 24 rows). 1,141 rows remain. Next:
  HVAC & Plumbing Draftsman, Civil Estimator, MEP Estimator (75 rows) to
  finish Technical Engineering, then move to Finance (120 rows, not
  started).
