---
id: 64
title: "M04 — Employee Directory & Workforce"
status: next
roles: [architect, backend-engineer]
priority: 6
created: 2026-10-15
updated: 2026-10-15
---

First Phase 3 module per `docs/PRD.md`'s build-order table ("Phase 3 —
Core operations foundation": M04, M07, M08, M09, M35, M31) and
CLAUDE.md's BRD module dependency table. Depends only on M01, M02, M03
(all `status: testing`, code-complete) — unblocked now that Phase 2
(M05/M06, tickets 0058/0060-0063) is code-complete.

Unlike M06, the BRD has no dedicated `§8.x Functional Requirements`
section for M04 — re-read the one-line module table row (BRD §7, "M04 |
Employee Directory & Workforce") and the entity list in BRD §6.2
(`EmployeeRecord, Skill, Certification, TrainingRecord` — note
`RecruitmentRequest, Candidate, Offer, LeaveRecord` belong to **M24**
People/Recruitment/Performance, a later module, not this one) before
writing any schema. The module description to build against:

> Employee profiles, employment status, skills, certifications, project
> allocation, onboarding/offboarding, site assignments, emergency
> contacts, documents and training validity. Payroll details can be
> phased separately.

## What to build (architect should confirm/refine this scope first)
- `employee_records`: tenant-scoped (NOT NULL `tenant_id`, ordinary
  per-tenant business data — same pattern as companies/branches/
  projects, not the shared-catalogue nullable-tenant pattern), linked
  1:1 to `app_users` where the employee has system access (nullable FK —
  not every employee needs a login), employment status (active/on-leave/
  suspended/offboarded — exact values TBD, don't invent HR policy
  wording without checking if BRD/PRD say more), department (FK to
  ticket 0056's `department_definitions`), reporting role (FK to
  `role_definitions`), employee code/number, emergency contact fields,
  onboarding/offboarding dates.
- `skills`, `employee_skills` (many-to-many, proficiency level TBD-free —
  don't invent a rating scale CLAUDE.md didn't specify; if needed, leave
  as a free-text/TBD field rather than fabricating one).
- `certifications`, `employee_certifications` (issuing body, issue/expiry
  date — training validity tracking per the module description; this is
  the one place where an actual "is this cert expired" business rule is
  needed, so get the expiry comparison logic right and tested).
- `training_records` (course/date/result — keep minimal, this is a
  directory not a full LMS).
- `employee_project_allocations` (employee, project FK from ticket
  0055's `projects` table, site assignment, allocation period — effective-
  dated like ticket 0056's `role_assignments`, not a point-in-time
  overwrite).
- Explicitly OUT of scope for this ticket: payroll (BRD says "can be
  phased separately"), recruitment/leave/performance (M24), equipment/
  plant allocation (M25) — do not build shadow versions of those.
- New permissions on the existing authority model (ticket 0056):
  `employee.directory.manage` (HR/admin CRUD) and a self-service read
  (`GET /employees/me` or similar) gated only on being the employee's
  own `app_users` row — same "own row" pattern ticket 0054 established
  for identity, not a new permission for reading your own record.
- Follow the exact module conventions already established: Fastify
  routes gated via `requirePermission`, RLS on every table, a
  `WorkforceRepository` port + Supabase adapter + fake-repository test
  double, service-layer business logic unit-tested against the fake,
  no country-specific hard-coding (BRD's "no GST/VAT/statutory defaults"
  rule applies here too if any document/ID field is added).

## Acceptance
- [ ] Employee CRUD (create/update/deactivate) works through the
      repository and is gated on `employee.directory.manage`.
- [ ] Skills/certifications/training can be attached to an employee;
      certification expiry is computed correctly (test both "still
      valid" and "expired" cases).
- [ ] Project allocation is effective-dated (test a past, current and
      future allocation window, same style as ticket 0056's
      `role_assignments` tests).
- [ ] An employee can read their own record via self-service without
      `employee.directory.manage`; cannot read another tenant's or
      another employee's record without it.
- [ ] `npm test` / `npm run build` pass; `scripts/tickets.py check` clean.

## Progress
- 2026-10-15: Filed as the first Phase 3 module (ticket 0063/M06d just
  landed, closing out Phase 2). If this turns out to be larger than one
  ticket once scoped in detail, split it the way ticket 0059 (M06) was
  split into 0060-0063 — don't force it into one ticket just because
  it was filed as one.
