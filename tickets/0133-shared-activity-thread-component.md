---
id: 133
title: Shared <ActivityThread> component (comments/history)
status: next
roles: [ui-designer, backend-engineer, test-engineer]
priority: 3
created: 2026-10-17
updated: 2026-10-17
---

Split from ticket 0111 (see DECISIONS.md). CLAUDE.md's shared-component
table: `<ActivityThread entityType="..." entityId="...">` for "any entity
that supports comments/history," backed by "the entity's comments
endpoint." Survey existing comment-shaped tables before designing a new
one — `task_comments` (ticket 0070, M07a) already exists; confirm whether
any other module built its own comments table since, and whether a single
generic component can read/write against each module's own
`{entityType}_comments` endpoint shape or needs a genuinely generic
`comments` table keyed by `(entity_type, entity_id)` instead. Don't invent
the generic table if only one caller (`task_comments`) exists today —
build the component against what's real, document the seam for a second
caller to plug into later.

## Acceptance
- [ ] `frontend/src/components/ActivityThread.tsx` — list of comments
  newest-last (or newest-first, pick one and be consistent), a text input
  to add a new one, author name resolved through the existing user-lookup
  pattern (not a raw UUID).
- [ ] Wired into at least one real screen (Task detail, if one exists, or
  wherever `task_comments` already has a caller).
- [ ] Tests.

## Progress
