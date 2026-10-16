---
id: 116
title: M06: Configuration Studio frontend (workflow definition editor)
status: next
roles: [ui-designer, backend-engineer, test-engineer, architect]
priority: 1
created: 2026-10-17
updated: 2026-10-17
---

M06 backend is fully built (definition CRUD, versioning, validation,
simulation, runtime). Zero frontend exists. Without this screen, no one can
configure a workflow in the app — they must insert rows directly into the
database. This is also the Phase 2 exit criterion that is currently unmet.

## Dependencies
- Ticket 0108 (M33) — work-item catalogue picker uses document types
- Ticket 0109 (shared components) — PermissionGate, UserPicker, EntityPicker,
  StatusBadge, DatePicker all used here

## Scope

### Nav entry
"Configuration Studio" in the sidebar, visible only to roles that hold
`workflow.definition.manage` (Platform Administrator, Document Controller).

### Workflow Definitions list page (`/config-studio`)
- Table: definition name, current published version number, status badge
  (draft / published / archived), last updated, created by
- "New Definition" button → create form
- Row click → definition detail page

### Definition detail page (`/config-studio/:definitionId`)
- Header: name, description, trigger type, created by/at
- **Versions tab** — list of all versions with status badge (draft /
  validated / published / archived), published-at date, "View" and
  "Rollback" buttons; "New Version" button drafts a new version from the
  current published one
- **Steps editor tab** (on a draft version) — visual step list:
  - Each step: step name, step type (task / request_approval / gateway /
    send_notification / escalate), assigned role picker, SLA duration (days),
    required evidence flag
  - Add step, reorder steps (drag or up/down arrows), delete step
  - For `request_approval` steps: approver user picker (multi-select),
    sequential vs parallel toggle, required count
  - For `gateway` steps: condition list (field / operator / value) with
    branch labels
- **Validation panel** — "Run validation" button → calls
  `POST /workflows/definitions/:id/versions/:versionId/validate`;
  shows errors inline next to the offending step; a valid result shows a
  green banner
- **Publish button** — enabled only when version status is `validated`;
  calls `POST /workflows/definitions/:id/versions/:versionId/publish`;
  confirms with "This will become the active version for all new instances"
- **Work items tab** — searchable table of catalogue items
  (`GET /catalogue/items`) that this definition handles; add/remove items
  from the definition's scope

### Catalogue browser (inside Configuration Studio)
- Accessible as a sub-page or slide-over panel within Config Studio
- Full table of `work_item_definitions` rows, filterable by:
  disposition (configure_workflow / configure_approval / …), module,
  keyword in title/description
- Create new catalogue item form: title, description, module, disposition,
  tags
- Edit existing item (all fields)
- Archive item — blocked with named-dependent error if active workflow
  instances reference it; confirmed with a warning if a definition references
  it
- Bulk CSV import (same format as the original seed)
- Export current catalogue to CSV
- Write actions gated on `catalogue.workitem.manage`

## Acceptance

- [ ] Configuration Studio nav entry visible only to permitted roles
- [ ] Workflow definition create, list, and detail all work
- [ ] Steps editor: add, reorder, delete steps; all step-type fields present
- [ ] Validation panel shows step-level errors from the backend
- [ ] Publish button only enabled after successful validation; publishes and
      refreshes version status
- [ ] Rollback button calls the rollback endpoint and shows the new published
      version
- [ ] Catalogue browser: full CRUD, archive (with block on active dependents),
      CSV import/export
- [ ] All write buttons wrapped in PermissionGate
- [ ] No raw UUIDs — all user/role references use pickers
- [ ] USER-GUIDE.md M06 entry updated to reflect the new UI

_Created by lee-coarasco in the AppYard dashboard._

## Progress
