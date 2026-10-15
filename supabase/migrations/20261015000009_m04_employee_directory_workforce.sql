-- M04: Employee Directory & Workforce (ticket 0064)
--
-- BRD §6.2 entities for this module: EmployeeRecord, Skill,
-- Certification, TrainingRecord. RecruitmentRequest/Candidate/Offer/
-- LeaveRecord belong to M24 (later) and are not built here. Payroll is
-- explicitly out of scope per the module description ("can be phased
-- separately").
--
-- All tables here are ordinary tenant-owned business data (NOT NULL
-- tenant_id, same pattern as companies/branches/projects) — unlike
-- role_definitions/permissions/the work-item catalogue, there is no
-- shared cross-tenant copy of a company's employees.

create table public.employee_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  company_id uuid not null references public.companies (id),
  -- Not every employee has system access, hence nullable. Where present,
  -- it's a 1:1 link (partial unique index below).
  app_user_id uuid references public.app_users (id),
  employee_code text not null,
  full_name text not null,
  department_id uuid references public.department_definitions (id),
  reporting_role_id text references public.role_definitions (id),
  -- Exact status values aren't specified anywhere in BRD/PRD beyond the
  -- module one-liner ("employment status"); these four are the minimal
  -- set the one-liner implies (active, on leave, suspended, offboarded).
  -- Not an HR policy invention — just the lifecycle states this table
  -- needs to exist at all.
  employment_status text not null default 'active'
    check (employment_status in ('active', 'on_leave', 'suspended', 'offboarded')),
  emergency_contact_name text,
  emergency_contact_phone text,
  onboarded_at date,
  offboarded_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_records_tenant_code_unique unique (tenant_id, employee_code)
);

create unique index employee_records_app_user_id_key on public.employee_records (app_user_id)
  where app_user_id is not null;

alter table public.employee_records enable row level security;

create policy "employee_records_tenant_isolation" on public.employee_records
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Tenant-defined lists, not a shared canonical catalogue like
-- role_definitions — each company names its own skills/certifications.
create table public.skills (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  name text not null,
  created_at timestamptz not null default now(),
  constraint skills_tenant_name_unique unique (tenant_id, name)
);

alter table public.skills enable row level security;

create policy "skills_tenant_isolation" on public.skills
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table public.employee_skills (
  employee_id uuid not null references public.employee_records (id),
  skill_id uuid not null references public.skills (id),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  -- No rating scale invented (CLAUDE.md: don't fabricate business rules
  -- that aren't specified) — free text until a real scale is requested.
  proficiency_note text,
  created_at timestamptz not null default now(),
  primary key (employee_id, skill_id)
);

alter table public.employee_skills enable row level security;

create policy "employee_skills_tenant_isolation" on public.employee_skills
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table public.certifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  name text not null,
  issuing_body text,
  created_at timestamptz not null default now(),
  constraint certifications_tenant_name_unique unique (tenant_id, name)
);

alter table public.certifications enable row level security;

create policy "certifications_tenant_isolation" on public.certifications
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- The one real business rule this ticket needs: training validity via
-- expiry date. issued_at/expires_at are dates, not timestamps — a
-- certificate's validity is a calendar-day concept, not time-of-day.
create table public.employee_certifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  employee_id uuid not null references public.employee_records (id),
  certification_id uuid not null references public.certifications (id),
  issued_at date not null,
  -- Null = does not expire.
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_certifications_date_range check (expires_at is null or expires_at >= issued_at)
);

create index employee_certifications_employee_idx on public.employee_certifications (employee_id);

alter table public.employee_certifications enable row level security;

create policy "employee_certifications_tenant_isolation" on public.employee_certifications
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Minimal: a directory record of training taken, not a full LMS (course
-- content, enrollment workflow, etc. are out of scope).
create table public.training_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  employee_id uuid not null references public.employee_records (id),
  course_name text not null,
  completed_at date not null,
  -- Free text (e.g. "pass"/"fail"/a score) — no fixed result enum
  -- invented, same reasoning as proficiency_note above.
  result text,
  created_at timestamptz not null default now()
);

create index training_records_employee_idx on public.training_records (employee_id);

alter table public.training_records enable row level security;

create policy "training_records_tenant_isolation" on public.training_records
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Effective-dated like ticket 0056's role_assignments: a new allocation
-- is a new row with its own validity window, history is never
-- overwritten by mutating an old row's dates.
create table public.employee_project_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  employee_id uuid not null references public.employee_records (id),
  project_id uuid not null references public.projects (id),
  site_assignment text,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_by uuid references public.app_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_project_allocations_valid_range check (valid_to is null or valid_to > valid_from)
);

create index employee_project_allocations_employee_idx on public.employee_project_allocations (employee_id);

alter table public.employee_project_allocations enable row level security;

create policy "employee_project_allocations_tenant_isolation" on public.employee_project_allocations
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- employee.directory.manage covers every admin CRUD/attach operation in
-- this module. Self-service ("read my own record") needs no new
-- permission — same "is this your own row" exemption used for
-- GET /identity/audit-log and GET /authority/effective-permissions.
insert into public.permissions (id, description) values
  ('employee.directory.manage', 'Create, update and manage employee directory records, skills, certifications, training and project allocations');

insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions
where id in ('employee.directory.manage');
