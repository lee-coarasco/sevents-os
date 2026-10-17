---
id: 147
title: "M04 — Employee Directory: bulk CSV import + org chart tab"
status: next
roles: [ui-designer, backend-engineer, test-engineer]
priority: 2
created: 2026-10-17
updated: 2026-10-17
---

Split from ticket 0117 (see that ticket's close-out note) after a fresh
survey. M04's auth-account-link gap from 0117 was already fixed —
`EmployeesPage.tsx` already has a `<UserPicker>` "Link to auth account"
field wired to `PATCH /employees/:id`. The two genuine remaining gaps are
bulk CSV import and the org chart tab.

## What to build

### Backend
- `POST /employees/bulk-import` — accepts a CSV (or parsed rows) with
  employee fields (name, department, designation, email, etc. — match the
  fields on the existing single-create form in `EmployeesPage.tsx`).
  - Validate rows; return a per-row result (created / skipped-with-reason)
    rather than failing the whole batch on one bad row.
  - Gate with the same permission the single-create endpoint uses.
  - Each created employee follows the same audit/notification pattern as a
    normal create (write to the module's audit log; `dispatchNotification`
    or `// TODO: dispatch notification` per the Definition of Done).
  - RLS: inserts go through the same tenant-scoped path as the existing
    single-create endpoint — do not bypass it for bulk.

### Frontend
- "Import" button on `EmployeesPage.tsx`:
  - "Download template" link (static CSV with the expected headers)
  - File upload → parse client-side (just for a preview/row-count), POST
    to `/employees/bulk-import`
  - Show per-row results (created vs skipped-with-reason) after import
  - Wrap in `<PermissionGate>`
- Org chart tab on `EmployeesPage.tsx`:
  - Simple nested/tree list grouped by `department_id` (per Definition of
    Done, a graphical tree is nice-to-have, not required) — department →
    employees reporting into it
  - Each employee name links to their detail page (cross-module navigation
    rule)

## Acceptance
- [ ] `POST /employees/bulk-import` exists, permission-gated, tenant-scoped,
      audited, returns per-row results
- [ ] Import button + template download + upload flow works end-to-end
- [ ] Org chart tab shows department → employee tree with working links
- [ ] Tests for the bulk-import endpoint (happy path + partial-failure row)
- [ ] `docs/USER-GUIDE.md` M04 entry updated

## Progress
- 2026-10-17: Split from ticket 0117 after re-survey (see 0117's close-out
  and DECISIONS.md). Not yet picked up.
