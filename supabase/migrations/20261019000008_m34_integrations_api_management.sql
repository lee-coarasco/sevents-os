-- Migration: 20261019000008_m34_integrations_api_management.sql
-- Description: M34 Integrations & API Management schema, API keys, webhooks, connectors, and delivery logs

-- 1. API KEYS TABLE
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  scopes text[] not null default '{}',
  rate_limit_rpm integer not null default 60,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_keys_tenant_prefix on public.api_keys (tenant_id, key_prefix);

alter table public.api_keys enable row level security;

create policy "api_keys_tenant_isolation"
  on public.api_keys
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 2. WEBHOOK SUBSCRIPTIONS TABLE
create table if not exists public.webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  target_url text not null,
  event_types text[] not null default '{}',
  secret_key text not null,
  is_active boolean not null default true,
  failure_count integer not null default 0,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_webhooks_tenant on public.webhook_subscriptions (tenant_id);

alter table public.webhook_subscriptions enable row level security;

create policy "webhook_subscriptions_tenant_isolation"
  on public.webhook_subscriptions
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 3. WEBHOOK DELIVERIES LOG TABLE
create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  webhook_id uuid not null references public.webhook_subscriptions(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  response_status integer,
  response_body text,
  status text not null check (status in ('success', 'failed', 'retrying')),
  delivered_at timestamptz not null default now()
);

create index if not exists idx_webhook_deliveries_tenant on public.webhook_deliveries (tenant_id, delivered_at desc);

alter table public.webhook_deliveries enable row level security;

create policy "webhook_deliveries_tenant_isolation"
  on public.webhook_deliveries
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 4. SERVICE CONNECTORS TABLE
create table if not exists public.service_connectors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  connector_key text not null,
  name text not null,
  category text not null check (category in ('accounting', 'banking', 'e_sign', 'storage', 'ocr', 'custom')),
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error', 'syncing')),
  credentials_masked jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_service_connectors_tenant on public.service_connectors (tenant_id, connector_key);

alter table public.service_connectors enable row level security;

create policy "service_connectors_tenant_isolation"
  on public.service_connectors
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 5. PERMISSIONS & ROLE ASSIGNMENTS
insert into public.permissions (id, description) values
  ('integrations.api_key.manage', 'Issue, configure, and inspect external REST API keys'),
  ('integrations.api_key.revoke', 'Revoke active external REST API keys'),
  ('integrations.webhook.manage', 'Create, update, and manage outbound event webhook subscriptions'),
  ('integrations.webhook.test', 'Send test ping payloads to verify webhook endpoints'),
  ('integrations.connector.manage', 'Configure third-party connectors for accounting, banking, and e-signatures'),
  ('integrations.log.view', 'View delivery traces and audit logs for webhooks and API calls')
on conflict (id) do nothing;

-- Seed role permissions using public.role_definitions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.role_definitions r
cross join public.permissions p
where r.id in (
  'role.platform_administrator',
  'role.company_administrator',
  'role.it_admin',
  'role.developer'
)
  and p.id in (
    'integrations.api_key.manage',
    'integrations.api_key.revoke',
    'integrations.webhook.manage',
    'integrations.webhook.test',
    'integrations.connector.manage',
    'integrations.log.view'
  )
on conflict do nothing;
