---
id: 122
title: "Wire dispatchNotification into workflow-relevant writes built since M31"
status: next
roles: [backend-engineer]
priority: 10
created: 2026-10-16
updated: 2026-10-16
---

CLAUDE.md's Definition of Done says: "Every action that creates or
modifies a workflow-relevant record calls `dispatchNotification` so the
M31 pipeline can deliver alerts. If M31 is not yet built, add a `//
TODO: dispatch notification` comment with the event name so the M31
session can wire it in without hunting every callsite."

M31 (tickets 0082/0083, `modules/notifications`) has been built and
`dispatchNotification` exists since the session that applied migrations
`m31b`/`m31c` (2026-10-16). Checked while finishing ticket 0105 (M13b):
`grep -rl dispatchNotification backend/src/modules/` only matches files
*inside* `modules/notifications` itself — no caller anywhere. There are
also no `// TODO: dispatch notification` placeholder comments anywhere,
so this isn't even tracked per-callsite; it's a silent, systemic gap.

Every workflow-relevant write built across M07 (tasks), M08 (approvals/
delegation), M09 (projects), M10 (CRM), M11 (tendering/estimating/
bidding) and M13 (documents, including this ticket's own submit-for-
release/resolve-approval endpoints) currently does none of this. None
of those modules' tickets are blocked by this — CLAUDE.md's checklist is
about to be failed at scale, not about any single ticket — so this is
filed as its own ticket rather than bolted onto whichever module is
open when someone notices.

## What to build
- Audit every write endpoint across `modules/workflow`, `modules/tasks`
  (M07), `modules/approvals`/`authority` (M08, wherever delegation and
  approval decisions live), `modules/projects` (M09), `modules/crm`
  (M10), `modules/tendering`/`modules/estimating`/`modules/bidding`
  (M11), and `modules/documents` (M13) that CLAUDE.md's checklist would
  call "workflow-relevant" (anything that creates a task, starts/
  advances/resolves an approval workflow instance, reassigns/delegates
  work, or changes a status another actor is waiting on).
- For each, call `dispatchNotification` with a `recipientId` that makes
  sense for that action (the assignee, the next approver, the
  submitter being notified of a decision, etc.) and a `templateKey`
  named for the event (e.g. `document_revision_approved`,
  `workflow_step_assigned`) — do not invent a generic catch-all
  template; one per distinct event, same as ticket 0082/0083's own
  template design.
- `dispatchNotification` needs a `NotificationsRepository`, a
  `NotificationSender`, and a `tenantId` — figure out the cleanest way
  to thread those into each module's existing route/service wiring
  (likely via the same `getXRepository`-style factory pattern
  `app.ts` already uses for cross-module deps, see how ticket 0105's
  own `getWorkflowRepository` option was added to `documentsRoutes`).
- Decide once, consistently, whether this goes at the service layer
  (inside `submitRevisionForRelease`, `startWorkflowInstance`, etc.) or
  at the route layer — pick whichever avoids every module reimplementing
  the same plumbing, and record the choice in DECISIONS.md so later
  modules (M14 onward) follow the same pattern without re-deriving it.

## Out of scope
- Any new notification channel, template content/copy, or delivery
  timing — ticket 0082/0083 already built the pipeline and its
  quiet-hours/digest logic; this ticket only adds callers.
- Retrofitting modules not yet built (M14 onward) — they should call
  `dispatchNotification` directly from day one; this ticket is only
  about the backlog that accumulated before this gap was noticed.

## Acceptance
- [ ] Every workflow-relevant write identified in the audit above calls
      `dispatchNotification` (or has a one-line justification in a code
      comment for why it legitimately doesn't, e.g. a read-only status
      poll like `resolve-approval` returning an already-resolved
      revision unchanged).
- [ ] A documented, reusable pattern exists for threading the
      notifications dependency into a module (not five different
      ad-hoc wiring styles).
- [ ] Tests cover at least one notification firing per module touched.
- [ ] `docs/DECISIONS.md` records the layering choice (service vs.
      route) for future modules to follow.

## Progress
- 2026-10-16 21:35 UTC: Filed after finding the gap while closing out
  ticket 0105 (M13b) — `dispatchNotification` has zero callers outside
  `modules/notifications` despite M31 being built since earlier the
  same day.
