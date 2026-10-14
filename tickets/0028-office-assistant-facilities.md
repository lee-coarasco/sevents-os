---
id: 28
title: "Classify catalogue cluster: Office Assistant facilities, fleet and admin support"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 21 People & Culture rows
carrying "Office Assistant" as `Who is Responsible` (#1035-1055). Fourth
batch of the People & Culture department pass (ticket 0007). This role
covers office facilities, company-vehicle administration and general
admin support, reporting to HR & Admin Lead (ticket 0026).

## Source rows covered

**A. Onboarding office/facility setup** — trigger: "an approved
candidate accepts the offer and a joining date is confirmed."

| S.No. | Work item |
|---|---|
| 1035 | Conduct office and facility orientation |
| 1036 | Allocate workstation and company assets |
| 1037 | Arrange approved employee transportation |

**B. Uniform and asset issuance** (standalone row) — trigger: "an
employee lifecycle event, approved request or scheduled People & Culture
activity becomes due."

| S.No. | Work item |
|---|---|
| 1038 | Issue uniforms and colour-coded safety helmets |

**C. Office, vehicle, vendor and document administration** — trigger:
"an approved office, vehicle, portal, vendor, document or
project-support requirement is received or a renewal becomes due." Split
by output shape (see Disposition):

| S.No. | Work item |
|---|---|
| 1039 | Collect and reconcile vehicle tracking sheets |
| 1040 | Maintain controlled company document files |
| 1041 | Handle office correspondence, calls and shared email |
| 1042 | Coordinate vehicle insurance and Mulkiya renewal |
| 1043 | Coordinate RTA fines, testing and vehicle passing |
| 1044 | Register Salik for new vehicles |
| 1045 | Register vehicles in ENOC VIP |
| 1046 | Upload approved purchase details and receipts to Pluto |
| 1047 | Maintain office and pantry supplies |
| 1048 | Coordinate office requirements with building management |
| 1049 | Coordinate GPS installation for new vehicles |
| 1051 | Track cleaner attendance and service completion |

**D-H. Standalone capabilities.**

| S.No. | Work item | Trigger |
|---|---|---|
| 1050 | Maintain the PWD sheet after purpose and data-standard approval | Only after the CPCO approves the PWD sheet's purpose, fields, sources, owner, review frequency and approver. |
| 1052 | Prepare meeting rooms, refreshments and internal logistics | An approved meeting or company activity is scheduled. |
| 1053 | Support filing, scanning, copying and dispatch | An authorised document request is received. |
| 1054 | Report facility maintenance and office safety issues | During daily office checks or when an issue is reported. |
| 1055 | Maintain office support request and completion log | For each office-support request. |

All 21 rows: canonical `role.office_assistant` (already listed in
`docs/canonical-role-map.md`). Shared escalation throughout: "The HR &
Admin Assistant or HR & Admin Lead provides operational backup;
building, vehicle, vendor or service exceptions escalate to the HR &
Admin Lead."

## Disposition

**Configure workflow** for 15 of 21 rows (A, B, the general-admin half
of C, D, E, F, H): onboarding facility setup (A), uniform issuance (B),
and the general-admin rows within C — 1039 (vehicle tracking-sheet
reconciliation), 1040 (document files), 1041 (correspondence), 1046
(purchase-receipt upload), 1047 (supplies), 1048 (building-management
coordination), 1051 (cleaner tracking) — are recurring administrative
tasks with a traceable next consumer (HR & Admin Lead). The PWD-sheet
row (1050, D) is ongoing controlled-data maintenance gated by a prior
CPCO approval — analogous to register/index-maintenance rows classified
workflow elsewhere (e.g. Legal Assistant, ticket 0021). Meeting-room
prep (1052, E), filing/dispatch support (1053, F) and the office-support
log (1055, H) are each a recurring operational task with a downstream
recipient.

**Track obligation/document** for the vehicle-licensing half of cluster
C (5 rows): "coordinate vehicle insurance and Mulkiya renewal" (1042),
"coordinate RTA fines, testing and vehicle passing" (1043), "register
Salik for new vehicles" (1044), "register vehicles in ENOC VIP" (1045)
and "coordinate GPS installation for new vehicles" (1049) — all explicit
UAE vehicle-registration/licensing/renewal transactions, the same test
used to split HR & Admin Assistant's visa/PRO rows (ticket 0027) from
its general-admin rows.

**Periodic review/monitor** for 1054 ("report facility maintenance and
office safety issues"): an explicit scheduled check ("during daily
office checks") with a measurable exception output tracked to closure —
BRD §6.5's review/monitor definition directly.

## Acceptance
- [x] All 21 Office Assistant rows (#1035-1055) classified, with cluster
      C split 7 Configure workflow / 5 Track obligation/document by
      output shape, and 1054 split out as Periodic review/monitor.
- [x] Confirmed `role.office_assistant` already exists in
      `docs/canonical-role-map.md` — no change needed there.
- [ ] SLA: source `Timing` is "To be confirmed" for all 21 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 21 Office Assistant
  rows — fourth role batch of the People & Culture department pass
  (ticket 0007). 1 raw label / 13 rows remain in People & Culture (IT
  Support Engineer).
