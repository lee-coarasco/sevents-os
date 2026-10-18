-- Migration: 20261019000003_m23_contracts_claims_variations_eot.sql
-- M23 Contracts, Claims, Variations & EOT
-- Implements Contract Repository & Obligations, Variation Orders (VO),
-- Claims & Extension of Time (EOT 28-day notice), and Securities Register (Bonds & Insurance).

-- 1. Contract Repository
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  contract_reference text not null,
  title text not null,
  contract_type text not null default 'main_contract' check (contract_type in ('main_contract', 'subcontract', 'consultancy', 'joint_venture')),
  counterparty_name text not null,
  original_value numeric(14, 2) not null check (original_value >= 0),
  revised_value numeric(14, 2) not null check (revised_value >= 0),
  signed_date date,
  commencement_date date not null,
  contractual_completion_date date not null,
  revised_completion_date date not null,
  governing_law text not null default 'UAE Law / FIDIC 1999 Red Book',
  status text not null default 'active' check (status in ('draft', 'executed', 'active', 'suspended', 'terminated', 'closed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_contracts_ref unique (tenant_id, contract_reference)
);

create index if not exists idx_contracts_tenant on public.contracts(tenant_id);
create index if not exists idx_contracts_project on public.contracts(tenant_id, project_id);
create index if not exists idx_contracts_status on public.contracts(tenant_id, status);

alter table public.contracts enable row level security;

create policy contracts_tenant_isolation on public.contracts
  for all using (tenant_id = public.current_tenant_id());

-- 2. Variation Orders & Change Management
create table if not exists public.variation_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  vo_number text not null,
  title text not null,
  description text not null,
  reason text not null default 'client_request' check (reason in ('client_request', 'site_instruction', 'design_change', 'unforeseen_conditions', 'value_engineering')),
  proposed_cost_amount numeric(14, 2) not null default 0.00,
  proposed_time_days integer not null default 0,
  approved_cost_amount numeric(14, 2) not null default 0.00,
  approved_time_days integer not null default 0,
  status text not null default 'identified' check (status in ('identified', 'pricing', 'submitted', 'approved', 'rejected')),
  approved_by text,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_variation_orders_num unique (tenant_id, vo_number)
);

create index if not exists idx_variation_orders_tenant on public.variation_orders(tenant_id);
create index if not exists idx_variation_orders_contract on public.variation_orders(tenant_id, contract_id);
create index if not exists idx_variation_orders_status on public.variation_orders(tenant_id, status);

alter table public.variation_orders enable row level security;

create policy variation_orders_tenant_isolation on public.variation_orders
  for all using (tenant_id = public.current_tenant_id());

-- 3. Claims & Extension of Time (EOT)
create table if not exists public.contract_claims (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  claim_number text not null,
  title text not null,
  event_type text not null default 'employer_delay' check (event_type in ('employer_delay', 'late_access', 'design_revision', 'adverse_weather', 'force_majeure', 'suspension')),
  event_date date not null,
  notice_date date not null,
  notice_deadline_date date not null,
  particulars_submitted_date date,
  claimed_days integer not null default 0,
  claimed_cost_amount numeric(14, 2) not null default 0.00,
  certified_days integer not null default 0,
  certified_cost_amount numeric(14, 2) not null default 0.00,
  status text not null default 'notice_issued' check (status in ('notice_issued', 'particulars_submitted', 'under_assessment', 'approved', 'partially_approved', 'rejected', 'disputed')),
  assessment_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_contract_claims_num unique (tenant_id, claim_number)
);

create index if not exists idx_contract_claims_tenant on public.contract_claims(tenant_id);
create index if not exists idx_contract_claims_contract on public.contract_claims(tenant_id, contract_id);
create index if not exists idx_contract_claims_status on public.contract_claims(tenant_id, status);

alter table public.contract_claims enable row level security;

create policy contract_claims_tenant_isolation on public.contract_claims
  for all using (tenant_id = public.current_tenant_id());

-- 4. Bonds, Guarantees & Insurance (Securities Register)
create table if not exists public.contract_securities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  security_type text not null check (security_type in ('performance_bond', 'advance_payment_guarantee', 'retention_bond', 'car_insurance', 'third_party_liability', 'workmen_compensation')),
  reference_number text not null,
  issuing_institution text not null,
  beneficiary text not null,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'AED',
  effective_date date not null,
  expiry_date date not null,
  status text not null default 'active' check (status in ('active', 'expired', 'called', 'released')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_contract_securities_ref unique (tenant_id, reference_number)
);

create index if not exists idx_contract_securities_tenant on public.contract_securities(tenant_id);
create index if not exists idx_contract_securities_contract on public.contract_securities(tenant_id, contract_id);
create index if not exists idx_contract_securities_status on public.contract_securities(tenant_id, status);

alter table public.contract_securities enable row level security;

create policy contract_securities_tenant_isolation on public.contract_securities
  for all using (tenant_id = public.current_tenant_id());

-- 5. Seed Permissions
insert into public.permissions (id, description) values
  ('contracts.contract.manage', 'Register and edit construction contracts and obligations'),
  ('contracts.variation.manage', 'Identify, price, and submit variation orders and scope changes'),
  ('contracts.variation.approve', 'Authorize and approve variation orders and contract value adjustments'),
  ('contracts.claim.manage', 'Issue contractual notices of claim and submit EOT particulars'),
  ('contracts.claim.assess', 'Assess, certify, or dispute time extension and prolongation claims'),
  ('contracts.security.manage', 'Manage performance bonds, APG bank guarantees, and insurance policies')
on conflict (id) do update set description = excluded.description;

-- Grant permissions to standard administrative, legal, commercial, and engineering roles
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.role_definitions r
cross join public.permissions p
where r.id in ('role.platform_administrator', 'role.clo', 'role.legal_counsel_lead', 'role.contracts_legal_assistant', 'role.cfo')
  and p.id in (
    'contracts.contract.manage',
    'contracts.variation.manage',
    'contracts.variation.approve',
    'contracts.claim.manage',
    'contracts.claim.assess',
    'contracts.security.manage'
  )
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.role_definitions r
cross join public.permissions p
where r.id in ('role.quantity_surveyor', 'role.project_engineer_lead')
  and p.id in (
    'contracts.contract.manage',
    'contracts.variation.manage',
    'contracts.claim.manage',
    'contracts.claim.assess',
    'contracts.security.manage'
  )
on conflict do nothing;
