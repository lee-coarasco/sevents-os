---
id: 86
title: Wire a real preview deploy for the frontend (Vercel)
status: blocked
roles: [human, devops]
priority: 1
created: 2026-10-16
updated: 2026-10-16T12:30Z
---

Ticket 0084 (the owner's "when will UI be created" question) got a
working `frontend/` scaffold built and tested locally this session —
login screen (Supabase auth) + a dashboard shell calling the real
backend. It builds and passes its tests, but there is still no URL
the owner can actually open in a browser. This ticket is what gets
one.

Hosting decision (DECISIONS.md, 2026-10-16): Vercel, for preview
deploys. Agent-decidable, no owner approval needed for the choice
itself — but creating the actual Vercel project/account and the
deploy token is an owner action per CLAUDE.md ("Anything the owner
must do (a key, an account, a device test) is a ticket with
`roles: [human]`").

## What's needed from the owner (human half)

**Deploy method confirmed (2026-10-16 update): Vercel CLI approach —
requires all three secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
`VERCEL_PROJECT_ID`.**

1. ✅ A Vercel account (free tier is enough for preview deploys).
2. Run `vercel link` locally inside the `frontend/` folder to connect it
   to a Vercel project. This creates `frontend/.vercel/project.json`
   containing your `orgId` and `projectId`.
3. Add these as GitHub Actions secrets (same place as `SUPABASE_URL`):
   - ✅ `VERCEL_TOKEN` — already added
   - `VERCEL_ORG_ID` — value from `frontend/.vercel/project.json` → `orgId`
   - `VERCEL_PROJECT_ID` — value from `frontend/.vercel/project.json` → `projectId`
4. Add the frontend runtime env vars in Vercel project settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_API_URL` (use `http://localhost:3000` as placeholder until
     backend is hosted)

## What devops does once the above exists
- Wire a preview deploy (`vercel deploy` or the Vercel GitHub
  integration) that runs on every PR/push to a non-main branch —
  preview only, never production, per CLAUDE.md's standing rule that
  devops never does production deploys itself.
- Confirm the deployed preview can actually sign in and load
  `GET /tenancy/companies` against a real (or seeded) Supabase
  project, not just build successfully.
- Once a preview URL is confirmed working, open the
  `roles: [human]` ticket CLAUDE.md asks for ("architect creates a
  ticket with `roles: [human]` when a preview deploy is ready") so the
  owner is told there's something to click.

## Out of scope
- Any production deploy — that still requires explicit owner
  approval per CLAUDE.md regardless of how this ticket resolves.
- Backend hosting — still a separate open TBD in CLAUDE.md's tech
  stack table (Vercel / Railway / Fly.io all acceptable); needs its
  own decision before `VITE_API_URL` can point at a real deployed
  backend rather than localhost.

## Acceptance
- [ ] Vercel account/project/secrets exist (human).
- [ ] CI wires a preview deploy on non-main branches (devops).
- [ ] A real preview URL loads the login screen and, after sign-in,
      the dashboard shell successfully calls the backend.
- [ ] A follow-up `roles: [human]` ticket is filed once the preview
      is confirmed working, per CLAUDE.md's rule for Phase 2+.

## Progress
- 2026-10-16 06:04 UTC: Filed off the back of ticket 0084's "when
  will UI be created" question — the frontend scaffold now exists
  (see ticket 0084's Progress note) but has nowhere to be seen except
  locally. Blocked on the owner setting up the Vercel account/token
  (see "What's needed from the owner" above); devops's half can start
  immediately once that exists.
- 2026-10-16 12:30 UTC: Owner initially confirmed GitHub App integration;
  later updated to Vercel CLI approach. `VERCEL_TOKEN` already set.
  Still needed: `VERCEL_ORG_ID` + `VERCEL_PROJECT_ID` (run `vercel link`
  in `frontend/` locally to get them from `.vercel/project.json`), then
  add as GitHub Actions secrets. Also add the three `VITE_*` env vars
  in Vercel project settings.
