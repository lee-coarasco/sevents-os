---
id: 139
title: Wire document-type and cost-code pickers into DocumentsPage and estimate-line forms
status: next
roles: [ui-designer]
priority: 2
created: 2026-10-17
updated: 2026-10-17
---

Ticket 0114 (M33) built the `document_types` and `cost_codes` master-data
tables, their `GET /master-data/document-types` and `GET /master-data/
cost-codes` endpoints, and the nullable `documents.document_type_id` /
`estimate_lines.cost_code_id` FK columns. It did **not** retrofit the
consuming forms — `DocumentsPage`'s create/edit form still writes the old
free-text `document_type` column, and no estimate-line form exists yet to
retrofit (that's an M11 scope question, not this ticket's).

This is the exact "no raw UUIDs, use a picker" rule from CLAUDE.md's
Definition of Done, deferred out of ticket 0114 because it touches another
module's form rather than the master-data screens themselves.

## Scope

- `DocumentsPage` create and edit forms: replace the free-text document
  type field with a `<select>` sourced from `GET /master-data/document-types`
  (active rows only), writing `document_type_id` on create/update instead of
  (or alongside, for backwards compat — the ticket 0114 migration kept the
  old `document_type` text column) the free-text field. Follow the same
  pattern `CataloguePage`'s `workflow_template_id` picker already uses.
- Estimate-line `cost_code_id` picker: only in scope once an estimate-line
  create/edit UI exists (M11 territory — check `tickets/` for the current
  M11 ticket before starting; if no estimate-line form exists yet, this half
  is blocked on that ticket, not on anything here).

## Acceptance
- [ ] DocumentsPage's create and edit forms use a document-types picker,
      not a free-text field, for the document type
- [ ] Existing documents with only the old free-text `document_type` set
      (no `document_type_id`) still display correctly — don't assume every
      row has been migrated
- [ ] Estimate-line cost-code picker is either built (if an estimate-line
      form already exists) or this half is explicitly left blocked with a
      pointer to the M11 ticket that owns the form

## Progress
