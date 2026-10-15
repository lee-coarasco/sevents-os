---
id: 54
title: "M01 — Identity, Authentication & Sessions"
status: testing
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
- [x] Migration creates `app_users` and `auth_audit_log` with RLS enabled
      and policies restricting a user to their own rows (`supabase/
      migrations/20261015000001_app_users_and_auth_audit_log.sql`).
- [ ] Invite → accept → sign-in → sign-out flow works end-to-end, exercised
      by tests — but only against an in-memory fake repository
      (`FakeIdentityRepository`), not the real Supabase project. This
      sandbox has no reachable `SUPABASE_URL`/`SUPABASE_*_KEY`, same gap
      already flagged in ticket 0053. The route/service layer is built
      against an `IdentityRepository` interface specifically so the real
      `createSupabaseIdentityRepository` adapter is a thin, swappable
      implementation — but that adapter itself is unverified against a
      live project. Next session with real credentials should run the
      flow once for real and report back here.
- [x] Re-inviting an already-invited email is a no-op, not a duplicate
      row (`service.test.ts`: case-insensitive too).
- [x] Deactivating a user prevents further sign-in but the row and its
      audit trail remain (`service.test.ts`, `routes.test.ts`).
- [x] `auth_audit_log` gets a row per sign-in/sign-out/failed-sign-in/
      invited/invite_accepted/deactivated/mfa event — added `POST
      /identity/sign-in` and `POST /identity/sign-out` endpoints (not
      originally listed in this ticket's scope, but required to produce
      real sign-in/sign-out audit rows at all, since Supabase Auth
      sign-in otherwise happens client-side with no backend involvement
      to log from).
- [x] MFA enrollment/verify endpoints exist and are tested
      (`POST /identity/mfa/enroll`, `POST /identity/mfa/verify`); the
      "privileged roles require MFA" policy is a `TODO` in `service.ts`
      pointing at ticket 0056, per this ticket's own scope note.
- [x] `npm test` passes (28/28); no hard-coded secrets in the diff.
- [x] Password complexity/lockout thresholds: left entirely to Supabase
      Auth's own defaults, nothing invented. **TBD—Business Owner
      Decision**: no concrete lockout policy (attempts/duration) exists
      anywhere in BRD/PRD; flagging here rather than guessing, per this
      ticket's own scope note and CLAUDE.md's rule against inventing
      authority/SLA/policy values.

## Progress
- 2026-10-15: Architect session. Filed as the first real-schema ticket of
  Phase 1, scoped to identity only so it doesn't block on M02/M03 tables
  that don't exist yet. Depends on ticket 0053 landing first.
- 2026-10-15 11:16 UTC: Built M01. Migration adds `app_users` +
  `auth_audit_log`, both RLS-enabled, own-rows-only policies, append-only
  by construction (no update/delete policy for any role on the audit
  log). Backend: `src/modules/identity/` — `repository.ts` defines the
  `IdentityRepository` port (Supabase-call-shape-free) plus
  `createSupabaseIdentityRepository` as the real adapter;
  `service.ts` holds all business logic (invite/accept/deactivate/
  sign-in/sign-out/audit-log/MFA), unit-tested via an in-memory
  `FakeIdentityRepository` so none of it needs live Supabase credentials;
  `routes.ts` wires 8 Fastify endpoints under `/identity/*`. Added
  `createAnonClient`/`createUserScopedClient` to `lib/supabase.ts`
  alongside the existing service-role client. 28/28 tests pass, `npm run
  build` clean. Status: `testing` — owner can verify with `cd backend &&
  npm test`; live-Supabase verification of the adapter itself is the one
  open item, same as ticket 0053's `/health` gap. Moving ticket 0055 (M02
  Tenant/Company) to next.
- 2026-10-15 12:05 UTC: Ticket 0056 (M03) closed the "any role/permission
  check beyond is this your own row" gap this ticket deliberately left
  open — `POST /identity/invite` and `POST /identity/deactivate` now
  require `identity.user.invite`/`identity.user.deactivate` via the new
  authority module. The "privileged roles require MFA" `TODO` in
  `service.ts` is still open (0056 didn't touch MFA policy — it's a
  separate decision about which roles count as privileged, not just
  that roles now exist).
