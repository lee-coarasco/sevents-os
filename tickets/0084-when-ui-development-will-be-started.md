---
id: 84
title: When UI development will be started for all the developed modules
status: in-progress
roles: [ui-designer, architect]
priority: 1
created: 2026-10-16
updated: 2026-10-16
---

So far only backend is created tell me when UI will be created .

_Created by lee-coarasco in the AppYard dashboard._

## Answer

You're right that nothing visual existed yet — that was a real gap,
not intentional. Here's why, and what changed in this session:

**Why there was no UI yet:** Phase 1 and Phase 2 were explicitly
backend/API-only by design (CLAUDE.md: "Phase 1: no user-facing UI
yet"). But the frontend framework itself should have been decided
during Phase 1 per the original plan (`docs/PRD.md` open question 5:
"architect to propose... during Phase 1") — ticket 0053 (the Phase 1
scaffold) explicitly deferred that decision "to a Phase 2 ticket when
there's something to render/deploy," and no later ticket ever picked
it back up. Phase 2 finished without it. That's the gap you noticed.

**What this session did about it:**
1. Made the frontend decision that was overdue: **Vite + React 18 +
   TypeScript + Tailwind CSS**, talking to the existing backend over
   REST and to Supabase Auth directly from the browser for sign-in.
   Hosting target: **Vercel** (preview deploys). Recorded in
   `DECISIONS.md` and `CLAUDE.md`'s tech stack table — these are
   agent-decidable per CLAUDE.md, not an owner-approval item.
2. Built the actual scaffold under `frontend/`: a working login
   screen (Supabase email/password sign-in) and a dashboard shell that
   calls the real backend (`GET /tenancy/companies`) and lists
   whatever companies exist for the signed-in user. Added
   `@fastify/cors` to the backend so the frontend's dev server is
   allowed to call it. Both builds pass, both test suites pass
   (366 backend + 1 new frontend test).
3. **When will you actually be able to click around in a browser?**
   Not yet — this session built the scaffold and verified it builds/
   tests locally, but there is no deployed preview yet. That's the
   very next piece of work (see ticket 0086), and per CLAUDE.md a
   `roles: [human]` ticket will tell you exactly when a preview URL
   exists to click.

**Going forward — UI will now be built module-by-module, not as one
big-bang effort at the end.** Per `docs/IMPLEMENTATION-PLAN.md` §3,
each BRD module from here on (M04, M07, M08, M09, ...) is meant to
ship as "schema, APIs, UI, permissions, audit... and user acceptance"
together — so UI tickets should ride alongside each backend module's
tickets rather than trailing a whole phase behind. Ticket 0086 covers
getting a real preview URL live; follow-on UI tickets for the modules
already built (M01-M03, M05-M06) are filed next.

## Progress
- 2026-10-16 06:04 UTC: Answered in `## Answer` above. Decided and
  recorded the frontend framework/hosting choice that had been
  deferred since ticket 0053 (Vite + React + TS + Tailwind, Vercel).
  Built the actual `frontend/` scaffold (login + dashboard shell
  calling the real `GET /tenancy/companies` backend route), added
  backend CORS support. Both test suites pass. Filed ticket 0086
  (devops: wire a real Vercel preview deploy) and ticket 0087
  (ui-designer: first real module screens — M02/M03 company/branch/
  project/department/role setup — on top of this scaffold). Leaving
  this ticket `in-progress` rather than closing it: it tracks the
  broader "when is UI done" question, and stays open until there's a
  live preview URL and at least one real module screen beyond the
  scaffold's login/dashboard.
