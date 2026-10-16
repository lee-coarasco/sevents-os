---
id: 111
title: Systemic UI foundations (do before any more module UIs):
status: next
roles: [ui-designer, backend-engineer, test-engineer, architect]
priority: 1
created: 2026-10-16
updated: 2026-10-16
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
