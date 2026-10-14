# Project: SEVENTS

## One-line idea
UAE-first, country-agnostic construction ERP with workflow automation and controlled AI agents, initially deployed for a UAE-based construction company.

Full requirements: `docs/BRD.md` — read this every session before doing anything.
Implementation plan: `docs/IMPLEMENTATION-PLAN.md`
Work item catalogue: `docs/work-item-catalogue.xlsx` (1,308 rows — import and classify into tickets)

## Status
`PHASE_0` — Discovery and configuration design. **No application code yet.**

The architect's job this phase:
1. Read `docs/BRD.md` (sections 1–4) and `docs/IMPLEMENTATION-PLAN.md` (Phase 0).
2. Produce `docs/PRD.md` covering the pilot scope only (Phase 3 vertical slice: material request → PO → GRN → site issue, or whatever the business owner confirms).
3. Import and classify work items from `docs/work-item-catalogue.xlsx` into `tickets/` — one ticket per actionable item, following the disposition categories in the Implementation Plan section 2.
4. Produce `docs/canonical-role-map.md` mapping source roles to canonical system roles.
5. Record all open questions and unknown SLAs in `DECISIONS.md` / `NEEDS_APPROVAL.md`.

**Do NOT write application code until the PRD is approved and status changes to `BUILDING`.**

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
- Ticket classification, disposition and ordering
- Folder/module structure, naming conventions, code style
- Which testing framework/library to use (once BUILDING)
- Internal API design, DB schema details, additive/non-destructive migrations
- UI component structure and styling approach
- Which open-source libraries to pull in (MIT/Apache/BSD licence only)
- Writing tests, fixing bugs it introduced, refactoring its own code
- Day-to-day task breakdown and ordering within an approved milestone
- Preview deploys (do not affect the live app)

## What requires YOUR approval (ask the owner and STOP that work)
- The overall PRD / feature scope before any code is written
- Tech stack choice (language, framework, database, hosting target)
- UAE VAT / tax treatment — do NOT activate tax posting without finance owner sign-off
- Authentication/authorization strategy
- Payment or banking integrations
- Third-party paid services or anything with a monthly cost
- Any decision that would be expensive or risky to reverse
- **Production deploys** — the devops subagent will never do this itself
- **Destructive database changes** — the backend-engineer subagent will never do these itself
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
   tickets/README.md, then the tickets `scripts/tickets.py next` names.
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
No builds in Phase 0 — all output is documentation and ticket files.
Daily log: `New build needed: NO`

## Tech stack
TBD — architect proposes in NEEDS_APPROVAL.md after PRD is approved.
Do not re-litigate without writing to NEEDS_APPROVAL.md first.

## Business rules / domain notes
- Architecture is country-agnostic, multi-tenant, configuration-first (BRD section 2, Implementation Plan section 1).
- UAE is the initial localization profile. GST must NOT be assumed or hard-coded anywhere.
- VAT is configurable — do not apply a default rate. Finance owner confirmation required before activation.
- Do not hard-code any country's tax rates, statutory IDs, invoice formats or filing requirements. Use localization configuration packs.
- AI agents must not invent authority limits, SLA values, approval policies or production data. Use `TBD—Business Owner Decision` entries for unknowns.
- The 1,308-row work-item catalogue configures the system; it does not define module or code boundaries.
