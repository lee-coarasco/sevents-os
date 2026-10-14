# Project: sevents-os

## One-line idea
The Operating System for Intelligent Construction.

Full requirements: docs/BRD.md (if you have one). The architect turns them into
docs/PRD.md; nothing is built until the PRD is approved.

## Status
`SPEC_PENDING` — the architect writes docs/PRD.md and the tech-stack proposal to
NEEDS_APPROVAL.md. Change to `BUILDING` once they are approved.

---

## Team structure
This project uses specialized subagents instead of one generalist agent:
- `architect` — PRD, tech stack, data model, breaks work into ticket files
- `ui-designer` — frontend/UI, no DB or deploy access
- `backend-engineer` — API, business logic, database schema
- `test-engineer` — writes/runs tests, verifies other subagents' work
- `devops` — builds and deploys, preview only, no prod access

Each subagent's full rules live in `.claude/agents/<name>.md`. The main
session should delegate to the right one rather than doing everything
itself. See those files before assuming what a subagent can/can't do.

## What the agent may decide on its own (no approval needed)
- Folder/module structure, naming conventions, code style
- Which testing framework/library to use
- Internal API design, DB schema details, additive/non-destructive migrations
- UI component structure and styling approach
- Which open-source libraries to pull in (as long as license is permissive:
  MIT/Apache/BSD) and they're added to package manifests properly
- Writing tests, fixing bugs it introduced, refactoring its own code
- Day-to-day task breakdown and ordering within an approved milestone
- Preview deploys (do not affect the live app)

## What requires YOUR approval (ask the owner and STOP that work)
- The overall PRD / feature scope before any code is written
- Tech stack choice (language, framework, database, hosting target)
- Authentication/authorization strategy
- Payment integration (or any handling of real money/real user financial data)
- Third-party paid services or anything with a monthly cost
- Any decision that would be expensive or risky to reverse later
- **Production deploys** — the devops subagent will never do this itself
- **Destructive database changes** — dropping/truncating tables with real
  data, lossy column changes, rotating or revealing API keys/secrets — the
  backend-engineer subagent will never do these itself
- Anything explicitly marked "ask first" in DECISIONS.md by you

Standing approvals (work the owner has pre-approved, with its limits) go here
as they are given, with the date.

## Workflow files are human-only
The scheduled agent must NEVER create or edit anything under `.github/workflows/`:
its GitHub token has no `workflows` permission, so the push is rejected and the
whole session's commits are lost. Needed workflow changes go into a ticket with
`roles: [human]`.

## Ground rules
1. Never guess on an approval-required item — ask the owner and stop working
   on that thread of work. A question about one ticket goes in that ticket's
   `## Needs approval` section and blocks only that ticket (prompt.md has the
   format); other tickets carry on. NEEDS_APPROVAL.md is only for a question
   that must stop ALL work, because it pauses every session until answered.
2. Every session: read CLAUDE.md, DECISIONS.md, NEEDS_APPROVAL.md and
   tickets/README.md, then the ticket `scripts/tickets.py next` names.
3. Every code change is a git commit with a clear message.
4. Write or update tests for anything you build. Do not mark a task done
   until its tests pass.
5. At the end of every session, append a summary to
   daily-log/YYYY-MM-DD.md and update the tickets you touched so the next session (which
   may be a different context window) can pick up cleanly. Head every
   daily-log entry, and every new DECISIONS.md/NEEDS_APPROVAL.md item, with a
   full `YYYY-MM-DD HH:MM <TZ>` timestamp (see prompt.md), not just a date.
6. Keep sessions scoped — finish or clearly checkpoint one task rather than
   leaving many things half-done.
7. If you're blocked (failing test you can't fix, missing credential, etc.),
   set the ticket to `status: blocked` with the reason under `## Progress`
   rather than skipping silently.

## How the owner tests
Web preview — the devops agent publishes a URL after each deploy.
Daily log: `New build needed: NO - preview URL is in the dashboard under Builds.`

## Tech stack
(Decided after PRD approval — do not re-litigate without writing to NEEDS_APPROVAL.md first.)

## Business rules / domain notes
(Decisions that change or add to the requirements, with the reason.)
