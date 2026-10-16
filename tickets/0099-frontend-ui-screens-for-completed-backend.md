---
id: 99
title: Frontend UI screens for completed backend modules (M04, M07, M08, M09, M10)" module: "M04/M07/M08/M09/M10
status: next
roles: [ui-designer]
priority: 1
created: 2026-10-16
updated: 2026-10-16
---

## Goal

Build frontend React screens for all backend modules that are already complete
and tested but have no UI yet. The backend APIs, DB schema and tests exist —
this ticket is purely frontend work.

## Screens to build (in this order)

1. **Employee Directory** (M04) — list of employees, add/edit employee form,
   department filter, status badge (active / on-leave / resigned)

2. **My Work / Task Inbox** (M07) — task list for the logged-in user, grouped
   by status (to-do / in-progress / blocked / done), open task detail drawer

3. **Approval Queue** (M08) — list of pending approvals assigned to the user,
   approve/reject with comment, delegation button

4. **Projects** (M09) — project register list, project detail page with WBS
   tree and milestone timeline

5. **Clients & CRM** (M10) — client list, contact list, opportunity kanban
   board (lead → qualified → tender → won/lost)

## Design system

Follow CLAUDE.md design tokens exactly:
- Amber `#F5B800` for CTAs, active nav, selected state
- Syne for headings, Inter for body
- Dark sidebar (`bg-zinc-900`), stone-50 page background
- Cards: `rounded-2xl border border-zinc-100 bg-white shadow-sm`

Reference: `frontend/src/components/AppLayout.tsx` and
`frontend/src/pages/LoginPage.tsx`

## API base URLs

All screens call the backend REST API at `VITE_API_URL`. Auth token comes from
`@supabase/supabase-js` session — pass it as `Authorization: Bearer <token>`
header on every request.

## Definition of done

- All five screen groups render without errors
- Navigation links in the sidebar reach each screen
- Empty states shown when no data
- `npm run build` in `frontend/` passes with no TypeScript errors
- Ticket marked `testing`

_Created by lee-coarasco in the AppYard dashboard._

## Progress
