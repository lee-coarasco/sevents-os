---
id: 94
title: "Supabase MCP tools not reachable — migrations still can't go live"
status: done
roles: [human]
priority: 1
created: 2026-10-16
updated: 2026-10-16
---

A 2026-10-16 session recorded that `SUPABASE_ACCESS_TOKEN` was added to
GitHub Actions secrets and said the next session must apply all
pending migrations via the Supabase MCP (`mcp__Supabase__*` tools).
The very next session (11:53 UTC) searched for those tools via
`ToolSearch` with multiple queries ("supabase", "migration", "mcp")
and found none — contradicting the "token added, should work now"
note. This session repeated that check independently (`ToolSearch`
for "supabase" and "Supabase list_migrations apply_migration") and
again found zero matching tools, and confirmed there is no
`.mcp.json` file in the repo and no `SUPABASE_*` environment variables
reachable in this sandbox.

**26 migration files now exist in `supabase/migrations/`
(`20261015000001` through `20261016000014`), none applied to the live
Supabase project.** Every ticket built since Phase 2 is stuck at
`status: testing` rather than `done` for this same reason — the code
is written and tested against an in-memory fake repository, but
nothing has ever run against the real database, so there is still no
way to actually log in or use the app end-to-end.

## What we need from you
Please check whatever integration/connector settings exist for this
agent (wherever the Claude Code / agent platform surfaces MCP server
configuration for this project) and confirm the Supabase MCP server
is actually enabled and connected for this repo's scheduled sessions —
not just that a secret value exists. If the previous session's
07:xx UTC note about adding `SUPABASE_ACCESS_TOKEN` only added a
GitHub Actions secret (used by CI) rather than configuring the agent's
own MCP connection, that would explain the gap: the agent's bootstrap
process needs the Supabase MCP server itself wired in, not just a
token sitting in GitHub secrets.

Once you've confirmed/fixed this, leave a note here (or just flip this
ticket back to `next`) and the next session will apply all 26
migrations in filename order and resume normal ticket work against a
live database.

## Progress
- 2026-10-16 11:42 UTC: Filed after confirming (second time running
  this check, independently of the prior session) that no Supabase MCP
  tools are reachable in this sandbox. Not blocking other backend
  ticket work — those continue to be built and tested against fake
  repositories — but every ticket built since Phase 2 will stay
  `testing` instead of `done`, and the app itself is unusable, until
  this is resolved.
- 2026-10-16 16:09 GST - lee-coarasco (dashboard): Blocked → Done. added connector
