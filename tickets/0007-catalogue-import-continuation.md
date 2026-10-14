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
| Projects | 304 | 126 | Partial — material-request slice (0001-0002) + COO (0034) + Project Engineer Lead (0035) + Quantity Surveyor (0036) + QHSE Engineer (0037); Site Civil/MEP Engineer, Civil/MEP Supervisor, Foreman/Chargehand/labour rows all untouched |
| Procurement | 160 | 35 | Partial — CPO strategy/governance rows (571-600 minus 582/584), vendor-management-beyond-RFQ rows untouched |
| Technical Engineering | 196 | 196 | Done — tickets 0008-0015 (all 8 roles) |
| Finance | 120 | 120 | Done — tickets 0016-0018 (all 3 roles) |
| Legal | 120 | 120 | Done — tickets 0019-0021 (all 3 roles) |
| Marketing & Sales | 120 | 120 | Done — tickets 0022-0024 (all 3 roles) |
| People & Culture | 98 | 98 | Done — tickets 0025-0029 (all 5 roles) |
| Research & Development | 120 | 120 | Done — tickets 0030-0031 (both roles) |
| Company / Leadership | 70 | 70 | Done — tickets 0032-0033 (both roles) |
| **Total** | **1,308** | **1,005** | **303 rows remain** |

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
  (ticket 0010, 22 rows), Civil Draftsman (ticket 0011, 20 rows),
  Electrical Draftsman (ticket 0012, 24 rows), HVAC & Plumbing Draftsman
  (ticket 0013, 25 rows), Civil Estimator (ticket 0014, 25 rows), then
  MEP Estimator (ticket 0015, 25 rows) — Technical Engineering department
  now fully classified (196/196 rows, tickets 0008-0015). Then started
  Finance with CFO (ticket 0016, 30 rows) — first department where the
  CXO role skews almost entirely to Configure approval/decision rather
  than Configure workflow (see ticket 0016's Disposition section for why).
  Then classified Senior Accountant (Lead) (ticket 0017, 45 rows) — first
  use of the Defer disposition, for the Phase 5 vendor-bill-matching/
  payment cluster already excluded from the pilot per DECISIONS.md. Then
  Accountant (ticket 0018, 45 rows), completing Finance (120/120 rows,
  tickets 0016-0018), with a second consistent Defer cluster one role
  level down from 0017's. 946 rows remain overall.
- 2026-10-14 (later session): Classified Legal in full — CLO (ticket
  0019, 30 rows, CXO skew to Configure approval/decision like CFO/ticket
  0016 but with a larger review/monitor slice because more rows use
  oversight/advisory verbs than "approve"), Legal Counsel (Lead) (ticket
  0020, 50 rows, all Configure workflow — the operational role running
  the matter/contract/claims pipelines the CLO approves into), and
  Contracts & Legal Assistant (ticket 0021, 40 rows, mostly Configure
  workflow with a small Periodic review/monitor + Track obligation/
  document split for the reporting/archival-rule rows, same pattern as
  Accountant/ticket 0018). Legal department complete (120/120 rows,
  tickets 0019-0021). 826 rows remain overall.
- 2026-10-14 (later session): Classified Marketing & Sales in full — CMO
  (ticket 0022, 30 rows, CXO skew to Configure approval/decision 24/30
  with a review/monitor split 6/30 like CFO/CLO), Marketing Manager
  (Lead) (ticket 0023, 50 rows, mostly Configure workflow 46/50 running
  the campaign/lead pipeline the CMO approves into, with a small
  review/monitor split 4/50 for scheduled pipeline/performance reports),
  and Business Development Executive (ticket 0024, 40 rows, almost all
  Configure workflow 39/40 — the most junior operational layer,
  prospecting through technical-handover support — with 1 review/monitor
  row for daily/weekly pipeline reporting). Marketing & Sales department
  complete (120/120 rows, tickets 0022-0024). 706 rows remain overall.
- 2026-10-14 (later session): Started People & Culture — this
  department's source text is shaped differently (shorter fields, many
  rows with distinct individual triggers rather than 5-row clusters
  sharing one trigger sentence). Classified CPCO (ticket 0025, 6 rows,
  smallest CXO raw-label count in the catalogue) and HR & Admin Lead
  (ticket 0026, 27 rows, mostly Configure workflow with one Track
  obligation/document row for visa/PRO/renewal transactions). 673 rows
  remain overall.
- 2026-10-14 (later session): Classified HR & Admin Assistant (ticket
  0027, 31 rows) — mostly Configure workflow (24/31) with a larger
  Track obligation/document split (7/31) than HR & Admin Lead's single
  row, since this role executes the actual visa/MOHRE/Invest-in-Dubai/
  DEQ government-portal filing transactions. 642 rows remain overall.
- 2026-10-14 (later session): Classified Office Assistant (ticket 0028,
  21 rows) — facilities/fleet/admin support, split 15 Configure workflow
  / 5 Track obligation/document (UAE vehicle-registration/licensing rows:
  Mulkiya, RTA, Salik, ENOC VIP, GPS) / 1 Periodic review/monitor (daily
  facility/safety checks). 621 rows remain overall. Next: IT Support
  Engineer (13 rows) is the last role in People & Culture.
- 2026-10-14 (later session): Classified IT Support Engineer (ticket
  0029, 13 rows) — joiner/leaver access provisioning and exit clearance
  (1056-1059, 1062-1064 all Configure workflow, same joiner/mover/leaver
  pipeline as HR & Admin Lead/Assistant/Office Assistant), asset/licence/
  access register maintenance (1065) and event-triggered incident/
  security reporting (1066, 1068) also Configure workflow, with 1067
  ("perform backup, endpoint security and patch controls" — run "at the
  approved security cadence") split out as the one Periodic review/
  monitor row. **People & Culture department now fully classified
  (98/98 rows, tickets 0025-0029).** This correction fixes a handoff gap:
  ticket 0029 was committed in session `a666da1` (13:37 UTC) but that
  session ended before updating this tracking table, so the table still
  read "IT Support Engineer untouched" / 621 rows remain for four later
  sessions. 700/1,308 rows classified, 608 remain. Next: Research &
  Development (120 rows, 2 roles — CRO 60 rows, Document Controller 60
  rows), the next "not started" department in the table above.
- 2026-10-14 (later session): Classified CRO (ticket 0030, 60 rows) —
  first of 2 Research & Development roles. Verb mix skews mostly
  Configure workflow (48/60: process architecture, SOP lifecycle,
  FirstBit ERP workflow change control, master-data governance,
  continuous improvement, innovation scouting, lessons-learned, change
  management) rather than Configure approval/decision like the other
  C-suite tickets, because the CRO is an internal process-excellence/R&D
  function, not a pure sign-off authority — only the strategy/portfolio
  cluster (6/60) is Configure approval/decision, plus KPI/performance
  management (6/60) as Periodic review/monitor. 760/1,308 rows
  classified, 548 remain. Next: Document Controller (60 rows), the last
  role in Research & Development.
- 2026-10-14 (later session): Classified Document Controller (ticket
  0031, 60 rows) — second and final Research & Development role. Mostly
  Configure workflow (54/60: intake/registration, classification/
  version control, review/approval routing, transmittals/correspondence,
  project technical registers, corporate/SOP document registers,
  meeting/decision/evidence registers, change control/nonconformities,
  project closeout/retention), with the weekly/monthly cadence reporting
  and continuity-check cluster (6/60) as Periodic review/monitor.
  **Research & Development department now fully classified (120/120
  rows, tickets 0030-0031).** 820/1,308 rows classified, 488 remain.
  Next: Company/Leadership (70 rows) is the only remaining department.
- 2026-10-14 (later session): Classified Chairman (ticket 0032, 20
  rows) — first of 2 Company/Leadership roles. All 20 rows Configure
  approval/decision (vision/strategy governance, CEO appointment/
  performance, budget/capital/financial exposure, strategic portfolio/
  crisis/board oversight) — sharper skew than any other C-suite ticket
  so far, zero workflow or review/monitor slice, because the Chairman's
  entire catalogue footprint is reserved-matter sign-off with execution
  staying with the CEO. 840/1,308 rows classified, 468 remain. Next: CEO
  (50 rows), the last role in the last department.
- 2026-10-14 (later session): Classified CEO (ticket 0033, 50 rows) —
  second and final Company/Leadership role, same all-Configure-
  approval/decision pattern as Chairman (ticket 0032). **Company/
  Leadership department now fully classified (70/70 rows).** 890/1,308
  rows classified overall, 418 remain. Only two departments are still
  open — both partially done from the original pilot-flow tickets
  (0001-0006), before this tracking ticket existed: Projects (304 total,
  11 classified +1 excluded, 293 remain — QHSE, QS billing/claims, COO,
  Foreman/Chargehand/labour and schedule/progress rows all untouched)
  and Procurement (160 total, 35 classified, 125 remain — CPO strategy/
  governance rows 571-600 minus 582/584, and vendor-management-beyond-
  RFQ rows). Next: pick either department's largest untouched role
  using `catalogue_lookup.py`, same method as every batch above.
- 2026-10-14 (later session): Classified COO (ticket 0034, 25 rows) —
  first Projects role picked up. Mostly Configure approval/decision
  (20/25: strategy/operating objectives, construction-ready handover
  gate, programme/resource/safety exception decisions, testing/
  completion/closeout readiness), with the daily/weekly/monthly
  project-control cadence cluster (5/25) as Periodic review/monitor.
  Projects: 36/304 rows classified (11 pilot + 25 COO), 267 remain.
  915/1,308 rows classified overall, 393 remain. Next: any other
  Projects role (Project Engineer Lead 35 rows is the next-largest) or
  Procurement's untouched CPO/vendor-management rows.
- 2026-10-14 (later session): Classified Project Engineer (Lead)
  (ticket 0035, 35 rows) — second Projects role. All 35 rows Configure
  workflow (project acceptance/setup, mobilisation planning, daily site
  coordination, procurement/billing coordination, progress/variation
  management, testing/handover/DLP) — the clean inverse of COO's
  (0034) mostly-approval pattern, since the PE Lead executes and
  coordinates but holds no final sign-off anywhere. Projects: 71/304
  rows classified, 232 remain. 950/1,308 rows classified overall, 358
  remain. Next: Quantity Surveyor (28 rows) is the next-largest
  untouched Projects role.
- 2026-10-14 (later session): Classified the remaining 25 Quantity
  Surveyor rows (ticket 0036), resolving ticket 0002's deferred row
  #525. Mostly Configure workflow (23/25: cost-baseline setup, budget
  tracking, progress measurement, variation/claims management, client/
  subcontractor billing, final-account/closeout), with the monthly
  forecast/variance-reporting pair (537-538) as Periodic review/monitor.
  Quantity Surveyor role now fully classified (28/28 combining tickets
  0002 and 0036). Projects: 96/304 rows classified, 208 remain.
  975/1,308 rows classified overall, 333 remain. Next: QHSE Engineer
  (30 rows) is the next-largest untouched Projects role.
- 2026-10-14 (later session): Classified QHSE Engineer (ticket 0037,
  30 rows) — fourth Projects role, spanning both QA/QC and Safety
  Officer personas as one job title (M19/M20 in the module catalogue).
  Mostly Configure workflow (23/30: mobilisation HSE/quality setup,
  daily site inspection, inspection-point/NCR management, incident/
  emergency response, record compilation/closeout), with the pre-work
  method/material/permit/competency approval gate (546-550, 5/30) as
  Configure approval/decision and the daily/weekly QHSE reporting pair
  (566-567, 2/30) as Periodic review/monitor. Flagged BRD M20's "safety
  decisions remain human-controlled" constraint for future AI-agent-
  studio scoping. Projects: 126/304 rows classified, 178 remain.
  1,005/1,308 rows classified overall, 303 remain. Next: Site Civil
  Engineer or Site MEP Engineer (28 rows each) are the next-largest
  untouched Projects roles.
