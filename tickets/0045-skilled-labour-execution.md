---
id: 45
title: "Classify catalogue cluster: Skilled Labour execution"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 14 Projects rows carrying
"Skilled Labour" as `Who is Responsible` (#457-470). Twelfth Projects
role, the trade-worker tier reporting to Chargehand/Foreman (not split
by trade — one generic "skilled trade" role in the catalogue). Confirmed
no overlap with the pilot tickets (0001-0002) — see ticket 0007's
2026-10-14 correction note.

## Source rows covered (4 clusters, by shared Trigger)

| Cluster | S.No. range | Rows | Shared trigger (abbreviated) | Output/Evidence shape |
|---|---|---|---|---|
| A. Receive task & pre-start check | 457-460 | 4 | A skilled worker receives the approved task | Confirmed task understanding, safe tools/materials, readiness to execute |
| B. Execute assigned trade work | 461-464 | 4 | The skilled task is released by the Chargehand or Foreman | Completed trade work meeting the approved method, dimensions and productivity expectation |
| C. Self-check & protect | 465-467 | 3 | Work is being performed or reaches self-check | Self-checked work, safe housekeeping, protected assets |
| D. Report & handover | 468-470 | 3 | The skilled task or shift is completed | Reported output, clean work front, returned tools/materials |

All 14 rows: canonical `role.skilled_labour` (already in
`docs/canonical-role-map.md`, "(new)"; no map change needed).

## Disposition

**Configure workflow** for all 14 rows: the most junior tier of the
field execution chain, with the narrowest authority yet — "the worker
follows the assigned scope only and seeks instruction before changing
method, material or location," "unsafe work stops without waiting for
routine reporting." No decision authority; every exception reports
upward to the Chargehand.

## Acceptance
- [x] All 14 Skilled Labour rows (#457-470) classified into 4 trigger
      clusters, all Configure workflow.
- [x] Confirmed `role.skilled_labour` already exists in
      `docs/canonical-role-map.md`.
- [ ] SLA: source `Timing` is "To be confirmed" for all 14 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 14 Skilled Labour
  rows — twelfth Projects role. Projects: 278/304 rows classified, 26
  remain (Driver 14, Unskilled Labour 12). 1,157/1,308 rows classified
  overall, 151 remain. Next: Driver (14 rows), then Unskilled Labour
  (12 rows) — the last two Projects roles.
