---
id: 155
title: "M12c: IFC release register"
status: testing
roles: [backend-engineer, ui-designer, test-engineer]
priority: 1
created: 2026-10-17
updated: 2026-10-17
done: 2026-10-17
depends_on: [119]
---

Split from ticket 0119.

IFC (Issued for Construction) release is NOT a new mechanism — M13b already
built `submit_for_release` and `resolve_revision_approval` endpoints that wire
an M06 workflow. This ticket builds only the per-project IFC register view and
nothing else.

## Backend

No new tables. One new endpoint:

`GET /projects/:projectId/ifc-register`
- Returns all documents with `document_type IN ('drawing', 'DRG', 'Drawing')`
  (case-insensitive) that belong to this project, joined to their
  `current_revision` with its `status`, `approved_at`, `workflow_instance_id`
- Each row: document_id, document_number, title, discipline, revision_code,
  revision_status, approved_at, submitted (bool: workflow_instance_id IS NOT NULL)
- Read-only endpoint, no guard needed (any authenticated tenant member may
  view the register)

## Frontend

Tab "IFC Register" within `ProjectDetailPage`.
- Table: document number, title, discipline, current revision code, status
  badge (draft/under_review/approved/superseded), approved date
- "Submit for IFC" link/button on each approved revision that hasn't been
  submitted → navigates to DocumentDetailPage where the existing submit
  button lives
- No inline workflow actions in the register itself — IFC release happens on
  DocumentDetailPage per M13's existing UI

## Acceptance
- [ ] `GET /projects/:projectId/ifc-register` endpoint working
- [ ] IFC Register tab in ProjectDetailPage
- [ ] Documents with drawing type shown with current revision and status
- [ ] Link to DocumentDetailPage for IFC submission
- [ ] All tests pass

## Progress
