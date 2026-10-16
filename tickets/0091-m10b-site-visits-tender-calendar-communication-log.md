---
id: 91
title: "M10b — Site visits, tender deadline calendar & client communication log"
status: testing
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
- [x] `site_visits` tenant-scoped with RLS, linked to an opportunity
      from ticket 0090.
- [x] Tender deadline + submission evidence tracked per FR-CRM-003.
- [x] Client communication log tenant-scoped with RLS.
- [x] Tests cover tenant isolation and permission gating.

## Progress
- 2026-10-16: Filed as the second of three M10 sub-tickets (see ticket
  0089's split).
- 2026-10-16 11:48 UTC: Built. Migration
  `supabase/migrations/20261016000013_m10b_crm_site_visits_tender_communications.sql`
  adds `site_visits` (opportunity_id FK, visited_by, visit_date, notes),
  `tender_submissions` (opportunity_id FK, deadline_date,
  submitted_at, evidence_reference, notes — a small table rather than
  columns on `opportunities`, so more than one deadline/resubmission
  per opportunity needs no later migration) and `client_communications`
  (client_id FK, optional opportunity_id FK, channel, summary,
  logged_by, occurred_at — a log only, no send/receive). All three
  tenant-scoped RLS. Reused ticket 0090's `crm.lead.manage` permission
  rather than adding a new one — same module, no new actor. Extended
  `backend/src/modules/crm/` (types/repository/service/routes) in
  place rather than a new module, following the same pattern as the
  M06 sub-tickets extending `modules/workflow/`. New routes:
  `POST`/`GET /crm/opportunities/:id/site-visits`,
  `POST`/`GET /crm/opportunities/:id/tender-submissions`,
  `POST`/`GET /crm/client-communications`. 8 new tests (tenant
  isolation, permission gating, multi-submission-per-opportunity).
  `npm test`: 473/473 (465 prior + 8 new), `npm run build` clean,
  `scripts/tickets.py check` clean. Not yet applied to the real
  Supabase project — same gap as ticket 0090 and every other migration
  in this repo. Status `testing`, not `done`, for the same reason.
  Next: ticket 0092 (M10c — pipeline forecast reporting, won-opportunity
  handover checklist gate).
