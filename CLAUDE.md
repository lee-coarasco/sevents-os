# Project: SEVENTS

## One-line idea
UAE-first, country-agnostic construction ERP with workflow automation and controlled AI agents, initially deployed for a UAE-based construction company.

Full requirements: `docs/BRD.md` — read this every session before doing anything.
Implementation plan: `docs/IMPLEMENTATION-PLAN.md`
Work item catalogue: `docs/work-item-catalogue.xlsx` (1,308 rows — imported and classified, see `tickets/` and `docs/catalogue/disposition-workbook.csv`)

## Status
`PHASE_2` — Configuration studio and workflow runtime. **Phase 1 code-complete (tickets 0053-0056, status: testing). M05 catalogue import (ticket 0058) built, status: testing. M06 (ticket 0059) is next.**

### Phase 0 deliverables (all done ✓)
- `docs/PRD.md` — pilot PRD for Phase 3 vertical slice (material request → PO → GRN → site issue). **Approved by owner 2026-10-15. Pilot flow confirmed.**
- `docs/canonical-role-map.md` — all 44 raw catalogue roles mapped to canonical role IDs.
- `docs/catalogue/disposition-workbook.csv` — all 1,308 rows classified (Configure workflow 995, Configure approval/decision 215, Periodic review/monitor 60, Track obligation/document 21, Defer 17).
- `tickets/0001`–`0051` — full catalogue classified into 51 ticket files.

### Build order (follow this exactly — do not jump phases)
1. ✓ **Phase 0** — Discovery and configuration design. Done.
2. ✓ **Phase 1** — Secure platform foundation. Code-complete (tickets 0053-0056, status: testing).
3. → **Phase 2** — Configuration studio and workflow runtime. **Start here now.** M05 (ticket 0058) built; M06 (ticket 0059) next.
4. **Phase 3 onwards** — Build BRD modules in dependency order (see below).
5. **Phase 4+** — Knowledge assistant, controlled AI agents.

**Do NOT skip to procurement or material-request features.** Build modules in the BRD order — every later module depends on the ones before it.

### BRD module build order (Phase 3 onwards)
Build in this sequence. Each module depends on those before it. Do not start a module until its prerequisites are done.

| # | Module | Depends on |
|---|---|---|
| M01 | Identity, Authentication & Sessions | — |
| M02 | Company, Branch, Project & Tenant Setup | M01 |
| M03 | Organization, Departments, Roles & Authority | M01, M02 |
| M04 | Employee Directory & Workforce | M01, M02, M03 |
| M05 | Work-Item Catalogue & Disposition | M03 |
| M06 | Configuration Studio & Workflow Engine | M03, M05 |
| M07 | Tasks, My Work & Work Queues | M03, M06 |
| M08 | Approvals & Delegation | M03, M06, M07 |
| M09 | Project & Portfolio Management | M02, M03, M08 |
| M10 | Client, CRM & Sales Pipeline | M02, M09 |
| M11 | Tendering, Estimation & Commercials | M09, M10 |
| M12 | Technical Engineering & Design Control | M09, M13 |
| M13 | Documents, Drawings & Records | M02, M09 |
| M14 | Procurement & Vendor Management | M09, M15, M08 |
| M15 | Inventory, Stores & Material Movement | M09, M14 |
| M16 | Subcontractor & Labour Operations | M09, M04 |
| M17 | Site Operations, DPR & Field Capture | M09, M07 |
| M18 | Schedule, Progress & Resource Planning | M09 |
| M19 | Quality, Inspection & NCR | M09, M07 |
| M20 | Safety, Incidents & Compliance | M09, M07 |
| M21 | Finance, Budgets & Cost Control | M09, M08 |
| M22 | Billing, Invoicing, Receivables & Payables | M21, M14 |
| M23 | Contracts, Claims, Variations & EOT | M09, M08, M21 |
| M24 | People, Recruitment & Performance | M04, M03 |
| M25 | Equipment, Plant & Fleet | M09, M04 |
| M26 | Customer/Stakeholder Communications | M10, M09 |
| M27 | Legal, Licences & Regulatory Register | M02, M08 |
| M28 | AI Knowledge Assistant & Search | M05, M06, M13 |
| M29 | AI Agent Studio & Tool Registry | M06, M28 |
| M30 | Agent Runs, Human Review & Audit | M29 |
| M31 | Notifications, SLA & Escalations | M06, M07 |
| M32 | Dashboards, Reports & KPI Builder | M07, M09, M21 |
| M33 | Master Data & Configuration | M02 |
| M34 | Integrations & API Management | M02, M34 |
| M35 | Audit, Security, Privacy & Retention | M01, M02 |
| M36 | Platform Administration & Support | all |
| M37 | Mobile/PWA & Offline Site Mode | M07, M17 |
| M38 | Implementation, Migration & Data Quality | M05, M33 |

**Note on Phase 1 overlap:** M01, M02, M03 are the Phase 1 deliverables. Phase 1 builds those. Phase 2 builds M05 + M06 (catalogue + workflow engine). Phase 3 starts M04, M07, M08, M09 and continues in order.

---

## Tech stack (owner-approved 2026-10-15)

**Approved. Do not re-litigate. Do not write to NEEDS_APPROVAL.md for these choices — they are final.**

| Layer | Choice | Notes |
|---|---|---|
| **Database** | Supabase (PostgreSQL) | Row-level security for tenant isolation; Supabase client SDK in backend |
| **Auth** | Supabase Auth | JWT-based; role claims in JWT for permission checks |
| **File storage** | Supabase Storage | Documents, evidence attachments, engineering files |
| **Realtime** | Supabase Realtime | Task/approval queue updates |
| **Backend API** | Node.js (TypeScript) | REST + tRPC or REST only — architect decides |
| **Frontend** | TBD — architect proposes in Phase 1 ticket | React-based preferred but not locked |
| **Hosting** | TBD — architect proposes | Vercel / Railway / Fly.io all acceptable |

**Supabase project is provisioned and ready.** Credentials are already set as GitHub Actions secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`. Do not hard-code them. Use `SUPABASE_SERVICE_ROLE_KEY` only in backend/server contexts, never in client-side code.

Use the Supabase CLI (`supabase`) for all schema work: write migration files under `supabase/migrations/`, apply with `supabase db push`. Initialize the Supabase project config (`supabase init`) if not already present. RLS must be enabled on every table — no table is accessible without a policy.

**What is decided:** Supabase for DB + Auth + Storage + Realtime. Node.js + TypeScript for the backend. These are not up for debate.

**What is still TBD:** Frontend framework (architect proposes), hosting target (architect proposes), specific Node.js framework (Express / Fastify / Hono — architect decides). Write to NEEDS_APPROVAL.md only if a genuinely new paid service is needed.

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
- Which testing framework/library to use
- Internal API design, DB schema details, additive/non-destructive migrations
- UI component structure and styling approach
- Which open-source libraries to pull in (MIT/Apache/BSD licence only)
- Writing tests, fixing bugs it introduced, refactoring its own code
- Day-to-day task breakdown and ordering within an approved milestone
- Preview deploys (do not affect the live app)
- Node.js framework choice (Express / Fastify / Hono)
- Frontend component library choice

## What requires YOUR approval (ask the owner and STOP that work)
- UAE VAT / tax treatment — do NOT activate tax posting without finance owner sign-off
- Payment or banking integrations
- Third-party paid services or anything with a monthly cost
- Any decision that would be expensive or risky to reverse
- **Production deploys** — the devops subagent will never do this itself
- **Destructive database changes** — the backend-engineer subagent will never do these itself
- Anything explicitly marked "ask first" in DECISIONS.md by you

### Standing approvals (owner pre-approved, with date)
- **2026-10-15** — Tech stack: Supabase (DB + Auth + Storage + Realtime) + Node.js/TypeScript backend. Final.
- **2026-10-15** — Phase build order: Phase 1 → Phase 2 → Phase 3+, no skipping. Within Phase 3+, build BRD modules in dependency order starting from M01 (see module table above). Do not jump to procurement or material modules early — they sit at M14/M15 and depend on everything before them.

## PRD sync rule
The AppYard dashboard reads `PRD.md` at the **repo root**. The detailed PRD lives at `docs/PRD.md`. Whenever you update `docs/PRD.md`, also update the root `PRD.md` in the same commit so the dashboard stays in sync.

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
Phase 1: no user-facing UI yet — owner tests by running the repo's test suite locally or reviewing migration files and API contracts.
Phase 2 onwards: architect creates a ticket with `roles: [human]` when a preview deploy is ready.
Daily log: `New build needed: NO` until the first deployable build exists.

## Tech stack (detail)
See Standing approvals above. Supabase + Node.js/TypeScript is locked.
Do not re-litigate the database or auth choice.

## Business rules / domain notes
- Architecture is country-agnostic, multi-tenant, configuration-first (BRD section 2, Implementation Plan section 1).
- UAE is the initial localization profile. GST must NOT be assumed or hard-coded anywhere.
- VAT is configurable — do not apply a default rate. Finance owner confirmation required before activation.
- Do not hard-code any country's tax rates, statutory IDs, invoice formats or filing requirements. Use localization configuration packs.
- AI agents must not invent authority limits, SLA values, approval policies or production data. Use `TBD—Business Owner Decision` entries for unknowns.
- The 1,308-row work-item catalogue configures the system; it does not define module or code boundaries.
