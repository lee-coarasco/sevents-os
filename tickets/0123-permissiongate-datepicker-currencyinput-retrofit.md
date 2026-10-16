---
id: 123
title: Retrofit shared <PermissionGate>, <DatePicker>, <CurrencyInput>/<CurrencyDisplay> across all built module UIs
status: next
roles: [ui-designer, architect]
priority: 3
created: 2026-10-16
updated: 2026-10-16
---

CLAUDE.md's Definition of Done (frontend checklist) requires every action
button to be wrapped in a `<PermissionGate permission="…">`, every date field
to use a shared `<DatePicker>`, and every monetary field to use
`<CurrencyInput>`/`<CurrencyDisplay>`. None of these three shared components
exist anywhere in `frontend/src/components/` yet — every module built so far
(M02, M03, M04, M05, M06, M07, M08, M09, M10, …) uses inline `has(...)` checks
from `usePermissions()` to conditionally render buttons, and plain
`<input type="date">` / `<input type="number">` for dates and money.

This was noticed while closing out ticket 0108 (Ticket A), which added several
new forms (M09 projects/WBS/milestones/activities, M10 clients/contacts/
opportunities) using the same inline-`has()`/native-input pattern as every
module before it, to stay consistent with the rest of the app rather than
introducing a half-retrofitted inconsistency. Building the three components
only for 0108's six modules would have left 10+ earlier modules still
non-compliant, so this is its own ticket covering the whole app.

## Scope
1. Build `<PermissionGate permission="…">` in `frontend/src/components/` —
   wraps children, renders nothing if `usePermissions().has(permission)` is
   false (same semantics as every existing inline `{!permissionsLoading &&
   has(...) && <button>...}` guard, just as a reusable wrapper).
2. Build `<DatePicker>` — locale-aware, week starts Sunday per CLAUDE.md,
   wraps a date input with the app's existing input styling.
3. Build `<CurrencyInput>` (editable) and `<CurrencyDisplay>` (read-only) —
   amount + currency code, matching the `formatAmount()` helper duplicated
   across `ProjectsPage.tsx`/`ProjectDetailPage.tsx` today.
4. Sweep every existing module UI (`frontend/src/pages/*.tsx`) and replace:
   - inline `has(...)` button guards → `<PermissionGate>`
   - native `<input type="date">` → `<DatePicker>`
   - native number inputs tied to a currency amount → `<CurrencyInput>`/
     `<CurrencyDisplay>`
5. Update each touched module's tests for the new component boundaries.

## Acceptance
- [ ] The three components exist in `frontend/src/components/` with tests.
- [ ] Every action button across every built module page is wrapped in
  `<PermissionGate>` — no inline `has(...)` conditionals left guarding a
  button's visibility.
- [ ] Every date field uses `<DatePicker>`; every monetary field uses
  `<CurrencyInput>`/`<CurrencyDisplay>`.
- [ ] Full frontend test suite and `tsc --noEmit`/`vite build` stay clean.

## Progress
- 2026-10-16 22:25 UTC: Filed from ticket 0108's close-out — see that
  ticket's final progress note for why this needs its own ticket rather
  than a partial fix inside 0108.
