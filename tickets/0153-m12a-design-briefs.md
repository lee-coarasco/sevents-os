---
id: 153
title: "M12a: Design briefs"
status: testing
roles: [backend-engineer, ui-designer, test-engineer]
priority: 1
created: 2026-10-17
updated: 2026-10-17
done: 2026-10-17
depends_on: [119]
---

Split from ticket 0119. Survey of M13 schema confirmed no duplication risk:
`documents` is a general spine; design briefs are project-level planning
artefacts that *reference* documents rather than being document revisions.

## Backend

`design_briefs` table:
- `id`, `tenant_id`, `project_id` (FK projects), `title` text not null,
  `discipline` text, `scope_description` text, `status` text default 'draft'
  check ('draft','issued','superseded'), `issued_by` uuid FK app_users,
  `issued_at` timestamptz, `reference_document_ids` uuid[] default '{}'
  (soft reference into documents.id — no FK array; documents module stays
  self-contained), `created_by` uuid FK app_users, `created_at` timestamptz

Permission: `engineering.design_brief.manage` — granted to
`role.platform_administrator`, `role.lead_engineer`, `role.project_engineer`.

Endpoints:
- `GET /projects/:projectId/design-briefs` — list for project
- `POST /projects/:projectId/design-briefs` — create (guarded)
- `GET /design-briefs/:id`
- `PATCH /design-briefs/:id` — update fields + status transitions (guarded)
- `DELETE /design-briefs/:id` — only when draft (guarded)

## Frontend

Tab "Design Briefs" within `ProjectDetailPage` (new tab beside existing ones).
- List of briefs: discipline, title, status badge, issued date
- Inline create form (permission-gated)
- Click row → slide-over/detail panel: all fields, status transition buttons
  (Issue, Supersede), reference document IDs shown as links to document detail
  page
- PermissionGate on all write actions

## Acceptance
- [ ] Design briefs table migration applied
- [ ] All 5 endpoints working with RLS
- [ ] ProjectDetailPage has Design Briefs tab
- [ ] Create, edit, status transitions in UI
- [ ] Reference doc IDs link to `/documents/:id`
- [ ] All tests pass

## Progress
