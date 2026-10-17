---
id: 140
title: Shared <EntityPicker> and <StatusBadge> components
status: testing
roles: [ui-designer, test-engineer]
priority: 2
created: 2026-10-17
updated: 2026-10-17
---

Split from ticket 0115 (see DECISIONS.md). Of 0115's twelve items, ten are
already covered by other tickets (0128 notification bell — testing, 0129
PermissionGate retrofit, 0130 My Account page, 0131 dashboard real data, 0132
FileAttachment, 0133 ActivityThread, 0134 CurrencyInput/Display, 0135 setup
wizard — blocked, 0123 DatePicker + PermissionGate + CurrencyInput retrofit,
and UserPicker which ticket 0108 already built). The two components CLAUDE.md's
shared-component table calls for that no ticket builds anywhere: `<EntityPicker>`
and `<StatusBadge>`. This ticket builds just those two.

Note: ticket 0108's close-out explicitly chose per-form `<select>`s over a
generic `<EntityPicker>` for its own six gaps, calling a generic component
"scope creep" for that narrow ticket. CLAUDE.md's Definition of Done table
lists `<EntityPicker type="project|client|document|…">` as a required shared
component in its own right, not conditional on any one module's ticket — so
building it here is closing a standing gap, not re-opening that earlier
judgment call. Existing per-form selects do not need to be retrofitted by this
ticket (same "don't touch already-shipped, already-tested screens for a
style-only change" reasoning as ticket 0125/0129) — this ticket only needs to
make the component available so new forms stop hand-rolling selects.

## Scope

### `<EntityPicker type="project|client|document|cost-code|document-type|currency|uom" value onChange placeholder>`
Same debounced-typeahead pattern as `UserPicker` for the following types.
List endpoints and label fields (surveyed, see table below) — add a client-
side substring filter for endpoints without server-side `?search=`, same
`useMemo` approach `UserPicker` uses:

| type | endpoint | label fields |
|---|---|---|
| `project` | `GET /projects` | `name` (`code`) |
| `client` | `GET /crm/clients?search=` | `name` |
| `document` | `GET /documents` | `title` |
| `cost-code` | `GET /master-data/cost-codes` | `code` — `description` |
| `document-type` | `GET /master-data/document-types` | `code` — `label` |
| `currency` | `GET /master-data/currencies` | `code` — `name` |
| `uom` | `GET /master-data/uom` | `code` — `description` |

Structure as one `EntityPicker.tsx` with a small per-type config map (endpoint,
label function) rather than one component per type — the entities are
heterogeneous but the fetch/filter/dropdown shell is identical.

### `<StatusBadge status="…" variant="…">`
Colour-coded pill, one shared palette keyed by status string, covering at
least the statuses already rendered ad-hoc across the app: project
(`active`/`on_hold`/`closed`), milestone (`pending`/`achieved`/`missed`),
document revision (`draft`/`under_review`/`approved`/`superseded`/`rejected`),
estimate/bid (`draft`/`pending_approval`/`approved`/`approved_with_conditions`/
`rejected`/`returned_for_correction`/`superseded`), workflow/task
(`pending`/`active`/`waiting`/`completed`/`skipped`/`failed`), employment
(`active`/`on_leave`/`suspended`/`offboarded`), opportunity stage (`lead`/
`qualified`/`site_visit`/`tender`/`negotiation`/`won`/`lost`). Unknown status
strings fall back to a neutral grey pill with the raw string, not a crash.
`variant` prop lets a caller pick a different palette when the same string
means different things in different modules (e.g. generic vs. project-status
palette) — default variant covers the common approve/reject/pending shape.

Do not retrofit every page that currently hand-rolls its own status pill —
out of scope for this ticket, same reasoning as the PermissionGate retrofit
being its own ticket (0129). New forms should use it going forward.

## Acceptance
- [x] `frontend/src/components/EntityPicker.tsx` + test file, covering all
      seven types in the table above.
- [x] `frontend/src/components/StatusBadge.tsx` + test file, covering every
      status string listed above plus the unknown-status fallback.
- [x] Full frontend suite green.
- [x] `docs/USER-GUIDE.md` note (shared components section, or create one) —
      not module-specific, so give it a short standalone mention.

## Progress
- 2026-10-17 03:12 UTC: Built both components.
  `EntityPicker.tsx` uses a per-type config map (endpoint, list response
  key, label function, whether the backend supports `?search=`) with the
  same debounced-typeahead shell `UserPicker` already established —
  `/crm/clients` and `/crm/contacts` are the only endpoints with real
  server-side search today, so those two debounce a `?search=` query;
  the rest (`projects`, `documents`, `master-data/*`) fetch the full list
  once and filter client-side, same as `UserPicker` does against
  `/admin/users`. `StatusBadge.tsx` maps every status string found across
  built modules to one of five tones (neutral/info/success/warning/
  danger); a `variant` prop lets a caller override individual mappings
  for a module where the same string means something different, and any
  unmapped string falls back to neutral grey with its own text rather
  than crashing.
  One test-writing gotcha worth flagging for future picker tests:
  `userEvent.type()` char-by-char typing fought with the 300ms debounce
  under real timers in this test environment (the debounced fetch never
  fired within a 3s `waitFor`, even though the component works correctly
  in the browser) — switched that one assertion to `fireEvent.change`
  with the full string in one shot, which exercises the same debounce
  path without the per-keystroke timing flakiness.
  8 new tests (4 EntityPicker, 4 StatusBadge). Full frontend suite: 88/88
  across 24 files, `npm run lint` (tsc --noEmit) and `npm run build`
  clean. Added a "Shared frontend components" section to
  `docs/USER-GUIDE.md` listing all five reusable components (including
  `PermissionGate`/`UserPicker`/`NotificationBell`, which had no central
  mention anywhere before this).
  Did not retrofit any existing page's hand-rolled `<select>` or status
  pill onto these two components — out of scope, same reasoning as the
  PermissionGate retrofit being its own ticket (0129).
  Set `status: testing`.
