-- 20261018000009_m20_safety_incidents_compliance.sql
-- M20: Safety, Incidents & Compliance
-- Covers Permits to Work (PTW), Incident Reporting & Investigations, Hazard Observations (with Stop-Work Directives), and Toolbox Talks (TBT).

-- 1. Safety Permits to Work (PTW)
create table if not exists public.safety_permits_to_work (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  permit_number text not null,
  permit_type text not null default 'working_at_height' check (permit_type in ('hot_work', 'working_at_height', 'confined_space', 'lifting_operations', 'deep_excavation', 'electrical_isolation')),
  title text not null,
  location_or_grid text not null,
  start_time timestamptz not null,
  expiry_time timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'active', 'suspended', 'closed', 'cancelled')),
  contractor_name text not null,
  supervisor_name text not null,
  safety_officer_name text,
  precautions_taken text,
  gas_test_required boolean not null default false,
  gas_test_results text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_safety_permit_number unique (tenant_id, permit_number)
);

create index if not exists idx_safety_ptw_tenant on public.safety_permits_to_work(tenant_id);
create index if not exists idx_safety_ptw_project on public.safety_permits_to_work(project_id);

-- 2. Safety Incidents & Emergency Log
create table if not exists public.safety_incidents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  incident_number text not null,
  incident_date timestamptz not null default now(),
  incident_type text not null default 'near_miss' check (incident_type in ('near_miss', 'first_aid', 'medical_treatment', 'lost_time_injury', 'dangerous_occurrence', 'environmental_spill')),
  severity text not null default 'minor' check (severity in ('minor', 'moderate', 'major', 'critical', 'fatal')),
  status text not null default 'reported' check (status in ('reported', 'under_investigation', 'capa_assigned', 'closed')),
  location_or_grid text not null,
  description text not null,
  injured_person_name text,
  injury_details text,
  lost_workdays integer not null default 0 check (lost_workdays >= 0),
  immediate_action_taken text,
  root_cause_analysis text,
  corrective_preventive_action text,
  reported_by text not null,
  investigated_by text,
  closed_by text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_safety_incident_number unique (tenant_id, incident_number)
);

create index if not exists idx_safety_incidents_tenant on public.safety_incidents(tenant_id);
create index if not exists idx_safety_incidents_project on public.safety_incidents(project_id);

-- 3. Safety Hazard Observations & Stop-Work
create table if not exists public.safety_hazard_observations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  observation_number text not null,
  observation_type text not null default 'unsafe_condition' check (observation_type in ('unsafe_condition', 'unsafe_act', 'positive_intervention')),
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high', 'imminent_danger')),
  stop_work_issued boolean not null default false,
  location_or_grid text not null,
  description text not null,
  action_required text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'rectified', 'closed')),
  reported_by text not null,
  assigned_to text,
  rectification_evidence text,
  target_rectification_date date,
  rectified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_safety_observation_number unique (tenant_id, observation_number)
);

create index if not exists idx_safety_hazard_tenant on public.safety_hazard_observations(tenant_id);
create index if not exists idx_safety_hazard_project on public.safety_hazard_observations(project_id);

-- 4. Safety Toolbox Talks (TBT)
create table if not exists public.safety_toolbox_talks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  tbt_number text not null,
  talk_date date not null default current_date,
  topic text not null,
  conducted_by text not null,
  trade_discipline text not null default 'general' check (trade_discipline in ('civil', 'mep', 'structural', 'finishes', 'piling', 'facade', 'general')),
  attendee_count integer not null default 0 check (attendee_count >= 0),
  key_points_discussed text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_safety_tbt_number unique (tenant_id, tbt_number)
);

create index if not exists idx_safety_tbt_tenant on public.safety_toolbox_talks(tenant_id);
create index if not exists idx_safety_tbt_project on public.safety_toolbox_talks(project_id);

-- 5. Enable Row-Level Security
alter table public.safety_permits_to_work enable row level security;
alter table public.safety_incidents enable row level security;
alter table public.safety_hazard_observations enable row level security;
alter table public.safety_toolbox_talks enable row level security;

-- 6. RLS Policies (Tenant Isolation)
create policy ptw_tenant_isolation on public.safety_permits_to_work
  for all using (tenant_id = public.current_tenant_id());

create policy incidents_tenant_isolation on public.safety_incidents
  for all using (tenant_id = public.current_tenant_id());

create policy hazard_tenant_isolation on public.safety_hazard_observations
  for all using (tenant_id = public.current_tenant_id());

create policy tbt_tenant_isolation on public.safety_toolbox_talks
  for all using (tenant_id = public.current_tenant_id());

-- 7. Seed Permissions in permissions table (id, description)
insert into public.permissions (id, description) values
  ('safety.ptw.manage', 'Create, update, and submit Permits to Work (PTW)'),
  ('safety.ptw.approve', 'Authorize, activate, and suspend Permits to Work (PTW)'),
  ('safety.incident.manage', 'Report and record safety incidents and emergency responses'),
  ('safety.incident.investigate', 'Investigate incidents, record root causes, and sign off CAPA closure'),
  ('safety.hazard.manage', 'Log hazard observations, issue stop-work orders, and verify rectifications'),
  ('safety.tbt.manage', 'Record and schedule site safety toolbox talks (TBT)')
on conflict (id) do nothing;

-- 8. Assign Permissions to Platform Administrator & QHSE Engineer
insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions
where id in (
  'safety.ptw.manage',
  'safety.ptw.approve',
  'safety.incident.manage',
  'safety.incident.investigate',
  'safety.hazard.manage',
  'safety.tbt.manage'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'role.qhse_engineer', id from public.permissions
where id in (
  'safety.ptw.manage',
  'safety.ptw.approve',
  'safety.incident.manage',
  'safety.incident.investigate',
  'safety.hazard.manage',
  'safety.tbt.manage'
)
on conflict do nothing;
