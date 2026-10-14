---
id: 25
title: "Classify catalogue cluster: CPCO People & Culture governance"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 6 People & Culture rows
carrying "Chief People & Culture Officer (CPCO)" as `Who is
Responsible` (#971-976). First batch of the People & Culture department
pass (ticket 0007). Smallest CXO raw-label count in the catalogue (6
rows vs. 25-30 for other departments' top role) — the source text here
is also shaped differently from every other department classified so
far: each row carries its own distinct trigger/action/output text rather
than 5 rows sharing one cluster trigger, so this ticket lists all 6
individually instead of grouping into trigger-clusters.

## Source rows covered

| S.No. | Work item | Trigger |
|---|---|---|
| 971 | Set workforce organisation and People & Culture strategy | At the annual planning cycle or a material organisation change. |
| 972 | Approve manpower plan, recruitment and compensation proposals | When departments submit validated manpower needs. |
| 973 | Approve employment, salary, leave and termination decisions | When a controlled employment decision exceeds routine processing. |
| 974 | Review performance, capability and succession risks | Quarterly and annually. |
| 975 | Govern employee relations, discipline and grievance cases | When a grievance, misconduct or material employee-relations issue is raised. |
| 976 | Report workforce cost, compliance and People & Culture KPIs | At the approved monthly and quarterly reporting cadence. |

All 6 rows: canonical `role.cpco` (already listed in
`docs/canonical-role-map.md`). Shared escalation throughout: "An
authorised CEO-approved delegate may act only within the approved
Delegation of Authority; reserved or material decisions escalate to the
CEO" — same reserved-decision pattern as every other CXO role classified
so far, though phrased more tersely than the Finance/Legal/Marketing CXO
rows (this department's source text throughout is noticeably shorter per
field than other departments — not a different disposition approach,
just a terser source style).

## Disposition

**Configure approval/decision** for 971, 972, 973, 975: each has a named
approver (CPCO), a bounded trigger and a recorded outcome ("recorded
approved organisation and workforce plan," "retained manpower plan
decision record," "recorded approval or rejection," "complete retained
case record") with no further recurring task.

**Periodic review/monitor** for 974, 976: both are explicitly
cadence-based scheduled reviews rather than bounded decisions — "review
performance, capability and succession risks" at a fixed "quarterly and
annually" cadence (974), and "report workforce cost, compliance and
People & Culture KPIs" at "the approved monthly and quarterly reporting
cadence" (976) — same reasoning as every other CXO's reporting-row split
(CFO's 735, CLO's 1213/1215, CMO's 880).

## Acceptance
- [x] All 6 CPCO rows (#971-976) classified individually (no
      trigger-cluster grouping — each row has distinct trigger text).
- [x] Confirmed `role.cpco` already exists in `docs/canonical-role-map.md`
      — no change needed there.
- [ ] Authority limits (compensation/termination approval thresholds,
      Delegation of Authority detail) are the same open PRD §8-9
      decision as every other role — not re-litigated here.
- [ ] SLA: source `Timing` is "To be confirmed" for all 6 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 6 CPCO rows — first role
  batch of the People & Culture department pass (ticket 0007). 4 raw
  labels / 92 rows remain in People & Culture (HR & Admin Lead, HR &
  Admin Assistant, Office Assistant, IT Support Engineer).
