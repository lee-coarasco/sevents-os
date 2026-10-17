---
id: 128
title: Notification bell + inbox in AppLayout, wired to M31 backend
status: testing
roles: [ui-designer, backend-engineer, test-engineer]
priority: 1
created: 2026-10-17
updated: 2026-10-17
---

Split from ticket 0111 (see DECISIONS.md). CLAUDE.md's Definition of Done
says: "Once the first module that triggers notifications is UI-complete,
the notification bell must be in the header... Do not mark any
notification-triggering module's UI done without the bell being present."
M31's backend (tickets 0081-0083) is built and `done`/`testing`, and several
UI-complete modules already trigger notifications through
`dispatchNotification` — this closes that overdue gap rather than letting
another module ship without it.

Backend is already fully built for this (ticket 0082/0083):
- `GET /notifications` — self-service, the caller's own notifications only
  (RLS `recipient_id = auth.uid()`, no extra permission needed).
- `POST /notifications/:id/read` — marks one notification read.
- `Notification.read_at` (null = unread) is what counts as "unread" for the
  badge.

## Acceptance
- [x] A bell icon in `AppLayout`'s header, visible to every signed-in user
  (no permission gate — this is self-service, same as the endpoint).
- [x] Unread count badge on the bell, driven by `read_at === null` across
  `GET /notifications`.
- [x] Clicking the bell opens a dropdown/inbox listing notifications
  (rendered_subject/rendered_body, newest first), each clickable to mark
  read via `POST /notifications/:id/read` (optimistic UI update, don't
  wait on a full refetch).
- [x] Unread notifications are visually distinct from read ones.
- [x] Empty state ("No notifications yet.") when the list is empty.
- [x] Reasonable polling or at least a refetch-on-open so the badge isn't
  permanently stale within a session (Supabase Realtime wiring is a nice-
  to-have, not required — note it as a follow-on if skipped).
- [x] Test: bell renders unread count, opening it lists notifications,
  clicking one marks it read and decrements the count.

## Progress
- 2026-10-17 02:34 UTC: Picked up already `in-progress` from the prior
  session (00:42 UTC), which had built `frontend/src/components/
  NotificationBell.tsx` + its test and wired it into `AppLayout.tsx`
  (commit `cb1bacf`) but left no Progress note, no daily-log entry, and
  hadn't run the suites. Verified rather than rebuilt: `GET
  /notifications` ordering is newest-first server-side
  (`repository.ts` `.order("created_at", { ascending: false })`),
  matching the acceptance text; backend routes (`GET /notifications`,
  `POST /notifications/:id/read`) already existed unchanged from
  tickets 0082/0083, no backend change needed for this ticket. Ran both
  suites clean: backend 594/594 (`npm run lint` + `npm test`), frontend
  59/59 across 15 files (`npm run lint` + `npm test`), `npm run build`
  clean on both. Added the missing M31 section to
  `docs/USER-GUIDE.md` (backend summary + the new bell/inbox screen) —
  CLAUDE.md's Definition of Done requires this and M31 had no entry at
  all despite its backend being `testing` since ticket 0083. Polling is
  every 30s (`POLL_INTERVAL_MS`) plus a refetch on open — Realtime
  wiring noted in the user guide as a follow-on, not built, per the
  ticket's own "nice-to-have" allowance. All acceptance boxes checked.
  Set `status: testing`.
