-- M02: Company, Branch, Project & Tenant Setup (ticket 0055)
--
-- Tenant is the top-level isolation boundary. Company/LegalEntity/Branch
-- belong to exactly one Tenant. From this migration forward, every
-- tenant-owned table carries tenant_id and an RLS policy scoping it to
-- the caller's own tenant (CLAUDE.md: "Tenant isolation via Supabase
-- Row-Level Security on every table").
--
-- No column in this migration has a country-specific default (tax rate,
-- statutory ID format, etc.) — CLAUDE.md business rules forbid assuming
-- GST/VAT/any one country's invoice or statutory-ID format in the
-- generic core.

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tenants enable row level security;

-- Tenant creation/renaming is an admin (service-role) operation, not a
-- self-service one — no insert/update/delete policy is defined for
-- anon/authenticated, so only a caller's own tenant is even visible.
create policy "tenants_select_own" on public.tenants
  for select
  using (id = (select tenant_id from public.app_users where id = auth.uid()));

-- Retrofit ticket 0054's app_users with tenant_id: additive, nullable,
-- no existing row/column is altered or dropped.
alter table public.app_users
  add column tenant_id uuid references public.tenants (id);

create index app_users_tenant_id_idx on public.app_users (tenant_id);

-- Shared by every tenant-owned table's RLS policy below, so the "what
-- tenant is the caller in" lookup lives in one place.
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.app_users where id = auth.uid();
$$;

create table public.legal_entities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  name text not null,
  -- Country-agnostic: nullable, no default, no country-specific format
  -- check. Populate per-country via a localization config pack later.
  statutory_id text,
  incorporation_country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.legal_entities enable row level security;

create policy "legal_entities_tenant_isolation" on public.legal_entities
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  legal_entity_id uuid references public.legal_entities (id),
  legal_name text not null,
  preferred_language text,
  reporting_currency text,
  fiscal_year_start_month smallint check (fiscal_year_start_month between 1 and 12),
  -- Data, not hard-coded module flags, so M33 Master Data can manage it.
  enabled_modules jsonb not null default '[]'::jsonb,
  -- VAT is configurable, never defaulted (CLAUDE.md: "do not apply a
  -- default rate"); activation requires finance-owner sign-off per
  -- docs/PRD.md open decision #2, tracked separately, not here.
  statutory_id text,
  vat_registration_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.companies enable row level security;

create policy "companies_tenant_isolation" on public.companies
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  company_id uuid not null references public.companies (id),
  name text not null,
  operating_region text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.branches enable row level security;

create policy "branches_tenant_isolation" on public.branches
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Minimal project register for Phase 1's "basic project administration
-- works" exit criterion. The full Project/WBS/budget/milestone model is
-- M09 (Phase 3) — do not extend this table here.
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  company_id uuid not null references public.companies (id),
  name text not null,
  code text,
  status text not null default 'active' check (status in ('active', 'on_hold', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "projects_tenant_isolation" on public.projects
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- File metadata only — the binary itself lives in Supabase Storage.
-- project_id is nullable: a file may be attached to a company-level
-- record instead of a project.
create table public.file_objects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  company_id uuid not null references public.companies (id),
  project_id uuid references public.projects (id),
  bucket text not null,
  storage_path text not null,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid references public.app_users (id),
  created_at timestamptz not null default now()
);

alter table public.file_objects enable row level security;

create policy "file_objects_tenant_isolation" on public.file_objects
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
