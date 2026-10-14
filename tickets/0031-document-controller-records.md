---
id: 31
title: "Classify catalogue cluster: Document Controller intake, registers and closeout"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 60 Research & Development rows
carrying "Document Controller" as `Who is Responsible` (#1129-1188).
Second and final role in Research & Development (ticket 0007) —
completes the department (120/120 rows). This role directly maps to
M13 "Documents, Drawings & Records" (BRD §7), with the recurring
boundary line across every cluster: "the Document Controller never
approves technical, legal, commercial or financial content" — it
administers the controlled record, the named functional owner/approver
owns the content decision.

## Source rows covered (10 clusters of 6 rows, by shared Trigger)

| Cluster | S.No. range | Shared trigger (abbreviated) | Output/Evidence shape |
|---|---|---|---|
| A. Intake & registration | 1129-1134 | A document enters the controlled-document process | Uniquely registered document with verified ownership/metadata/status |
| B. Classification & version control | 1135-1140 | Document registered, revised, reclassified or requires controlled access | Classified, named, numbered, access-controlled document with version history |
| C. Review & approval routing | 1141-1146 | Registered document ready for review, approval, correction or controlled release | Completed review trail, approval evidence, controlled issue, status/supersession link |
| D. Transmittals & correspondence | 1147-1152 | Approved document/correspondence requires internal/external transmission and response tracking | Controlled transmittal/correspondence record with delivery evidence, response owner, due date |
| E. Project technical registers | 1153-1158 | A drawing, BOQ, spec, submittal, RFI, authority submission or IFC package is created/revised/returned | Current project technical register, controlled submission, IFC handover evidence |
| F. Corporate/SOP document registers | 1159-1164 | An SOP, policy, form, org record, matrix or corporate reference is approved/revised/scheduled for review | Current controlled corporate-document register with owner/approver/revision/review date |
| G. Meeting/decision/evidence registers | 1165-1170 | A meeting, decision, action, risk, change, report, inspection or certificate record is approved for control | Registered, searchable evidence record linked to project/process with follow-up status |
| H. Change control & nonconformities | 1171-1176 | A controlled document change, revision conflict, obsolete copy, unauthorised issue or nonconformity is identified | Controlled change/reissue, withdrawn obsolete version, notification, corrective-action closure |
| I. Project closeout & retention | 1177-1182 | A project stage, completion, DLP closeout, matter closure or retention event requires final record control | Reconciled handover index, final-record package, controlled archive, retention/disposal status |
| J. Cadence reporting & continuity checks | 1183-1188 | Weekly/monthly cutoff, spot-check cycle, user-support request, absence, access issue or recovery test becomes due | Overdue/KPI report, audit result, continuity record, archive-recovery test result |

All 60 rows: canonical `role.document_controller` (already in
`docs/canonical-role-map.md`, no change needed).

## Disposition

**Configure workflow** (54 rows — clusters A-I): every cluster is a
recurring, system-supported document/records-management capability
(intake → classify → route → transmit → register → control change →
close out) matching M13's responsibility list directly. This includes
the "register maintenance" clusters (E, F, G) — unlike the UAE
statutory-renewal rows classified as Track obligation/document
elsewhere (e.g. Office Assistant/ticket 0028's Mulkiya/RTA/Salik rows),
these are not filing/signature/physical-paper/renewal obligations; they
are the Document Controller operating the ERP's own controlled-document
and records registers, which is the actionable workflow capability
itself.

**Periodic review/monitor** (6 rows — cluster J): explicitly cadence-
driven ("weekly/monthly cutoff, spot-check cycle") with a measurable
output (KPI/exception report, audit result, recovery-test result) —
BRD §6.5's review/monitor definition directly, same reasoning as the
CRO ticket's (0030) KPI cluster and other periodic-cadence rows
classified earlier in this catalogue.

## Acceptance
- [x] All 60 Document Controller rows (#1129-1188) classified into 10
      trigger clusters.
- [x] Confirmed `role.document_controller` already exists in
      `docs/canonical-role-map.md`.
- [x] Research & Development department now fully classified (120/120
      rows, tickets 0030-0031).
- [ ] SLA: source `Timing` is "To be confirmed" for all 60 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 60 Document Controller
  rows — second and final Research & Development role. 820/1,308 rows
  classified overall, 488 remain. Next: Company/Leadership (70 rows, not
  started) is the only remaining department per ticket 0007's table.
