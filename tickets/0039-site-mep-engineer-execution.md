---
id: 39
title: "Classify catalogue cluster: Site MEP Engineer execution"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 28 Projects rows carrying "Site
MEP Engineer" as `Who is Responsible` (#355-382). Sixth Projects role
picked up, directly after Site Civil Engineer (ticket 0038). Mirrors that
role's pattern exactly, one discipline over (mechanical/electrical/
plumbing instead of civil), reporting the same way to the Project
Engineer Lead/CTO/QHSE.

## Source rows covered (5 clusters, by shared Trigger)

| Cluster | S.No. range | Rows | Shared trigger (abbreviated) | Output/Evidence shape |
|---|---|---|---|---|
| A. Work-front mobilisation/release readiness | 355-358 | 4 | An MEP work front is scheduled for mobilisation or release | Verified MEP readiness record, controlled input set, closed/assigned pre-start actions |
| B. Daily/lookahead work planning | 359-364 | 6 | An approved MEP activity enters the daily or lookahead plan | MEP work plan, technical-readiness record, resource request, coordinated interface decision |
| C. Supervised execution | 365-370 | 6 | An approved MEP work front, method and inspection plan are released | Installed MEP work meeting approved routing, access, sequence, performance and protection requirements |
| D. Material/inspection/testing/concealment control | 371-376 | 6 | MEP material arrives or work reaches an inspection, testing, concealment or resource-control point | Approved equipment/material evidence, WIR, test result, RFI, NCR closure or allocation record |
| E. Reporting, testing/commissioning & closeout | 377-382 | 6 | Daily reporting, measurement, testing, snag or MEP-closeout milestone becomes due | Verified MEP quantities, progress evidence, test status, red-lines, O&M data, completion handover |

All 28 rows: canonical `role.site_mep_engineer` (already in
`docs/canonical-role-map.md`, mapped from source label "Site Manager/Site
Engineer", no change needed).

## Disposition

**Configure workflow** for all 28 rows, identical reasoning to Site
Civil Engineer (ticket 0038): every cluster is the Site MEP Engineer
personally executing, supervising or verifying a discipline operational
pipeline (readiness check → plan → supervise installation → control
materials/inspections/tests → report/commission/close out) with no final
sign-off authority — Continuity/Escalation text routes technical,
testing, authority or life-safety risk up to the Project Engineer, CTO
or QHSE. Cluster C explicitly includes "ELV, fire-alarm and life-safety
system execution within scope" (#368) — still Configure workflow because
the row is installation/execution, not the authority approval itself;
the life-safety-decision boundary this role sits under is the same
QHSE/CTO escalation path as every other cluster, so no split was needed
(contrast with ticket 0037's QHSE Engineer, which did split out an
actual approval-gate cluster).

## Acceptance
- [x] All 28 Site MEP Engineer rows (#355-382) classified into 5
      trigger clusters, all Configure workflow.
- [x] Confirmed `role.site_mep_engineer` already exists in
      `docs/canonical-role-map.md`.
- [ ] SLA: source `Timing` is "To be confirmed" for all 28 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 28 Site MEP Engineer
  rows — sixth Projects role. Projects: 182/304 rows classified, 122
  remain (Civil/MEP Supervisor, Foreman, Chargehand, Plant & Equipment
  Operator, Skilled/Unskilled Labour, Driver all untouched).
  1,061/1,308 rows classified overall, 247 remain. Next: Civil
  Supervisor or MEP Supervisor is the next-largest untouched Projects
  role — check row counts with `catalogue_lookup.py` first.
