---
id: 27
title: "Classify catalogue cluster: HR & Admin Assistant intake, documents and government filings"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 31 People & Culture rows
carrying "HR & Admin Assistant" as `Who is Responsible` (#1004-1034).
Third batch of the People & Culture department pass (ticket 0007). This
role is the operational-support layer beneath HR & Admin Lead (ticket
0026), same shape as Contracts & Legal Assistant beneath Legal Counsel
(Lead) (ticket 0021) — but with a notably larger share of rows that are
UAE government-portal filing/renewal obligations (visa, MOHRE, Invest in
Dubai, DEQ) rather than pipeline steps, since this is the role that
actually executes PRO/government transactions.

## Source rows covered

**A. Recruitment pre-screening** — trigger: "an approved manpower
requirement reaches the recruitment stage."

| S.No. | Work item |
|---|---|
| 1004 | Pre-screen white-collar candidates through approved recruitment channels |
| 1005 | Pre-screen blue-collar candidates through approved recruitment channels or agencies |
| 1006 | Schedule and prepare candidate interviews |
| 1007 | Complete background checks for locally hired employees |
| 1008 | Collect and verify pre-employment documents |
| 1009 | Maintain candidate follow-up until joining |

**B. Onboarding documentation** — trigger: "an approved candidate
accepts the offer and a joining date is confirmed."

| S.No. | Work item |
|---|---|
| 1010 | Obtain signed employment agreement |
| 1011 | Collect completed employee information form |
| 1012 | Manage passport receipt and acknowledgement under approved policy |
| 1013 | Register employee biometric attendance |
| 1014 | Confirm employment record in employee register and ERP |

**C. Exit processing** — trigger: "a resignation, termination or
employee exit is formally approved."

| S.No. | Work item |
|---|---|
| 1015 | Process work permit and visa cancellation |
| 1016 | Update ERP termination status and last working date |
| 1017 | Return passport or controlled personal documents and obtain acknowledgement |

**D. Visa, travel and PRO transactions** — trigger: "an approved
employment, renewal, cancellation, visit or travel requirement is
received or an expiry alert becomes due."

| S.No. | Work item |
|---|---|
| 1018 | Process employee visas and renewals |
| 1019 | Arrange approved visit visas and air tickets |
| 1020 | Coordinate authorised PRO transactions |

**E. IT/access/asset provisioning** (standalone row) — trigger: "an
approved joiner, employee change, access request, asset requirement or
system update is received."

| S.No. | Work item |
|---|---|
| 1021 | Manage approved Instagram and LinkedIn updates |

**F. Employee lifecycle records and payroll administration** — trigger:
"an employee lifecycle event, approved request or scheduled People &
Culture activity becomes due."

| S.No. | Work item |
|---|---|
| 1022 | Prepare employee and administrative request letters |
| 1023 | Maintain employee master data in Excel and ERP |
| 1024 | Maintain physical and digital employee files |
| 1025 | Distribute payslips securely |
| 1026 | Track annual leave balances and requests |
| 1027 | Consolidate site and office attendance |
| 1028 | Submit Emirates ID data for C3 payroll card processing |

**G. Government-portal document, licence and visa renewal tracking** —
trigger: "an approved office, vehicle, portal, vendor, document or
project-support requirement is received or a renewal becomes due."

| S.No. | Work item |
|---|---|
| 1029 | Track expiry and renewal of company documents, licences and visas |
| 1030 | Process authorised transactions on the MOHRE portal |
| 1031 | Process authorised transactions on the Invest in Dubai portal |
| 1032 | Track DEQ portal updates and required actions |

**H-I. Standalone capabilities.**

| S.No. | Work item | Trigger |
|---|---|---|
| 1033 | Track probation deadlines and confirmation decisions | From the employee joining date. |
| 1034 | Maintain controlled HR forms, templates and revision index | When a form, letter or checklist is created or revised. |

All 31 rows: canonical `role.hr_admin_assistant` (already listed in
`docs/canonical-role-map.md`). Shared escalation throughout: "The HR &
Admin Lead reviews the evidence and provides backup; overdue manager,
government, legal or payment dependencies escalate to the CPCO" —
distinct from HR & Admin Lead's own continuity text (ticket 0026),
confirming this is one operational layer further down.

## Disposition

**Configure workflow** for 24 of 31 rows (A, B, C, E, F, H, I): each is
a recurring operational task with a traceable next consumer — the
recruitment/onboarding/exit clusters (A-C) feed HR & Admin Lead review
and CPCO approval; the IT/access row (E) and lifecycle-records cluster
(F) are ongoing administrative tasks; probation tracking (H) is a
milestone-based workflow routed for approval at the deadline; the
controlled-template index (I) is ongoing document-version maintenance,
same reasoning as Legal Assistant's register-maintenance rows (ticket
0021) staying workflow rather than Track obligation/document.

**Track obligation/document** for 7 of 31 rows (D and G): "process
employee visas and renewals," "arrange approved visit visas and air
tickets," "coordinate authorised PRO transactions" (D, 1018-1020), and
"track expiry and renewal of company documents, licences and visas,"
"process... MOHRE portal," "process... Invest in Dubai portal," "track
DEQ portal updates" (G, 1029-1032) — all explicitly government-portal
filing/renewal transactions, BRD §6.5's own definition almost verbatim,
distinct from HR & Admin Lead's equivalent generic office/vendor/
project-support cluster (ticket 0026 cluster F) which stayed Configure
workflow because it is not government-filing-specific. This mirrors HR
& Admin Lead's own row 983 (ticket 0026), which used the same test on a
single row — here the same test applies to two clusters because this
role does the actual government-portal execution work.

## Acceptance
- [x] All 31 HR & Admin Assistant rows (#1004-1034) classified across 9
      clusters/standalone rows, with D and G (7 rows) split out as Track
      obligation/document.
- [x] Confirmed `role.hr_admin_assistant` already exists in
      `docs/canonical-role-map.md` — no change needed there.
- [ ] Authority limits and SLAs for visa/PRO turnaround are the same
      open PRD §8-9 decision as every other role — not re-litigated
      here.
- [ ] SLA: source `Timing` is "To be confirmed" for all 31 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 31 HR & Admin Assistant
  rows — third role batch of the People & Culture department pass
  (ticket 0007). 2 raw labels / 34 rows remain in People & Culture
  (Office Assistant, IT Support Engineer).
