---
id: 101
title: read me file for the application
status: done
roles: [architect]
priority: 1
created: 2026-10-16
updated: 2026-10-16
---

create a readme md file to cover all the details about this project architecture and everything that readme should contain.

_Created by lee-coarasco in the AppYard dashboard._

## Acceptance
- [x] Root `README.md` covers: what the project is, current status (pointing
      at `docs/USER-GUIDE.md` rather than duplicating it), architecture,
      repo layout, local setup for backend + frontend, how to run tests, and
      how a session/human should work in this repo (points at CLAUDE.md,
      tickets/, daily-log/).

## Progress
- 2026-10-16 17:30 UTC: Wrote root `README.md`. Deliberately points at
  `docs/USER-GUIDE.md` (ticket 0100) for per-module status/usage rather than
  repeating it — a README that duplicates a living doc goes stale the first
  time only one of the two gets updated. Pulled setup steps from
  `backend/.env.example`, `frontend/.env.example` and both `package.json`
  scripts blocks to make sure the documented commands (`npm run dev`,
  `npm run bootstrap:admin`, `npm test`, `npm run build`) are the real ones,
  not guessed. Marking `done` — no tests apply to a markdown file.
