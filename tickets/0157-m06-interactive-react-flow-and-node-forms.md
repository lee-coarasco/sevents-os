---
id: 157
title: "M06: Interactive React Flow Canvas & Structured Node Config Forms"
status: done
roles: [ui-designer, test-engineer]
priority: 1
created: 2026-10-18
updated: 2026-10-18
done: 2026-10-18
depends_on: [60]
---

## Summary

Resolves remaining UX configuration gaps in M06 Configuration Studio (`WorkflowVersionDetailPage.tsx`):
1. Replaces raw JSON textarea with dedicated UI form fields for the 5 remaining node types:
   - `collect_form_data` (template key, required fields, instructions)
   - `request_upload_evidence` (accepted file types, max file size, label, required checkbox)
   - `call_service` (webhook URL, method dropdown, timeout, retry count)
   - `create_linked_followup` (role selector, workflow key, link type dropdown, description template)
   - `evaluate_condition` (field, operator dropdown, value, description)
2. Upgrades the read-only FlowTab to an interactive drag-and-drop canvas using `@xyflow/react` (React Flow):
   - Drag to reposition nodes
   - Visual handle connection to create transitions via `POST /workflow/versions/:versionId/transitions`
   - Edge selection & Backspace/Delete to remove transitions via `DELETE /workflow/versions/:versionId/transitions/:id`
   - Node palette with all 13 node types to insert steps directly onto canvas
   - Slide-over node inspection and configuration edit drawer
   - Edge condition badges showing branch expressions
   - Automatic BFS-based topological depth layout

## Acceptance
- [x] Dedicated UI form fields for all 5 previously unhandled node types
- [x] `@xyflow/react` dependency added and installed
- [x] Interactive canvas replacing read-only vertical flowchart
- [x] Drag to connect nodes creating real workflow transitions
- [x] Delete transition edges with backspace/delete key
- [x] Node palette to add any of 13 node types directly from flow tab
- [x] Click node to edit in slide-over drawer
- [x] TypeScript build passes with zero errors
- [x] Existing tests pass (`WorkflowVersionDetailPage.test.tsx`)

## Progress

- 2026-10-18: Implemented bespoke forms for 5 node types. Installed `@xyflow/react`. Built `CustomWorkflowNode`, handle connections, edge deletion, node palette, and edit slide-over. Validated build and vitest tests.
