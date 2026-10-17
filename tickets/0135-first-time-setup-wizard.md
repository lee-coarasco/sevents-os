---
id: 135
title: First-time setup wizard (create tenant → company → first admin)
status: blocked
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

## Needs approval
### 2026-10-17 00:50 UTC — Who is allowed to run a self-service "first-time setup wizard," and how are they authenticated before any tenant/role exists?
Tenant creation and the first Platform Administrator role grant are
currently deliberately service-role/DB-only bootstrap steps (DECISIONS.md,
tickets 0055/0056) — there is no API path today where an unauthenticated
or pre-role user can create a tenant or grant themselves
`role.platform_administrator`, because that would be an unauthenticated
privilege-escalation surface.

Options:
1. **This wizard is only for the platform operator (you/your team), run
   against a known-trusted channel** (e.g. a one-time setup token issued
   out-of-band, or simply run via a service-role script/CLI like the
   catalogue import already is) — not exposed as a public "sign up and
   create your own tenant" flow. Keeps the existing bootstrap-is-trusted-
   only precedent intact.
2. **This is meant to be genuine self-service tenant signup** (a new
   construction company signs up on its own, with no prior relationship)
   — a materially bigger feature: email verification, abuse/rate limiting,
   a real "who's allowed to self-provision a tenant" policy, none of which
   exists in this codebase and none of which CLAUDE.md's BRD/PRD mention
   as a requirement so far.

Recommendation: option 1. Nothing in the BRD/PRD describes self-service
multi-tenant signup as a product requirement — every tenant so far has
been owner/operator-provisioned. A wizard UI wrapping the existing
service-role bootstrap steps behind a one-time setup token (generated and
handed to the operator out-of-band, consumed once) gets the UX
improvement ("click through steps" instead of "run DB commands") without
opening a new public attack surface.

## Progress
