---
id: 44
title: "Classify catalogue cluster: Plant & Equipment Operator execution"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 16 Projects rows carrying
"Plant & Equipment Operator" as `Who is Responsible` (#497-512). Eleventh
Projects role. Note the S.No. range is non-contiguous with the other
labour-tier roles (#457-496, 40 rows, belong to Skilled Labour/Driver/
Unskilled Labour — not yet classified) — the source sheet does not list
roles in a fixed order within a department.

## Source rows covered (4 clusters, by shared Trigger)

| Cluster | S.No. range | Rows | Shared trigger (abbreviated) | Output/Evidence shape |
|---|---|---|---|---|
| A. Pre-start inspection | 497-500 | 4 | An authorised equipment task is scheduled | Verified operator, certified equipment, completed pre-start record |
| B. Operate within capacity & exclusion zone | 501-504 | 4 | The equipment and work zone are formally released | Safe plant output within approved capacity, method and exclusion-zone controls |
| C. Monitor & stop | 505-508 | 4 | Equipment is operating or a performance concern appears | Utilisation record, monitored condition, reported safety/productivity exception |
| D. Maintenance & shift-end | 509-512 | 4 | Maintenance becomes due, a defect is found or the shift ends | Maintained or isolated equipment, completed fuel/care/utilisation/defect records |

All 16 rows: canonical `role.plant_equipment_operator` (already in
`docs/canonical-role-map.md`, "(new) — see M25 Equipment/Plant/Fleet";
no map change needed).

## Disposition

**Configure workflow** for all 16 rows. This is a certification-gated
operational role rather than a pure labour role — "plant is not operated
with expired certification, failed safety device, unsuitable attachment
or unclear operating plan" — but the certification check itself is a
precondition the Operator verifies before acting, not a decision this
role makes; exceptions and unsafe conditions escalate to the Supervisor,
QHSE and Project Engineer, matching every other field-tier role above
it. "Stop equipment on unsafe condition" (#507) stays Configure workflow
for the same reason "stop unsafe work" stayed Configure workflow for
Chargehand (0043) — a mandated stop action, not an approval/decision.

## Acceptance
- [x] All 16 Plant & Equipment Operator rows (#497-512) classified into
      4 trigger clusters, all Configure workflow.
- [x] Confirmed `role.plant_equipment_operator` already exists in
      `docs/canonical-role-map.md`.
- [ ] SLA: source `Timing` is "To be confirmed" for all 16 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 16 Plant & Equipment
  Operator rows — eleventh Projects role. Noticed the running tally in
  ticket 0007 didn't add up against raw per-role row counts and
  flagged it as likely pilot-ticket overlap in Skilled Labour/Driver/
  Unskilled Labour; a later session that day traced it instead to
  tickets 0038/0039 re-covering rows already in ticket 0001 (see
  ticket 0007's correction note) — Skilled Labour/Driver/Unskilled
  Labour have no overlap and can be classified in full. Corrected
  figures: 1,143/1,308 rows classified overall, 165 remain.
