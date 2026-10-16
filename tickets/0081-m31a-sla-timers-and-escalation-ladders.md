---
id: 81
title: "M31a — SLA timers & escalation ladders (config + runtime)"
status: next
roles: [backend-engineer]
priority: 11
created: 2026-10-16
updated: 2026-10-16
---

First of three M31 sub-tickets (see ticket 0069 and DECISIONS.md for
the split rationale). Covers the SLA/escalation half of BRD §7's M31
module row and FR-NOT-001/002's "deduplicated and traceable" /
"delivery visible and retried" requirements as they apply to escalation
events specifically (notification *delivery* itself is ticket 0082).

## Survey findings (read before building)
- `workflow_step_instances` (ticket 0070/M07a,
  `20261015000010_m07a_task_metadata_blocking_comments.sql`) already
  has `owner_id`, `reviewer_id`, `due_at`, `priority`, `blocked_reason`,
  `blocked_at`. **No `sla_due_at`, `sla_warning_at`, `escalated_at` or
  similar column exists yet.**
- `workflow_nodes.config` (jsonb, ticket 0060/M06a,
  `20261015000005_m06a_workflow_definitions.sql`) already accepts
  `escalate` and `send_notification` as node types in the type
  enumeration, but neither has a dedicated schema — their config is
  whatever free-form jsonb the configuration studio writes, and
  **neither has a runtime handler**: reaching an `escalate` node in a
  running workflow instance does not currently do anything.
- `workflow_events` (ticket 0062/M06c,
  `20261015000007_m06c_workflow_runtime.sql`) already declares
  `escalated`, `timer_fired` and `notification_sent` in
  `WORKFLOW_EVENT_TYPES` (`backend/src/modules/workflow/types.ts`) —
  **declared, never emitted by any runtime code path today.** This
  ticket is what should start emitting `timer_fired`/`escalated`;
  ticket 0082 is what should start emitting `notification_sent`.
- No `sla_definitions`, `escalation_definitions` or
  `escalation_ladders` table exists anywhere in this codebase.
- Check ticket 0062 (M06c, runtime/instance engine) for however the
  current runtime advances a workflow instance (poll loop, on-demand
  evaluation on read, etc.) before deciding how SLA breach detection
  gets scheduled — do not assume a cron/poll mechanism exists if it
  doesn't; if none does, this ticket may need to add the first one (an
  on-demand "evaluate SLA state for this step" check triggered by the
  same read paths the task-queue views already use, same spirit as
  ticket 0077's `computeProjectHealth` being computed on read rather
  than needing a new background scheduler).

## What to build
- A tenant-scoped `sla_definitions` table: a named SLA policy (e.g.
  "RFI response", "approval chain") with a duration, a reference to
  which clock it runs against (do not hard-code a business-hours
  calendar — country-agnostic per CLAUDE.md, so if a calendar is
  needed it must be caller-configured, not a built-in default), and a
  warning threshold (e.g. percentage of duration elapsed) — every
  value is caller-supplied config, never an invented default per
  CLAUDE.md's "must not invent... SLA values."
- A tenant-scoped `escalation_ladders` (or `escalation_rungs`) table:
  an ordered list of rungs tied to an `sla_definitions` row, each rung
  with its own delay-after-breach and action (e.g. notify owner, notify
  owner's manager, notify a named role) — the action is a reference
  consumed by ticket 0082's dispatcher, not a notification send
  implemented in this ticket.
- SLA clock semantics: a step's SLA clock pauses while
  `workflow_step_instances.blocked_at` is set (reuse that existing
  column's semantics — a step marked blocked is not accruing SLA
  breach time) and resumes when cleared. Do not invent a second,
  parallel "pause" concept.
- Wire the `escalate` node type to something real: when a running step
  instance's SLA state crosses its warning threshold or its rungs'
  delays, emit the already-declared-but-unused `timer_fired` and
  `escalated` workflow_events (with the rung/action identified in the
  payload) instead of leaving them dead code.
- New deny-by-default permission `workflow.sla.manage` for
  defining/editing SLA definitions and escalation ladders — separate
  from running/working a task, same "administration vs. doing the
  work" split as every other module's permission pairs.

## Out of scope
- Actual notification delivery (templates, email/in-app sending,
  dedup, retry) — ticket 0082.
- Preferences, quiet hours, digest batching — ticket 0083.
- WhatsApp/SMS — a new paid service, needs owner approval before any
  future ticket wires one in (CLAUDE.md).

## Acceptance
- [ ] `sla_definitions` and the escalation ladder table/config exist,
      tenant-scoped RLS, `workflow.sla.manage` deny-by-default and
      gates writes to both.
- [ ] A running `workflow_step_instances` row's SLA state (on-time /
      warning / breached, and which escalation rung is currently
      active if any) can be computed from recorded data only — no
      invented default calendar, threshold or delay.
- [ ] SLA clock correctly pauses/resumes around `blocked_at`.
- [ ] `timer_fired` and `escalated` workflow_events are actually
      emitted by this ticket's runtime code (previously declared,
      unused).
- [ ] Tests cover: SLA pause/resume around `blocked_at`, escalation
      ladder rung progression over elapsed time, and tenant isolation.

## Progress
- 2026-10-16 01:52 UTC: Filed as the first of three M31 sub-tickets
  (see ticket 0069's split). Survey of existing SLA/task/notification
  infrastructure done as part of filing this ticket — see "Survey
  findings" above; do not re-survey from scratch.
