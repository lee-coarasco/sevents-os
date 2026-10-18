-- ============================================================================
-- M21: Finance, Budgets & Cost Control
-- ============================================================================

-- 1. Cost Codes Master
create table if not exists public.cost_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  category text not null check (category in ('materials', 'labour', 'subcontractor', 'equipment', 'overhead')),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_cost_codes_code unique (tenant_id, code)
);

create index if not exists idx_cost_codes_tenant on public.cost_codes(tenant_id);
create index if not exists idx_cost_codes_category on public.cost_codes(tenant_id, category);

alter table public.cost_codes enable row level security;

create policy cost_codes_tenant_isolation on public.cost_codes
  for all using (tenant_id = public.current_tenant_id());

-- 2. Project Budgets Master
create table if not exists public.project_budgets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  version_number integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'locked_baseline')),
  total_original_budget numeric(16, 2) not null default 0,
  total_revised_budget numeric(16, 2) not null default 0,
  approved_by text,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_project_budgets_version unique (tenant_id, project_id, version_number)
);

create index if not exists idx_project_budgets_tenant on public.project_budgets(tenant_id);
create index if not exists idx_project_budgets_project on public.project_budgets(tenant_id, project_id);

alter table public.project_budgets enable row level security;

create policy project_budgets_tenant_isolation on public.project_budgets
  for all using (tenant_id = public.current_tenant_id());

-- 3. Project Budget Lines (Cost Breakdown Structure)
create table if not exists public.project_budget_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  budget_id uuid not null references public.project_budgets(id) on delete cascade,
  cost_code_id uuid not null references public.cost_codes(id) on delete cascade,
  original_amount numeric(16, 2) not null default 0,
  revised_amount numeric(16, 2) not null default 0,
  committed_amount numeric(16, 2) not null default 0,
  actual_amount numeric(16, 2) not null default 0,
  accrued_amount numeric(16, 2) not null default 0,
  estimate_to_complete numeric(16, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_budget_lines_code unique (tenant_id, budget_id, cost_code_id)
);

create index if not exists idx_budget_lines_tenant on public.project_budget_lines(tenant_id);
create index if not exists idx_budget_lines_budget on public.project_budget_lines(budget_id);
create index if not exists idx_budget_lines_cost_code on public.project_budget_lines(cost_code_id);

alter table public.project_budget_lines enable row level security;

create policy budget_lines_tenant_isolation on public.project_budget_lines
  for all using (tenant_id = public.current_tenant_id());

-- 4. Budget Revisions & Reallocations
create table if not exists public.budget_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  revision_number text not null,
  from_cost_code_id uuid references public.cost_codes(id) on delete set null,
  to_cost_code_id uuid not null references public.cost_codes(id) on delete cascade,
  amount numeric(16, 2) not null check (amount > 0),
  reason text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
  requested_by text not null,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_budget_revisions_number unique (tenant_id, project_id, revision_number)
);

create index if not exists idx_budget_revisions_tenant on public.budget_revisions(tenant_id);
create index if not exists idx_budget_revisions_project on public.budget_revisions(tenant_id, project_id);

alter table public.budget_revisions enable row level security;

create policy budget_revisions_tenant_isolation on public.budget_revisions
  for all using (tenant_id = public.current_tenant_id());

-- 5. Expense Claims & Direct Costs
create table if not exists public.expense_claims (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  cost_code_id uuid not null references public.cost_codes(id) on delete cascade,
  claim_number text not null,
  claimant_name text not null,
  claim_date timestamptz not null default now(),
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'AED',
  description text not null,
  receipt_reference text,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'paid', 'rejected')),
  approved_by text,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_expense_claims_number unique (tenant_id, claim_number)
);

create index if not exists idx_expense_claims_tenant on public.expense_claims(tenant_id);
create index if not exists idx_expense_claims_project on public.expense_claims(tenant_id, project_id);
create index if not exists idx_expense_claims_status on public.expense_claims(tenant_id, status);

alter table public.expense_claims enable row level security;

create policy expense_claims_tenant_isolation on public.expense_claims
  for all using (tenant_id = public.current_tenant_id());

-- 6. Financial Periods & Governance
create table if not exists public.financial_periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  period_name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'open' check (status in ('open', 'closing_in_progress', 'closed')),
  closed_by text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_financial_periods_name unique (tenant_id, period_name)
);

create index if not exists idx_financial_periods_tenant on public.financial_periods(tenant_id);

alter table public.financial_periods enable row level security;

create policy financial_periods_tenant_isolation on public.financial_periods
  for all using (tenant_id = public.current_tenant_id());

-- 7. Seed Permissions
insert into public.permissions (id, description) values
  ('finance.budget.manage', 'Create and modify cost codes, project budgets, and budget lines'),
  ('finance.budget.approve', 'Approve project budgets and baseline lockings'),
  ('finance.forecast.manage', 'Submit and approve budget transfers, reforecasting, and contingency adjustments'),
  ('finance.expense.manage', 'Submit and edit employee expense claims and petty cash disbursements'),
  ('finance.expense.approve', 'Approve and mark expense claims as paid'),
  ('finance.period.manage', 'Manage financial accounting periods and close monthly ledger')
on conflict (id) do update set description = excluded.description;

-- Grant permissions to standard administrative and finance roles
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.role_definitions r
cross join public.permissions p
where r.id in ('role.platform_administrator', 'role.cfo', 'role.senior_accountant_lead', 'role.accountant')
  and p.id in (
    'finance.budget.manage',
    'finance.budget.approve',
    'finance.forecast.manage',
    'finance.expense.manage',
    'finance.expense.approve',
    'finance.period.manage'
  )
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.role_definitions r
cross join public.permissions p
where r.id in ('role.project_engineer_lead', 'role.quantity_surveyor')
  and p.id in (
    'finance.budget.manage',
    'finance.forecast.manage',
    'finance.expense.manage'
  )
on conflict do nothing;
