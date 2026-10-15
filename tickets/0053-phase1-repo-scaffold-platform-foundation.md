---
id: 53
title: "Phase 1 scaffold: Node.js/TypeScript backend, Supabase project, test harness"
status: next
roles: [backend-engineer, devops]
priority: 1
created: 2026-10-15
updated: 2026-10-15
---

Phase 0 is done (all of tickets 0001-0052). CLAUDE.md and
`docs/IMPLEMENTATION-PLAN.md` §3 say Phase 1 ("Secure platform foundation")
starts now. No application code exists yet — this ticket is the one-time
scaffold everything else in Phase 1 (tickets 0054-0056, M01-M03) builds on.

This ticket does not implement any business logic. It only creates the
skeleton so the next tickets can add real endpoints/migrations without
first inventing project structure.

## Scope

- `supabase/` — run `supabase init`; `supabase/migrations/` for schema
  changes (empty to start, first real migration lands in ticket 0054).
  Do not hard-code the project's Supabase URL/keys anywhere — read
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` from env
  (already set as GitHub Actions secrets per CLAUDE.md).
- Node.js + TypeScript backend skeleton under `backend/`:
  - Framework choice: **Fastify** (agent-decidable per CLAUDE.md — chosen
    for low overhead and first-class TypeScript/schema support, which
    suits a config-first API). Record this in DECISIONS.md.
  - `backend/package.json`, `tsconfig.json`, lint config.
  - A health-check route (`GET /health`) that confirms the process is up
    and can reach Supabase, as the first thing testable.
  - `backend/src/lib/supabase.ts` — one shared client factory, service-role
    client for server-side use only (never sent to a client bundle).
  - Env var loading via `.env` locally (gitignored) + `.env.example`
    committed with placeholder names only, no real values.
- Test harness: pick one runner (Vitest recommended — fast, native ESM/TS)
  and wire `npm test` in `backend/package.json`. One smoke test asserting
  the health route returns 200.
- Do NOT touch `.github/workflows/` — CI wiring for `npm test` is human-only
  per CLAUDE.md ("Workflow files are human-only"). Instead, open a new
  ticket with `roles: [human]` asking the owner to add a test-on-PR step,
  once this ticket lands and `npm test` works locally.
- Frontend framework and hosting target stay undecided in this ticket —
  Phase 1 has no UI (CLAUDE.md "How the owner tests": "Phase 1: no
  user-facing UI yet"). Defer both to a Phase 2 ticket when there's
  something to render/deploy.

## Out of scope (future tickets)
- Any real table/migration (ticket 0054 adds the first one: identity).
- Auth endpoints, RLS policies, tenant model (tickets 0054-0056).
- Any deploy — devops only runs `npm run build` here to prove it compiles;
  no Vercel/preview deploy needed until there's a UI to show.

## Acceptance
- [ ] `backend/` exists with a working TypeScript build (`npm run build`
      succeeds with zero errors).
- [ ] `npm test` runs and passes (health-check smoke test).
- [ ] `GET /health` returns 200 and confirms it can reach Supabase using
      env-provided credentials (no hard-coded secrets anywhere in the diff).
- [ ] `supabase/` initialized with an empty `migrations/` folder, ready for
      ticket 0054's first migration.
- [ ] `.env.example` committed, `.env` gitignored.
- [ ] DECISIONS.md updated with the Fastify + Vitest choices and why.
- [ ] A `roles: [human]` ticket filed for wiring `npm test`/`npm run build`
      into CI once this ticket's tests pass locally.

## Progress
- 2026-10-15: Architect session. Filed this ticket as the first Phase 1
  ticket — no backend code existed yet. Tickets 0054 (M01 Identity), 0055
  (M02 Tenant/Company) and 0056 (M03 Org/Roles/Authority) depend on this
  scaffold and are filed alongside it, in that build order.
