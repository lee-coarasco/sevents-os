---
id: 42
title: "Classify catalogue cluster: Foreman execution"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 18 Projects rows carrying
"Foreman" as `Who is Responsible` (#423-440). Ninth Projects role, one
tier below Civil/MEP Supervisor (tickets 0040-0041) in the field chain
of command — the catalogue does not split Foreman by trade (civil vs.
MEP), unlike Supervisor/Site Engineer above it.

## Source rows covered (4 clusters, by shared Trigger)

| Cluster | S.No. range | Rows | Shared trigger (abbreviated) | Output/Evidence shape |
|---|---|---|---|---|
| A. Receive target & brief crew | 423-426 | 4 | The supervisor issues the approved daily target | Briefed crew, ready work front, recorded pre-start constraint status |
| B. Organise & execute | 427-431 | 5 | The crew is released to execute the approved task | Organised and sequenced work with protected interfaces, controlled materials, safe access |
| C. Monitor & check | 432-436 | 5 | Work is in progress or ready for internal checking | Productivity, quality, wastage, delay and corrective-action record |
| D. Report & handover | 437-440 | 4 | The task or shift reaches reporting and handover cutoff | Reported attendance, completed quantity, next-shift need, secured work-front status |

All 18 rows: canonical `role.foreman` (already in
`docs/canonical-role-map.md`, "(new) field supervisory, reports to
Supervisor"; no map change needed).

## Disposition

**Configure workflow** for all 18 rows: same authority-capped
operational pattern as Civil/MEP Supervisor (tickets 0040-0041), one
tier further down — "changes to drawing, method, sequence or resource
commitment require supervisor approval" and the Foreman "does not claim
unverified quantities or completed inspection status." No approval or
decision authority anywhere in the cluster set.

## Acceptance
- [x] All 18 Foreman rows (#423-440) classified into 4 trigger
      clusters, all Configure workflow.
- [x] Confirmed `role.foreman` already exists in
      `docs/canonical-role-map.md`.
- [ ] SLA: source `Timing` is "To be confirmed" for all 18 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 18 Foreman rows —
  ninth Projects role. Projects: 240/304 rows classified, 64 remain
  (Chargehand 16, Plant & Equipment Operator 16, Skilled Labour 14,
  Driver 14, Unskilled Labour 12 — the 5 lowest-tier roles).
  1,119/1,308 rows classified overall, 189 remain. Next: Chargehand
  (16 rows) is the next-largest untouched Projects role — likely
  mirrors Foreman's pattern one tier further down.
