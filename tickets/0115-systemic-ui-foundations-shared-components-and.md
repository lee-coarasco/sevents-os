---
id: 115
title: Systemic UI foundations — shared components and AppLayout features
status: done
roles: [ui-designer, backend-engineer, test-engineer, architect]
priority: 1
created: 2026-10-17
updated: 2026-10-17
---

**Closed with no code — fully superseded by tickets filed earlier the same
day. See Progress for the item-by-item mapping.**

Before any further module UIs can be considered "done" (per the Definition of
Done in CLAUDE.md), these eight shared components and AppLayout features must
exist. Every later module UI ticket depends on this one. Build all of them in
a single ticket so they ship together and every module can start using them
immediately.

## Scope

### 1. `<PermissionGate permission="x.y.z">`
- Calls `GET /auth/effective-permissions` once on mount (cache the result in
  React context — do not re-fetch per component)
- Hides children entirely when the current user lacks the named permission
- Accepts `fallback` prop for an alternate render when permission is absent
- Used on every action button across every screen

### 2. `<UserPicker value={userId} onChange={fn} placeholder="Search users…">`
- Typeahead that calls `GET /employees?search=` (or `GET /admin/users?search=`)
  as the user types (debounced 300ms)
- Displays name + role + department in the dropdown
- Returns a `userId` (UUID) to the parent form
- Replaces every bare UUID text input across M03, M04, M07, M08

### 3. `<EntityPicker type="project|client|document|cost-code|document-type|…" …>`
- Same typeahead pattern as UserPicker, parameterised by entity type
- Each type maps to its own list endpoint and display fields
- Used in every form that references another entity

### 4. `<ActivityThread entityType="task|approval|project|document|…" entityId={id}>`
- Fetches and renders the entity's comment/event history
- New comment form at the bottom (calls the entity's comments endpoint)
- Shows event entries (assigned, status changed, etc.) interspersed with
  comments in chronological order
- Used in task drawer (M07), approval drawer (M08), project detail (M09),
  document detail (M13), and every future module that has comments

### 5. `<FileAttachment entityType="…" entityId={id} storageReference={…}>`
- Upload button → uploads to Supabase Storage via backend proxy, gets back a
  storage reference
- Displays current attachment with a download/view link
- Used on any `storage_reference` field (document revisions, estimate evidence,
  task evidence, etc.)

### 6. `<CurrencyInput value={amount} currency={code} onChangeAmount onChangeCurrency>`
- Formatted number input (thousands separator, 2 decimal places)
- Currency selector dropdown populated from `GET /master-data/currencies`
  (depends on ticket 0108 — build after M33 backend is ready)
- `<CurrencyDisplay amount currency>` companion for read-only display
- Used on every monetary field (estimates, budgets, contract values, etc.)

### 7. `<DatePicker value onChange locale="en-AE">`
- Wraps a date input with UAE locale (week starts Sunday)
- Displays in DD/MM/YYYY format
- Used on every date field across all screens

### 8. `<StatusBadge status="draft|approved|rejected|…" variant="…">`
- Maps status string to a colour-coded pill
- Variant prop allows per-module colour schemes
- Used in every list and detail view that shows a status

### 9. Notification bell in AppLayout
- Bell icon in the header navbar
- Unread count badge (red dot) from `GET /notifications?status=pending&limit=1`
  (just the count, not the full list)
- Click opens a notification drawer: list of unread notifications from
  `GET /notifications?status=pending`, mark-as-read on click (calls
  `PATCH /notifications/:id/read`)
- Uses Supabase Realtime subscription on the `notifications` table for
  the current user — unread badge updates in real time without polling

### 10. User Profile page (`/profile`)
- Displays the current user's name, email, role(s), department
- Change password section (via Supabase Auth `updatePassword`)
- Notification preferences (calls `GET/PUT /notifications/preferences`)
- Active sessions list (calls `GET /auth/sessions`) with "Sign out all
  other sessions" button
- Nav link: user avatar/name in the bottom of the sidebar

### 11. Dashboard with real data (`/dashboard`)
- Four KPI cards: My open tasks count, My pending approvals count,
  Open opportunities count, Active projects count
- Each card links to the relevant page
- All counts from existing list endpoints with a `?status=open&assignedToMe=true`
  filter — no new endpoints needed

### 12. First-time setup wizard
- Shown to `role.platform_administrator` when `GET /tenancy/companies`
  returns an empty list
- Step 1: Create company (name, registration number, country)
- Step 2: Create first branch (name, city)
- Step 3: Create first department
- Step 4: Invite first user (email → POST /identity/invite)
- Dismissable after step 1 is complete; remaining steps shown as a checklist
  on the dashboard

## Dependencies
- Ticket 0108 (M33 backend) must be complete before `<CurrencyInput>` can be
  built — build all other components first, add CurrencyInput last

## Acceptance

- [ ] All 8 shared components exist in `frontend/src/components/` with their
      own test files
- [ ] `usePermissions` hook fetches once, caches in context, never re-fetches
      on re-render
- [ ] UserPicker debounces correctly — max one API call per 300ms burst
- [ ] Notification bell shows unread count; drawer opens and marks read;
      Realtime subscription updates the badge without page refresh
- [ ] Profile page: password change, notification preferences, session list
      all work end-to-end
- [ ] Dashboard KPI cards all show real counts (not hardcoded)
- [ ] Setup wizard appears on first login for platform_administrator with no
      company; disappears after company is created
- [ ] USER-GUIDE.md updated: note all shared components and the profile/
      dashboard screens

_Created by lee-coarasco in the AppYard dashboard._

## Progress
- 2026-10-17 (session): This ticket's twelve items turn out to duplicate
  work already split out of ticket 0111 earlier the same day, plus one
  earlier shared-component ticket. Mapping (no code needed for any of
  these ten — just cross-referencing):
  1. `<PermissionGate>` — already built (ticket 0125). Retrofit across
     existing pages tracked in ticket 0129.
  2. `<UserPicker>` — already built (ticket 0108).
  3. `<EntityPicker>` — not covered by any existing ticket. Split out as
     new ticket 0140, built this session.
  4. `<ActivityThread>` — ticket 0133.
  5. `<FileAttachment>` — ticket 0132.
  6. `<CurrencyInput>`/`<CurrencyDisplay>` — ticket 0134 (+ retrofit in
     0123).
  7. `<DatePicker>` — ticket 0123.
  8. `<StatusBadge>` — not covered by any existing ticket. Split out as
     new ticket 0140, built this session.
  9. Notification bell — already built, `status: testing` (ticket 0128).
  10. Profile/My Account page — ticket 0130.
  11. Dashboard real data — ticket 0131.
  12. First-time setup wizard — ticket 0135 (`status: blocked`, owner
      question pending).
  Closing this ticket `done` with no code of its own: items 1/2/9 are
  already shipped, items 3/8 are carved into new ticket 0140 (built this
  session), and the rest already have their own tickets in the backlog.
  Logged in DECISIONS.md.
