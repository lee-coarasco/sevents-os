-- Migration: 20261019000006_m27_legal_licences_regulatory_register.sql
-- Module: M27 Legal, Licences & Regulatory Register
-- Multi-tenant isolation enforced via tenant_id = public.current_tenant_id()

-- 1. LICENCES & PERMITS REGISTER
create table if not exists public.licences_permits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  licence_name text not null,
  licence_number text not null,
  category text not null check (category in ('trade_licence', 'civil_defense', 'municipality_permit', 'environmental', 'road_transport', 'customs', 'other')),
  issuing_authority text not null,
  issue_date date not null,
  expiry_date date not null,
  renewal_lead_days integer not null default 30,
  status text not null default 'active' check (status in ('active', 'expiring_soon', 'expired', 'under_renewal', 'suspended')),
  responsible_officer text not null,
  renewal_cost numeric(14, 2) default 0,
  document_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_licences_permits_tenant_expiry on public.licences_permits (tenant_id, expiry_date);
create index if not exists idx_licences_permits_status on public.licences_permits (tenant_id, status);

alter table public.licences_permits enable row level security;

create policy "licences_permits_tenant_isolation"
  on public.licences_permits
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 2. LEGAL MATTERS & DISPUTES
create table if not exists public.legal_matters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  matter_reference text not null,
  title text not null,
  matter_type text not null check (matter_type in ('arbitration', 'litigation', 'adjudication', 'mediation', 'labor_claim', 'regulatory_investigation')),
  court_or_tribunal text not null,
  claim_amount numeric(14, 2) not null default 0,
  currency text not null default 'AED',
  opposing_party text not null,
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high', 'critical')),
  access_class text not null default 'internal' check (access_class in ('public', 'internal', 'privileged_confidential')),
  internal_counsel text not null,
  status text not null default 'open' check (status in ('open', 'pleadings', 'hearing', 'settled', 'judgment_awarded', 'closed')),
  summary text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_legal_matters_tenant_status on public.legal_matters (tenant_id, status);
create index if not exists idx_legal_matters_risk on public.legal_matters (tenant_id, risk_level);

alter table public.legal_matters enable row level security;

create policy "legal_matters_tenant_isolation"
  on public.legal_matters
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 3. EXTERNAL COUNSEL & ADVISORS
create table if not exists public.external_counsel (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  firm_name text not null,
  lead_attorney text not null,
  email text,
  phone text,
  specialization text not null,
  fee_arrangement text not null check (fee_arrangement in ('hourly', 'fixed_fee', 'capped', 'contingency')),
  budget_amount numeric(14, 2) not null default 0,
  billed_amount numeric(14, 2) not null default 0,
  currency text not null default 'AED',
  status text not null default 'active' check (status in ('active', 'concluded', 'terminated')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_external_counsel_tenant on public.external_counsel (tenant_id, status);

alter table public.external_counsel enable row level security;

create policy "external_counsel_tenant_isolation"
  on public.external_counsel
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 4. REGULATORY COMPLIANCE OBLIGATIONS & FILINGS
create table if not exists public.compliance_obligations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  obligation_name text not null,
  regulatory_body text not null,
  frequency text not null check (frequency in ('monthly', 'quarterly', 'semi_annual', 'annual', 'ad_hoc')),
  deadline_date date not null,
  compliance_owner text not null,
  status text not null default 'pending' check (status in ('pending', 'filed', 'exempt', 'overdue')),
  evidence_reference text,
  filing_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_compliance_obligations_tenant_deadline on public.compliance_obligations (tenant_id, deadline_date);

alter table public.compliance_obligations enable row level security;

create policy "compliance_obligations_tenant_isolation"
  on public.compliance_obligations
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 5. PERMISSIONS & ROLE ASSIGNMENTS
insert into public.permissions (id, description) values
  ('legal.licence.manage', 'Register and manage corporate and site licences and permits'),
  ('legal.licence.renew', 'Record and certify licence renewal applications and payments'),
  ('legal.matter.manage', 'Create and update legal matters and dispute records'),
  ('legal.matter.view_privileged', 'View privileged and strictly confidential legal dispute records'),
  ('legal.counsel.manage', 'Manage retained external law firms and advisory billing'),
  ('legal.compliance.manage', 'Track and file statutory regulatory compliance obligations')
on conflict (id) do nothing;

-- Seed role permissions using public.role_definitions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.role_definitions r
cross join public.permissions p
where r.id in ('role.platform_administrator', 'role.clo', 'role.legal_counsel_lead', 'role.contracts_legal_assistant')
  and p.id in (
    'legal.licence.manage',
    'legal.licence.renew',
    'legal.matter.manage',
    'legal.matter.view_privileged',
    'legal.counsel.manage',
    'legal.compliance.manage'
  )
on conflict do nothing;
