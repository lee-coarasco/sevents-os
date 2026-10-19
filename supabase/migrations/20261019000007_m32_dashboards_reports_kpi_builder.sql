-- Migration: 20261019000007_m32_dashboards_reports_kpi_builder.sql
-- Description: M32 Dashboards, Reports & KPI Builder schema, saved report definitions, and permissions

-- 1. DASHBOARD REPORTS TABLE
create table if not exists public.dashboard_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  category text not null check (category in ('executive', 'financial', 'operational', 'qhse', 'custom')),
  config jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id) on delete set null,
  is_preset boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dashboard_reports_tenant_cat on public.dashboard_reports (tenant_id, category);

alter table public.dashboard_reports enable row level security;

create policy "dashboard_reports_tenant_isolation"
  on public.dashboard_reports
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 2. PERMISSIONS & ROLE ASSIGNMENTS
insert into public.permissions (id, description) values
  ('dashboard.executive.view', 'View executive-level portfolio health, contract summaries, and risk radar'),
  ('dashboard.financial.view', 'View cross-module financial variance, budget vs committed spend, and billing status'),
  ('dashboard.operations.view', 'View site operational metrics, manpower mobilization, fleet utilization, and QHSE compliance'),
  ('dashboard.reports.manage', 'Create, modify, and save custom report definitions and KPI dashboards'),
  ('dashboard.reports.export', 'Export tabular report datasets and KPI analytics to CSV and structured formats')
on conflict (id) do nothing;

-- Seed role permissions using public.role_definitions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.role_definitions r
cross join public.permissions p
where r.id in (
  'role.platform_administrator',
  'role.ceo',
  'role.coo',
  'role.cfo',
  'role.project_director',
  'role.senior_accountant',
  'role.qhse_director',
  'role.project_engineer_lead'
)
  and p.id in (
    'dashboard.executive.view',
    'dashboard.financial.view',
    'dashboard.operations.view',
    'dashboard.reports.manage',
    'dashboard.reports.export'
  )
on conflict do nothing;
