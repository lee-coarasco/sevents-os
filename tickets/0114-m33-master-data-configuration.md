---
id: 114
title: M33: Master Data & Configuration
status: next
roles: [ui-designer, backend-engineer, test-engineer, architect]
priority: 1
created: 2026-10-17
updated: 2026-10-17
---

---
id: 108
title: "M33: Master Data & Configuration"
status: next
roles: [backend-engineer, ui-designer, test-engineer]
priority: 1
created: 2026-10-16
updated: 2026-10-16
---

M33 was listed in Phase 2 of the PRD but was never built. Every module from
Phase 3 onwards that references a document type, cost code, project type, or
unit of measure is using free-text fields as a workaround. This ticket builds
the master data layer those modules need and retrofits the controlled-list
references.

## Scope

### Backend — new tables and endpoints

**Units of measure** (`uom`)
- id, code (e.g. "m²", "kg", "nr", "ls"), description, is_active
- `GET /master-data/uom`, `POST`, `PATCH /:id`, archive

**Currencies** (`currencies`)
- code (ISO 4217, e.g. "AED", "USD"), name, symbol, is_base_currency,
  exchange_rate_to_base, effective_date, is_active
- `GET /master-data/currencies`, `POST`, `PATCH /:id`, archive
- Only one row may have `is_base_currency = true`

**Cost codes** (`cost_codes`)
- id, parent_id (self-referencing, nullable — supports hierarchy),
  code, description, category (labour/material/plant/subcontract/overhead),
  is_active
- `GET /master-data/cost-codes` (tree structure), `POST`, `PATCH /:id`, archive
- Block archive if any estimate_lines reference this cost code

**Document types** (`document_types`)
- id, code (e.g. "DRG", "SPEC", "BOQ", "RFI"), label, is_active
- `GET /master-data/document-types`, `POST`, `PATCH /:id`, archive
- Block archive if any documents.document_type references this code

**Project types** (`project_types`)
- id, code, label (e.g. "commercial", "residential", "civil", "fit-out"),
  is_active
- `GET /master-data/project-types`, `POST`, `PATCH /:id`, archive

**Numbering schemes** (`numbering_schemes`)
- id, entity_type (project/document/estimate/po/invoice/…), prefix, suffix,
  next_sequence (integer), padding (digits, default 4), is_active
- `GET /master-data/numbering-schemes`, `POST`, `PATCH /:id`
- `POST /master-data/numbering-schemes/:id/next` — atomically increments
  next_sequence and returns the formatted number (used by other modules at
  record creation time)

**Permission:** `master-data.manage` — Platform Administrator only for write;
reads open to all authenticated users (same broad-read/narrow-write pattern).

### Retrofit existing modules (additive migrations only)

- `documents.document_type` (text) → add `document_type_id uuid references
  document_types(id)` nullable; existing free-text column kept for
  backwards-compat but document_type_id is the authoritative field going
  forward. Document create/edit form uses the document-types picker.
- `projects` → add `project_type_id uuid references project_types(id)` nullable
- `estimate_lines` → add `cost_code_id uuid references cost_codes(id)` nullable
- Any monetary field that is currency-aware → ensure it has a companion
  `currency_code` column defaulting to the base currency

### Frontend — Master Data settings section

Add a "Master Data" section to the navigation (visible to
`role.platform_administrator` only — hide via `<PermissionGate>`):

- **Units of Measure** — list, add, edit, archive (block if referenced)
- **Currencies** — list, add, edit, set base currency, archive
- **Cost Codes** — tree view, add child/sibling, edit, archive (block if referenced)
- **Document Types** — list, add, edit, archive (block if referenced)
- **Project Types** — list, add, edit, archive
- **Numbering Schemes** — list, add, edit (show preview of next number)

Each list follows the Definition-of-Done shared component rules:
- `<PermissionGate>` on all write buttons
- Archived items hidden by default, shown with "Show archived" toggle
- Archival blocked with named-dependent error when active records reference
  the item

## Acceptance

- [ ] All six master-data entity types have full CRUD via REST API
- [ ] `numbering-schemes/:id/next` is atomic (no duplicate numbers under concurrent calls)
- [ ] Master Data nav section visible to platform_administrator only
- [ ] All six screens have list, create form, edit form, archive/restore
- [ ] Archiving a document type that is in use returns a 409 with the count of
      referencing documents
- [ ] `documents.document_type_id` FK exists; document create/edit form uses
      the document-types picker
- [ ] `projects.project_type_id` FK exists; project create form uses the picker
- [ ] `estimate_lines.cost_code_id` FK exists; estimate-line form uses the picker
- [ ] Tests cover the numbering-scheme atomic-increment, archive-block, and all
      CRUD endpoints
- [ ] USER-GUIDE.md updated with M33 entry

_Created by lee-coarasco in the AppYard dashboard._

## Progress
