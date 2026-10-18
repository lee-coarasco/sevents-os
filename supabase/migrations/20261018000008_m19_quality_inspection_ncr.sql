-- 20261018000008_m19_quality_inspection_ncr.sql
-- M19: Quality, Inspection & NCR
-- Covers Inspection and Test Plans (ITP), Work Inspection Requests (WIR / RFI), Checklist Items, and Non-Conformance Reports (NCR) with CAPA.

-- 1. Quality Inspection & Test Plans (ITP)
create table if not exists public.quality_inspection_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  plan_number text not null,
  title text not null,
  trade_discipline text not null default 'civil' check (trade_discipline in ('civil', 'mep', 'structural', 'finishes', 'piling', 'facade')),
  version text not null default 'v1.0',
  status text not null default 'draft' check (status in ('draft', 'approved', 'archived')),
  applicable_specifications text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_quality_plan_number unique (tenant_id, plan_number)
);

create index if not exists idx_quality_plans_tenant on public.quality_inspection_plans(tenant_id);
create index if not exists idx_quality_plans_project on public.quality_inspection_plans(project_id);

-- 2. ITP Inspection Checkpoint Items
create table if not exists public.itp_inspection_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.quality_inspection_plans(id) on delete cascade,
  item_sequence integer not null default 1,
  activity_name text not null,
  acceptance_criteria text not null,
  point_type text not null default 'hold_point' check (point_type in ('hold_point', 'witness_point', 'surveillance', 'review')),
  reference_standard text,
  verifying_document text,
  created_at timestamptz not null default now()
);

create index if not exists idx_itp_items_tenant on public.itp_inspection_items(tenant_id);
create index if not exists idx_itp_items_plan on public.itp_inspection_items(plan_id);

-- 3. Work Inspection Requests (WIR / RFI)
create table if not exists public.work_inspection_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  plan_id uuid references public.quality_inspection_plans(id) on delete set null,
  wir_number text not null,
  title text not null,
  trade_discipline text not null default 'civil' check (trade_discipline in ('civil', 'mep', 'structural', 'finishes', 'piling', 'facade')),
  location_or_grid text not null,
  inspection_date date not null default current_date,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'in_progress', 'approved', 'conditionally_approved', 'rejected')),
  contractor_representative text,
  inspector_name text,
  inspector_remarks text,
  signed_off_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_wir_number unique (tenant_id, wir_number)
);

create index if not exists idx_wir_tenant on public.work_inspection_requests(tenant_id);
create index if not exists idx_wir_project on public.work_inspection_requests(project_id);
create index if not exists idx_wir_plan on public.work_inspection_requests(plan_id);

-- 4. WIR Checklist Items
create table if not exists public.wir_checklist_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  wir_id uuid not null references public.work_inspection_requests(id) on delete cascade,
  item_sequence integer not null default 1,
  checkpoint_description text not null,
  result text not null default 'pending' check (result in ('pending', 'pass', 'fail', 'na')),
  comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_wir_checklist_tenant on public.wir_checklist_items(tenant_id);
create index if not exists idx_wir_checklist_wir on public.wir_checklist_items(wir_id);

-- 5. Non-Conformance Reports (NCR)
create table if not exists public.non_conformance_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  wir_id uuid references public.work_inspection_requests(id) on delete set null,
  ncr_number text not null,
  title text not null,
  trade_discipline text not null default 'civil' check (trade_discipline in ('civil', 'mep', 'structural', 'finishes', 'piling', 'facade')),
  location_or_grid text not null,
  severity text not null default 'minor' check (severity in ('minor', 'major', 'critical')),
  status text not null default 'open' check (status in ('open', 'under_review', 'containment_applied', 'capa_submitted', 'verified_closed', 'voided')),
  issue_description text not null,
  root_cause_category text not null default 'workmanship' check (root_cause_category in ('workmanship', 'material_defect', 'design_clash', 'method_deviation', 'environmental')),
  issued_by text not null,
  issued_to text not null,
  target_closure_date date,
  containment_action text,
  corrective_action_plan text,
  preventive_action_plan text,
  closed_by text,
  closed_at timestamptz,
  closure_remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_ncr_number unique (tenant_id, ncr_number)
);

create index if not exists idx_ncr_tenant on public.non_conformance_reports(tenant_id);
create index if not exists idx_ncr_project on public.non_conformance_reports(project_id);
create index if not exists idx_ncr_wir on public.non_conformance_reports(wir_id);

-- 6. Enable Row-Level Security
alter table public.quality_inspection_plans enable row level security;
alter table public.itp_inspection_items enable row level security;
alter table public.work_inspection_requests enable row level security;
alter table public.wir_checklist_items enable row level security;
alter table public.non_conformance_reports enable row level security;

-- 7. RLS Policies (Tenant Isolation)
create policy quality_plans_tenant_isolation on public.quality_inspection_plans
  for all using (tenant_id = public.current_tenant_id());

create policy itp_items_tenant_isolation on public.itp_inspection_items
  for all using (tenant_id = public.current_tenant_id());

create policy wir_tenant_isolation on public.work_inspection_requests
  for all using (tenant_id = public.current_tenant_id());

create policy wir_checklist_tenant_isolation on public.wir_checklist_items
  for all using (tenant_id = public.current_tenant_id());

create policy ncr_tenant_isolation on public.non_conformance_reports
  for all using (tenant_id = public.current_tenant_id());

-- 8. Seed Permissions in permissions table (id, description)
insert into public.permissions (id, description) values
  ('quality.itp.manage', 'Create, update, and approve quality inspection and test plans (ITP)'),
  ('quality.inspection.manage', 'Create and submit work inspection requests (WIR/RFI) and checklist items'),
  ('quality.inspection.signoff', 'Execute quality inspection sign-off (pass, conditional, or rejection)'),
  ('quality.ncr.manage', 'Issue, update, and submit CAPA responses for Non-Conformance Reports (NCR)'),
  ('quality.ncr.close', 'Verify and formally close Non-Conformance Reports (NCR)')
on conflict (id) do nothing;

-- 9. Assign Permissions to Platform Administrator & QHSE Engineer
insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions
where id in (
  'quality.itp.manage',
  'quality.inspection.manage',
  'quality.inspection.signoff',
  'quality.ncr.manage',
  'quality.ncr.close'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'role.qhse_engineer', id from public.permissions
where id in (
  'quality.itp.manage',
  'quality.inspection.manage',
  'quality.inspection.signoff',
  'quality.ncr.manage',
  'quality.ncr.close'
)
on conflict do nothing;
