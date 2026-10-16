---
id: 121
title: Global search across all modules
status: next
roles: [ui-designer, backend-engineer, test-engineer, architect]
priority: 1
created: 2026-10-17
updated: 2026-10-17
---

No cross-module search exists. Users cannot find a project, employee, document,
client, or task by name from anywhere in the app — they must navigate to each
module's own page and use its local filter.

## Scope

### Backend — `GET /search?q=&types=&limit=`
- Single endpoint that queries across entity types in parallel:
  - `projects` — match on name, code
  - `employees` — match on name, email, employee code
  - `documents` — match on title, document number
  - `clients` — match on name
  - `opportunities` — match on title
  - `tasks` (workflow_step_instances) — match on step name, comments
- Returns up to `limit` results per type (default 5), each with: type label,
  id, display name, subtitle (e.g. project code, document number), and the
  route to navigate to
- All queries are RLS-protected — results only include records the current
  user's tenant owns
- Uses PostgreSQL `ilike '%query%'` on indexed columns (add indexes if
  missing)
- Permission: read access only; same broad-read convention as every list
  endpoint

### Frontend — search bar in AppLayout header
- Search icon/input in the top navbar (visible on all pages)
- Typing (debounced 300ms) calls `GET /search?q=` and shows a dropdown of
  grouped results by type
- Click a result → navigate to its detail page (using the returned route)
- Keyboard navigation (↑↓ to move, Enter to navigate, Esc to close)
- Empty state: "No results for 'xyz'" — never a blank dropdown

## Acceptance

- [ ] Search endpoint returns results from all six entity types in under 500ms
      for a 3-character query on a populated database
- [ ] Results only include the current tenant's records (RLS verified by test)
- [ ] Search bar appears in AppLayout header on all authenticated pages
- [ ] Dropdown groups results by type with a type label
- [ ] Clicking a result navigates to the correct detail page
- [ ] Keyboard navigation works
- [ ] USER-GUIDE.md updated with note on global search

_Created by lee-coarasco in the AppYard dashboard._

## Progress
