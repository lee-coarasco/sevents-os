---
id: 91
title: "M10b — Site visits, tender deadline calendar & client communication log"
status: next
roles: [backend-engineer]
priority: 13
created: 2026-10-16
updated: 2026-10-16
---

Second of three M10 sub-tickets (see ticket 0089 for the split
rationale). Depends on ticket 0090 (M10a — needs a Lead/Opportunity to
attach to). Covers BRD §8.5 FR-CRM-003 and the BRD §7 module-row
phrases "site visit... tender calendar... client communication log."

## What to build
- `site_visits`: tenant-scoped, `opportunity_id` FK, visited_by,
  visit_date, notes/findings.
- Tender deadline tracking (FR-CRM-003: "tender deadlines and
  submission evidence are tracked") — a `tender_deadline` date (and
  any reminder-worthy fields) on the opportunity row itself, or a
  small `tender_submissions` table if more than one deadline/
  submission needs tracking per opportunity (e.g. clarification
  deadline vs. final submission deadline) — look at how many distinct
  dates BRD actually asks for before deciding a separate table is
  worth it; do not build a full tender-document-management feature
  here, that is M11's job. "Submission evidence" is an attachment/
  reference to what was submitted and when, not the tender document's
  content itself.
- `client_communications` (or similar): tenant-scoped,
  `client_id`/`opportunity_id` FK, channel, summary/notes, logged_by,
  occurred_at — a log, not a two-way messaging feature. Do not build
  email sending/receiving here; ticket 0082 (M31b, notifications) is
  the only place this project does outbound delivery, and this ticket
  has no requirement to send anything.
- If ticket 0083's (M31c) notification/SLA machinery can flag an
  approaching tender deadline, that is natural follow-on scope for a
  *later* ticket, not this one — do not wire a scheduler/cron here;
  this project explicitly has no scheduled/automatic jobs anywhere
  yet (same reasoning as every prior ticket's "Out of scope: automatic/
  scheduled anything").

## Out of scope
- Tender documents, bid/no-bid, estimates — M11.
- Automatic deadline reminders/escalation — a future ticket once M31's
  SLA/escalation machinery is deliberately pointed at this module;
  not invented here.

## Acceptance
- [ ] `site_visits` tenant-scoped with RLS, linked to an opportunity
      from ticket 0090.
- [ ] Tender deadline + submission evidence tracked per FR-CRM-003.
- [ ] Client communication log tenant-scoped with RLS.
- [ ] Tests cover tenant isolation and permission gating.

## Progress
- 2026-10-16: Filed as the second of three M10 sub-tickets (see ticket
  0089's split).
