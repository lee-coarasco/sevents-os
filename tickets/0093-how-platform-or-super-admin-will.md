---
id: 93
title: how platform or super admin will be used to access the app
status: done
roles: [architect, backend-engineer]
priority: 1
created: 2026-10-16
updated: 2026-10-16
---

who will create users now after applying migrations how i can do the first login with which user.

_Created by lee-coarasco in the AppYard dashboard._

## Answer

**Short answer: nobody can create a user through the app yet — the very
first user has to be created by running one script, once, against the
real Supabase project.**

Why: `POST /identity/invite` (the only way to create a user today — there
is no self-service sign-up by design) is gated behind the
`identity.user.invite` permission. Nobody holds any permission until a
`role.platform_administrator` role assignment exists, and that role is
deliberately **not** grantable through the API (same "admin operation, not
self-service" rule as tenant creation) — so on a brand-new database there
is a chicken-and-egg gap. This was already flagged as a known gap in
tickets 0055/0056 and `DECISIONS.md` (2026-10-15 12:05 UTC), but no runnable
procedure existed yet. This session built one.

**What to run, once, after migrations are applied:**

```
cd backend
BOOTSTRAP_ADMIN_EMAIL=you@yourcompany.com \
BOOTSTRAP_ADMIN_PASSWORD='a strong password' \
BOOTSTRAP_TENANT_NAME='Your Company Name' \
npm run bootstrap:admin
```

This uses the service-role key (already in your env/CI secrets per
CLAUDE.md) to: create a tenant (if `BOOTSTRAP_TENANT_NAME` doesn't already
exist), create the Supabase Auth user with that email/password
(pre-confirmed, so no email-verification step needed), create its
`app_users` row as `active`, and grant it `role.platform_administrator`.
It's idempotent — safe to re-run; re-running with the same email just
confirms the admin already exists and changes nothing.

**Then:** open the frontend login page and sign in with that email and
password. You're now the Platform Administrator and can use
`POST /identity/invite` (once a UI exists for it — not built yet) to add
everyone else.

Built in `backend/src/modules/identity/bootstrap.ts`
(`bootstrapFirstAdmin`, unit-tested in `bootstrap.test.ts` with a fake
repository — happy path, idempotency, existing-tenant reuse,
existing-user reuse) and wired into a CLI at
`backend/src/scripts/bootstrap-first-admin.ts` (`npm run bootstrap:admin`),
following the same "admin CLI script, not an API route" pattern as
`import-catalogue.ts`. Documented the new env vars in
`backend/.env.example`. Reused the existing `invited`/`invite_accepted`/
`role_assignment_created` audit event types rather than inventing a new
one, so no migration was needed.

Not yet run against the real Supabase project — this sandbox has no
reachable Supabase credentials this session (same gap flagged in every
prior ticket touching the Supabase-backed repositories). Whoever has the
real `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` just needs to run the
command above once.

## Progress
- 2026-10-16 11:22 UTC: Answered above. Built `bootstrapFirstAdmin`
  (`backend/src/modules/identity/bootstrap.ts` + Supabase adapter),
  `npm run bootstrap:admin` CLI (`backend/src/scripts/bootstrap-first-admin.ts`),
  4 new unit tests, and documented the new env vars in
  `backend/.env.example`. `npm test`: 447/447 (443 prior + 4 new),
  `npm run build` clean, `scripts/tickets.py check` clean. Closing as
  `done` — the question is fully answered and the gap it identified
  (no runnable first-admin procedure) is now closed in code; only
  remaining step is a human actually running the command against the
  real Supabase project, which doesn't need its own ticket.
