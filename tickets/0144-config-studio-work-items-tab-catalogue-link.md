---
id: 144
title: Config Studio — work items tab (link catalogue items to a definition)
status: next
roles: [ui-designer, test-engineer]
priority: 2
created: 2026-10-17
updated: 2026-10-17
---

Split from ticket 0116 (see DECISIONS.md). 0116 also asked for a "Catalogue
browser" (full catalogue CRUD + CSV import/export reachable from inside
Config Studio) — that's not new scope, it's the existing `/catalogue` page
(ticket 0125, built) plus ticket 0126 (create/import/export, still blocked
on an open architect question about `source_work_item_id`/RLS trust model).
Don't rebuild either here. This ticket is just the one genuinely
Config-Studio-specific piece: seeing/managing which catalogue items a given
workflow definition handles, from the definition's own detail page.

## Backend reference (surveyed this session)
- `GET /catalogue/work-items?...` (ticket 0058/0125) returns
  `WorkItemSummary[]` including `workflow_template_id`. No dedicated
  "items for this definition" endpoint — filter the existing list client-
  side by `workflow_template_id === definitionId` (same approach
  `CataloguePage` already takes for its own filters).
- Assigning/unassigning an item to this definition is a `PATCH` on the
  catalogue item (same endpoint `CataloguePage`'s edit form already calls)
  setting `workflow_template_id` to this definition's id or `null`. No new
  backend endpoint needed — confirm the exact PATCH path/permission by
  reading `CataloguePage.tsx`'s existing edit call before wiring this up.

## Scope
- "Work items" tab on the definition detail page (`/config-studio/
  :definitionId`): table of catalogue items currently assigned to this
  definition (filtered client-side as above).
- "Assign items" action: reuses an `<EntityPicker>`-style search over
  unassigned/other items, or a simple searchable list with an "Assign"
  button per row — PATCHes `workflow_template_id`.
- "Unassign" button per row in the assigned table — PATCHes
  `workflow_template_id: null`.
- Gated on `catalogue.workitem.manage` (the same permission `CataloguePage`
  uses for writes).

## Acceptance
- [ ] Work items tab lists items currently assigned to the definition.
- [ ] Assign/unassign both work via the existing catalogue PATCH endpoint
      — no new backend route.
- [ ] Permission-gated.
- [ ] Tests.

## Progress
