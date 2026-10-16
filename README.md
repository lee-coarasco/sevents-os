# SEVENTS

A UAE-first, country-agnostic construction ERP: workflow automation,
configurable approval chains, and (later) controlled AI agents, built for a
UAE-based construction company as the first deployment.

This repo is built by autonomous Claude Code sessions running on a schedule,
guided by the docs below — see [Working on this repo](#working-on-this-repo)
if that's why you're here.

## Current status

`PHASE_2` of the build — Configuration studio and workflow runtime are
code-complete; Phase 3 (project/task/approval/CRM modules) is in progress.
**For what's actually built and how to use it today, module by module, see
[`docs/USER-GUIDE.md`](docs/USER-GUIDE.md) — it's the single source of truth
and is kept in sync with every change.**

## Architecture

- **Database / Auth / Storage / Realtime:** [Supabase](https://supabase.com)
  (PostgreSQL). Every table has row-level security — tenant isolation is
  enforced at the database layer, not just in application code.
- **Backend:** Node.js + TypeScript, [Fastify](https://fastify.dev). One
  module per BRD area under `backend/src/modules/` (e.g. `identity`,
  `tenancy`, `authority`, `workflow`, `projects`, `crm`) — each owns its own
  `routes.ts`, `service.ts`, `repository.ts`, `types.ts`, and tests.
- **Frontend:** [Vite](https://vitejs.dev) + React 18 + TypeScript +
  Tailwind CSS, talking to the backend over REST and to Supabase Auth
  directly from the browser for sign-in. One page per screen under
  `frontend/src/pages/`.
- **Multi-tenancy:** every table carries a `tenant_id`; RLS policies scope
  every query to the caller's tenant automatically.
- **Configuration-first:** the 1,308-row work-item catalogue (`docs/
  work-item-catalogue.xlsx`) drives which workflows/approvals exist — it
  configures the system, it does not define module or code boundaries.
  See `docs/BRD.md` §6.3 and `docs/IMPLEMENTATION-PLAN.md` §1.

## Repo layout

```
backend/            Fastify API, one folder per module under src/modules/
frontend/            Vite + React app, one file per screen under src/pages/
supabase/migrations/ SQL migrations, applied via the Supabase MCP tool
docs/
  BRD.md              Full business requirements — read before any session
  IMPLEMENTATION-PLAN.md
  PRD.md              Pilot vertical-slice PRD (material request → PO → GRN → site issue)
  USER-GUIDE.md       What's built per module, kept current every session
  catalogue/          Disposition workbook + role map from the source catalogue
tickets/             One markdown file per backlog item — see tickets/README.md
daily-log/           One file per day, appended to at the end of every session
scripts/tickets.py   Backlog CLI: `next`, `new-id`, `check`
CLAUDE.md            Project rules, approvals, standing decisions for agent sessions
DECISIONS.md         Append-only decision log
NEEDS_APPROVAL.md    Open questions that block ALL work until the owner answers
```

## Getting started

### Prerequisites

- Node.js ≥ 20
- A Supabase project (URL + anon key + service role key)

### Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
npm run dev             # starts the Fastify API on PORT (default 3000)
```

Database migrations live in `supabase/migrations/` and are applied via the
Supabase MCP tool (`mcp__Supabase__apply_migration`), not the Supabase CLI.
To create the first login-able user against a fresh Supabase project, set
`BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD` in `.env` and run
`npm run bootstrap:admin` once.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL
npm run dev                   # Vite dev server, default http://localhost:5173
```

### Tests

```bash
cd backend && npm test     # vitest
cd frontend && npm test    # vitest + Testing Library
```

Both `npm run build` (frontend: `tsc` + `vite build`; backend: `tsc`) must
pass with no TypeScript errors before any change is considered done.

## Working on this repo

This project is developed by scheduled, autonomous Claude Code sessions, not
ad hoc chat. If you're a human or an agent picking this up:

1. Read `CLAUDE.md` first, every session — it has the module build order,
   what an agent may decide on its own vs. what needs the owner's approval,
   the design system, and the standing ground rules.
2. Check `NEEDS_APPROVAL.md` — if it's non-empty, all work is paused until
   the owner answers.
3. Check `DECISIONS.md` for past decisions so you don't contradict them.
4. Read `tickets/README.md`, then run `python3 scripts/tickets.py next` to
   find the next ticket to work on.
5. After any change, update `docs/USER-GUIDE.md` for the module you touched,
   update the ticket's `## Progress`, and append to today's
   `daily-log/YYYY-MM-DD.md`.

Build order is strict: modules depend on the ones before them (BRD module
table in `CLAUDE.md`) — don't skip ahead to procurement/material-request
features before the modules they depend on exist.
