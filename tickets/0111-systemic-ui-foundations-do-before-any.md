---
id: 111
title: Systemic UI foundations (do before any more module UIs):
status: done
roles: [ui-designer, backend-engineer, test-engineer, architect]
priority: 1
created: 2026-10-16
updated: 2026-10-17
---

Notification bell + inbox in AppLayout (wired to M31 backend)
User profile / My Account page (password change, notification preferences, active sessions)
Dashboard with real data (my tasks count, pending approvals count, open opportunities, project health)
Permission-aware <PermissionGate> component used consistently across all pages
Shared file-upload component (Supabase Storage wiring)
Shared activity/comment thread component
Shared amount + currency input/display
First-time setup wizard (create tenant → company → first admin)

_Created by lee-coarasco in the AppYard dashboard._

## Progress
- 2026-10-17 00:50 UTC: closed with no code of its own and split into
  eight sub-tickets, one per bullet — same "too large for one ticket"
  pattern every other oversized ticket in this project has followed
  (see DECISIONS.md for the full write-up): 0128 (notification bell +
  inbox, first because CLAUDE.md's own Definition-of-Done already
  requires it now that M31/notification-triggering module UIs exist),
  0129 (retrofit every existing page onto the `<PermissionGate>`
  component ticket 0125 just built), 0130 (My Account page), 0131
  (dashboard with real counts), 0132 (shared `<FileAttachment>` +
  Supabase Storage wiring), 0133 (shared `<ActivityThread>`), 0134
  (shared `<CurrencyInput>`/`<CurrencyDisplay>`), 0135 (first-time
  setup wizard). Picked up and finished 0128 in the same session —
  see that ticket for what's built.
