---
id: 135
title: First-time setup wizard (create tenant → company → first admin)
status: next
roles: [architect, ui-designer, backend-engineer, test-engineer]
priority: 3
created: 2026-10-17
updated: 2026-10-17
---

Split from ticket 0111 (see DECISIONS.md). Today, tenant creation and the
first Platform Administrator role assignment are both service-role/DB
bootstrap steps (DECISIONS.md, tickets 0055/0056) — deliberately not
self-service, because nobody holds `authority.role_assignment.manage`
before that first grant exists. This ticket needs an architect decision
before any UI work starts: **does a self-service "first-time setup
wizard" contradict that standing bootstrap-is-admin-only precedent, or is
it meant for a different audience (e.g. the platform operator doing the
one-time initial setup, authenticated some other way)?**

Do not silently build an unauthenticated "create the first tenant/admin"
endpoint — that would reopen the exact unauthenticated-privilege-grant gap
ticket 0056 closed. Raise this as this ticket's own `## Needs approval`
question (who is allowed to run this wizard, and how are they
authenticated before any role exists to check) before writing code, per
CLAUDE.md's "never guess on an approval-required item" rule — this is
exactly that kind of question, since inventing an authentication bypass
for "the first user" is a security-shaped decision, not an internal API
detail.

## Acceptance
- [ ] Owner has answered the authentication/authorization question above.
- [ ] Wizard UI: create tenant → create first company → create first
  admin user, each step calling the existing (currently service-role-only)
  operations through whatever authenticated path the owner's answer
  specifies.
- [ ] Tests.

## Progress

- 2026-10-17 08:04 GST - lee-coarasco (dashboard): Answered "Who is allowed to run a self-service "first-time setup wizard," and how are they authenticated before any tenant/role exists?": Go with option 1 only
