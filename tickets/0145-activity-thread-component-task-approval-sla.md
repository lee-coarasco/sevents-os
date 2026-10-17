---
id: 145
title: "ActivityThread shared component wired into M07 task drawer + M08 approval drawer; M07 SLA countdown"
status: testing
roles: [ui-designer, backend-engineer, test-engineer]
priority: 1
created: 2026-10-17
updated: 2026-10-17
---

Split from ticket 0117 (see that ticket's close-out note) after a fresh survey
found most of 0117 stale or already built. This sub-ticket is the genuine
remaining gap shared by M07 (Task Inbox) and M08 (Approval Queue): neither
drawer shows an activity/comment history, and the Definition of Done requires
`<ActivityThread>` as a shared component built once and reused everywhere.
M07's SLA countdown gap is bundled in here because it touches the exact same
task drawer file and is small.

## What already exists (do not rebuild)
- `frontend/src/pages/TaskInboxPage.tsx`: Reassign/Delegate buttons already
  wired with `<UserPicker>`, calling `POST /tasks/:id/reassign` and
  `POST /tasks/:id/delegate`. Leave as-is.
- `frontend/src/pages/ApprovalQueuePage.tsx`: all four decisions (approve,
  reject, approved_with_conditions, returned_for_correction) already wired.
  Leave as-is.
- Backend: `POST /workflow/steps/:stepId/comments` already exists
  (`backend/src/modules/workflow/routes.ts`) and `addTaskComment` is wired to
  `workflow_events`/comments. `WorkflowStepInstance.comments: TaskComment[]`
  already exists in `types.ts`. `ApprovalQueuePage.tsx` already fetches
  `comments` and `decisions` on its detail payload (line ~37-39) but only
  renders `decisions` — it silently drops `comments` on the floor today.

## What to build

### Backend
- Confirm (or add if missing) a GET endpoint that returns a single step
  instance with its `comments` array for the Task Inbox drawer — check
  whether `GET /workflow/steps/:stepId` (routes.ts ~line 187/229) already
  returns this; if `/tasks/my-work` list doesn't include comments, either
  have the drawer fetch step detail on selection, or extend the list item.
  Prefer fetching detail lazily on drawer-open over bloating the list
  payload.
- No new comments-storage work needed — reuse the existing endpoint/table
  for both tasks and approvals (an approval decision happens inside a step
  instance, so the same `stepId` comments endpoint covers both).

### Shared component
- Build `frontend/src/components/ActivityThread.tsx`:
  `<ActivityThread entityType="task|approval" entityId={stepId} comments={comments} decisions={decisions} onPostComment={...} />`
  - Renders a chronological list merging comments and decisions (for
    approvals) into one thread, newest last, each with actor, timestamp,
    and body/decision+reason.
  - A text box + "Post" button at the bottom calling
    `POST /workflow/steps/:stepId/comments`, then refetching/prepending.
  - Follow the design-system tokens (card styling, `font-body`, zinc/brand
    palette) from `AppLayout.tsx`.

### M07 — Task Inbox drawer
- Wire `<ActivityThread entityType="task">` into the task drawer in
  `TaskInboxPage.tsx`, fetching step detail (comments) on selection.
- SLA countdown: replace the plain `due_at` text (currently
  `new Date(selectedTask.due_at).toLocaleString()`) with a relative-time
  label — "Due in 2 days" / "Due in 3 hours" / "Overdue by 1 day" — coloured
  green (>24h left), amber (<24h left), red (overdue). Pure client-side date
  math, no backend change.

### M08 — Approval Queue drawer
- Wire `<ActivityThread entityType="approval">` into the approval drawer in
  `ApprovalQueuePage.tsx`, reusing the `comments` + `decisions` it already
  fetches (no new fetch needed — it was already pulling `comments`, just
  not rendering them).

## Acceptance
- [ ] `<ActivityThread>` component exists in `frontend/src/components/`
      following the design system
- [ ] Task drawer (M07) shows ActivityThread with existing comments +
      ability to post a new one
- [ ] Task drawer (M07) shows SLA countdown with correct green/amber/red
      colour thresholds
- [ ] Approval drawer (M08) shows ActivityThread with existing comments +
      decisions merged, newest last, ability to post a new comment
- [ ] Tests cover the SLA countdown colour/label logic and the comment-post
      flow
- [ ] `docs/USER-GUIDE.md` M07 and M08 entries updated

## Progress
- 2026-10-17: Built and tested. Found ticket 0133 ("Shared `<ActivityThread>`
  component") already covered this exact scope — closed it `done` as
  absorbed into this ticket (my mistake not to cross-check before splitting
  0117; see 0133's own Progress note and DECISIONS.md).
  Backend: added `GET /tasks/:stepInstanceId` (routes.ts, gated by the same
  `requireActOrOwnTask` guard reassign/delegate already use) and
  `getTaskDetail` in service.ts, returning `{ stepInstance, comments,
  events }` for a plain task — reused `repository.listTaskComments`/
  `listEvents`, no schema change. M08 needed no backend change: `GET
  /approvals/:id` already returned `comments`+`decisions`, the frontend
  just wasn't rendering `comments`. Note: posting a comment
  (`POST /workflow/steps/:id/comments`) still requires the broad
  `workflow.instance.act` permission (ticket 0070's original scope,
  unchanged) — it does NOT have the own-task exemption reassign/delegate
  have, so an assignee without that permission can read their task's
  comments but not post one. Scoped as-is rather than widening that
  permission check, since loosening who can write audit-trailed comments
  felt like a decision bigger than this ticket; flagged here for whoever
  next touches task permissions.
  Frontend: new `frontend/src/components/ActivityThread.tsx` (comments +
  optional decisions merged into one timeline, oldest-first, author
  resolved via the existing `useUsers` lookup, a post box gated by
  `canPost`). Wired into `TaskInboxPage.tsx` (fetches `/tasks/:id` on
  selection, SLA countdown added next to the due date — green >24h, amber
  <24h, red overdue, re-ticks every 60s) and `ApprovalQueuePage.tsx`
  (replaced the old static "Decisions so far" block with `<ActivityThread>`
  reusing the `comments`/`decisions` it already fetched; removed the now-
  unused `decisionColors` map).
  Tests: 2 new backend unit tests (`task.test.ts`), 3 new backend route
  tests (`routes.test.ts` — own-task read, 403 for a non-owner without
  permission, 401 with no token; also hoisted the shared
  `startWaitingStepAssignedTo` test helper to module scope so both
  describe blocks could use it), 2 new frontend tests (SLA countdown +
  comment post in `TaskInboxPage.test.tsx`, comments/decisions render +
  comment post in `ApprovalQueuePage.test.tsx`). Backend: 621/621 passing,
  `lint`/`build` clean. Frontend: 98/98 passing, `lint`/`build` clean.
  Set `status: testing` — no DB migration involved, so nothing blocks the
  owner trying this once a build is deployed.
