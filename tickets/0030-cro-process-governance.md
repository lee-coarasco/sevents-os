---
id: 30
title: "Classify catalogue cluster: CRO process, SOP, ERP-workflow and KPI governance"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 60 Research & Development rows
carrying "Chief Research Officer (CRO)" as `Who is Responsible`
(#1069-1128). First of 2 roles in Research & Development (ticket 0007) —
the other is Document Controller (60 rows, not started).

Unlike the CFO/CLO/CMO C-suite rows classified earlier (tickets
0016/0019/0022), which skewed heavily to **Configure approval/decision**
because those roles' own verbs were mostly "approve X", the CRO's own
verbs here are mostly "set/design/define/maintain/govern/resolve/
coordinate/benchmark/evaluate" — the CRO is Sevents' internal process-
excellence and R&D function (process architecture, SOP governance,
FirstBit ERP workflow change control, master-data governance, KPI/
performance management, continuous improvement, innovation scouting,
lessons-learned, change management), not a pure financial/legal sign-off
authority. The CEO is the escalation point for material decisions
throughout (shared `Continuity/Escalation` text: "company architecture,
SOP governance, material ERP/master-data change, pilot scale decisions
and unresolved cross-department ownership remain with the CRO or
escalate to the CEO"), but the CRO's day-to-day rows are themselves
operational governance workflows, not approval gates. This is the
expected, data-driven result of this role's actual verbs — not a
classification inconsistency with the other CXO tickets.

## Source rows covered (10 clusters of 6 rows, by shared Trigger)

| Cluster | S.No. range | Shared trigger (abbreviated) | Output/Evidence shape |
|---|---|---|---|
| A. Strategy & portfolio governance | 1069-1074 | Annual strategy cycle, executive instruction, new initiative or portfolio review requires R&D direction | Approved R&D strategy, prioritised portfolio, business case, stage-gate decision, executive report |
| B. Process architecture | 1075-1080 | New service, department change, workflow conflict, ownership gap or process review affects the operating model | Controlled process architecture, inventory, owner assignment, handoff map, RACI, resolved ownership |
| C. SOP framework & lifecycle | 1081-1086 | New process, control gap, audit finding, policy change or scheduled SOP review requires documented control | Approved SOP, form, checklist, revision decision, review schedule, deviation record |
| D. FirstBit ERP workflow change control | 1087-1092 | Department requests a new/changed FirstBit workflow, approval, status, field, role or exception route | Approved workflow blueprint, UAT evidence, controlled configuration release, change record, adoption report |
| E. Master-data governance | 1093-1098 | New master-data record, correction, duplicate, merge, deactivation or data-quality issue submitted | Valid FirstBit master-data record or controlled rejection with audit trail |
| F. KPI & performance management | 1099-1104 | KPI design, weekly/monthly cutoff, threshold breach, reconciliation issue or performance review becomes due | Controlled KPI definition, reconciled dashboard, exception analysis, corrective action, closure record |
| G. Continuous improvement | 1105-1110 | Audit finding, recurring failure, delay, rework pattern, user suggestion or control gap requires improvement | Prioritised improvement record, root-cause analysis, future-state design, trial evidence, benefit result, closure decision |
| H. Innovation scouting & evaluation | 1111-1116 | New method, tool, automation opportunity, benchmark finding or approved innovation idea requires evaluation | Benchmark, feasibility assessment, business case, PoC result, scale/modify/stop recommendation |
| I. Lessons-learned & knowledge management | 1117-1122 | Stage gate, incident, recurring problem, completed project or management review produces a reusable lesson | Validated lesson, root cause, repository entry, approved SOP/workflow/training change, adoption record |
| J. Change management & continuity | 1123-1128 | Approved process/system/data/organisational change moves toward deployment or requires continuity control | Change-impact assessment, readiness plan, training/hypercare record, continuity arrangement, risk/decision/action register |

All 60 rows: canonical `role.cro` (already in `docs/canonical-role-map.md`,
no change needed).

## Disposition

**Configure workflow** (48 rows — clusters B, C, D, E, G, H, I, J): each
is a multi-step operational pipeline the CRO runs end-to-end (design →
route → verify → release → monitor), not a single sign-off gate. Matches
BRD §6.5's workflow definition directly.

**Configure approval/decision** (6 rows — cluster A): the CRO's own
verbs here are strategy-setting/portfolio decisions ("set", "approve
initiative charters", "align portfolio") that are themselves the
decision point, with the CEO/CFO as the escalation/co-sign authority for
material investment — same reasoning as the CFO/CLO/CMO strategy
clusters (tickets 0016/0019/0022).

**Periodic review/monitor** (6 rows — cluster F): explicitly cadence-
driven ("weekly/monthly cutoff") plus threshold-breach monitoring, with
a measurable output (reconciled dashboard, exception analysis) — BRD
§6.5's review/monitor definition.

## Acceptance
- [x] All 60 CRO rows (#1069-1128) classified into 10 trigger clusters.
- [x] Confirmed `role.cro` already exists in `docs/canonical-role-map.md`.
- [ ] SLA: source `Timing` is "To be confirmed" for all 60 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 60 CRO rows — first of 2
  Research & Development roles. 760/1,308 rows classified overall, 548
  remain. Next: Document Controller (60 rows), the only remaining role in
  Research & Development.
