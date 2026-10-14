---
id: 37
title: "Classify catalogue cluster: QHSE Engineer site safety, quality and incident control"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 30 Projects rows carrying
"QHSE Engineer" as `Who is Responsible` (#541-570). Fourth Projects
role picked up after COO (0034), Project Engineer Lead (0035) and
Quantity Surveyor (0036). Per `docs/canonical-role-map.md`, this role
spans both the QA/QC Engineer and Safety Officer BRD §3.1 personas as
one job title — maps to M19 (Quality, Inspection & NCR) and M20
(Safety, Incidents & Compliance) in the module catalogue. **M20's
module description explicitly states "Safety decisions remain
human-controlled"** — note this for any later AI-agent-studio scoping
work (M29/M30): stop-work and incident-response capabilities in this
ticket must never be delegated to an autonomous agent.

## Source rows covered (6 clusters, by shared Trigger)

| Cluster | S.No. range | Rows | Shared trigger (abbreviated) | Output/Evidence shape |
|---|---|---|---|---|
| A. Mobilisation HSE/quality setup | 541-545 | 5 | Project mobilised or a material QHSE requirement changes | Approved HSE/quality plans, requirement registers, emergency controls, pre-start readiness |
| B. Pre-work approval gate | 546-550 | 5 | A method, material, high-risk activity, inspection or competency approval is required | Approved method/RA/ITP/submittal, permit control, competency/certification record |
| C. Daily site inspection | 551-555 | 5 | Daily work proceeds or a planned safety/quality inspection becomes due | Inspection evidence, corrective actions, verified controls, stop-work record |
| D. Inspection-point & NCR management | 556-560 | 5 | Material arrives, work reaches inspection/test point or nonconformity is identified | Accepted/rejected status, test evidence, NCR record, corrective-action closure |
| E. Incident & emergency response | 561-565 | 5 | An accident, incident, near miss, emergency or serious unsafe condition occurs | Controlled response, notification, investigation, root cause, closed preventive action |
| F1. QHSE performance reporting | 566-567 | 2 | Shift, task or inspection point is completed | Daily/weekly QHSE performance report, KPI/audit/overdue-action dashboard |
| F2. Record compilation & closeout | 568-570 | 3 | Same as F1, but closeout-specific rows | Compiled inspection/NCR records, testing/commissioning support, closeout dossier handover |

All 30 rows: canonical `role.qhse_engineer` (already in
`docs/canonical-role-map.md`, no change needed).

## Disposition

**Configure workflow** (23 rows — clusters A, C, D, E, F2): recurring
operational capabilities matching M19/M20's module descriptions
directly (HSE/quality plan setup, daily inspection with corrective
actions, inspection-point/NCR lifecycle, incident response/
investigation/CAPA, closeout record compilation).

**Configure approval/decision** (5 rows — cluster B): every row's
shared Control/Handoff text states "Affected work stays on hold until
reviews and approvals are complete" — the QHSE Engineer is the named
gating authority for method statements, material submittals, permits
and competency before work may proceed, matching BRD §6.5's
approval/decision shape (an approver, inputs, recorded outcome,
follow-up), distinct from Document Controller's review-routing rows
(ticket 0031) where the controller explicitly never approves content.

**Periodic review/monitor** (2 rows — cluster F1, #566-567): split out
of the F cluster the same way as Quantity Surveyor's monthly-forecast
split (ticket 0036) — "prepare daily and weekly QHSE performance
reports" and "maintain QHSE KPIs, audit findings and overdue-action
dashboard" are cadence-driven reporting with a measurable output,
while #568-570 in the same raw cluster are closeout-event workflow
actions.

## Acceptance
- [x] All 30 QHSE Engineer rows (#541-570) classified into 6 trigger
      clusters (one split into two by output shape).
- [x] Confirmed `role.qhse_engineer` already exists in
      `docs/canonical-role-map.md`.
- [x] Flagged the human-controlled-safety-decision constraint (BRD
      M20) for future AI-agent-studio scoping.
- [ ] SLA: source `Timing` is "To be confirmed" for all 30 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 30 QHSE Engineer rows
  — fourth Projects role. Projects: 126/304 rows classified, 178 remain
  untouched (Site Civil/MEP Engineer, Civil/MEP Supervisor, Foreman,
  Chargehand, Plant & Equipment Operator, Skilled/Unskilled Labour,
  Driver). 1,005/1,308 rows classified overall, 303 remain. Next: Site
  Civil Engineer or Site MEP Engineer (28 rows each) are the
  next-largest untouched Projects roles.
