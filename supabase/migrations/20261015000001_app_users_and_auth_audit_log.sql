-- M01: Identity, Authentication & Sessions (ticket 0054)
--
-- app_users holds platform-specific profile/lifecycle fields on top of
-- Supabase Auth's auth.users; auth_audit_log is an append-only trail of
-- identity events. No tenant_id yet — M02 (ticket 0055) adds it via an
-- additive migration once Tenant/Company exist.

create table public.app_users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  status text not null default 'pending' check (status in ('pending', 'active', 'deactivated')),
  invited_by uuid references public.app_users (id),
  invited_at timestamptz not null default now(),
  activated_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index app_users_email_key on public.app_users (lower(email));

alter table public.app_users enable row level security;

create policy "app_users_select_own" on public.app_users
  for select
  using (auth.uid() = id);

create policy "app_users_update_own" on public.app_users
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No insert/delete policy for anon/authenticated roles: rows are only
-- ever created by the backend via the service-role key (which bypasses
-- RLS), as part of the invite flow. Users never insert or delete their
-- own row.

create table public.auth_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users (id) on delete set null,
  event_type text not null check (
    event_type in (
      'invited',
      'invite_accepted',
      'deactivated',
      'sign_in',
      'sign_out',
      'sign_in_failed',
      'password_reset_requested',
      'password_reset_completed',
      'mfa_enrolled',
      'mfa_verified',
      'mfa_verification_failed'
    )
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.auth_audit_log enable row level security;

create policy "auth_audit_log_select_own" on public.auth_audit_log
  for select
  using (auth.uid() = user_id);

-- Append-only by construction: no update/delete policy exists for any
-- role, and no insert policy exists for anon/authenticated — every row
-- is written by the backend via the service-role key, which bypasses RLS.
