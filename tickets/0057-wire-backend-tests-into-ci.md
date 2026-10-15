---
id: 57
title: "Wire backend build/test into CI (requires editing .github/workflows/)"
status: next
roles: [human]
priority: 1
created: 2026-10-15
updated: 2026-10-15
---

Ticket 0053 added a real `backend/` app (`npm run build`, `npm test`) and
`npm test` passes locally. The scheduled agent can never create or edit
anything under `.github/workflows/` — its GitHub token has no `workflows`
permission, so the push would be rejected and the whole session's commits
would be lost (see CLAUDE.md "Workflow files are human-only"). This is
exactly that case, so it's filed as a `roles: [human]` ticket instead.

## What to do

Add a step to the CI workflow (or a new one) that, on every PR/push
touching `backend/`:

1. `cd backend && npm ci`
2. `npm run build`
3. `npm test`

Fail the check if any step fails. `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` are already GitHub Actions secrets per
CLAUDE.md — the current `GET /health` test suite doesn't need them (it
injects a mocked Supabase client), but pass them through as env vars
anyway since later tickets' tests (0054 onward) will need a real Supabase
project to run integration tests against.

## Acceptance
- [ ] A CI check runs `backend`'s build + test on every relevant PR/push.
- [ ] The check is required (or at least visible) before merge.

## Progress
- 2026-10-15 11:12 UTC: Filed by the backend-engineer session that built
  ticket 0053, per CLAUDE.md's standing rule that workflow file changes
  always go to a human ticket.
