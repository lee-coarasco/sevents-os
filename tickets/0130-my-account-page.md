---
id: 130
title: User profile / My Account page (password change, notification preferences, active sessions)
status: next
roles: [ui-designer, backend-engineer, test-engineer]
priority: 2
created: 2026-10-17
updated: 2026-10-17
---

Split from ticket 0111 (see DECISIONS.md). A self-service "My Account"
screen — every signed-in user needs one, not gated by any permission.

Survey what already exists before building:
- Password change: Supabase Auth's client SDK has `supabase.auth.updateUser({ password })`
  directly from the browser (same pattern `LoginPage`/`AuthContext` already
  use for sign-in) — no new backend endpoint needed.
- Notification preferences: `GET /notifications/preferences` /
  `POST /notifications/preferences` already exist (ticket 0083), gated on
  `notification.preferences.manage` which (per that ticket's own decision)
  is granted to every role by default.
- Active sessions: survey `backend/src/modules/identity` for anything
  session-list-shaped (ticket 0054's audit log has login history, but
  confirm whether an actual "active sessions" concept — as opposed to
  historical audit rows — exists before promising a revoke-this-session
  control the backend can't support). If no real "active session" entity
  exists, scope this part down to showing login history from the audit log
  instead of inventing a session-revocation mechanism nothing asked for.

## Acceptance
- [ ] `/account` route + nav entry (put it in the user footer area of
  `AppLayout`, not the main sidebar nav list — it's not a module).
- [ ] Change password form using Supabase Auth directly from the browser.
- [ ] Notification preferences list/toggle UI against the existing
  `GET`/`POST /notifications/preferences` endpoints.
- [ ] Sessions/login-history section — scoped to what the backend actually
  has (see survey note above); if scoped down to read-only history, say so
  explicitly rather than silently shipping less than the ticket's title
  implies.
- [ ] Tests for the page.
- [ ] `docs/USER-GUIDE.md` note (M01 section) on where to find this.

## Progress
