-- 20261018000007_m16_subcontractor_labour.sql
-- M16: Subcontractor & Labour Operations
-- Covers Subcontractor Work Orders, Milestones, Daily Attendance, Measured Works, and Payment Claims (with retention).

-- 1. Subcontractor Work Orders (Contracts / Work Packages)
create table if not exists public.subcontractor_work_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete set null,
  work_order_number text not null,
  title text not null,
  trade_discipline text not null default 'civil' check (trade_discipline in ('civil', 'mep', 'structural', 'finishes', 'piling', 'facade', 'landscape')),
  contract_value numeric(14, 2) not null default 0 check (contract_value >= 0),
  retention_rate_pct numeric(5, 2) not null default 10.0 check (retention_rate_pct >= 0 and retention_rate_pct <= 100),
  start_date date,
  completion_date date,
  status text not null default 'draft' check (status in ('draft', 'approved', 'active', 'completed', 'terminated')),
  scope_of_work text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_subcontractor_wo_number unique (tenant_id, work_order_number)
);

create index if not exists idx_subcontractor_wo_tenant on public.subcontractor_work_orders(tenant_id);
create index if not exists idx_subcontractor_wo_project on public.subcontractor_work_orders(project_id);
create index if not exists idx_subcontractor_wo_vendor on public.subcontractor_work_orders(vendor_id);

-- 2. Work Order Milestones
create table if not exists public.work_order_milestones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  work_order_id uuid not null references public.subcontractor_work_orders(id) on delete cascade,
  milestone_name text not null,
  description text,
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  planned_date date,
  status text not null default 'pending' check (status in ('pending', 'completed', 'certified')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_wo_milestones_tenant on public.work_order_milestones(tenant_id);
create index if not exists idx_wo_milestones_wo on public.work_order_milestones(work_order_id);

-- 3. Daily Attendance & Manpower Logs
create table if not exists public.subcontractor_attendance_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  work_order_id uuid not null references public.subcontractor_work_orders(id) on delete cascade,
  date date not null default current_date,
  trade text not null,
  skilled_count integer not null default 0 check (skilled_count >= 0),
  unskilled_count integer not null default 0 check (unskilled_count >= 0),
  total_hours numeric(6, 2) not null default 8.0 check (total_hours >= 0),
  supervisor_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subcontractor_att_tenant on public.subcontractor_attendance_logs(tenant_id);
create index if not exists idx_subcontractor_att_project on public.subcontractor_attendance_logs(project_id);
create index if not exists idx_subcontractor_att_wo on public.subcontractor_attendance_logs(work_order_id);

-- 4. Measured Work Progress (Field Quantity Certifications)
create table if not exists public.subcontractor_measured_works (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  work_order_id uuid not null references public.subcontractor_work_orders(id) on delete cascade,
  measurement_date date not null default current_date,
  wbs_code text,
  boq_item_reference text,
  description text not null,
  uom text not null default 'SQM',
  quantity_measured numeric(12, 2) not null default 0 check (quantity_measured >= 0),
  unit_rate numeric(14, 2) not null default 0 check (unit_rate >= 0),
  certified_amount numeric(14, 2) not null default 0 check (certified_amount >= 0),
  measured_by text,
  status text not null default 'draft' check (status in ('draft', 'verified', 'certified')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subcontractor_mw_tenant on public.subcontractor_measured_works(tenant_id);
create index if not exists idx_subcontractor_mw_wo on public.subcontractor_measured_works(work_order_id);

-- 5. Subcontractor Payment Claims & Interim Certificates
create table if not exists public.subcontractor_payment_claims (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  work_order_id uuid not null references public.subcontractor_work_orders(id) on delete cascade,
  claim_number text not null,
  period_start date not null,
  period_end date not null,
  claimed_amount numeric(14, 2) not null default 0 check (claimed_amount >= 0),
  certified_amount numeric(14, 2) not null default 0 check (certified_amount >= 0),
  retention_deducted numeric(14, 2) not null default 0 check (retention_deducted >= 0),
  net_payable_amount numeric(14, 2) not null default 0 check (net_payable_amount >= 0),
  status text not null default 'submitted' check (status in ('submitted', 'under_review', 'certified', 'paid')),
  submitted_at timestamptz not null default now(),
  certified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_subcontractor_claim_number unique (tenant_id, claim_number)
);

create index if not exists idx_subcontractor_claims_tenant on public.subcontractor_payment_claims(tenant_id);
create index if not exists idx_subcontractor_claims_project on public.subcontractor_payment_claims(project_id);
create index if not exists idx_subcontractor_claims_wo on public.subcontractor_payment_claims(work_order_id);

-- 6. Enable Row Level Security (RLS)
alter table public.subcontractor_work_orders enable row level security;
alter table public.work_order_milestones enable row level security;
alter table public.subcontractor_attendance_logs enable row level security;
alter table public.subcontractor_measured_works enable row level security;
alter table public.subcontractor_payment_claims enable row level security;

-- 7. Multi-tenant RLS Policies
create policy subcontractor_wo_tenant_isolation on public.subcontractor_work_orders
  for all using (tenant_id = public.current_tenant_id());

create policy wo_milestones_tenant_isolation on public.work_order_milestones
  for all using (tenant_id = public.current_tenant_id());

create policy subcontractor_attendance_tenant_isolation on public.subcontractor_attendance_logs
  for all using (tenant_id = public.current_tenant_id());

create policy subcontractor_mw_tenant_isolation on public.subcontractor_measured_works
  for all using (tenant_id = public.current_tenant_id());

create policy subcontractor_claims_tenant_isolation on public.subcontractor_payment_claims
  for all using (tenant_id = public.current_tenant_id());

-- 8. Seed Permissions
insert into public.permissions (key, description) values
  ('subcontractor.workorder.manage', 'Create, update, and approve subcontractor work packages and orders'),
  ('subcontractor.workorder.view', 'View subcontractor work orders, agreements, and milestones'),
  ('subcontractor.attendance.manage', 'Record and verify daily subcontractor manpower and attendance'),
  ('subcontractor.claims.manage', 'Submit and review subcontractor measured work and payment claims'),
  ('subcontractor.claims.certify', 'Certify subcontractor progress claims, retention, and payment certificates')
on conflict (key) do nothing;

-- 9. Assign Permissions to Platform Administrator
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'role.platform_administrator'
  and p.key in (
    'subcontractor.workorder.manage',
    'subcontractor.workorder.view',
    'subcontractor.attendance.manage',
    'subcontractor.claims.manage',
    'subcontractor.claims.certify'
  )
on conflict do nothing;
