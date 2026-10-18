-- M18: Schedule, Progress & Resource Planning (ticket 0120)
-- Lookahead plans (2-week / 4-week) and delay records with variance tracking

create table public.lookahead_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  period_start date not null,
  period_end date not null,
  timeframe_weeks integer not null default 2 check (timeframe_weeks in (2, 4)),
  created_by uuid references public.app_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lookahead_plans_period_valid check (period_end >= period_start)
);

alter table public.lookahead_plans enable row level security;

create policy "lookahead_plans_tenant_isolation" on public.lookahead_plans
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table public.lookahead_activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  lookahead_plan_id uuid not null references public.lookahead_plans (id) on delete cascade,
  schedule_activity_id uuid references public.schedule_activities (id) on delete set null,
  custom_activity_name text,
  planned_action text not null check (length(trim(planned_action)) > 0),
  target_date date not null,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed', 'delayed')),
  assigned_to uuid references public.app_users (id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lookahead_activities enable row level security;

create policy "lookahead_activities_tenant_isolation" on public.lookahead_activities
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table public.schedule_delay_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  project_id uuid not null references public.projects (id) on delete cascade,
  schedule_activity_id uuid not null references public.schedule_activities (id) on delete cascade,
  delay_days integer not null check (delay_days > 0),
  reason_category text not null check (reason_category in ('client', 'design', 'procurement', 'subcontractor', 'weather', 'permits', 'other')),
  description text not null check (length(trim(description)) > 0),
  mitigation_plan text,
  recorded_by uuid references public.app_users (id),
  recorded_at timestamptz not null default now()
);

alter table public.schedule_delay_records enable row level security;

create policy "schedule_delay_records_tenant_isolation" on public.schedule_delay_records
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Add permission for delay logging
insert into public.permissions (id, description) values
  ('project.delay.manage', 'Log schedule delays and manage delay mitigation plans');

insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions
where id in ('project.delay.manage');
