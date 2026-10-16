---
id: 85
title: For workflow are we using temporal?
status: done
roles: [backend-engineer, architect]
priority: 1
created: 2026-10-16
updated: 2026-10-16
---

How we are managing the workflows now are we using temporal or supabse service for this . Check and tell me and later we if do with temporal deployment how we can do will it requires only minimum changes to support?

_Created by lee-coarasco in the AppYard dashboard._

## Answer

**No, we are not using Temporal.** The workflow engine (M06, tickets
0060-0063) is custom-built directly on Supabase/Postgres:
`workflow_definitions` / `workflow_versions` / `workflow_nodes` /
`workflow_transitions` define the configured graph; `workflow_instances`
/ `workflow_step_instances` / `workflow_events` track a running
instance. `backend/src/modules/workflow/runtime.ts` and `service.ts`
advance a step, pick the next node, and record events — all as plain
database reads/writes inside the Node/Fastify API, no separate
workflow server or worker process.

Crucially, it is **pull-based, not push-based**: there is no
background poller or scheduler anywhere in this codebase. SLA/
escalation state (`sla.ts`, ticket 0081) is computed on demand,
each time a step is read, from `started_at`/`due_at` timestamps and
a sum of `task_blocked`/`task_unblocked` event pairs — the same
"compute on read rather than add a scheduler" pattern ticket 0077
used for project health. A step only ever changes because some
request (a human completing a task, an approval decision, a GET that
happens to recompute SLA state) touches it.

**Would adopting Temporal later be a minimal change? No.** Two
things would have to change at once, not just the execution engine:

1. **Where workflow logic lives.** Temporal workflows are
   TypeScript/Go/Java *code*, deployed and versioned like any other
   service, executed deterministically on workers. SEVENTS' M06
   configuration studio is built so a tenant admin configures a
   workflow graph *as data* (`workflow_nodes`/`workflow_transitions`
   rows) with no code change and no deploy — that's the literal exit
   criterion for Phase 2 in `docs/IMPLEMENTATION-PLAN.md` ("an
   administrator can add a role and configure a workflow... without
   code changes"). Moving to Temporal would mean either hand-writing
   a Temporal workflow per configured flow (which throws away the
   no-code studio) or writing one generic "graph-interpreter" Temporal
   workflow that reads `workflow_nodes`/`workflow_transitions` and
   dispatches dynamically — possible, but it's a rewrite of
   `runtime.ts`'s step-executor to run inside Temporal's workflow
   execution context (deterministic replay rules, no arbitrary
   I/O inside workflow code), not a drop-in swap.
2. **Where time lives.** SLA warning/breach/escalation would move
   from "computed from timestamps on read" to real Temporal durable
   timers (`sleep`/`condition` calls) — a different programming model,
   and ticket 0063's audited version-migration-of-running-instances
   mechanism would need a Temporal-side equivalent (workflow
   versioning/patching).

There's also a standing-approval angle: Temporal (self-hosted cluster
or Temporal Cloud) is new infrastructure with an ongoing cost, which
CLAUDE.md requires owner approval for before adopting — it is not
something to add speculatively.

**Recommendation:** stay on the current Postgres-based engine. It
already satisfies the BRD/Implementation-Plan requirements this
project is scored against (deterministic, versioned, publish/rollback,
auditable, no-code configurable) without new paid infrastructure.
Revisit only if a concrete requirement shows up that the current
engine genuinely can't satisfy at scale (e.g., very long-running
durable waits across months, or a hard need for distributed
exactly-once execution) — that would be a real, named gap, not a
speculative rewrite.

## Progress
- 2026-10-16 06:04 UTC: Answered in `## Answer` above — confirmed no
  Temporal anywhere in the codebase (the one "temporal" hit in
  `service.ts` is the English word, re: a time-bounded delegation
  entity, unrelated to the product). No code change needed; closing
  as answered.
