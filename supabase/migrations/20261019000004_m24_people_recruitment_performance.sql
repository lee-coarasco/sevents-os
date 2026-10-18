-- Migration: 20261019000004_m24_people_recruitment_performance.sql
-- Module: M24 People, Recruitment & Performance

-- 1. MANPOWER REQUESTS (Site Manpower Mobilization Requisitions)
create table if not exists public.manpower_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id(),
  project_id text not null,
  request_number text not null,
  role_title text not null,
  quantity_required integer not null check (quantity_required > 0),
  skill_level text not null default 'intermediate' check (skill_level in ('entry', 'intermediate', 'senior', 'master')),
  required_date date not null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'fulfilled', 'cancelled')),
  approved_by text,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_manpower_requests_tenant_project on public.manpower_requests (tenant_id, project_id);

alter table public.manpower_requests enable row level security;

create policy "manpower_requests_tenant_isolation"
  on public.manpower_requests
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 2. RECRUITMENT CANDIDATES (Talent Pipeline)
create table if not exists public.recruitment_candidates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id(),
  manpower_request_id uuid references public.manpower_requests(id) on delete set null,
  candidate_name text not null,
  email text not null,
  phone text,
  position_applied text not null,
  current_company text,
  years_experience numeric(4,1) not null default 0,
  stage text not null default 'applied' check (stage in ('applied', 'screening', 'interview', 'offered', 'hired', 'rejected')),
  rating integer default 3 check (rating between 1 and 5),
  resume_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recruitment_candidates_tenant_stage on public.recruitment_candidates (tenant_id, stage);

alter table public.recruitment_candidates enable row level security;

create policy "recruitment_candidates_tenant_isolation"
  on public.recruitment_candidates
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 3. SITE COMPETENCIES (Trade Skills & Safety Certifications Register)
create table if not exists public.site_competencies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id(),
  employee_name text not null,
  trade text not null default 'civil_mason' check (trade in ('civil_mason', 'steel_fixer', 'electrician', 'plumber', 'hvac_technician', 'safety_marshall', 'scaffolder', 'crane_operator')),
  certification_name text not null,
  certifying_body text not null,
  issue_date date not null,
  expiry_date date not null,
  status text not null default 'valid' check (status in ('valid', 'expiring_soon', 'expired')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_site_competencies_tenant_status on public.site_competencies (tenant_id, status);

alter table public.site_competencies enable row level security;

create policy "site_competencies_tenant_isolation"
  on public.site_competencies
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 4. PERFORMANCE APPRAISALS (Performance Reviews & Goal Assessments)
create table if not exists public.performance_appraisals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id(),
  employee_name text not null,
  review_period text not null,
  appraiser_name text not null,
  score numeric(4,1) not null default 3.0 check (score between 1.0 and 5.0),
  strengths text,
  growth_areas text,
  goals text,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_performance_appraisals_tenant_period on public.performance_appraisals (tenant_id, review_period);

alter table public.performance_appraisals enable row level security;

create policy "performance_appraisals_tenant_isolation"
  on public.performance_appraisals
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 5. PERMISSIONS & ROLE ASSIGNMENTS
insert into public.permissions (key, description) values
  ('people.manpower.manage', 'Create, update and track site manpower requisitions'),
  ('people.manpower.approve', 'Approve project manpower mobilization requisitions'),
  ('people.recruitment.manage', 'Manage candidate recruitment pipeline and hiring stages'),
  ('people.competency.manage', 'Register and audit site worker competencies and training certifications'),
  ('people.appraisal.manage', 'Conduct and submit employee performance reviews and appraisals')
on conflict (key) do nothing;

-- Seed role permissions using public.role_definitions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.role_definitions r
cross join public.permissions p
where r.id in ('role.platform_administrator', 'role.hr_admin_lead', 'role.hr_admin_assistant')
  and p.key in (
    'people.manpower.manage',
    'people.manpower.approve',
    'people.recruitment.manage',
    'people.competency.manage',
    'people.appraisal.manage'
  )
on conflict do nothing;

-- Project leaders can raise manpower requests and record site competency/certifications
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.role_definitions r
cross join public.permissions p
where r.id in ('role.project_engineer_lead', 'role.site_civil_engineer')
  and p.key in (
    'people.manpower.manage',
    'people.competency.manage'
  )
on conflict do nothing;
