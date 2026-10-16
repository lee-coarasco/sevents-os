-- M31c: Notification preferences, quiet hours & digest (ticket 0083)
--
-- Builds on 0082's notification_templates/notifications tables. Survey:
-- notification_templates has no `category` column (only `template_key`
-- + `channel`), so notification_preferences keys off `template_key`
-- directly instead of inventing a separate category dimension.

alter table public.notifications
  add column deferred_delivery_mode text check (deferred_delivery_mode in ('immediate', 'digest'));

alter table public.notifications drop constraint if exists notifications_status_check;
alter table public.notifications
  add constraint notifications_status_check
  check (status in ('pending', 'sent', 'failed', 'retrying', 'deferred', 'skipped'));

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  user_id uuid not null references public.app_users (id),
  template_key text not null,
  channel text not null check (channel in ('in_app', 'email')),
  opted_in boolean not null default true,
  delivery_mode text not null default 'immediate' check (delivery_mode in ('immediate', 'digest')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_unique unique (tenant_id, user_id, template_key, channel)
);

alter table public.notification_preferences enable row level security;

-- Self-only, same "own row" precedent as notifications_own_rows_select
-- (ticket 0082) — a caller can never read or write another user's
-- preferences, even within the same tenant.
create policy "notification_preferences_own_rows" on public.notification_preferences
  for all
  using (tenant_id = public.current_tenant_id() and user_id = auth.uid())
  with check (tenant_id = public.current_tenant_id() and user_id = auth.uid());

-- One row per user. Every field nullable, none defaulted to a
-- non-null value — per CLAUDE.md, quiet hours/digest must never get a
-- hard-coded default window or interval, so "no row" and "row with
-- null fields" both mean plain immediate delivery.
create table public.notification_schedule_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  user_id uuid not null references public.app_users (id),
  quiet_hours_start time,
  quiet_hours_end time,
  quiet_hours_timezone text,
  digest_interval_minutes integer check (digest_interval_minutes > 0),
  last_digest_released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_schedule_settings_unique unique (tenant_id, user_id)
);

alter table public.notification_schedule_settings enable row level security;

create policy "notification_schedule_settings_own_rows" on public.notification_schedule_settings
  for all
  using (tenant_id = public.current_tenant_id() and user_id = auth.uid())
  with check (tenant_id = public.current_tenant_id() and user_id = auth.uid());

-- Unlike every permission added so far (deny-by-default, granted only
-- to role.platform_administrator), this one gates a basic self-service
-- action every user should have — "scoped to self" per the ticket, not
-- an administrative action. RLS above is what actually prevents
-- targeting another user; the permission just gates whether this
-- feature is available to the caller's role at all. Granted to every
-- canonical role (including the two restricted-portal roles — a
-- vendor/client still manages their own notification preferences).
insert into public.permissions (id, description) values
  ('notification.preferences.manage', 'Manage your own notification preferences, quiet hours and digest settings (self-scoped; RLS prevents targeting another user)');

insert into public.role_permissions (role_id, permission_id)
select id, 'notification.preferences.manage' from public.role_definitions;
