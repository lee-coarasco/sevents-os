---
id: 150
title: "Catalogue UX: Pagination + Slide-over Edit Panel"
status: done
roles: [ui-designer, backend-engineer]
priority: 2
created: 2026-10-17
updated: 2026-10-17
---

## Problem
1. GET /catalogue/work-items returned all 1,308 rows with no pagination — the page showed a huge table with no way to page through it.
2. The edit form rendered below the 1,308-row table, requiring the user to scroll to the bottom of the page to edit any item.

## Solution

### Backend
- Added `excludeRetired?: boolean`, `page?: number`, `pageSize?: number` to `WorkItemFilters` in `types.ts`
- Added `PaginatedWorkItems` interface (items, total, page, pageSize)
- `repository.ts` `applyFilters` now respects `excludeRetired`
- `routes.ts` GET /catalogue/work-items now accepts `page`, `pageSize`, `excludeRetired` query params; returns `{ items, total, page, pageSize }` (default 50 per page, max 200)

### Frontend
- New shared component `Pagination.tsx` — Previous/Next + numbered page buttons + "Showing X–Y of Z" label
- `CataloguePage.tsx` rewritten:
  - Server-side pagination via `page`/`pageSize` params
  - `excludeRetired=true` sent when "Show retired" checkbox is off (server filters, accurate counts)
  - Edit form replaced with a fixed right-side slide-over panel (width 96, z-50) with close button
  - Highlighted row when editing (bg-brand-soft)
  - Backdrop overlay closes panel on click

## Files changed
- `backend/src/modules/catalogue/types.ts`
- `backend/src/modules/catalogue/repository.ts`
- `backend/src/modules/catalogue/routes.ts`
- `frontend/src/components/Pagination.tsx` (new)
- `frontend/src/pages/CataloguePage.tsx`

## Roles
roles: [backend-engineer, ui-designer]
