---
id: 64
title: "M04 — Employee Directory & Workforce"
status: testing
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
- [x] Employee CRUD (create/update/deactivate) works through the
      repository and is gated on `employee.directory.manage`.
- [x] Skills/certifications/training can be attached to an employee;
      certification expiry is computed correctly (test both "still
      valid" and "expired" cases).
- [x] Project allocation is effective-dated (test a past, current and
      future allocation window, same style as ticket 0056's
      `role_assignments` tests).
- [x] An employee can read their own record via self-service without
      `employee.directory.manage`; cannot read another tenant's or
      another employee's record without it.
- [x] `npm test` / `npm run build` pass; `scripts/tickets.py check` clean.

## Progress
- 2026-10-15: Filed as the first Phase 3 module (ticket 0063/M06d just
  landed, closing out Phase 2). If this turns out to be larger than one
  ticket once scoped in detail, split it the way ticket 0059 (M06) was
  split into 0060-0063 — don't force it into one ticket just because
  it was filed as one.
- 2026-10-15 20:40 UTC: Built as a single ticket (scope was comparable
  to M03's, not M06's — no split needed). Added migration
  `20261015000009_m04_employee_directory_workforce.sql`:
  `employee_records` (NOT NULL tenant_id, nullable 1:1 `app_user_id`,
  employment_status enum active/on_leave/suspended/offboarded),
  `skills`/`employee_skills` (tenant-defined list, free-text
  `proficiency_note` — no rating scale invented), `certifications`/
  `employee_certifications` (date-only issued_at/expires_at,
  expires_at nullable = never expires), `training_records` (free-text
  `result`, no LMS), `employee_project_allocations` (effective-dated,
  same valid_from/valid_to pattern as ticket 0056's role_assignments).
  New permission `employee.directory.manage`, granted only to
  `role.platform_administrator` by default (same deny-by-default
  bootstrap every prior migration uses). New `backend/src/modules/
  workforce/` module: `WorkforceRepository` port + Supabase adapter +
  `service.ts` (incl. `isCertificationExpired`, calendar-day comparison,
  unit-tested for still-valid/expired/never-expires) + Fastify routes,
  wired into `app.ts`. `GET /employees/me` is self-service (no
  permission required, same exemption as `GET /identity/audit-log`);
  `GET/POST/PATCH /employees/:id...` routes are gated on
  `employee.directory.manage`. `FakeWorkforceRepository` test double +
  `service.test.ts` (18 cases) + `routes.test.ts` (8 cases) cover every
  acceptance point, including the cross-tenant 404 and the
  no-permission 403 on another employee's record. `npm run build`,
  `npm run lint` and `npm test` all pass (187/187 tests, 20 files).
  `scripts/tickets.py check` clean. Supabase CLI still unavailable in
  this sandbox (same recurring gap as every prior ticket) — migration
  is unexercised against a live project; schema correctness is reviewed
  by hand against the ticket 0055/0056 conventions it copies.
  Set to `status: testing` — next session or the owner should try a
  real `supabase db push` once the CLI/credentials are reachable.
