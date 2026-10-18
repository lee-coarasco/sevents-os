-- 20261018000006_m15_inventory_stores.sql
-- M15: Inventory, Stores & Material Movement
-- Covers store locations, inventory items, stock ledger balances, GRNs, Material Issue Notes (MIN), and Material Gate Passes.

-- 1. Store Locations (Warehouses, Laydown Yards, Site Stores)
create table if not exists public.store_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  code text not null,
  name text not null,
  location_type text not null default 'site_store' check (location_type in ('central_warehouse', 'site_store', 'laydown_yard', 'scrap_yard')),
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_store_locations_code unique (tenant_id, code)
);

create index if not exists idx_store_locations_tenant on public.store_locations(tenant_id);
create index if not exists idx_store_locations_project on public.store_locations(project_id);

-- 2. Inventory Items Master
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  item_code text not null,
  name text not null,
  description text,
  category text not null default 'materials' check (category in ('materials', 'plant_spares', 'consumables', 'tools_ppe', 'safety_equipment')),
  uom text not null default 'NOS',
  reorder_level numeric(12, 2) not null default 0,
  unit_cost numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_inventory_items_code unique (tenant_id, item_code)
);

create index if not exists idx_inventory_items_tenant on public.inventory_items(tenant_id);

-- 3. Inventory Stock Balances (Location + Item + Bin)
create table if not exists public.inventory_stock_balances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null references public.store_locations(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  rack_bin text,
  quantity_on_hand numeric(14, 2) not null default 0 check (quantity_on_hand >= 0),
  quantity_reserved numeric(14, 2) not null default 0 check (quantity_reserved >= 0),
  last_counted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_stock_location_item_bin unique (tenant_id, location_id, item_id, rack_bin)
);

create index if not exists idx_inventory_stock_tenant on public.inventory_stock_balances(tenant_id);
create index if not exists idx_inventory_stock_location on public.inventory_stock_balances(location_id);
create index if not exists idx_inventory_stock_item on public.inventory_stock_balances(item_id);

-- 4. Goods Received Notes (GRN)
create table if not exists public.goods_received_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  po_id uuid references public.purchase_orders(id) on delete set null,
  location_id uuid not null references public.store_locations(id) on delete cascade,
  grn_number text not null,
  supplier_delivery_note text,
  carrier_name text,
  vehicle_number text,
  received_date date not null default current_date,
  status text not null default 'draft' check (status in ('draft', 'inspected', 'accepted', 'rejected')),
  received_by text,
  inspected_by text,
  inspection_notes text,
  general_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_grn_number unique (tenant_id, grn_number)
);

create index if not exists idx_grn_tenant on public.goods_received_notes(tenant_id);
create index if not exists idx_grn_project on public.goods_received_notes(project_id);
create index if not exists idx_grn_po on public.goods_received_notes(po_id);

-- 5. GRN Items
create table if not exists public.grn_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  grn_id uuid not null references public.goods_received_notes(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  po_item_id uuid references public.purchase_order_items(id) on delete set null,
  quantity_delivered numeric(12, 2) not null check (quantity_delivered > 0),
  quantity_accepted numeric(12, 2) not null default 0 check (quantity_accepted >= 0),
  quantity_rejected numeric(12, 2) not null default 0 check (quantity_rejected >= 0),
  rack_bin text,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_grn_items_grn on public.grn_items(grn_id);

-- 6. Material Issue Notes (MIN)
create table if not exists public.material_issue_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  location_id uuid not null references public.store_locations(id) on delete cascade,
  issue_number text not null,
  issue_date date not null default current_date,
  issued_to text not null, -- Subcontractor or site crew
  cost_code text,
  status text not null default 'draft' check (status in ('draft', 'issued', 'returned')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_min_number unique (tenant_id, issue_number)
);

create index if not exists idx_min_tenant on public.material_issue_notes(tenant_id);
create index if not exists idx_min_project on public.material_issue_notes(project_id);

-- 7. Material Issue Items
create table if not exists public.material_issue_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  issue_id uuid not null references public.material_issue_notes(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity_issued numeric(12, 2) not null check (quantity_issued > 0),
  quantity_returned numeric(12, 2) not null default 0 check (quantity_returned >= 0),
  rack_bin text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_min_items_issue on public.material_issue_items(issue_id);

-- 8. Material Gate Passes
create table if not exists public.material_gate_passes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  pass_number text not null,
  pass_type text not null default 'outbound' check (pass_type in ('inbound', 'outbound', 'transfer', 'returnable', 'disposal')),
  status text not null default 'draft' check (status in ('draft', 'approved', 'dispatched', 'closed')),
  vehicle_number text not null,
  driver_name text not null,
  driver_contact text,
  destination text not null,
  authorized_by text,
  exit_time timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_gate_pass_number unique (tenant_id, pass_number)
);

create index if not exists idx_gate_pass_tenant on public.material_gate_passes(tenant_id);
create index if not exists idx_gate_pass_project on public.material_gate_passes(project_id);

-- 9. Row-Level Security (RLS) Policies
alter table public.store_locations enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_stock_balances enable row level security;
alter table public.goods_received_notes enable row level security;
alter table public.grn_items enable row level security;
alter table public.material_issue_notes enable row level security;
alter table public.material_issue_items enable row level security;
alter table public.material_gate_passes enable row level security;

-- Policies for tenant isolation
create policy store_locations_tenant_isolation on public.store_locations
  for all using (tenant_id = public.current_tenant_id());

create policy inventory_items_tenant_isolation on public.inventory_items
  for all using (tenant_id = public.current_tenant_id());

create policy inventory_stock_tenant_isolation on public.inventory_stock_balances
  for all using (tenant_id = public.current_tenant_id());

create policy grn_tenant_isolation on public.goods_received_notes
  for all using (tenant_id = public.current_tenant_id());

create policy grn_items_tenant_isolation on public.grn_items
  for all using (tenant_id = public.current_tenant_id());

create policy min_tenant_isolation on public.material_issue_notes
  for all using (tenant_id = public.current_tenant_id());

create policy min_items_tenant_isolation on public.material_issue_items
  for all using (tenant_id = public.current_tenant_id());

create policy gate_pass_tenant_isolation on public.material_gate_passes
  for all using (tenant_id = public.current_tenant_id());

-- 10. Seed Permissions
insert into public.permissions (id, description) values
  ('inventory.store.manage', 'Create and update warehouse and site store locations'),
  ('inventory.item.manage', 'Create and manage inventory items catalog'),
  ('inventory.stock.view', 'View stock balances and warehouse inventory'),
  ('inventory.grn.manage', 'Create, inspect, and accept Goods Received Notes'),
  ('inventory.issue.manage', 'Create and issue material to site crews and work fronts'),
  ('inventory.gatepass.manage', 'Create, approve, and dispatch material gate passes')
on conflict (id) do nothing;

-- Assign to platform administrator role
insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions
where id in (
  'inventory.store.manage',
  'inventory.item.manage',
  'inventory.stock.view',
  'inventory.grn.manage',
  'inventory.issue.manage',
  'inventory.gatepass.manage'
)
on conflict do nothing;
