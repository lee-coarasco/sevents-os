---
id: 96
title: "M11a — Tender document register & scope matrix"
status: next
roles: [backend-engineer]
priority: 14
created: 2026-10-16
updated: 2026-10-16
---

First of three M11 sub-tickets (see ticket 0095 for the split
rationale). Depends on M10 (ticket 0091's `tender_submissions` table,
which this extends, not duplicates).

## What to build
- A tender document register: real rows for the documents that make
  up a tender package (drawings, BOQ, specifications, addenda) tied to
  an `opportunity`'s `tender_submissions` row (ticket 0091) — type,
  title/number, revision, received date, a storage reference (reuse
  whatever file-reference shape ticket 0013-era document tickets used
  if one already exists in this codebase; otherwise a plain text/URL
  reference field is enough, same "no bespoke file upload pipeline
  invented here" restraint M13 (Documents, Drawings & Records) will
  own properly later).
- Scope matrix / clarification log: BRD §10.1 step 5's "tender
  documents and deadline register" plus the catalogue rows ticket 0014
  named (missing-information/contradiction/commercial-risk log,
  clarification queries and responses) — model as real rows (item,
  raised_by, raised_at, response, resolved_at), not a jsonb blob.
- Permission: reuse `crm.lead.manage`? Survey first — ticket 0090/0092
  reused a single CRM-wide permission because the whole CRM module has
  one named owner cluster (Sales/Marketing/Technical). This module's
  named owners are "Estimator; Commercial; Technical; Finance" (BRD §7
  row 437) — a different cluster. Check `docs/canonical-role-map.md`
  for real role IDs matching "Estimator"/"Commercial" (tickets
  0014/0015 already name `role.civil_estimator`/the MEP Estimator
  equivalent) before deciding whether to grant a new
  `tendering.document.manage`-style permission to those roles plus
  `role.platform_administrator`, same reasoning ticket 0090 used for
  `crm.lead.manage`.

## Out of scope
- Estimate versions, cost build-up — ticket 0097 (M11b).
- Bid/no-bid decision, quote approval — ticket 0098 (M11c).
- A general-purpose document/drawing management system — that's M13;
  this ticket only needs the tender-specific register fields BRD §10.1
  step 5 and the catalogue's tender-intake cluster (ticket 0014 rows
  217-221) ask for.

## Acceptance
- [ ] Tender document register rows (type, title/number, revision,
      received date, storage reference) tied to a `tender_submissions`
      row, tenant-scoped with RLS.
- [ ] Scope matrix / clarification log rows (item, raised_by,
      raised_at, response, resolved_at) tied to the same tender.
- [ ] Permission decision recorded (reuse `crm.lead.manage` or a new
      `tendering.*` permission, with reasoning either way).
- [ ] Tests cover tenant isolation and permission gating.

## Progress
- 2026-10-16: Filed as the first of three M11 sub-tickets (see ticket
  0095's split).
