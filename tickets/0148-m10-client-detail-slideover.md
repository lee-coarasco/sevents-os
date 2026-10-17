---
id: 148
title: "M10 — CRM: client detail slide-over (contacts, opportunities, communications)"
status: next
roles: [ui-designer, backend-engineer, test-engineer]
priority: 2
created: 2026-10-17
updated: 2026-10-17
---

Split from ticket 0117 (see that ticket's close-out note) after a fresh
survey. Ticket 0108 already built full create/edit forms for clients,
contacts, and opportunities (Kanban) on `frontend/src/pages/CrmPage.tsx` —
0117's "no create/edit forms" framing for M10 was stale. The one genuine
remaining gap is the client detail slide-over with linked records and a
communication log.

## Current state
- `CrmPage.tsx` clients tab: list + create/edit forms, no click-through
  detail view. Clicking a client name does nothing beyond the inline edit.
- `OpportunityDetailPage.tsx` exists (opportunity detail, with site-visit/
  tender tabs) — this is a different entity; do not conflate it with the
  client detail slide-over asked for here.
- No "communications" log entity/endpoint found in a quick check — confirm
  whether `backend/src/modules/crm` already has a communications table/
  endpoint before assuming one needs to be built from scratch.

## What to build

### Backend (survey first — some of this may already exist)
- Confirm whether a communications log table/endpoint exists for
  clients (grep `backend/src/modules/crm` for "communication"). If not:
  - `GET /crm/clients/:id/communications`, `POST /crm/clients/:id/communications`
    (fields: type — call/email/meeting/site-visit, date, summary, logged-by)
  - Tenant-isolated RLS, permission-gated, audited
- Confirm `GET /crm/clients/:id` (or equivalent) returns enough to resolve
  linked contacts and opportunities, or that separate list endpoints can be
  filtered by `client_id` (likely already true since the contacts/
  opportunities tabs already filter by client in their forms).

### Frontend
- Click a client name/row in the Clients tab → open a slide-over (reuse
  the drawer pattern from `TaskInboxPage.tsx`/`ApprovalQueuePage.tsx` for
  consistency) showing:
  - Client basic info
  - Linked contacts (from the existing contacts list, filtered by
    `client_id`), each a link to... (contacts don't have their own detail
    page today — a plain list row is fine, do not build a contact detail
    page as part of this ticket)
  - Linked opportunities (filtered by `client_id`), each linking to
    `OpportunityDetailPage.tsx`
  - Site visits/communications list + "Add communication" inline form
- Wrap the "Add communication" action in `<PermissionGate>`

## Acceptance
- [ ] Clicking a client opens a detail slide-over (not just inline edit)
- [ ] Slide-over shows linked contacts and linked opportunities with
      working links to opportunity detail
- [ ] Communication log list + add-communication form works end-to-end
- [ ] Tests for any new backend endpoint
- [ ] `docs/USER-GUIDE.md` M10 entry updated

## Progress
- 2026-10-17: Split from ticket 0117 after re-survey (see 0117's close-out
  and DECISIONS.md). Not yet picked up.
