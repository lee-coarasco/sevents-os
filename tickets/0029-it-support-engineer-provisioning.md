---
id: 29
title: "Classify catalogue cluster: IT Support Engineer provisioning and security operations"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 13 People & Culture rows
carrying "IT Support Engineer" as `Who is Responsible` (#1056-1068).
Fifth and final batch of the People & Culture department pass (ticket
0007) — completes People & Culture (98/98 rows). This role is distinct
from IT as a product capability (M20-class modules elsewhere in the
catalogue reference technical platform config); per
`docs/canonical-role-map.md`'s existing note, it is "distinct from
Platform Administrator; internal IT, not SEVENTS app config."

## Source rows covered

| S.No. | Work item | Trigger |
|---|---|---|
| 1056 | Prepare system, software, email and server access before joining | An approved manpower requirement reaches the recruitment stage. |
| 1057 | Issue approved email and ERP access and deliver system training | An approved candidate accepts the offer and a joining date is confirmed. |
| 1058 | Revoke user access and recover company-controlled accounts | A resignation, termination or employee exit is formally approved. |
| 1059 | Recover and reconcile company assets | A resignation, termination or employee exit is formally approved. |
| 1060 | Manage IT asset allocation and return | An approved joiner, employee change, access request, asset requirement or system update is received. |
| 1061 | Configure employee software and systems | An approved joiner, employee change, access request, asset requirement or system update is received. |
| 1062 | Maintain company website in WIX | An approved joiner, employee change, access request, asset requirement or system update is received. |
| 1063 | Create approved company email accounts | An approved joiner, employee change, access request, asset requirement or system update is received. |
| 1064 | Create approved ERP user accounts | An employee lifecycle event, approved request or scheduled People & Culture activity becomes due. |
| 1065 | Maintain IT asset, software licence and access registers | Whenever an IT asset, licence or access permission is issued, changed, renewed or returned. |
| 1066 | Resolve user hardware, software and connectivity incidents | A user reports an IT incident. |
| 1067 | Perform backup, endpoint security and patch controls | At the approved security cadence. |
| 1068 | Report security incidents, downtime and recurring IT issues | A security event, material outage or recurring IT failure occurs. |

All 13 rows: canonical `role.it_support_engineer` (already listed in
`docs/canonical-role-map.md`). Shared escalation throughout: "An
approved IT support resource may provide technical backup; access,
security, data-loss or material downtime exceptions escalate to the HR
& Admin Lead and CPCO."

## Disposition

**Configure workflow** for 12 of 13 rows (all except 1067): pre-joining
setup, onboarding access issuance, exit access revocation/asset recovery
and general provisioning (1056-1064) are recurring operational tasks
within the same joiner/mover/leaver lifecycle pipelines classified for
HR & Admin Lead/Assistant/Office Assistant (tickets 0026-0028); the
asset/licence/access register (1065) is ongoing register maintenance,
same reasoning as every other register-maintenance row in this
catalogue; incident resolution (1066) and security-event reporting
(1068) are each event-triggered response processes with a recorded
closure outcome, not scheduled reviews.

**Periodic review/monitor** for 1067 ("perform backup, endpoint security
and patch controls"): the one row explicitly run "at the approved
security cadence" — a scheduled verification with a measurable output
("recorded verification results and corrections of failures"), BRD
§6.5's review/monitor definition directly, distinct from 1066/1068's
event-triggered (not scheduled) incident response.

## Acceptance
- [x] All 13 IT Support Engineer rows (#1056-1068) classified, with 1067
      split out as Periodic review/monitor.
- [x] Confirmed `role.it_support_engineer` already exists in
      `docs/canonical-role-map.md` — no change needed there.
- [x] People & Culture department now fully classified: 98/98 rows
      across 5 roles (tickets 0025-0029).
- [ ] SLA: source `Timing` is "To be confirmed" for all 13 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 13 IT Support Engineer
  rows — fifth and final role in People & Culture. Department complete
  (98/98 rows, tickets 0025-0029). Next department per ticket 0007's
  table: Research & Development (120 rows, not started).
