---
id: 34
title: "Classify catalogue cluster: COO portfolio governance and project-control cadence"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 25 Projects rows carrying
"Chief Operations Officer (COO)" as `Who is Responsible` (#267-291).
First role picked up from ticket 0007's "untouched" list for the
Projects department (304 rows total; only the material-request slice —
tickets 0001-0002, 11 rows — was classified before this). COO was
explicitly named as untouched in ticket 0007's tracking table.

## Source rows covered (5 clusters of 5 rows, by shared Trigger)

| Cluster | S.No. range | Shared trigger (abbreviated) | Output/Evidence shape |
|---|---|---|---|
| A. Projects strategy & operating objectives | 267-271 | Annual plan, portfolio change or executive review requires an operating decision | Approved Projects plan, governance decision, KPI action, portfolio record |
| B. Construction-ready handover gate | 272-276 | CTO submits a construction-ready package and commercial/financial gates are visible | Accepted/conditional/rejected handover, assigned Project Engineer, readiness actions |
| C. Project-control cadence review | 277-281 | Daily, weekly or monthly project-control cadence becomes due | Verified portfolio dashboard, decision log, recovery action, named due date |
| D. Programme/resource/safety exception decisions | 282-286 | A programme, resource, safety, client, cost or cross-department exception exceeds routine project authority | Approved recovery, hold, restart, reallocation or escalation decision |
| E. Testing, completion & closeout readiness | 287-291 | Project reaches testing, practical completion, DLP or final-closeout stage | Approved readiness decision, handover record, DLP action, resource-release, improvement record |

All 25 rows: canonical `role.coo` (already in
`docs/canonical-role-map.md`, no change needed).

## Disposition

**Configure approval/decision** (20 rows — clusters A, B, D, E): each
is a gate/exception/readiness decision with the COO as approver and
named functional-chief/CEO escalation, same shape as the other C-suite
approval tickets (0016/0019/0022/0030-cluster-A/0032/0033).

**Periodic review/monitor** (5 rows — cluster C): explicitly cadence-
driven ("daily, weekly or monthly project-control cadence becomes
due") with a measurable, recurring output (verified dashboard, decision
log) — BRD §6.5's review/monitor definition, same reasoning as the
CRO/Document Controller cadence clusters (tickets 0030, 0031).

## Acceptance
- [x] All 25 COO rows (#267-291) classified into 5 trigger clusters.
- [x] Confirmed `role.coo` already exists in
      `docs/canonical-role-map.md`.
- [ ] SLA: source `Timing` is "To be confirmed" for all 25 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 25 COO rows — first
  Projects role picked up after Company/Leadership completed. Projects
  department: 36/304 rows now classified (11 from tickets 0001-0002 +
  25 here), 1 reviewed/excluded (#525), 267 remain untouched (Project
  Engineer Lead, Quantity Surveyor, QHSE Engineer, Site Civil/MEP
  Engineer, Civil/MEP Supervisor, Foreman, Chargehand, Plant &
  Equipment Operator, Skilled/Unskilled Labour, Driver). 915/1,308 rows
  classified overall, 393 remain. Next: pick another Projects role (e.g.
  Project Engineer Lead, 35 rows) or switch to Procurement's CPO/
  vendor-management rows — either is valid per ticket 0007.
