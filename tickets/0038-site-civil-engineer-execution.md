---
id: 38
title: "Classify catalogue cluster: Site Civil Engineer execution"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 28 Projects rows carrying "Site
Civil Engineer" as `Who is Responsible` (#327-354). Fifth Projects role
picked up, after COO (0034), Project Engineer Lead (0035), Quantity
Surveyor (0002/0036) and QHSE Engineer (0037). This is the discipline
engineer who runs civil work fronts under the Project Engineer Lead's
daily coordination.

## Source rows covered (5 clusters, by shared Trigger)

| Cluster | S.No. range | Rows | Shared trigger (abbreviated) | Output/Evidence shape |
|---|---|---|---|---|
| A. Work-front mobilisation/release readiness | 327-330 | 4 | A civil work front is scheduled for mobilisation or release | Verified civil readiness record, controlled input set, closed/assigned pre-start actions |
| B. Daily/lookahead work planning | 331-336 | 6 | An approved civil activity enters the daily or lookahead plan | Civil work plan, engineering record, resource request, coordinated interface decision |
| C. Supervised execution | 337-342 | 6 | An approved civil work front, method and inspection plan are released | Executed civil work meeting drawing, sequence, tolerance and protection requirements |
| D. Material/inspection/concealment control | 343-348 | 6 | Civil material arrives or work reaches an inspection, concealment or resource-control point | Approved material evidence, WIR, RFI, NCR closure or reconciled consumption record |
| E. Reporting, measurement & closeout | 349-354 | 6 | Daily reporting, measurement, snag or civil-closeout milestone becomes due | Verified civil quantities, progress evidence, red-lines, inspection status, completion handover |

All 28 rows: canonical `role.site_civil_engineer` (already in
`docs/canonical-role-map.md`, mapped from source label "Site Manager/Site
Engineer", no change needed).

## Disposition

**Configure workflow** for all 28 rows. Every cluster is the Site Civil
Engineer personally executing, supervising or verifying a discipline
operational pipeline (readiness check → plan → supervise execution →
control materials/inspections → report/close out) with no final sign-off
authority anywhere: every cluster's Continuity/Escalation text routes
IFC, quality, quantity, temporary-work or safety risk up to the Project
Engineer, CTO or QHSE. Same pattern as Project Engineer Lead (ticket
0035) one level up and QHSE Engineer's inspection clusters (ticket 0037)
— a site discipline role with zero approval/decision rows. Cluster D's
"raise RFIs" and "record NCRs" rows stay Configure workflow rather than
Configure approval/decision because this role raises/records, it does
not decide the RFI answer or approve NCR closure (that sits with the
Project Engineer/CTO/QHSE per the Control/Handoff text).

## Acceptance
- [x] All 28 Site Civil Engineer rows (#327-354) classified into 5
      trigger clusters, all Configure workflow.
- [x] Confirmed `role.site_civil_engineer` already exists in
      `docs/canonical-role-map.md`.
- [ ] SLA: source `Timing` is "To be confirmed" for all 28 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 28 Site Civil Engineer
  rows — fifth Projects role. Projects: 154/304 rows classified, 150
  remain (Site MEP Engineer 28 rows, Civil/MEP Supervisor, Foreman,
  Chargehand, Plant & Equipment Operator, Skilled/Unskilled Labour,
  Driver all untouched). 1,033/1,308 rows classified overall, 275
  remain. Next: Site MEP Engineer (28 rows) is the next-largest
  untouched Projects role, same pattern as this ticket.
