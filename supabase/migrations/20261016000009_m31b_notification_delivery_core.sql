-- M31b: Notification delivery core (ticket 0082)
--
-- Greenfield (ticket 0069's survey: no notifications/templates/queue/
-- digest table exists anywhere yet). Dedup (FR-NOT-001) is a DB-enforced
-- uniqueness constraint on (tenant_id, dedup_key, recipient_id) — the
-- *mechanism*, not a fabricated dedup window: whatever time window a
-- caller wants is entirely encoded in how it builds dedup_key (e.g.
-- including a day bucket for a daily reminder). Retry policy
-- (FR-NOT-002) is caller-configured per (tenant, channel) — no
-- hard-coded max-attempts/backoff constant anywhere in code.

create table public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  template_key text not null,
  channel text not null check (channel in ('in_app', 'email')),
  subject text,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_templates_tenant_key_channel_unique unique (tenant_id, template_key, channel)
);

alter table public.notification_templates enable row level security;

create policy "notification_templates_tenant_isolation" on public.notification_templates
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- No seeded rows, no hard-coded max_attempts/backoff default anywhere in
-- code — a channel with no row here is not retryable until a tenant
-- admin configures one (same "no matching row = not authorized, never
-- unlimited" precedent as ticket 0056's approval_limits).
create table public.notification_retry_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  channel text not null check (channel in ('in_app', 'email')),
  max_attempts integer not null check (max_attempts > 0),
  backoff_seconds integer not null check (backoff_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_retry_policies_tenant_channel_unique unique (tenant_id, channel)
);

alter table public.notification_retry_policies enable row level security;

create policy "notification_retry_policies_tenant_isolation" on public.notification_retry_policies
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  recipient_id uuid not null references public.app_users (id),
  channel text not null check (channel in ('in_app', 'email')),
  template_id uuid references public.notification_templates (id),
  dedup_key text not null,
  rendered_subject text,
  rendered_body text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'retrying')),
  attempt_count integer not null default 0,
  last_attempted_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notifications_dedup_recipient_unique unique (tenant_id, dedup_key, recipient_id)
);

create index notifications_recipient_idx on public.notifications (recipient_id);

alter table public.notifications enable row level security;

-- Unlike every other tenant-scoped table, same-tenant visibility is not
-- enough here: FR-NOT's whole point is a user's own notification feed,
-- so the policy itself checks recipient_id = auth.uid(), same "own row
-- only" precedent as ticket 0054's auth_audit_log policy. The
-- dispatcher (creating a notification for an arbitrary recipient, not
-- the caller) and the retry path go through the service-role client,
-- same precedent as every other system-triggered write in this codebase
-- (ticket 0056's insertAuditEvent, ticket 0058's catalogue import).
create policy "notifications_own_rows_select" on public.notifications
  for select
  using (tenant_id = public.current_tenant_id() and recipient_id = auth.uid());

create policy "notifications_own_rows_update" on public.notifications
  for update
  using (tenant_id = public.current_tenant_id() and recipient_id = auth.uid())
  with check (tenant_id = public.current_tenant_id() and recipient_id = auth.uid());

-- Template/retry-policy administration is a compliance/ops action,
-- distinct from any per-user preference (ticket 0083's own scope).
-- Deny-by-default: only the platform administrator role is granted it.
insert into public.permissions (id, description) values
  ('notification.template.manage', 'Create/update notification templates and retry policies');

insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions
where id = 'notification.template.manage';
