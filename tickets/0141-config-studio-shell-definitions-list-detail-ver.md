---
id: 141
title: Config Studio shell — nav, definitions list/create, detail page, versions tab, rollback
status: testing
roles: [ui-designer, test-engineer]
priority: 1
created: 2026-10-17
updated: 2026-10-17
---

Split from ticket 0116 (see DECISIONS.md). 0116 described M06's frontend as
one ticket covering nav + list + detail + a "steps editor" + validation +
publish + a "work items tab" + a "catalogue browser." The backend's actual
step model is a node/transition/condition graph (not the simple linear list
0116 assumed — nodes carry a `node_type`, transitions link node pairs with an
optional `condition_id` for branching), which is enough extra surface on its
own to warrant splitting the steps editor out, same "build order" reasoning
the backend itself used when ticket 0059 was split into 0060-0063. This
ticket is the first slice: everything that doesn't require editing the graph.

## Backend reference (surveyed this session — exact routes/fields)
- `GET /workflow/definitions?status=&key=` / `GET /workflow/definitions/:id`
  / `POST /workflow/definitions` — permission `workflow.definition.manage`.
  `WorkflowDefinition`: `id, key, name, description, capability_key, status
  (draft|under_review|approved|published|retired), current_version,
  created_by, updated_by`.
- `POST /workflow/definitions/:id/versions` (body `{ copyFromVersionId? }`),
  `GET /workflow/definitions/:id/versions` — permission
  `workflow.definition.manage`. `WorkflowVersion`: `id, version, status
  (draft|published|retired), effective_from, effective_to,
  rollback_of_version, published_by, published_at, created_by, created_at`.
- `POST /workflow/definitions/:id/rollback` (body `{ toVersion, reason? }`)
  — permission `workflow.definition.publish`. Target version must be
  `published`; creates+publishes a new version cloning its graph.

## Scope
- Nav entry "Configuration Studio" (`/config-studio`), gated on
  `workflow.definition.manage`.
- Definitions list page: table (name, key, status via `<StatusBadge>`,
  current published version, updated), status filter, "New Definition" form
  (key, name, description), row click → detail page.
- Definition detail page (`/config-studio/:definitionId`): header
  (name/key/description/status/created by), **Versions tab** — table of
  versions (version number, status badge, published-at, rollback_of_version
  if set), "New Version" button (drafts from current published, via
  `copyFromVersionId`), "Rollback to this version" button on any published
  row (confirm dialog, calls the rollback endpoint, refreshes the list).
- Version detail is a stub for now: clicking a version navigates to
  `/config-studio/:definitionId/versions/:versionId` which for this ticket
  just shows the version's metadata (status/dates) — the actual steps
  editor is ticket 0142.
- All write actions in `<PermissionGate>`.

## Acceptance
- [x] Nav entry visible only to `workflow.definition.manage` holders.
- [x] List, create, detail, versions tab, new-version, rollback all work
      end to end against the real backend shapes above.
- [x] Tests for list/create/detail/versions/rollback.
- [x] `docs/USER-GUIDE.md` M06 entry updated.

## Progress
- 2026-10-17 03:21 UTC: Built `WorkflowDefinitionsPage.tsx` (list + status
  filter + create form), `WorkflowDefinitionDetailPage.tsx` (header +
  Versions tab: table, New Version via `copyFromVersionId`, Rollback with
  a confirm step asking for an optional reason), and a
  `WorkflowVersionDetailPage.tsx` stub (metadata only, explicitly labelled
  as a placeholder for tickets 0142/0143). Added the "Configuration
  Studio" nav entry (gated on `workflow.definition.manage`) and three
  routes in `App.tsx`. All write actions wrapped in `<PermissionGate>`
  (rollback specifically gated on `workflow.definition.publish`, not the
  same permission as everything else on the page — confirmed from the
  backend survey rather than assumed). Reused `<StatusBadge>` (ticket
  0140, built earlier this session) for both definition and version
  status pills instead of hand-rolling another status-to-colour map.
  12 new tests across 3 files. One test-writing note: a `PermissionGate`-
  wrapped button needs `findByText` (not `getByText`) for its *first*
  assertion in a test, since `usePermissions()` resolves on a separate
  async tick from the page's own data fetch — asserting on unrelated
  loaded data first and then synchronously `getByText`-ing a gated button
  can race the permission fetch.
  Full frontend suite: 96/96 across 27 files, `npm run lint` (tsc
  --noEmit) and `npm run build` clean. `docs/USER-GUIDE.md` M06 entry
  rewritten to describe the real screen and spell out exactly what's
  still missing (steps editor, validation, publish) so it isn't mistaken
  for a complete Configuration Studio.
  Set `status: testing`.
