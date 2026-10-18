-- M14: Procurement, Requisitions & Purchase Orders (ticket 0161)
-- Vendors directory, Purchase Requisitions (PR), RFQ packages, and Purchase Orders (PO)

-- 1. Vendors (Approved Vendor List - AVL)
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  name text not null,
  trade_license_number text,
  tax_registration_number text,
  contact_person text,
  email text,
  phone text,
  address text,
  category text not null default 'materials' check (category in ('materials', 'plant_machinery', 'services', 'specialist_contractor')),
  rating numeric default 5.0 check (rating >= 1 and rating <= 5),
  status text not null default 'active' check (status in ('pending_kyc', 'active', 'suspended', 'blacklisted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vendors enable row level security;

create policy "vendors_tenant_isolation" on public.vendors
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 2. Purchase Requisitions (PR)
create table if not exists public.purchase_requisitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  project_id uuid not null references public.projects (id) on delete cascade,
  pr_number text not null,
  title text not null,
  required_date date not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'urgent')),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected', 'ordered', 'cancelled')),
  requested_by uuid references public.app_users (id),
  total_estimated_amount numeric not null default 0 check (total_estimated_amount >= 0),
  currency text not null default 'AED',
  notes text,
  approved_at timestamptz,
  approved_by uuid references public.app_users (id),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_project_pr_number unique (project_id, pr_number)
);

alter table public.purchase_requisitions enable row level security;

create policy "purchase_requisitions_tenant_isolation" on public.purchase_requisitions
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 3. Purchase Requisition Items
create table if not exists public.purchase_requisition_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  requisition_id uuid not null references public.purchase_requisitions (id) on delete cascade,
  item_description text not null,
  cost_code text,
  quantity numeric not null check (quantity > 0),
  uom text not null,
  estimated_unit_rate numeric default 0 check (estimated_unit_rate >= 0),
  estimated_total_amount numeric default 0 check (estimated_total_amount >= 0),
  schedule_activity_id uuid references public.schedule_activities (id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.purchase_requisition_items enable row level security;

create policy "purchase_requisition_items_tenant_isolation" on public.purchase_requisition_items
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 4. RFQ Packages
create table if not exists public.rfq_packages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  project_id uuid not null references public.projects (id) on delete cascade,
  requisition_id uuid references public.purchase_requisitions (id) on delete set null,
  rfq_number text not null,
  title text not null,
  issue_date date not null,
  due_date date not null,
  status text not null default 'draft' check (status in ('draft', 'issued', 'evaluated', 'awarded', 'closed')),
  scope_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_project_rfq_number unique (project_id, rfq_number)
);

alter table public.rfq_packages enable row level security;

create policy "rfq_packages_tenant_isolation" on public.rfq_packages
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 5. RFQ Vendor Quotes
create table if not exists public.rfq_vendors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  rfq_id uuid not null references public.rfq_packages (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  quoted_amount numeric check (quoted_amount is null or quoted_amount >= 0),
  submission_date date,
  compliance_status text not null default 'compliant' check (compliance_status in ('compliant', 'deviations', 'non_compliant')),
  notes text,
  created_at timestamptz not null default now(),
  constraint unique_rfq_vendor unique (rfq_id, vendor_id)
);

alter table public.rfq_vendors enable row level security;

create policy "rfq_vendors_tenant_isolation" on public.rfq_vendors
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 6. Purchase Orders (PO)
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  project_id uuid not null references public.projects (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  requisition_id uuid references public.purchase_requisitions (id) on delete set null,
  rfq_id uuid references public.rfq_packages (id) on delete set null,
  po_number text not null,
  order_date date not null,
  expected_delivery_date date,
  delivery_address text,
  payment_terms text,
  status text not null default 'draft' check (status in ('draft', 'issued', 'partially_delivered', 'delivered', 'closed', 'cancelled')),
  subtotal_amount numeric not null default 0 check (subtotal_amount >= 0),
  tax_amount numeric not null default 0 check (tax_amount >= 0),
  total_amount numeric not null default 0 check (total_amount >= 0),
  currency text not null default 'AED',
  approved_by uuid references public.app_users (id),
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_project_po_number unique (project_id, po_number)
);

alter table public.purchase_orders enable row level security;

create policy "purchase_orders_tenant_isolation" on public.purchase_orders
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 7. Purchase Order Line Items
create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  po_id uuid not null references public.purchase_orders (id) on delete cascade,
  item_description text not null,
  quantity numeric not null check (quantity > 0),
  uom text not null,
  unit_price numeric not null check (unit_price >= 0),
  total_amount numeric not null check (total_amount >= 0),
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'partial', 'delivered')),
  created_at timestamptz not null default now()
);

alter table public.purchase_order_items enable row level security;

create policy "purchase_order_items_tenant_isolation" on public.purchase_order_items
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Permissions
insert into public.permissions (id, description) values
  ('procurement.vendor.manage', 'Create, update, and manage approved vendor list (AVL)'),
  ('procurement.requisition.manage', 'Create, update, and submit purchase requisitions (PR)'),
  ('procurement.requisition.approve', 'Approve or reject purchase requisitions'),
  ('procurement.po.manage', 'Create, update, issue, and cancel purchase orders (PO)'),
  ('procurement.po.approve', 'Authorize and approve purchase orders')
on conflict (id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions
where id in (
  'procurement.vendor.manage',
  'procurement.requisition.manage',
  'procurement.requisition.approve',
  'procurement.po.manage',
  'procurement.po.approve'
)
on conflict do nothing;
