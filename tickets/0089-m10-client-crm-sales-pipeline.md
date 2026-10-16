---
id: 89
title: "M10 — Client, CRM & Sales Pipeline"
status: done
roles: [architect, backend-engineer]
priority: 13
created: 2026-10-16
updated: 2026-10-16
---

First Phase 4 module per `docs/PRD.md`'s build-order table (`## 2.
Build order`). Phase 3 (M04/M07/M08/M09/M35/M31) is now entirely
`testing`. Depends on M02 (done) and M09 (done — a won opportunity
hands off toward project creation, so this module needs `projects` to
exist, not necessarily to auto-create one).

Reference: CLAUDE.md module table — "Leads, contacts, tender calendar,
pipeline forecast, handover." BRD §7 module row (line 436): "Lead
capture, qualification, contacts, site visit, opportunity stages,
tender calendar, bid/no-bid, client communication log, handover
checklist, proposals, pipeline forecast and sales-to-technical
handoff." BRD §8.5 (`## 8.5 CRM, tendering and estimation`):
FR-CRM-001 (lead/opportunity has source, client, owner, stage,
expected value, probability, next action, due date), FR-CRM-002
(duplicate client/contact detection), FR-CRM-003 (tender deadlines and
submission evidence tracked), FR-CRM-004 (won-opportunity handover
cannot complete while mandatory fields are missing, unless an
authorized exception is recorded). BRD §6.2 core entities: `Client,
Contact, Lead, Opportunity, SiteVisit`. Note: `Tender, Bid, Estimate,
EstimateLine` are also listed in §6.2 but FR-BID-001/FR-EST-00x and the
module table both place bid/no-bid decisions and estimating in **M11
(Tendering, Estimation & Commercials)**, not here — M10 only tracks the
tender *deadline* (the "tender calendar" row), not the tender document
or the bid decision itself. BRD §10.1 ("Opportunity to project") steps
1-3 are this module's scope; step 4 onward (feasibility, tender
documents, estimate, bid/no-bid) is M11/M12.

## Survey findings
No CRM-shaped table exists yet (`grep`-checked: no `clients`,
`contacts`, `leads`, `opportunities`, `site_visits` tables in any
migration). `projects` (ticket 0073) already has a nullable
`client_name`/free-text client field, not a real `Client`/`Contact`
entity — this module is additive, not a rename of something that
exists. The M08 approval seam (`startWorkflowInstance`/
`decideApprovalStep`) and M06's `request_approval` node are the
existing approval-gate mechanism FR-CRM-004's handover gate should
reuse, same as every M09/M35 sub-ticket already did — do not invent a
second approval mechanism for the handover checklist.

## Split
Split the same way tickets 0059/0065/0067/0068/0069 were, into three
dependency-ordered sub-tickets:
- **0090 (M10a)** — Client/Contact/Lead/Opportunity core data model,
  pipeline stages, duplicate detection (FR-CRM-001, FR-CRM-002). No
  internal dependency beyond M02/M09.
- **0091 (M10b)** — Site visits, tender deadline & submission-evidence
  tracking, client communication log (FR-CRM-003 + the "tender
  calendar"/"client communication log" BRD §7 phrases). Depends on
  0090 (attaches to a Lead/Opportunity).
- **0092 (M10c)** — Pipeline forecast reporting and the won-opportunity
  handover checklist gate (FR-CRM-004), approval-gated via the
  existing M08/M06 `request_approval` seam — not an automatic project-
  creation pipeline, which nothing in FR-CRM-004 asks for. Depends on
  0090 (pipeline data to forecast over) and M08 (ticket 0066, the
  approval seam).

## Progress
- 2026-10-16 08:05 UTC: Filed as the first Phase 4 module (Phase 3 is
  fully `testing` as of ticket 0080). Surveyed the schema for any
  existing CRM-shaped table (none) and closed this ticket with no code
  of its own, split into 0090/0091/0092 above.
- Approved by: agent (ticket classification/ordering and internal
  data-model split are explicitly agent-decidable per CLAUDE.md, same
  weight as every prior M06/M07/M09/M31/M35 split; recorded in
  DECISIONS.md).
