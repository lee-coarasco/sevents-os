---
id: 141
title: Config Studio shell — nav, definitions list/create, detail page, versions tab, rollback
status: in-progress
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
- [ ] Nav entry visible only to `workflow.definition.manage` holders.
- [ ] List, create, detail, versions tab, new-version, rollback all work
      end to end against the real backend shapes above.
- [ ] Tests for list/create/detail/versions/rollback.
- [ ] `docs/USER-GUIDE.md` M06 entry updated.

## Progress
