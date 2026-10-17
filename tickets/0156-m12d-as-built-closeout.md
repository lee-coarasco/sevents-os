---
id: 156
title: "M12d: As-built closeout"
status: testing
roles: [backend-engineer, ui-designer, test-engineer]
priority: 1
created: 2026-10-17
updated: 2026-10-17
done: 2026-10-17
depends_on: [119]
---

Split from ticket 0119.

## Backend

`as_built_records` table:
- `id`, `tenant_id`, `project_id` FK projects NOT NULL
- `document_id` uuid FK documents NOT NULL
- `original_revision_id` uuid FK document_revisions nullable (the design revision)
- `as_built_revision_id` uuid FK document_revisions nullable (the as-built revision)
- `confirmed_by` uuid FK app_users
- `confirmed_at` timestamptz
- `notes` text nullable
- `created_at` timestamptz default now()
- UNIQUE (project_id, document_id) — one as-built record per document per project

Permission: `engineering.as_built.manage` — granted to `role.platform_administrator`,
`role.lead_engineer`, `role.project_engineer`, `role.document_controller`.

Endpoints:
- `GET /projects/:projectId/as-built` — list records
- `POST /projects/:projectId/as-built` — create record (guarded)
- `PATCH /projects/:projectId/as-built/:id` — update (confirm, add notes) (guarded)

## Frontend

Tab "As-Built" within `ProjectDetailPage`.
- Checklist view: document number, title, original revision, as-built revision,
  confirmed_by display name, confirmed_at date
- PermissionGate on Add / Confirm actions
- Add form: document picker (`EntityPicker` type "document"), revision pickers
  (dropdowns populated from that document's revisions), notes
- Confirm button: sets confirmed_by to current user, confirmed_at to now

## Acceptance
- [ ] as_built_records table migration applied
- [ ] All 3 endpoints working with RLS
- [ ] ProjectDetailPage has As-Built tab
- [ ] Add and Confirm in UI
- [ ] Document picker linked to documents list
- [ ] All tests pass

## Progress
