---
id: 53
title: "Phase 1 scaffold: Node.js/TypeScript backend, Supabase project, test harness"
status: testing
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
- [x] `backend/` exists with a working TypeScript build (`npm run build`
      succeeds with zero errors).
- [x] `npm test` runs and passes (health-check smoke test).
- [x] `GET /health` route implemented: returns 200 + `{status:"ok"}` when
      it can reach Supabase, 503 + `{status:"degraded"}` otherwise, reading
      `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` from env with no hard-coded
      secrets. Verified against a mocked Supabase client (both the
      reachable and unreachable branches) — this session's sandbox has no
      real `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` available to it, so
      the live round-trip to the actual Supabase project is NOT yet
      exercised. Flagging for the owner/next session to confirm `GET
      /health` against the real project once it's run with real env vars.
- [x] `supabase/` initialized (hand-written `config.toml` + empty
      `migrations/` — the `supabase` CLI binary wasn't available in this
      sandbox; see DECISIONS.md) ready for ticket 0054's first migration.
- [x] `.env.example` committed, `backend/.env` gitignored.
- [x] DECISIONS.md updated with the Fastify + Vitest choices and why, plus
      the CLI-unavailable note.
- [x] Ticket 0057 filed (`roles: [human]`) for wiring `npm test`/
      `npm run build` into CI.

## Progress
- 2026-10-15: Architect session. Filed this ticket as the first Phase 1
  ticket — no backend code existed yet. Tickets 0054 (M01 Identity), 0055
  (M02 Tenant/Company) and 0056 (M03 Org/Roles/Authority) depend on this
  scaffold and are filed alongside it, in that build order.
- 2026-10-15 11:12 UTC: Built the scaffold. `backend/` is a Fastify +
  TypeScript app (`npm run build` clean, `npm test` — 3/3 passing via
  Vitest). `GET /health` injects the Supabase client so tests don't need
  live credentials/network; real connectivity to the actual Supabase
  project is unverified in this session (no credentials reachable in this
  sandbox) — first session with real env vars should hit `/health` once
  and confirm `"status":"ok"`. `supabase/config.toml` + `migrations/`
  created by hand (CLI not installed here). Ran `npm audit` after pinning
  `vitest@^4.1.11` — 0 vulnerabilities. Status set to `testing`: the owner
  can verify by running `cd backend && npm install && npm test` (per
  CLAUDE.md "How the owner tests" — Phase 1 has no UI). Moving ticket 0054
  (M01 Identity) to next.
