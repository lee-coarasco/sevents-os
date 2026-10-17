---
id: 128
title: Notification bell + inbox in AppLayout, wired to M31 backend
status: in-progress
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
- [ ] A bell icon in `AppLayout`'s header, visible to every signed-in user
  (no permission gate — this is self-service, same as the endpoint).
- [ ] Unread count badge on the bell, driven by `read_at === null` across
  `GET /notifications`.
- [ ] Clicking the bell opens a dropdown/inbox listing notifications
  (rendered_subject/rendered_body, newest first), each clickable to mark
  read via `POST /notifications/:id/read` (optimistic UI update, don't
  wait on a full refetch).
- [ ] Unread notifications are visually distinct from read ones.
- [ ] Empty state ("No notifications yet.") when the list is empty.
- [ ] Reasonable polling or at least a refetch-on-open so the badge isn't
  permanently stale within a session (Supabase Realtime wiring is a nice-
  to-have, not required — note it as a follow-on if skipped).
- [ ] Test: bell renders unread count, opening it lists notifications,
  clicking one marks it read and decrements the count.

## Progress
