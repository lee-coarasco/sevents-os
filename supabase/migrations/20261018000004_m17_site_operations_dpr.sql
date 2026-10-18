-- M17: Site Operations, DPR & Field Capture (ticket 0160)
-- Daily Progress Reports (DPR), Manpower, Equipment, Executed Quantities, Blockers, Site Instructions

create table public.daily_progress_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  project_id uuid not null references public.projects (id) on delete cascade,
  report_date date not null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  weather_condition text not null default 'clear' check (weather_condition in ('clear', 'partly_cloudy', 'sunny', 'rain', 'heavy_rain', 'dust_storm', 'extreme_heat', 'other')),
  temperature_celsius numeric,
  weather_impact text check (weather_impact in ('none', 'minor_delay', 'work_stoppage')),
  general_notes text,
  site_engineer_id uuid references public.app_users (id),
  supervisor_id uuid references public.app_users (id),
  approved_at timestamptz,
  approved_by uuid references public.app_users (id),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_project_report_date unique (project_id, report_date)
);

alter table public.daily_progress_reports enable row level security;

create policy "daily_progress_reports_tenant_isolation" on public.daily_progress_reports
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table public.dpr_manpower_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  dpr_id uuid not null references public.daily_progress_reports (id) on delete cascade,
  trade text not null,
  headcount integer not null check (headcount >= 0),
  hours_worked numeric not null default 8.0 check (hours_worked >= 0),
  subcontractor_name text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.dpr_manpower_entries enable row level security;

create policy "dpr_manpower_entries_tenant_isolation" on public.dpr_manpower_entries
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table public.dpr_equipment_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  dpr_id uuid not null references public.daily_progress_reports (id) on delete cascade,
  equipment_type text not null,
  quantity integer not null default 1 check (quantity > 0),
  operating_hours numeric not null default 8.0 check (operating_hours >= 0),
  idle_hours numeric not null default 0 check (idle_hours >= 0),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.dpr_equipment_entries enable row level security;

create policy "dpr_equipment_entries_tenant_isolation" on public.dpr_equipment_entries
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table public.dpr_work_progress_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  dpr_id uuid not null references public.daily_progress_reports (id) on delete cascade,
  schedule_activity_id uuid references public.schedule_activities (id) on delete set null,
  location_or_grid text,
  description text not null check (length(trim(description)) > 0),
  quantity_executed numeric check (quantity_executed is null or quantity_executed >= 0),
  uom text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.dpr_work_progress_entries enable row level security;

create policy "dpr_work_progress_entries_tenant_isolation" on public.dpr_work_progress_entries
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table public.dpr_blockers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  dpr_id uuid not null references public.daily_progress_reports (id) on delete cascade,
  category text not null check (category in ('material_shortage', 'drawing_delay', 'inspection_pending', 'access_blocked', 'weather', 'subcontractor_default', 'safety_stop', 'other')),
  description text not null check (length(trim(description)) > 0),
  impact_hours numeric default 0 check (impact_hours >= 0),
  resolution_action text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

alter table public.dpr_blockers enable row level security;

create policy "dpr_blockers_tenant_isolation" on public.dpr_blockers
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table public.dpr_site_instructions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  project_id uuid not null references public.projects (id) on delete cascade,
  dpr_id uuid references public.daily_progress_reports (id) on delete set null,
  instruction_number text not null,
  issued_by text not null,
  recipient text not null,
  instruction_text text not null check (length(trim(instruction_text)) > 0),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'acknowledged')),
  target_completion_date date,
  issued_at timestamptz not null default now()
);

alter table public.dpr_site_instructions enable row level security;

create policy "dpr_site_instructions_tenant_isolation" on public.dpr_site_instructions
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Permissions
insert into public.permissions (id, description) values
  ('site.dpr.manage', 'Create, update, and submit Daily Progress Reports (DPR)'),
  ('site.dpr.approve', 'Approve or reject Daily Progress Reports'),
  ('site.instruction.manage', 'Issue, track, and update Site Instructions')
on conflict (id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions
where id in ('site.dpr.manage', 'site.dpr.approve', 'site.instruction.manage')
on conflict do nothing;
