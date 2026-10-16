---
id: 124
title: M11 estimate fields and M13 document metadata are missing edit forms
status: next
roles: [ui-designer]
priority: 3
created: 2026-10-16
updated: 2026-10-16
---

Ticket 0109 built the M11 (tendering/estimating/bidding) and M13
(documents) frontend. Two entities fall short of CLAUDE.md's "full CRUD in
the UI" rule:

- **Estimates** (`TenderSubmissionDetailPage`): the "Manage lines" panel
  lets you add/remove line items, but there is no form to edit a draft
  estimate's own top-level fields (assumptions, inclusions, exclusions,
  taxes, overheads, contingency, margin) after creation — only
  `PATCH /estimates/:estimateId` exists on the backend (ticket 0097), with
  no UI calling it.
- **Documents** (`DocumentsPage`/`DocumentDetailPage`): there is a create
  form, but no "Edit" affordance for an existing document's metadata
  (title, document number, discipline, access class, project, tags) —
  `PATCH /documents/:id` exists (ticket 0104) with no UI calling it.

## Acceptance
- [ ] A draft estimate can be edited in place (assumptions/inclusions/
  exclusions/taxes/overheads/contingency/margin) via `PATCH
  /estimates/:estimateId`, gated the same way creation is (estimate must
  be `draft`, 409 surfaced otherwise).
- [ ] A document's metadata can be edited via `PATCH /documents/:id`,
  gated on `documents.register.manage`.
- [ ] Tests cover both edit flows.

## Progress
