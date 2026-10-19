-- ============================================================================
-- M25: Equipment, Plant & Fleet Operations
-- ============================================================================

-- 1. Equipment Assets Master Register
create table if not exists public.equipment_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  asset_code text not null,
  name text not null,
  category text not null check (category in ('heavy_plant', 'earthmoving', 'lifting_rigging', 'power_generation', 'fleet_vehicle', 'small_tools')),
  make text not null,
  model text not null,
  year_of_manufacture integer,
  serial_or_vin text,
  ownership_type text not null default 'owned' check (ownership_type in ('owned', 'leased', 'hired')),
  hire_vendor_name text,
  daily_rate numeric(14, 2) not null default 0,
  status text not null default 'available' check (status in ('available', 'mobilized_on_site', 'under_maintenance', 'breakdown', 'decommissioned')),
  current_meter_hours numeric(14, 2) not null default 0,
  current_project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_equipment_assets_code unique (tenant_id, asset_code)
);

create index if not exists idx_equipment_assets_tenant on public.equipment_assets(tenant_id);
create index if not exists idx_equipment_assets_category on public.equipment_assets(tenant_id, category);
create index if not exists idx_equipment_assets_status on public.equipment_assets(tenant_id, status);
create index if not exists idx_equipment_assets_project on public.equipment_assets(current_project_id);

alter table public.equipment_assets enable row level security;

create policy equipment_assets_tenant_isolation on public.equipment_assets
  for all using (tenant_id = public.current_tenant_id());

-- 2. Equipment Allocations / Mobilizations
create table if not exists public.equipment_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  equipment_id uuid not null references public.equipment_assets(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  allocation_number text not null,
  mobilization_date timestamptz not null default now(),
  expected_demobilization_date timestamptz,
  actual_demobilization_date timestamptz,
  grid_location text,
  status text not null default 'requested' check (status in ('requested', 'approved', 'mobilized', 'demobilized')),
  requested_by text not null,
  approved_by text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_equipment_allocations_number unique (tenant_id, allocation_number)
);

create index if not exists idx_equipment_allocations_tenant on public.equipment_allocations(tenant_id);
create index if not exists idx_equipment_allocations_project on public.equipment_allocations(tenant_id, project_id);
create index if not exists idx_equipment_allocations_equipment on public.equipment_allocations(equipment_id);

alter table public.equipment_allocations enable row level security;

create policy equipment_allocations_tenant_isolation on public.equipment_allocations
  for all using (tenant_id = public.current_tenant_id());

-- 3. Equipment Daily Utilization Logs
create table if not exists public.equipment_daily_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  equipment_id uuid not null references public.equipment_assets(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  log_date date not null default current_date,
  operating_hours numeric(6, 2) not null default 0,
  idle_hours numeric(6, 2) not null default 0,
  breakdown_hours numeric(6, 2) not null default 0,
  start_meter_reading numeric(14, 2) not null default 0,
  end_meter_reading numeric(14, 2) not null default 0,
  fuel_added_litres numeric(10, 2) not null default 0,
  operator_name text not null,
  work_description text not null,
  supervisor_signoff text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_equipment_daily_logs_tenant on public.equipment_daily_logs(tenant_id);
create index if not exists idx_equipment_daily_logs_project on public.equipment_daily_logs(tenant_id, project_id);
create index if not exists idx_equipment_daily_logs_equipment on public.equipment_daily_logs(equipment_id);
create index if not exists idx_equipment_daily_logs_date on public.equipment_daily_logs(log_date);

alter table public.equipment_daily_logs enable row level security;

create policy equipment_daily_logs_tenant_isolation on public.equipment_daily_logs
  for all using (tenant_id = public.current_tenant_id());

-- 4. Equipment Maintenance & Inspections Records
create table if not exists public.equipment_maintenance_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  equipment_id uuid not null references public.equipment_assets(id) on delete cascade,
  maintenance_type text not null check (maintenance_type in ('preventive_service', 'breakdown_repair', 'safety_inspection', 'statutory_certification')),
  maintenance_date date not null default current_date,
  meter_hours_at_service numeric(14, 2) not null default 0,
  cost numeric(14, 2) not null default 0,
  performed_by text not null,
  description text not null,
  next_due_date date,
  next_due_meter_hours numeric(14, 2),
  status text not null default 'completed' check (status in ('scheduled', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_equipment_maintenance_tenant on public.equipment_maintenance_records(tenant_id);
create index if not exists idx_equipment_maintenance_equipment on public.equipment_maintenance_records(equipment_id);

alter table public.equipment_maintenance_records enable row level security;

create policy equipment_maintenance_tenant_isolation on public.equipment_maintenance_records
  for all using (tenant_id = public.current_tenant_id());

-- 5. Equipment Statutory Third-Party Certificates
create table if not exists public.equipment_statutory_certificates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  equipment_id uuid not null references public.equipment_assets(id) on delete cascade,
  certificate_type text not null check (certificate_type in ('safe_working_load_3rd_party', 'lifting_tackle_inspection', 'registration_mulkiya', 'insurance_policy', 'emission_test')),
  certificate_number text not null,
  issuing_authority text not null,
  issue_date date not null,
  expiry_date date not null,
  attachment_url text,
  status text not null default 'valid' check (status in ('valid', 'expired', 'pending_renewal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_equipment_statutory_cert unique (tenant_id, equipment_id, certificate_number)
);

create index if not exists idx_equipment_certificates_tenant on public.equipment_statutory_certificates(tenant_id);
create index if not exists idx_equipment_certificates_equipment on public.equipment_statutory_certificates(equipment_id);
create index if not exists idx_equipment_certificates_expiry on public.equipment_statutory_certificates(expiry_date);

alter table public.equipment_statutory_certificates enable row level security;

create policy equipment_statutory_certificates_tenant_isolation on public.equipment_statutory_certificates
  for all using (tenant_id = public.current_tenant_id());

-- 6. Permissions Seeding (Note: permissions table primary key is `id`, not `key`)
insert into public.permissions (id, description) values
  ('equipment.asset.manage', 'Register, update, and manage plant, machinery, and fleet assets'),
  ('equipment.allocation.manage', 'Request, mobilize, and demobilize equipment for project sites'),
  ('equipment.allocation.approve', 'Approve project plant allocation and mobilization requests'),
  ('equipment.log.manage', 'Log and sign off daily equipment utilization, meter readings, and fuel consumption'),
  ('equipment.maintenance.manage', 'Schedule, execute, and record equipment maintenance and repair work'),
  ('equipment.certificate.manage', 'Manage statutory third-party calibration, registration, and safety certificates')
on conflict (id) do nothing;

-- 7. Grant Permissions to Relevant Roles
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from (
  values
    ('role.platform_administrator'),
    ('role.plant_equipment_operator'),
    ('role.logistics_coordinator'),
    ('role.project_engineer_lead'),
    ('role.site_civil_engineer')
) as target_roles(role_id)
cross join (
  values
    ('equipment.asset.manage'),
    ('equipment.allocation.manage'),
    ('equipment.allocation.approve'),
    ('equipment.log.manage'),
    ('equipment.maintenance.manage'),
    ('equipment.certificate.manage')
) as target_perms(id)
join public.permissions p on p.id = target_perms.id
join public.role_definitions r on r.id = target_roles.role_id
on conflict do nothing;
