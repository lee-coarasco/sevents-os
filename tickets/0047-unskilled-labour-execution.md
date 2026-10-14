---
id: 47
title: "Classify catalogue cluster: Unskilled Labour execution"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 12 Projects rows carrying
"Unskilled Labour" as `Who is Responsible` (#471-482). Fourteenth and
final Projects role — completes the Projects department (304/304 rows).
Confirmed no overlap with the pilot tickets (0001-0002).

## Source rows covered (4 clusters, by shared Trigger)

| Cluster | S.No. range | Rows | Shared trigger (abbreviated) | Output/Evidence shape |
|---|---|---|---|---|
| A. Receive support task & pre-start check | 471-473 | 3 | The general worker receives a support task | Confirmed instruction, PPE, safe route, basic-tool readiness |
| B. Support execution | 474-476 | 3 | The work crew requires authorised material or physical support | Safely staged material, prepared access/protection, completed support task |
| C. Housekeeping & protection | 477-479 | 3 | Work or housekeeping is in progress | Clear access, segregated waste, protected property, compliant work-front condition |
| D. Report & handover | 480-482 | 3 | The support task or shift is completed | Cleaned area, returned tools, reported completion/exception status |

All 12 rows: canonical `role.unskilled_labour` (already in
`docs/canonical-role-map.md`, "(new)"; no map change needed).

## Disposition

**Configure workflow** for all 12 rows: the narrowest-authority tier in
the entire Projects department — "the worker performs only the assigned
support activity," "hazardous or skilled work is not performed without
competence and instruction." Every row is the general labourer following
instruction and reporting exceptions to the Chargehand; there is no row
in this cluster set with any decision content.

## Acceptance
- [x] All 12 Unskilled Labour rows (#471-482) classified into 4 trigger
      clusters, all Configure workflow.
- [x] Confirmed `role.unskilled_labour` already exists in
      `docs/canonical-role-map.md`.
- [ ] SLA: source `Timing` is "To be confirmed" for all 12 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 12 Unskilled Labour
  rows — fourteenth and final Projects role. **Projects department now
  fully classified (304/304 rows, tickets 0001-0002 + 0034-0047).**
  1,183/1,308 rows classified overall, 125 remain — all in Procurement
  (160 total, 35 classified via original pilot tickets, 125 remain:
  vendor-management-beyond-RFQ rows and any CPO rows not already
  covered). Next: Procurement is now the only open department — pick
  its largest untouched role with `catalogue_lookup.py`, same method
  as every batch above.
