---
id: 100
title: developer guide md file
status: done
roles: [ui-designer, architect]
priority: 1
created: 2026-10-16
updated: 2026-10-16
---

for all modules so far build and upcoming modules every time when something is finished this should be updated in user guide . so we know which module and how to use that module. if any changes done on module that time also this should be updated to the latest information.

_Created by lee-coarasco in the AppYard dashboard._

## Acceptance
- [x] `docs/USER-GUIDE.md` exists with one entry per BRD module that has any
      code today (M01-M11), each stating status, what's built (backend +
      frontend), and how to actually use it in plain language.
- [x] A standing instruction exists (CLAUDE.md ground rule 8) telling every
      future session to update this file in the same commit as any module
      change, so it doesn't go stale — this was the ticket's "every time
      something is finished" ask, not a one-off doc.

## Progress
- 2026-10-16 17:20 UTC: Wrote `docs/USER-GUIDE.md` — one section per module
  M01 through M11 (M11 flagged as "ahead of the official build order" since
  CLAUDE.md's module table doesn't officially reach it yet, but it has real
  backend code via tickets 0095-0098 and the guide shouldn't silently omit
  that), plus a closing "Not started yet" note pointing at M12+ so nobody
  assumes code exists just because a module number got skipped. Each entry
  cross-checked against `tickets/*.md` status fields (not assumed from
  CLAUDE.md's phase-level status alone — e.g. M11a/b/c are `testing`, not
  `done`, even though the M11 umbrella ticket 0095 is `done` in the
  architect-breakdown sense only) and against this session's own direct
  reading of `backend/src/modules/workflow/routes.ts` for M07/M08 (a survey
  agent drafted the per-module facts first; its listed endpoint paths
  weren't all exactly right — e.g. it had the approval-revoke route as
  `/workflow/instances/:id/steps/:stepInstanceId/revoke-approval`, the real
  one is `POST /approvals/decisions/:decisionId/revoke` — so the final doc
  deliberately describes capabilities in prose rather than quoting exact
  paths for M06/M07/M08, to avoid baking in a route the agent got wrong).
  Added CLAUDE.md ground rule 8 so the "keep this updated every time" part
  of the ask is a standing instruction, not something only this session did.
  Marking `done` — no tests apply to a markdown file; `python3
  scripts/tickets.py check` passes.
