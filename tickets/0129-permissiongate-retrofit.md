---
id: 129
title: Retrofit existing pages onto the shared <PermissionGate> component
status: testing
roles: [ui-designer, test-engineer]
priority: 2
created: 2026-10-17
updated: 2026-10-17
done: 2026-10-17
---

Split from ticket 0111 (see DECISIONS.md). Ticket 0125 built
`frontend/src/components/PermissionGate.tsx` (the shared component
CLAUDE.md's component table requires) because its own catalogue admin
screen needed it, but every page built before that ticket
(`EmployeesPage`, `DepartmentsRolesPage`, `OrgSetupPage`, `ProjectsPage`,
`ProjectDetailPage`, `CrmPage`, `OpportunityDetailPage`,
`TenderSubmissionDetailPage`, `DocumentsPage`, `DocumentDetailPage`,
`TaskInboxPage`, `ApprovalQueuePage`) still gates its action buttons with
an inline `has(...)` conditional instead. Mechanical, low-risk cleanup —
swap each inline gate for `<PermissionGate permission="...">`, keep the
same permission keys, re-run each page's existing test file (behavior
should be identical, just the implementation).

## Acceptance
- [ ] Every action button in the pages listed above that currently reads
  `has("...")` directly is wrapped in `<PermissionGate permission="...">`
  instead.
- [ ] No behavior change — existing tests for every touched page still
  pass without modification (or with only the minimal change a markup
  restructure forces, e.g. a wrapper div).
- [ ] Full frontend suite green after the retrofit.

## Progress

2026-10-17 — Complete. All pages retrofitted:
- DepartmentsRolesPage, EmployeesPage, OrgSetupPage, ProjectsPage: migrated in concurrent 0118/0134 commit (10dda1b)
- ProjectDetailPage (6 gates), CrmPage (6 gates), OpportunityDetailPage (2 gates), TaskInboxPage (action panel + fallback): commit e71d474
- All 31 frontend tests pass. ApprovalQueuePage required no changes (only uses canAct as a prop, not as a conditional render gate).
