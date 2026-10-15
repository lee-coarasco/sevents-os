---
id: 54
title: "M01 — Identity, Authentication & Sessions"
status: next
roles: [backend-engineer, test-engineer]
priority: 2
created: 2026-10-15
updated: 2026-10-15
---

First real module of Phase 1 (`docs/BRD.md` §8.1, `docs/PRD.md` Phase 1
table). Depends on ticket 0053 (backend/Supabase scaffold) only — M01 has
no other module dependency per CLAUDE.md's build-order table.

Builds sign-in, session control and account lifecycle on top of Supabase
Auth (locked choice, do not re-litigate). This ticket does NOT build
tenant/company (ticket 0055) or roles/authority (ticket 0056) — those
reference `users` created here but their tables don't exist yet, so keep
this ticket's schema limited to what identity alone needs.

## Scope

- Use Supabase Auth for credential storage/sign-in — do not build a
  parallel password store.
- `public.app_users` table: one row per Supabase Auth user, holding
  platform-specific profile fields Auth doesn't (display name, status,
  invited_by, deactivated_at). Primary key = Supabase `auth.users.id`
  (1:1). No `tenant_id`/`company_id` column yet — those arrive in ticket
  0056 once M02/M03 exist; adding a nullable FK now and backfilling later
  is fine, don't block on it.
- Account lifecycle: invite (create pending user), activate, deactivate
  (soft — never hard-delete a user row; BRD §6.1 "never silently delete
  audit records" extends to the identity trail).
- Session control: rely on Supabase's JWT session expiry/refresh; add a
  `public.auth_audit_log` table (append-only) that records sign-in,
  sign-out, failed sign-in, password reset, deactivation events — one row
  per event, never updated or deleted.
- MFA: BRD §5.1 says "MFA for privileged roles." Supabase Auth supports
  TOTP MFA natively — wire the enrollment/verify API calls through our
  backend so we control the "privileged roles require MFA" policy
  server-side, but do not invent which roles count as "privileged" yet
  (roles don't exist until ticket 0056). Leave the policy check as a
  `TODO` wired to always-allow for now, with a comment pointing at ticket
  0056, rather than guessing.
- RLS: enable RLS on every new table from the first migration, even
  before tenant_id exists — a user should only be able to read/update
  their own `app_users` row (service-role bypasses this for admin ops).
- API endpoints (backend-engineer, Fastify per ticket 0053): invite user,
  accept invite/set password, deactivate user, list auth audit log
  (self-service: a user can see their own log; broader admin visibility
  waits for ticket 0056's role/permission model).
- Idempotency: inviting the same email twice must not create two pending
  users (BRD §6.1 "idempotency keys for ... write operations").

## Explicitly NOT in this ticket
- SSO/OIDC federation — BRD §5.1 says "SSO-ready architecture," meaning
  don't design against it, not implement it now. No SSO provider is
  configured.
- Any role/permission check beyond "is this your own row" — that's
  ticket 0056.
- Password complexity/lockout policy values — if a concrete threshold
  (e.g. "5 failed attempts locks the account for 15 minutes") isn't
  already decided anywhere in BRD/PRD, leave it at whatever Supabase
  Auth's own default is and record that as a `TBD—Business Owner
  Decision` in this ticket's Progress rather than inventing a number.

## Acceptance
- [ ] Migration creates `app_users` and `auth_audit_log` with RLS enabled
      and policies restricting a user to their own rows.
- [ ] Invite → accept → sign-in → sign-out flow works end-to-end against
      the real Supabase project, exercised by an integration test.
- [ ] Re-inviting an already-invited email is a no-op, not a duplicate
      row (test asserts this).
- [ ] Deactivating a user prevents further sign-in but the row and its
      audit trail remain (test asserts soft-deactivation, not deletion).
- [ ] auth_audit_log has at least one row per sign-in/sign-out/failed
      sign-in/deactivation in the test run.
- [ ] MFA enrollment/verify endpoints exist and are tested, even though
      enforcement policy is a deferred TODO.
- [ ] `npm test` passes; no hard-coded secrets in the diff.

## Progress
- 2026-10-15: Architect session. Filed as the first real-schema ticket of
  Phase 1, scoped to identity only so it doesn't block on M02/M03 tables
  that don't exist yet. Depends on ticket 0053 landing first.
