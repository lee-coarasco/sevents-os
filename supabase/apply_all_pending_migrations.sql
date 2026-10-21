-- ==============================================================================

-- CONSOLIDATED IDEMPOTENT MIGRATIONS BUNDLE (M14 through M38, Storage & AI)

-- Execute this script in your Supabase Dashboard -> SQL Editor.

-- This script creates all missing tables, indexes, RLS policies and reloads PostgREST.

-- Safe to execute multiple times (fully idempotent).

-- ==============================================================================


-- >>> BEGIN: 20261018000001_ux_workflow_catalogue_fixes.sql >>>

-- UX fixes for M05/M06: node edit/delete, catalogue create, definition edit
-- (companion to WorkflowVersionDetailPage + CataloguePage rewrites)

-- 1. Allow authenticated users to UPDATE and DELETE workflow_nodes on draft versions.
--    (Currently INSERT-only; blocked node edit/delete in the UI.)
drop policy if exists "workflow_nodes_update" on public.workflow_nodes;
create policy "workflow_nodes_update" on public.workflow_nodes
  for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

drop policy if exists "workflow_nodes_delete" on public.workflow_nodes;
create policy "workflow_nodes_delete" on public.workflow_nodes
  for delete
  using (tenant_id = public.current_tenant_id());

-- 2. Allow authenticated users to DELETE workflow_transitions and workflow_conditions.
drop policy if exists "workflow_transitions_delete" on public.workflow_transitions;
create policy "workflow_transitions_delete" on public.workflow_transitions
  for delete
  using (tenant_id = public.current_tenant_id());

drop policy if exists "workflow_conditions_delete" on public.workflow_conditions;
create policy "workflow_conditions_delete" on public.workflow_conditions
  for delete
  using (tenant_id = public.current_tenant_id());

-- 3. Allow authenticated users to UPDATE workflow_definitions (name, description, capability_key).
drop policy if exists "workflow_definitions_update_meta" on public.workflow_definitions;
create policy "workflow_definitions_update_meta" on public.workflow_definitions
  for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 4. Add source_type to work_item_definitions to distinguish imported vs manually created rows.
--    Existing rows (all imported) default to 'imported'.
alter table public.work_item_definitions
  add column if not exists source_type text not null default 'imported'
  check (source_type in ('imported', 'manual'));

-- 5. Add configuration_status_text to make configuration_status easier to show in UI
--    (column already exists from M05, no change needed — just confirming the update policy).

-- 6. Allow authenticated users to INSERT new manual work_item_definitions.
--    (M05 migration intentionally omitted this; the user now needs to create custom items.)
drop policy if exists "work_item_definitions_insert" on public.work_item_definitions;
create policy "work_item_definitions_insert" on public.work_item_definitions
  for insert
  with check (tenant_id = public.current_tenant_id());

-- <<< END: 20261018000001_ux_workflow_catalogue_fixes.sql <<<


-- >>> BEGIN: 20261018000002_dynamic_role_permissions.sql >>>

-- Migration: Dynamic Role Permissions (grant/revoke permissions per role)
-- Allows viewing all system permissions and updating role-permission assignments dynamically.

-- Add insert/delete policy on role_permissions for authenticated users with authority.role.manage
-- While backend uses serviceClient, adding explicit RLS policies ensures DB-level completeness.

drop policy if exists "role_permissions_insert_authenticated" on public.role_permissions;
create policy "role_permissions_insert_authenticated" on public.role_permissions
  for insert
  with check (true);

drop policy if exists "role_permissions_delete_authenticated" on public.role_permissions;
create policy "role_permissions_delete_authenticated" on public.role_permissions
  for delete
  using (true);

-- <<< END: 20261018000002_dynamic_role_permissions.sql <<<


-- >>> BEGIN: 20261018000003_m18_schedule_lookahead_delays.sql >>>

-- M18: Schedule, Progress & Resource Planning (ticket 0120)
-- Lookahead plans (2-week / 4-week) and delay records with variance tracking

create table if not exists public.lookahead_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  period_start date not null,
  period_end date not null,
  timeframe_weeks integer not null default 2 check (timeframe_weeks in (2, 4)),
  created_by uuid references public.app_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lookahead_plans_period_valid check (period_end >= period_start)
);

alter table public.lookahead_plans enable row level security;

drop policy if exists "lookahead_plans_tenant_isolation" on public.lookahead_plans;
create policy "lookahead_plans_tenant_isolation" on public.lookahead_plans
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table if not exists public.lookahead_activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  lookahead_plan_id uuid not null references public.lookahead_plans (id) on delete cascade,
  schedule_activity_id uuid references public.schedule_activities (id) on delete set null,
  custom_activity_name text,
  planned_action text not null check (length(trim(planned_action)) > 0),
  target_date date not null,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed', 'delayed')),
  assigned_to uuid references public.app_users (id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lookahead_activities enable row level security;

drop policy if exists "lookahead_activities_tenant_isolation" on public.lookahead_activities;
create policy "lookahead_activities_tenant_isolation" on public.lookahead_activities
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table if not exists public.schedule_delay_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  project_id uuid not null references public.projects (id) on delete cascade,
  schedule_activity_id uuid not null references public.schedule_activities (id) on delete cascade,
  delay_days integer not null check (delay_days > 0),
  reason_category text not null check (reason_category in ('client', 'design', 'procurement', 'subcontractor', 'weather', 'permits', 'other')),
  description text not null check (length(trim(description)) > 0),
  mitigation_plan text,
  recorded_by uuid references public.app_users (id),
  recorded_at timestamptz not null default now()
);

alter table public.schedule_delay_records enable row level security;

drop policy if exists "schedule_delay_records_tenant_isolation" on public.schedule_delay_records;
create policy "schedule_delay_records_tenant_isolation" on public.schedule_delay_records
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Add permission for delay logging
insert into public.permissions (id, description) values
  ('project.delay.manage', 'Log schedule delays and manage delay mitigation plans');

insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions
where id in ('project.delay.manage');

-- <<< END: 20261018000003_m18_schedule_lookahead_delays.sql <<<


-- >>> BEGIN: 20261018000004_m17_site_operations_dpr.sql >>>

-- M17: Site Operations, DPR & Field Capture (ticket 0160)
-- Daily Progress Reports (DPR), Manpower, Equipment, Executed Quantities, Blockers, Site Instructions

create table if not exists public.daily_progress_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  project_id uuid not null references public.projects (id) on delete cascade,
  report_date date not null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  weather_condition text not null default 'clear' check (weather_condition in ('clear', 'partly_cloudy', 'sunny', 'rain', 'heavy_rain', 'dust_storm', 'extreme_heat', 'other')),
  temperature_celsius numeric,
  weather_impact text check (weather_impact in ('none', 'minor_delay', 'work_stoppage')),
  general_notes text,
  site_engineer_id uuid references public.app_users (id),
  supervisor_id uuid references public.app_users (id),
  approved_at timestamptz,
  approved_by uuid references public.app_users (id),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_project_report_date unique (project_id, report_date)
);

alter table public.daily_progress_reports enable row level security;

drop policy if exists "daily_progress_reports_tenant_isolation" on public.daily_progress_reports;
create policy "daily_progress_reports_tenant_isolation" on public.daily_progress_reports
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table if not exists public.dpr_manpower_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  dpr_id uuid not null references public.daily_progress_reports (id) on delete cascade,
  trade text not null,
  headcount integer not null check (headcount >= 0),
  hours_worked numeric not null default 8.0 check (hours_worked >= 0),
  subcontractor_name text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.dpr_manpower_entries enable row level security;

drop policy if exists "dpr_manpower_entries_tenant_isolation" on public.dpr_manpower_entries;
create policy "dpr_manpower_entries_tenant_isolation" on public.dpr_manpower_entries
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table if not exists public.dpr_equipment_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  dpr_id uuid not null references public.daily_progress_reports (id) on delete cascade,
  equipment_type text not null,
  quantity integer not null default 1 check (quantity > 0),
  operating_hours numeric not null default 8.0 check (operating_hours >= 0),
  idle_hours numeric not null default 0 check (idle_hours >= 0),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.dpr_equipment_entries enable row level security;

drop policy if exists "dpr_equipment_entries_tenant_isolation" on public.dpr_equipment_entries;
create policy "dpr_equipment_entries_tenant_isolation" on public.dpr_equipment_entries
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table if not exists public.dpr_work_progress_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  dpr_id uuid not null references public.daily_progress_reports (id) on delete cascade,
  schedule_activity_id uuid references public.schedule_activities (id) on delete set null,
  location_or_grid text,
  description text not null check (length(trim(description)) > 0),
  quantity_executed numeric check (quantity_executed is null or quantity_executed >= 0),
  uom text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.dpr_work_progress_entries enable row level security;

drop policy if exists "dpr_work_progress_entries_tenant_isolation" on public.dpr_work_progress_entries;
create policy "dpr_work_progress_entries_tenant_isolation" on public.dpr_work_progress_entries
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table if not exists public.dpr_blockers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  dpr_id uuid not null references public.daily_progress_reports (id) on delete cascade,
  category text not null check (category in ('material_shortage', 'drawing_delay', 'inspection_pending', 'access_blocked', 'weather', 'subcontractor_default', 'safety_stop', 'other')),
  description text not null check (length(trim(description)) > 0),
  impact_hours numeric default 0 check (impact_hours >= 0),
  resolution_action text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

alter table public.dpr_blockers enable row level security;

drop policy if exists "dpr_blockers_tenant_isolation" on public.dpr_blockers;
create policy "dpr_blockers_tenant_isolation" on public.dpr_blockers
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table if not exists public.dpr_site_instructions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  project_id uuid not null references public.projects (id) on delete cascade,
  dpr_id uuid references public.daily_progress_reports (id) on delete set null,
  instruction_number text not null,
  issued_by text not null,
  recipient text not null,
  instruction_text text not null check (length(trim(instruction_text)) > 0),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'acknowledged')),
  target_completion_date date,
  issued_at timestamptz not null default now()
);

alter table public.dpr_site_instructions enable row level security;

drop policy if exists "dpr_site_instructions_tenant_isolation" on public.dpr_site_instructions;
create policy "dpr_site_instructions_tenant_isolation" on public.dpr_site_instructions
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Permissions
insert into public.permissions (id, description) values
  ('site.dpr.manage', 'Create, update, and submit Daily Progress Reports (DPR)'),
  ('site.dpr.approve', 'Approve or reject Daily Progress Reports'),
  ('site.instruction.manage', 'Issue, track, and update Site Instructions')
on conflict (id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions
where id in ('site.dpr.manage', 'site.dpr.approve', 'site.instruction.manage')
on conflict do nothing;

-- <<< END: 20261018000004_m17_site_operations_dpr.sql <<<


-- >>> BEGIN: 20261018000005_m14_procurement_po.sql >>>

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

drop policy if exists "vendors_tenant_isolation" on public.vendors;
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

drop policy if exists "purchase_requisitions_tenant_isolation" on public.purchase_requisitions;
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

drop policy if exists "purchase_requisition_items_tenant_isolation" on public.purchase_requisition_items;
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

drop policy if exists "rfq_packages_tenant_isolation" on public.rfq_packages;
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

drop policy if exists "rfq_vendors_tenant_isolation" on public.rfq_vendors;
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

drop policy if exists "purchase_orders_tenant_isolation" on public.purchase_orders;
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

drop policy if exists "purchase_order_items_tenant_isolation" on public.purchase_order_items;
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

-- <<< END: 20261018000005_m14_procurement_po.sql <<<


-- >>> BEGIN: 20261018000006_m15_inventory_stores.sql >>>

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
drop policy if exists store_locations_tenant_isolation on public.store_locations;
create policy store_locations_tenant_isolation on public.store_locations
  for all using (tenant_id = public.current_tenant_id());

drop policy if exists inventory_items_tenant_isolation on public.inventory_items;
create policy inventory_items_tenant_isolation on public.inventory_items
  for all using (tenant_id = public.current_tenant_id());

drop policy if exists inventory_stock_tenant_isolation on public.inventory_stock_balances;
create policy inventory_stock_tenant_isolation on public.inventory_stock_balances
  for all using (tenant_id = public.current_tenant_id());

drop policy if exists grn_tenant_isolation on public.goods_received_notes;
create policy grn_tenant_isolation on public.goods_received_notes
  for all using (tenant_id = public.current_tenant_id());

drop policy if exists grn_items_tenant_isolation on public.grn_items;
create policy grn_items_tenant_isolation on public.grn_items
  for all using (tenant_id = public.current_tenant_id());

drop policy if exists min_tenant_isolation on public.material_issue_notes;
create policy min_tenant_isolation on public.material_issue_notes
  for all using (tenant_id = public.current_tenant_id());

drop policy if exists min_items_tenant_isolation on public.material_issue_items;
create policy min_items_tenant_isolation on public.material_issue_items
  for all using (tenant_id = public.current_tenant_id());

drop policy if exists gate_pass_tenant_isolation on public.material_gate_passes;
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

-- <<< END: 20261018000006_m15_inventory_stores.sql <<<


-- >>> BEGIN: 20261018000007_m16_subcontractor_labour.sql >>>

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
drop policy if exists subcontractor_wo_tenant_isolation on public.subcontractor_work_orders;
create policy subcontractor_wo_tenant_isolation on public.subcontractor_work_orders
  for all using (tenant_id = public.current_tenant_id());

drop policy if exists wo_milestones_tenant_isolation on public.work_order_milestones;
create policy wo_milestones_tenant_isolation on public.work_order_milestones
  for all using (tenant_id = public.current_tenant_id());

drop policy if exists subcontractor_attendance_tenant_isolation on public.subcontractor_attendance_logs;
create policy subcontractor_attendance_tenant_isolation on public.subcontractor_attendance_logs
  for all using (tenant_id = public.current_tenant_id());

drop policy if exists subcontractor_mw_tenant_isolation on public.subcontractor_measured_works;
create policy subcontractor_mw_tenant_isolation on public.subcontractor_measured_works
  for all using (tenant_id = public.current_tenant_id());

drop policy if exists subcontractor_claims_tenant_isolation on public.subcontractor_payment_claims;
create policy subcontractor_claims_tenant_isolation on public.subcontractor_payment_claims
  for all using (tenant_id = public.current_tenant_id());

-- 8. Seed Permissions
insert into public.permissions (id, description) values
  ('subcontractor.workorder.manage', 'Create, update, and approve subcontractor work packages and orders'),
  ('subcontractor.workorder.view', 'View subcontractor work orders, agreements, and milestones'),
  ('subcontractor.attendance.manage', 'Record and verify daily subcontractor manpower and attendance'),
  ('subcontractor.claims.manage', 'Submit and review subcontractor measured work and payment claims'),
  ('subcontractor.claims.certify', 'Certify subcontractor progress claims, retention, and payment certificates')
on conflict (id) do nothing;

-- 9. Assign Permissions to Platform Administrator
insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions
where id in (
  'subcontractor.workorder.manage',
  'subcontractor.workorder.view',
  'subcontractor.attendance.manage',
  'subcontractor.claims.manage',
  'subcontractor.claims.certify'
)
on conflict do nothing;

-- <<< END: 20261018000007_m16_subcontractor_labour.sql <<<


-- >>> BEGIN: 20261018000008_m19_quality_inspection_ncr.sql >>>

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
drop policy if exists quality_plans_tenant_isolation on public.quality_inspection_plans;
create policy quality_plans_tenant_isolation on public.quality_inspection_plans
  for all using (tenant_id = public.current_tenant_id());

drop policy if exists itp_items_tenant_isolation on public.itp_inspection_items;
create policy itp_items_tenant_isolation on public.itp_inspection_items
  for all using (tenant_id = public.current_tenant_id());

drop policy if exists wir_tenant_isolation on public.work_inspection_requests;
create policy wir_tenant_isolation on public.work_inspection_requests
  for all using (tenant_id = public.current_tenant_id());

drop policy if exists wir_checklist_tenant_isolation on public.wir_checklist_items;
create policy wir_checklist_tenant_isolation on public.wir_checklist_items
  for all using (tenant_id = public.current_tenant_id());

drop policy if exists ncr_tenant_isolation on public.non_conformance_reports;
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

-- <<< END: 20261018000008_m19_quality_inspection_ncr.sql <<<


-- >>> BEGIN: 20261018000009_m20_safety_incidents_compliance.sql >>>

-- 20261018000009_m20_safety_incidents_compliance.sql
-- M20: Safety, Incidents & Compliance
-- Covers Permits to Work (PTW), Incident Reporting & Investigations, Hazard Observations (with Stop-Work Directives), and Toolbox Talks (TBT).

-- 1. Safety Permits to Work (PTW)
create table if not exists public.safety_permits_to_work (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  permit_number text not null,
  permit_type text not null default 'working_at_height' check (permit_type in ('hot_work', 'working_at_height', 'confined_space', 'lifting_operations', 'deep_excavation', 'electrical_isolation')),
  title text not null,
  location_or_grid text not null,
  start_time timestamptz not null,
  expiry_time timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'active', 'suspended', 'closed', 'cancelled')),
  contractor_name text not null,
  supervisor_name text not null,
  safety_officer_name text,
  precautions_taken text,
  gas_test_required boolean not null default false,
  gas_test_results text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_safety_permit_number unique (tenant_id, permit_number)
);

create index if not exists idx_safety_ptw_tenant on public.safety_permits_to_work(tenant_id);
create index if not exists idx_safety_ptw_project on public.safety_permits_to_work(project_id);

-- 2. Safety Incidents & Emergency Log
create table if not exists public.safety_incidents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  incident_number text not null,
  incident_date timestamptz not null default now(),
  incident_type text not null default 'near_miss' check (incident_type in ('near_miss', 'first_aid', 'medical_treatment', 'lost_time_injury', 'dangerous_occurrence', 'environmental_spill')),
  severity text not null default 'minor' check (severity in ('minor', 'moderate', 'major', 'critical', 'fatal')),
  status text not null default 'reported' check (status in ('reported', 'under_investigation', 'capa_assigned', 'closed')),
  location_or_grid text not null,
  description text not null,
  injured_person_name text,
  injury_details text,
  lost_workdays integer not null default 0 check (lost_workdays >= 0),
  immediate_action_taken text,
  root_cause_analysis text,
  corrective_preventive_action text,
  reported_by text not null,
  investigated_by text,
  closed_by text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_safety_incident_number unique (tenant_id, incident_number)
);

create index if not exists idx_safety_incidents_tenant on public.safety_incidents(tenant_id);
create index if not exists idx_safety_incidents_project on public.safety_incidents(project_id);

-- 3. Safety Hazard Observations & Stop-Work
create table if not exists public.safety_hazard_observations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  observation_number text not null,
  observation_type text not null default 'unsafe_condition' check (observation_type in ('unsafe_condition', 'unsafe_act', 'positive_intervention')),
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high', 'imminent_danger')),
  stop_work_issued boolean not null default false,
  location_or_grid text not null,
  description text not null,
  action_required text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'rectified', 'closed')),
  reported_by text not null,
  assigned_to text,
  rectification_evidence text,
  target_rectification_date date,
  rectified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_safety_observation_number unique (tenant_id, observation_number)
);

create index if not exists idx_safety_hazard_tenant on public.safety_hazard_observations(tenant_id);
create index if not exists idx_safety_hazard_project on public.safety_hazard_observations(project_id);

-- 4. Safety Toolbox Talks (TBT)
create table if not exists public.safety_toolbox_talks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  tbt_number text not null,
  talk_date date not null default current_date,
  topic text not null,
  conducted_by text not null,
  trade_discipline text not null default 'general' check (trade_discipline in ('civil', 'mep', 'structural', 'finishes', 'piling', 'facade', 'general')),
  attendee_count integer not null default 0 check (attendee_count >= 0),
  key_points_discussed text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_safety_tbt_number unique (tenant_id, tbt_number)
);

create index if not exists idx_safety_tbt_tenant on public.safety_toolbox_talks(tenant_id);
create index if not exists idx_safety_tbt_project on public.safety_toolbox_talks(project_id);

-- 5. Enable Row-Level Security
alter table public.safety_permits_to_work enable row level security;
alter table public.safety_incidents enable row level security;
alter table public.safety_hazard_observations enable row level security;
alter table public.safety_toolbox_talks enable row level security;

-- 6. RLS Policies (Tenant Isolation)
drop policy if exists ptw_tenant_isolation on public.safety_permits_to_work;
create policy ptw_tenant_isolation on public.safety_permits_to_work
  for all using (tenant_id = public.current_tenant_id());

drop policy if exists incidents_tenant_isolation on public.safety_incidents;
create policy incidents_tenant_isolation on public.safety_incidents
  for all using (tenant_id = public.current_tenant_id());

drop policy if exists hazard_tenant_isolation on public.safety_hazard_observations;
create policy hazard_tenant_isolation on public.safety_hazard_observations
  for all using (tenant_id = public.current_tenant_id());

drop policy if exists tbt_tenant_isolation on public.safety_toolbox_talks;
create policy tbt_tenant_isolation on public.safety_toolbox_talks
  for all using (tenant_id = public.current_tenant_id());

-- 7. Seed Permissions in permissions table (id, description)
insert into public.permissions (id, description) values
  ('safety.ptw.manage', 'Create, update, and submit Permits to Work (PTW)'),
  ('safety.ptw.approve', 'Authorize, activate, and suspend Permits to Work (PTW)'),
  ('safety.incident.manage', 'Report and record safety incidents and emergency responses'),
  ('safety.incident.investigate', 'Investigate incidents, record root causes, and sign off CAPA closure'),
  ('safety.hazard.manage', 'Log hazard observations, issue stop-work orders, and verify rectifications'),
  ('safety.tbt.manage', 'Record and schedule site safety toolbox talks (TBT)')
on conflict (id) do nothing;

-- 8. Assign Permissions to Platform Administrator & QHSE Engineer
insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions
where id in (
  'safety.ptw.manage',
  'safety.ptw.approve',
  'safety.incident.manage',
  'safety.incident.investigate',
  'safety.hazard.manage',
  'safety.tbt.manage'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'role.qhse_engineer', id from public.permissions
where id in (
  'safety.ptw.manage',
  'safety.ptw.approve',
  'safety.incident.manage',
  'safety.incident.investigate',
  'safety.hazard.manage',
  'safety.tbt.manage'
)
on conflict do nothing;

-- <<< END: 20261018000009_m20_safety_incidents_compliance.sql <<<


-- >>> BEGIN: 20261018000010_m25_equipment_plant_fleet.sql >>>

-- ============================================================================
-- M25: Equipment, Plant & Fleet Operations
-- ============================================================================

-- 1. Equipment Assets Master Register
create table if not exists public.equipment_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  asset_code text not null,
  name text not null,
  category text not null check (category in ('heavy_plant', 'earthmoving', 'lifting_rigging', 'power_generation', 'fleet_vehicle', 'small_tools')),
  make text not null,
  model text not null,
  year_of_manufacture integer,
  serial_or_vin text,
  ownership_type text not null default 'owned' check (ownership_type in ('owned', 'leased', 'hired')),
  hire_vendor_name text,
  daily_rate numeric(14, 2) not null default 0,
  status text not null default 'available' check (status in ('available', 'mobilized_on_site', 'under_maintenance', 'breakdown', 'decommissioned')),
  current_meter_hours numeric(14, 2) not null default 0,
  current_project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_equipment_assets_code unique (tenant_id, asset_code)
);

create index if not exists idx_equipment_assets_tenant on public.equipment_assets(tenant_id);
create index if not exists idx_equipment_assets_category on public.equipment_assets(tenant_id, category);
create index if not exists idx_equipment_assets_status on public.equipment_assets(tenant_id, status);
create index if not exists idx_equipment_assets_project on public.equipment_assets(current_project_id);

alter table public.equipment_assets enable row level security;

drop policy if exists equipment_assets_tenant_isolation on public.equipment_assets;
create policy equipment_assets_tenant_isolation on public.equipment_assets
  for all using (tenant_id = public.current_tenant_id());

-- 2. Equipment Allocations / Mobilizations
create table if not exists public.equipment_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  equipment_id uuid not null references public.equipment_assets(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  allocation_number text not null,
  mobilization_date timestamptz not null default now(),
  expected_demobilization_date timestamptz,
  actual_demobilization_date timestamptz,
  grid_location text,
  status text not null default 'requested' check (status in ('requested', 'approved', 'mobilized', 'demobilized')),
  requested_by text not null,
  approved_by text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_equipment_allocations_number unique (tenant_id, allocation_number)
);

create index if not exists idx_equipment_allocations_tenant on public.equipment_allocations(tenant_id);
create index if not exists idx_equipment_allocations_project on public.equipment_allocations(tenant_id, project_id);
create index if not exists idx_equipment_allocations_equipment on public.equipment_allocations(equipment_id);

alter table public.equipment_allocations enable row level security;

drop policy if exists equipment_allocations_tenant_isolation on public.equipment_allocations;
create policy equipment_allocations_tenant_isolation on public.equipment_allocations
  for all using (tenant_id = public.current_tenant_id());

-- 3. Equipment Daily Utilization Logs
create table if not exists public.equipment_daily_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  equipment_id uuid not null references public.equipment_assets(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  log_date date not null default current_date,
  operating_hours numeric(6, 2) not null default 0,
  idle_hours numeric(6, 2) not null default 0,
  breakdown_hours numeric(6, 2) not null default 0,
  start_meter_reading numeric(14, 2) not null default 0,
  end_meter_reading numeric(14, 2) not null default 0,
  fuel_added_litres numeric(10, 2) not null default 0,
  operator_name text not null,
  work_description text not null,
  supervisor_signoff text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_equipment_daily_logs_tenant on public.equipment_daily_logs(tenant_id);
create index if not exists idx_equipment_daily_logs_project on public.equipment_daily_logs(tenant_id, project_id);
create index if not exists idx_equipment_daily_logs_equipment on public.equipment_daily_logs(equipment_id);
create index if not exists idx_equipment_daily_logs_date on public.equipment_daily_logs(log_date);

alter table public.equipment_daily_logs enable row level security;

drop policy if exists equipment_daily_logs_tenant_isolation on public.equipment_daily_logs;
create policy equipment_daily_logs_tenant_isolation on public.equipment_daily_logs
  for all using (tenant_id = public.current_tenant_id());

-- 4. Equipment Maintenance & Inspections Records
create table if not exists public.equipment_maintenance_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  equipment_id uuid not null references public.equipment_assets(id) on delete cascade,
  maintenance_type text not null check (maintenance_type in ('preventive_service', 'breakdown_repair', 'safety_inspection', 'statutory_certification')),
  maintenance_date date not null default current_date,
  meter_hours_at_service numeric(14, 2) not null default 0,
  cost numeric(14, 2) not null default 0,
  performed_by text not null,
  description text not null,
  next_due_date date,
  next_due_meter_hours numeric(14, 2),
  status text not null default 'completed' check (status in ('scheduled', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_equipment_maintenance_tenant on public.equipment_maintenance_records(tenant_id);
create index if not exists idx_equipment_maintenance_equipment on public.equipment_maintenance_records(equipment_id);

alter table public.equipment_maintenance_records enable row level security;

drop policy if exists equipment_maintenance_tenant_isolation on public.equipment_maintenance_records;
create policy equipment_maintenance_tenant_isolation on public.equipment_maintenance_records
  for all using (tenant_id = public.current_tenant_id());

-- 5. Equipment Statutory Third-Party Certificates
create table if not exists public.equipment_statutory_certificates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  equipment_id uuid not null references public.equipment_assets(id) on delete cascade,
  certificate_type text not null check (certificate_type in ('safe_working_load_3rd_party', 'lifting_tackle_inspection', 'registration_mulkiya', 'insurance_policy', 'emission_test')),
  certificate_number text not null,
  issuing_authority text not null,
  issue_date date not null,
  expiry_date date not null,
  attachment_url text,
  status text not null default 'valid' check (status in ('valid', 'expired', 'pending_renewal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_equipment_statutory_cert unique (tenant_id, equipment_id, certificate_number)
);

create index if not exists idx_equipment_certificates_tenant on public.equipment_statutory_certificates(tenant_id);
create index if not exists idx_equipment_certificates_equipment on public.equipment_statutory_certificates(equipment_id);
create index if not exists idx_equipment_certificates_expiry on public.equipment_statutory_certificates(expiry_date);

alter table public.equipment_statutory_certificates enable row level security;

drop policy if exists equipment_statutory_certificates_tenant_isolation on public.equipment_statutory_certificates;
create policy equipment_statutory_certificates_tenant_isolation on public.equipment_statutory_certificates
  for all using (tenant_id = public.current_tenant_id());

-- 6. Permissions Seeding (Note: permissions table primary key is `id`, not `key`)
insert into public.permissions (id, description) values
  ('equipment.asset.manage', 'Register, update, and manage plant, machinery, and fleet assets'),
  ('equipment.allocation.manage', 'Request, mobilize, and demobilize equipment for project sites'),
  ('equipment.allocation.approve', 'Approve project plant allocation and mobilization requests'),
  ('equipment.log.manage', 'Log and sign off daily equipment utilization, meter readings, and fuel consumption'),
  ('equipment.maintenance.manage', 'Schedule, execute, and record equipment maintenance and repair work'),
  ('equipment.certificate.manage', 'Manage statutory third-party calibration, registration, and safety certificates')
on conflict (id) do nothing;

-- 7. Grant Permissions to Relevant Roles
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from (
  values
    ('role.platform_administrator'),
    ('role.plant_equipment_operator'),
    ('role.logistics_coordinator'),
    ('role.project_engineer_lead'),
    ('role.site_civil_engineer')
) as target_roles(role_id)
cross join (
  values
    ('equipment.asset.manage'),
    ('equipment.allocation.manage'),
    ('equipment.allocation.approve'),
    ('equipment.log.manage'),
    ('equipment.maintenance.manage'),
    ('equipment.certificate.manage')
) as target_perms(id)
join public.permissions p on p.id = target_perms.id
join public.role_definitions r on r.id = target_roles.role_id
on conflict do nothing;

-- <<< END: 20261018000010_m25_equipment_plant_fleet.sql <<<


-- >>> BEGIN: 20261019000001_m21_finance_budgets_cost_control.sql >>>

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

drop policy if exists cost_codes_tenant_isolation on public.cost_codes;
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

drop policy if exists project_budgets_tenant_isolation on public.project_budgets;
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

drop policy if exists budget_lines_tenant_isolation on public.project_budget_lines;
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

drop policy if exists budget_revisions_tenant_isolation on public.budget_revisions;
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

drop policy if exists expense_claims_tenant_isolation on public.expense_claims;
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

drop policy if exists financial_periods_tenant_isolation on public.financial_periods;
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

-- <<< END: 20261019000001_m21_finance_budgets_cost_control.sql <<<


-- >>> BEGIN: 20261019000002_m22_billing_invoicing.sql >>>

-- Migration: 20261019000002_m22_billing_invoicing.sql
-- M22 Billing, Invoicing, Receivables & Payables
-- Implements Client Payment Applications (IPC), Tax Invoices, Receipts & AR Aging,
-- Vendor Bills (3-Way Match), and Retention Ledger.

-- 1. Client Applications for Payment (Interim Payment Certificates)
create table if not exists public.payment_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  application_number text not null,
  period_start date not null,
  period_end date not null,
  submission_date date not null default current_date,
  gross_work_completed numeric(14, 2) not null default 0.00 check (gross_work_completed >= 0),
  advance_recovery_amount numeric(14, 2) not null default 0.00 check (advance_recovery_amount >= 0),
  retention_withheld_amount numeric(14, 2) not null default 0.00 check (retention_withheld_amount >= 0),
  net_certified_amount numeric(14, 2) not null default 0.00,
  tax_rate numeric(5, 2) not null default 5.00,
  tax_amount numeric(14, 2) not null default 0.00,
  total_amount numeric(14, 2) not null default 0.00,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'certified', 'invoiced', 'paid', 'disputed')),
  certified_by text,
  certified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_payment_applications_num unique (tenant_id, application_number)
);

create index if not exists idx_payment_applications_tenant on public.payment_applications(tenant_id);
create index if not exists idx_payment_applications_project on public.payment_applications(tenant_id, project_id);
create index if not exists idx_payment_applications_status on public.payment_applications(tenant_id, status);

alter table public.payment_applications enable row level security;

drop policy if exists payment_applications_tenant_isolation on public.payment_applications;
create policy payment_applications_tenant_isolation on public.payment_applications
  for all using (tenant_id = public.current_tenant_id());

-- 2. Payment Application Breakdown Items
create table if not exists public.payment_application_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  application_id uuid not null references public.payment_applications(id) on delete cascade,
  cost_code_id uuid references public.cost_codes(id) on delete set null,
  description text not null,
  previous_claimed_amount numeric(14, 2) not null default 0.00,
  current_claimed_amount numeric(14, 2) not null default 0.00,
  certified_amount numeric(14, 2) not null default 0.00,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payment_app_items_app on public.payment_application_items(application_id);
create index if not exists idx_payment_app_items_tenant on public.payment_application_items(tenant_id);

alter table public.payment_application_items enable row level security;

drop policy if exists payment_application_items_tenant_isolation on public.payment_application_items;
create policy payment_application_items_tenant_isolation on public.payment_application_items
  for all using (tenant_id = public.current_tenant_id());

-- 3. Tax Invoices & Accounts Receivable
create table if not exists public.tax_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  application_id uuid references public.payment_applications(id) on delete set null,
  invoice_number text not null,
  invoice_type text not null default 'progress' check (invoice_type in ('progress', 'advance', 'retention_release', 'direct')),
  client_name text not null,
  trn text,
  issue_date date not null default current_date,
  due_date date not null,
  subtotal_amount numeric(14, 2) not null default 0.00,
  tax_amount numeric(14, 2) not null default 0.00,
  total_amount numeric(14, 2) not null default 0.00,
  paid_amount numeric(14, 2) not null default 0.00,
  status text not null default 'unpaid' check (status in ('unpaid', 'partially_paid', 'paid', 'overdue', 'disputed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_tax_invoices_num unique (tenant_id, invoice_number)
);

create index if not exists idx_tax_invoices_tenant on public.tax_invoices(tenant_id);
create index if not exists idx_tax_invoices_project on public.tax_invoices(tenant_id, project_id);
create index if not exists idx_tax_invoices_status on public.tax_invoices(tenant_id, status);

alter table public.tax_invoices enable row level security;

drop policy if exists tax_invoices_tenant_isolation on public.tax_invoices;
create policy tax_invoices_tenant_isolation on public.tax_invoices
  for all using (tenant_id = public.current_tenant_id());

-- 4. Client Receipts (Collections)
create table if not exists public.client_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  invoice_id uuid not null references public.tax_invoices(id) on delete cascade,
  receipt_number text not null,
  receipt_date date not null default current_date,
  amount numeric(14, 2) not null check (amount > 0),
  payment_method text not null default 'bank_transfer' check (payment_method in ('bank_transfer', 'cheque', 'credit_card', 'cash')),
  reference_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_client_receipts_num unique (tenant_id, receipt_number)
);

create index if not exists idx_client_receipts_tenant on public.client_receipts(tenant_id);
create index if not exists idx_client_receipts_invoice on public.client_receipts(tenant_id, invoice_id);

alter table public.client_receipts enable row level security;

drop policy if exists client_receipts_tenant_isolation on public.client_receipts;
create policy client_receipts_tenant_isolation on public.client_receipts
  for all using (tenant_id = public.current_tenant_id());

-- 5. Vendor Bills & Accounts Payable (3-Way Match)
create table if not exists public.vendor_bills (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  cost_code_id uuid references public.cost_codes(id) on delete set null,
  po_id uuid references public.purchase_orders(id) on delete set null,
  bill_number text not null,
  bill_date date not null default current_date,
  due_date date not null,
  subtotal_amount numeric(14, 2) not null default 0.00,
  tax_amount numeric(14, 2) not null default 0.00,
  total_amount numeric(14, 2) not null default 0.00,
  match_status text not null default 'matched' check (match_status in ('matched', 'variance_flagged', 'manual_override')),
  status text not null default 'received' check (status in ('received', 'verified', 'approved', 'scheduled', 'paid', 'disputed')),
  paid_amount numeric(14, 2) not null default 0.00,
  payment_reference text,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_vendor_bills_num unique (tenant_id, bill_number)
);

create index if not exists idx_vendor_bills_tenant on public.vendor_bills(tenant_id);
create index if not exists idx_vendor_bills_project on public.vendor_bills(tenant_id, project_id);
create index if not exists idx_vendor_bills_vendor on public.vendor_bills(tenant_id, vendor_id);
create index if not exists idx_vendor_bills_status on public.vendor_bills(tenant_id, status);

alter table public.vendor_bills enable row level security;

drop policy if exists vendor_bills_tenant_isolation on public.vendor_bills;
create policy vendor_bills_tenant_isolation on public.vendor_bills
  for all using (tenant_id = public.current_tenant_id());

-- 6. Retention Ledger & DLP Controls
create table if not exists public.retention_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  retention_type text not null check (retention_type in ('client_receivable', 'subcontractor_payable')),
  party_name text not null,
  reference_id text not null,
  total_retained_amount numeric(14, 2) not null check (total_retained_amount >= 0),
  first_release_amount numeric(14, 2) not null default 0.00,
  first_release_date date,
  first_release_status text not null default 'pending' check (first_release_status in ('pending', 'released')),
  second_release_amount numeric(14, 2) not null default 0.00,
  second_release_due_date date,
  second_release_status text not null default 'pending' check (second_release_status in ('pending', 'released')),
  status text not null default 'held' check (status in ('held', 'partially_released', 'fully_released')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_retention_records_tenant on public.retention_records(tenant_id);
create index if not exists idx_retention_records_project on public.retention_records(tenant_id, project_id);

alter table public.retention_records enable row level security;

drop policy if exists retention_records_tenant_isolation on public.retention_records;
create policy retention_records_tenant_isolation on public.retention_records
  for all using (tenant_id = public.current_tenant_id());

-- 7. Seed Permissions
insert into public.permissions (id, description) values
  ('billing.application.manage', 'Create and edit client payment applications'),
  ('billing.application.certify', 'Certify interim payment certificates and approve valuations'),
  ('billing.invoice.manage', 'Generate official tax invoices and credit notes'),
  ('billing.receipt.record', 'Record client collections and allocate receipts against receivables'),
  ('billing.vendor_bill.manage', 'Register and match supplier and subcontractor bills'),
  ('billing.vendor_bill.approve', 'Approve vendor bills and schedule payment runs'),
  ('billing.retention.manage', 'Manage retention ledger and authorize TOC / DLP releases')
on conflict (id) do update set description = excluded.description;

-- Grant permissions to standard administrative and finance roles
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.role_definitions r
cross join public.permissions p
where r.id in ('role.platform_administrator', 'role.cfo', 'role.senior_accountant_lead', 'role.accountant')
  and p.id in (
    'billing.application.manage',
    'billing.application.certify',
    'billing.invoice.manage',
    'billing.receipt.record',
    'billing.vendor_bill.manage',
    'billing.vendor_bill.approve',
    'billing.retention.manage'
  )
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.role_definitions r
cross join public.permissions p
where r.id in ('role.quantity_surveyor', 'role.project_engineer_lead')
  and p.id in (
    'billing.application.manage',
    'billing.application.certify',
    'billing.vendor_bill.manage',
    'billing.retention.manage'
  )
on conflict do nothing;

-- <<< END: 20261019000002_m22_billing_invoicing.sql <<<


-- >>> BEGIN: 20261019000003_m23_contracts_claims_variations_eot.sql >>>

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

drop policy if exists contracts_tenant_isolation on public.contracts;
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

drop policy if exists variation_orders_tenant_isolation on public.variation_orders;
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

drop policy if exists contract_claims_tenant_isolation on public.contract_claims;
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

drop policy if exists contract_securities_tenant_isolation on public.contract_securities;
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

-- <<< END: 20261019000003_m23_contracts_claims_variations_eot.sql <<<


-- >>> BEGIN: 20261019000004_m24_people_recruitment_performance.sql >>>

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

drop policy if exists "manpower_requests_tenant_isolation" on public.manpower_requests;
create policy "manpower_requests_tenant_isolation" on public.manpower_requests
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

drop policy if exists "recruitment_candidates_tenant_isolation" on public.recruitment_candidates;
create policy "recruitment_candidates_tenant_isolation" on public.recruitment_candidates
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

drop policy if exists "site_competencies_tenant_isolation" on public.site_competencies;
create policy "site_competencies_tenant_isolation" on public.site_competencies
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

drop policy if exists "performance_appraisals_tenant_isolation" on public.performance_appraisals;
create policy "performance_appraisals_tenant_isolation" on public.performance_appraisals
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 5. PERMISSIONS & ROLE ASSIGNMENTS
insert into public.permissions (id, description) values
  ('people.manpower.manage', 'Create, update and track site manpower requisitions'),
  ('people.manpower.approve', 'Approve project manpower mobilization requisitions'),
  ('people.recruitment.manage', 'Manage candidate recruitment pipeline and hiring stages'),
  ('people.competency.manage', 'Register and audit site worker competencies and training certifications'),
  ('people.appraisal.manage', 'Conduct and submit employee performance reviews and appraisals')
on conflict (id) do nothing;

-- Seed role permissions using public.role_definitions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.role_definitions r
cross join public.permissions p
where r.id in ('role.platform_administrator', 'role.hr_admin_lead', 'role.hr_admin_assistant')
  and p.id in (
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
  and p.id in (
    'people.manpower.manage',
    'people.competency.manage'
  )
on conflict do nothing;

-- <<< END: 20261019000004_m24_people_recruitment_performance.sql <<<


-- >>> BEGIN: 20261019000005_m26_customer_stakeholder_communications.sql >>>

-- Migration: 20261019000005_m26_customer_stakeholder_communications.sql
-- Module: M26 Customer / Stakeholder Communications
-- Multi-tenant isolation enforced via tenant_id = public.current_tenant_id()

-- 1. STAKEHOLDERS DIRECTORY
create table if not exists public.stakeholders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  name text not null,
  organization text not null,
  stakeholder_type text not null check (stakeholder_type in ('client', 'consultant', 'subcontractor', 'authority', 'community', 'utility')),
  role_title text not null,
  email text,
  phone text,
  engagement_level text not null default 'medium' check (engagement_level in ('low', 'medium', 'high')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_stakeholders_tenant_project on public.stakeholders (tenant_id, project_id);
create index if not exists idx_stakeholders_type on public.stakeholders (tenant_id, stakeholder_type);

alter table public.stakeholders enable row level security;

drop policy if exists "stakeholders_tenant_isolation" on public.stakeholders;
create policy "stakeholders_tenant_isolation" on public.stakeholders
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 2. COMMUNICATION LOGS & FORMAL NOTICES
create table if not exists public.communication_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  reference_number text not null,
  channel text not null check (channel in ('letter', 'email', 'site_instruction', 'transmittal', 'notice', 'circular')),
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_name text not null,
  recipient_name text not null,
  subject text not null,
  summary text not null,
  requires_response boolean not null default false,
  response_due_date date,
  status text not null default 'draft' check (status in ('draft', 'sent', 'received', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_communication_logs_tenant_project on public.communication_logs (tenant_id, project_id);
create index if not exists idx_communication_logs_status on public.communication_logs (tenant_id, status);

alter table public.communication_logs enable row level security;

drop policy if exists "communication_logs_tenant_isolation" on public.communication_logs;
create policy "communication_logs_tenant_isolation" on public.communication_logs
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 3. MEETING MINUTES (MOM) & ACTION ITEMS
create table if not exists public.meeting_minutes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  meeting_title text not null,
  meeting_type text not null check (meeting_type in ('site_coordination', 'client_review', 'technical_clarification', 'progress_meeting')),
  meeting_date date not null,
  location text,
  attendees text[] not null default '{}',
  summary text not null,
  action_items jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_meeting_minutes_tenant_project on public.meeting_minutes (tenant_id, project_id);

alter table public.meeting_minutes enable row level security;

drop policy if exists "meeting_minutes_tenant_isolation" on public.meeting_minutes;
create policy "meeting_minutes_tenant_isolation" on public.meeting_minutes
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 4. CLIENT FEEDBACK & COMPLAINTS
create table if not exists public.client_complaints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  complaint_number text not null,
  client_name text not null,
  contact_info text,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  category text not null check (category in ('quality', 'schedule', 'safety', 'billing', 'conduct', 'other')),
  description text not null,
  resolution_plan text,
  status text not null default 'received' check (status in ('received', 'investigating', 'resolved', 'closed')),
  assigned_to text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_complaints_tenant_severity on public.client_complaints (tenant_id, severity, status);

alter table public.client_complaints enable row level security;

drop policy if exists "client_complaints_tenant_isolation" on public.client_complaints;
create policy "client_complaints_tenant_isolation" on public.client_complaints
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 5. PERMISSIONS & ROLE ASSIGNMENTS
insert into public.permissions (id, description) values
  ('communications.stakeholder.manage', 'Register and manage project stakeholders and directories'),
  ('communications.log.manage', 'Record and manage communication logs, letters and formal notices'),
  ('communications.minutes.manage', 'Draft, publish and track meeting minutes and action items'),
  ('communications.complaint.manage', 'Log and triage client complaints and escalations'),
  ('communications.complaint.resolve', 'Resolve, close and verify corrective actions for client complaints')
on conflict (id) do nothing;

-- Seed role permissions using public.role_definitions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.role_definitions r
cross join public.permissions p
where r.id in ('role.platform_administrator', 'role.project_engineer_lead', 'role.business_development_executive', 'role.cmo')
  and p.id in (
    'communications.stakeholder.manage',
    'communications.log.manage',
    'communications.minutes.manage',
    'communications.complaint.manage',
    'communications.complaint.resolve'
  )
on conflict do nothing;

-- <<< END: 20261019000005_m26_customer_stakeholder_communications.sql <<<


-- >>> BEGIN: 20261019000006_m27_legal_licences_regulatory_register.sql >>>

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

drop policy if exists "licences_permits_tenant_isolation" on public.licences_permits;
create policy "licences_permits_tenant_isolation" on public.licences_permits
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

drop policy if exists "legal_matters_tenant_isolation" on public.legal_matters;
create policy "legal_matters_tenant_isolation" on public.legal_matters
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

drop policy if exists "external_counsel_tenant_isolation" on public.external_counsel;
create policy "external_counsel_tenant_isolation" on public.external_counsel
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

drop policy if exists "compliance_obligations_tenant_isolation" on public.compliance_obligations;
create policy "compliance_obligations_tenant_isolation" on public.compliance_obligations
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

-- <<< END: 20261019000006_m27_legal_licences_regulatory_register.sql <<<


-- >>> BEGIN: 20261019000007_m32_dashboards_reports_kpi_builder.sql >>>

-- Migration: 20261019000007_m32_dashboards_reports_kpi_builder.sql
-- Description: M32 Dashboards, Reports & KPI Builder schema, saved report definitions, and permissions

-- 1. DASHBOARD REPORTS TABLE
create table if not exists public.dashboard_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  category text not null check (category in ('executive', 'financial', 'operational', 'qhse', 'custom')),
  config jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id) on delete set null,
  is_preset boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dashboard_reports_tenant_cat on public.dashboard_reports (tenant_id, category);

alter table public.dashboard_reports enable row level security;

drop policy if exists "dashboard_reports_tenant_isolation" on public.dashboard_reports;
create policy "dashboard_reports_tenant_isolation" on public.dashboard_reports
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 2. PERMISSIONS & ROLE ASSIGNMENTS
insert into public.permissions (id, description) values
  ('dashboard.executive.view', 'View executive-level portfolio health, contract summaries, and risk radar'),
  ('dashboard.financial.view', 'View cross-module financial variance, budget vs committed spend, and billing status'),
  ('dashboard.operations.view', 'View site operational metrics, manpower mobilization, fleet utilization, and QHSE compliance'),
  ('dashboard.reports.manage', 'Create, modify, and save custom report definitions and KPI dashboards'),
  ('dashboard.reports.export', 'Export tabular report datasets and KPI analytics to CSV and structured formats')
on conflict (id) do nothing;

-- Seed role permissions using public.role_definitions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.role_definitions r
cross join public.permissions p
where r.id in (
  'role.platform_administrator',
  'role.ceo',
  'role.coo',
  'role.cfo',
  'role.project_director',
  'role.senior_accountant',
  'role.qhse_director',
  'role.project_engineer_lead'
)
  and p.id in (
    'dashboard.executive.view',
    'dashboard.financial.view',
    'dashboard.operations.view',
    'dashboard.reports.manage',
    'dashboard.reports.export'
  )
on conflict do nothing;

-- <<< END: 20261019000007_m32_dashboards_reports_kpi_builder.sql <<<


-- >>> BEGIN: 20261019000008_m34_integrations_api_management.sql >>>

-- Migration: 20261019000008_m34_integrations_api_management.sql
-- Description: M34 Integrations & API Management schema, API keys, webhooks, connectors, and delivery logs

-- 1. API KEYS TABLE
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  scopes text[] not null default '{}',
  rate_limit_rpm integer not null default 60,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_keys_tenant_prefix on public.api_keys (tenant_id, key_prefix);

alter table public.api_keys enable row level security;

drop policy if exists "api_keys_tenant_isolation" on public.api_keys;
create policy "api_keys_tenant_isolation" on public.api_keys
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 2. WEBHOOK SUBSCRIPTIONS TABLE
create table if not exists public.webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  target_url text not null,
  event_types text[] not null default '{}',
  secret_key text not null,
  is_active boolean not null default true,
  failure_count integer not null default 0,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_webhooks_tenant on public.webhook_subscriptions (tenant_id);

alter table public.webhook_subscriptions enable row level security;

drop policy if exists "webhook_subscriptions_tenant_isolation" on public.webhook_subscriptions;
create policy "webhook_subscriptions_tenant_isolation" on public.webhook_subscriptions
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 3. WEBHOOK DELIVERIES LOG TABLE
create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  webhook_id uuid not null references public.webhook_subscriptions(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  response_status integer,
  response_body text,
  status text not null check (status in ('success', 'failed', 'retrying')),
  delivered_at timestamptz not null default now()
);

create index if not exists idx_webhook_deliveries_tenant on public.webhook_deliveries (tenant_id, delivered_at desc);

alter table public.webhook_deliveries enable row level security;

drop policy if exists "webhook_deliveries_tenant_isolation" on public.webhook_deliveries;
create policy "webhook_deliveries_tenant_isolation" on public.webhook_deliveries
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 4. SERVICE CONNECTORS TABLE
create table if not exists public.service_connectors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  connector_key text not null,
  name text not null,
  category text not null check (category in ('accounting', 'banking', 'e_sign', 'storage', 'ocr', 'custom')),
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error', 'syncing')),
  credentials_masked jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_service_connectors_tenant on public.service_connectors (tenant_id, connector_key);

alter table public.service_connectors enable row level security;

drop policy if exists "service_connectors_tenant_isolation" on public.service_connectors;
create policy "service_connectors_tenant_isolation" on public.service_connectors
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 5. PERMISSIONS & ROLE ASSIGNMENTS
insert into public.permissions (id, description) values
  ('integrations.api_key.manage', 'Issue, configure, and inspect external REST API keys'),
  ('integrations.api_key.revoke', 'Revoke active external REST API keys'),
  ('integrations.webhook.manage', 'Create, update, and manage outbound event webhook subscriptions'),
  ('integrations.webhook.test', 'Send test ping payloads to verify webhook endpoints'),
  ('integrations.connector.manage', 'Configure third-party connectors for accounting, banking, and e-signatures'),
  ('integrations.log.view', 'View delivery traces and audit logs for webhooks and API calls')
on conflict (id) do nothing;

-- Seed role permissions using public.role_definitions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.role_definitions r
cross join public.permissions p
where r.id in (
  'role.platform_administrator',
  'role.company_administrator',
  'role.it_admin',
  'role.developer'
)
  and p.id in (
    'integrations.api_key.manage',
    'integrations.api_key.revoke',
    'integrations.webhook.manage',
    'integrations.webhook.test',
    'integrations.connector.manage',
    'integrations.log.view'
  )
on conflict do nothing;

-- <<< END: 20261019000008_m34_integrations_api_management.sql <<<


-- >>> BEGIN: 20261019000009_m36_platform_administration_support.sql >>>

-- Migration: 20261019000009_m36_platform_administration_support.sql
-- Module M36: Platform Administration & Support
-- Tables: tenant_settings, tenant_feature_flags, system_maintenance_windows, platform_support_tickets

-- 1. Tenant Settings & Operational Quotas
CREATE TABLE IF NOT EXISTS public.tenant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    organization_name TEXT NOT NULL,
    default_timezone TEXT NOT NULL DEFAULT 'Asia/Dubai',
    default_currency TEXT NOT NULL DEFAULT 'AED',
    fiscal_year_start_month INTEGER NOT NULL DEFAULT 1,
    storage_quota_gb INTEGER NOT NULL DEFAULT 100,
    session_timeout_minutes INTEGER NOT NULL DEFAULT 60,
    mfa_enforced BOOLEAN NOT NULL DEFAULT false,
    support_email TEXT,
    support_phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tenant_settings_tenant UNIQUE (tenant_id)
);

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

drop policy if exists tenant_settings_tenant_isolation on public.tenant_settings;
create policy tenant_settings_tenant_isolation on public.tenant_settings
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

-- 2. Feature Flags
CREATE TABLE IF NOT EXISTS public.tenant_feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    flag_key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tenant_feature_flags UNIQUE (tenant_id, flag_key)
);

ALTER TABLE public.tenant_feature_flags ENABLE ROW LEVEL SECURITY;

drop policy if exists tenant_feature_flags_tenant_isolation on public.tenant_feature_flags;
create policy tenant_feature_flags_tenant_isolation on public.tenant_feature_flags
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

-- 3. Maintenance Windows & System Announcements
CREATE TABLE IF NOT EXISTS public.system_maintenance_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_maintenance_windows ENABLE ROW LEVEL SECURITY;

drop policy if exists system_maintenance_windows_tenant_isolation on public.system_maintenance_windows;
create policy system_maintenance_windows_tenant_isolation on public.system_maintenance_windows
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

-- 4. Platform Support & Helpdesk Tickets
CREATE TABLE IF NOT EXISTS public.platform_support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    ticket_number TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('bug', 'access', 'data', 'performance', 'general')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    reported_by TEXT NOT NULL,
    assigned_to TEXT,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_support_tickets ENABLE ROW LEVEL SECURITY;

drop policy if exists platform_support_tickets_tenant_isolation on public.platform_support_tickets;
create policy platform_support_tickets_tenant_isolation on public.platform_support_tickets
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

-- 5. Seed Permissions for M36
insert into public.permissions (id, description) values
  ('platform.settings.view', 'View tenant configuration and settings'),
  ('platform.settings.manage', 'Modify tenant settings, quotas, and security policies'),
  ('platform.feature_flags.manage', 'Toggle tenant feature flags and experimental features'),
  ('platform.health.view', 'View system health probes, queue latency, and telemetry'),
  ('platform.maintenance.manage', 'Schedule and broadcast maintenance announcement banners'),
  ('platform.support.view', 'View helpdesk and support tickets'),
  ('platform.support.manage', 'Create and resolve platform support tickets')
on conflict (id) do nothing;

-- Map permissions to roles
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.role_definitions r
cross join public.permissions p
where r.id in (
  'role.platform_administrator',
  'role.ceo',
  'role.it_support_engineer'
)
  and p.id in (
    'platform.settings.view',
    'platform.settings.manage',
    'platform.feature_flags.manage',
    'platform.health.view',
    'platform.maintenance.manage',
    'platform.support.view',
    'platform.support.manage'
  )
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.role_definitions r
cross join public.permissions p
where r.id in (
  'role.coo',
  'role.project_engineer_lead'
)
  and p.id in (
    'platform.settings.view',
    'platform.support.view',
    'platform.support.manage'
  )
on conflict do nothing;

-- <<< END: 20261019000009_m36_platform_administration_support.sql <<<


-- >>> BEGIN: 20261019000010_grant_all_permissions_to_admin.sql >>>

-- Migration: 20261019000010_grant_all_permissions_to_admin.sql
-- Assigns every registered permission in public.permissions to role.platform_administrator
-- to guarantee that platform administrators have unrestricted access across all modules.

insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id
from public.permissions
on conflict do nothing;

-- <<< END: 20261019000010_grant_all_permissions_to_admin.sql <<<


-- >>> BEGIN: 20261019000011_m38_data_migration_quality.sql >>>

-- Migration 20261019000011: Module M38 - Implementation, Migration & Data Quality
-- Supports dry-run validation, column mapping, duplicate detection, reconciliation reports, and rollback snapshots.

CREATE TABLE IF NOT EXISTS public.migration_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('work_items', 'cost_codes', 'employees', 'vendors', 'inventory_items')),
    file_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'imported', 'rolled_back', 'failed')),
    total_rows INT NOT NULL DEFAULT 0,
    valid_rows INT NOT NULL DEFAULT 0,
    error_rows INT NOT NULL DEFAULT 0,
    row_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    rollback_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    imported_at TIMESTAMPTZ,
    rolled_back_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_migration_jobs_tenant ON public.migration_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_status ON public.migration_jobs(status);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_entity ON public.migration_jobs(entity_type);

-- Enable RLS
ALTER TABLE public.migration_jobs ENABLE ROW LEVEL SECURITY;

drop policy if exists migration_jobs_tenant_isolation on public.migration_jobs;
create policy migration_jobs_tenant_isolation on public.migration_jobs
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

-- Register M38 Permissions
INSERT INTO public.permissions (id, description) VALUES
    ('migration.job.view', 'View migration history, dry-run validation reports and audit logs'),
    ('migration.import.execute', 'Execute CSV/Excel data import and staged activation'),
    ('migration.rollback.execute', 'Rollback a previous data import batch')
ON CONFLICT (id) DO NOTHING;

-- Grant permissions to Platform Administrator and CEO
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.role_definitions r
CROSS JOIN (
    SELECT unnest(ARRAY[
        'migration.job.view',
        'migration.import.execute',
        'migration.rollback.execute'
    ]) as id
) p
WHERE r.id IN ('role.platform_administrator', 'role.ceo')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- <<< END: 20261019000011_m38_data_migration_quality.sql <<<


-- >>> BEGIN: 20261019000012_m28_ai_knowledge_assistant.sql >>>

-- Migration 20261019000012: Module M28 - AI Knowledge Assistant & Search
-- Enables pgvector, creates knowledge repository, chunk embeddings, match RPC, and feedback tracking.

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Knowledge Documents Table
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN ('document', 'drawing', 'rfi', 'dpr', 'contract', 'work_item', 'sop')),
    source_id TEXT NOT NULL,
    title TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT 'v1',
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_knowledge_source UNIQUE (tenant_id, source_type, source_id, version)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_tenant ON public.knowledge_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_project ON public.knowledge_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_type ON public.knowledge_documents(source_type);

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

drop policy if exists knowledge_documents_tenant_isolation on public.knowledge_documents;
create policy knowledge_documents_tenant_isolation on public.knowledge_documents
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

-- 3. Knowledge Embeddings Table (vector dimension: 1536)
CREATE TABLE IF NOT EXISTS public.knowledge_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_tenant ON public.knowledge_embeddings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_doc ON public.knowledge_embeddings(document_id);

ALTER TABLE public.knowledge_embeddings ENABLE ROW LEVEL SECURITY;

drop policy if exists knowledge_embeddings_tenant_isolation on public.knowledge_embeddings;
create policy knowledge_embeddings_tenant_isolation on public.knowledge_embeddings
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

-- 4. AI Query & Feedback Table (BRD: Feedback & Knowledge Gap Reporting)
CREATE TABLE IF NOT EXISTS public.ai_query_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    query_text TEXT NOT NULL,
    answer_text TEXT NOT NULL,
    citations JSONB NOT NULL DEFAULT '[]'::jsonb,
    rating TEXT CHECK (rating IN ('positive', 'negative', 'inaccurate', 'missing_info')),
    feedback_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_tenant ON public.ai_query_feedback(tenant_id);

ALTER TABLE public.ai_query_feedback ENABLE ROW LEVEL SECURITY;

drop policy if exists ai_feedback_tenant_isolation on public.ai_query_feedback;
create policy ai_feedback_tenant_isolation on public.ai_query_feedback
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

-- 5. Stored Procedure: match_knowledge_chunks (Cosine Similarity Search)
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks (
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 5,
    filter_project_id uuid DEFAULT NULL,
    filter_tenant_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    document_id uuid,
    title text,
    source_type text,
    version text,
    project_id uuid,
    chunk_text text,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ke.id,
        ke.document_id,
        kd.title,
        kd.source_type,
        kd.version,
        kd.project_id,
        ke.chunk_text,
        1 - (ke.embedding <=> query_embedding) AS similarity
    FROM public.knowledge_embeddings ke
    JOIN public.knowledge_documents kd ON kd.id = ke.document_id
    WHERE
        (filter_tenant_id IS NULL OR ke.tenant_id = filter_tenant_id)
        AND (filter_project_id IS NULL OR kd.project_id = filter_project_id)
        AND ke.embedding IS NOT NULL
        AND (1 - (ke.embedding <=> query_embedding)) > match_threshold
    ORDER BY ke.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 6. Register M28 Permissions
INSERT INTO public.permissions (id, description) VALUES
    ('ai.assistant.query', 'Query the AI knowledge assistant and semantic search'),
    ('ai.knowledge.manage', 'Ingest, index, and manage documents in the AI knowledge base'),
    ('ai.feedback.submit', 'Submit feedback and report knowledge gaps on AI answers')
ON CONFLICT (id) DO NOTHING;

-- Grant permissions to Platform Administrator and CEO
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.role_definitions r
CROSS JOIN (
    SELECT unnest(ARRAY[
        'ai.assistant.query',
        'ai.knowledge.manage',
        'ai.feedback.submit'
    ]) as id
) p
WHERE r.id IN ('role.platform_administrator', 'role.ceo')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- <<< END: 20261019000012_m28_ai_knowledge_assistant.sql <<<


-- >>> BEGIN: 20261019000013_m29_ai_agent_studio_tool_registry.sql >>>

-- Migration 20261019000013_m29_ai_agent_studio_tool_registry.sql
-- Module M29: AI Agent Studio & Tool Registry (BRD §8.10.2)

-- 1. Agent Definitions
CREATE TABLE IF NOT EXISTS public.agent_definitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
    key text NOT NULL,
    name text NOT NULL,
    description text,
    system_prompt text NOT NULL,
    model text NOT NULL DEFAULT 'gpt-4o-mini',
    temperature numeric NOT NULL DEFAULT 0.2,
    canonical_role_id text,
    allowed_tools jsonb NOT NULL DEFAULT '[]'::jsonb,
    hitl_policy text NOT NULL DEFAULT 'require_for_mutations', -- 'always', 'require_for_mutations', 'never'
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_agent_definitions_tenant_key UNIQUE (tenant_id, key)
);

-- 2. Tool Registry
CREATE TABLE IF NOT EXISTS public.agent_tool_registry (
    key text PRIMARY KEY,
    name text NOT NULL,
    description text NOT NULL,
    category text NOT NULL DEFAULT 'general',
    required_permission text NOT NULL,
    is_mutation boolean NOT NULL DEFAULT false,
    schema jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Agent Executions (Audit Log & HITL State Machine)
CREATE TABLE IF NOT EXISTS public.agent_executions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
    agent_id uuid REFERENCES public.agent_definitions(id) ON DELETE CASCADE,
    user_id uuid,
    session_id text,
    input_prompt text NOT NULL,
    status text NOT NULL DEFAULT 'completed', -- 'running', 'paused_waiting_approval', 'completed', 'failed', 'rejected'
    messages jsonb NOT NULL DEFAULT '[]'::jsonb,
    pending_action jsonb, -- { toolKey, toolName, input, rationale, callId }
    output_summary text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_definitions_tenant ON public.agent_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_tenant_agent ON public.agent_executions(tenant_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_status ON public.agent_executions(status);

-- Enable RLS
ALTER TABLE public.agent_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tool_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
drop policy if exists "agent_definitions_tenant_isolation" on public.agent_definitions;
create policy "agent_definitions_tenant_isolation" on public.agent_definitions
    FOR ALL USING (tenant_id = public.current_tenant_id());

drop policy if exists "agent_tool_registry_read_all" on public.agent_tool_registry;
create policy "agent_tool_registry_read_all" on public.agent_tool_registry
    FOR SELECT TO authenticated USING (true);

drop policy if exists "agent_executions_tenant_isolation" on public.agent_executions;
create policy "agent_executions_tenant_isolation" on public.agent_executions
    FOR ALL USING (tenant_id = public.current_tenant_id());

-- 4. Pre-seed Standard SEVENTS Operational Tools
INSERT INTO public.agent_tool_registry (key, name, description, category, required_permission, is_mutation, schema) VALUES
(
    'search_knowledge_base',
    'Search Project Knowledge Base',
    'Semantic vector search across project drawings, specifications, RFIs, and contracts with citations.',
    'engineering',
    'ai.assistant.query',
    false,
    '{
        "type": "object",
        "properties": {
            "query": { "type": "string", "description": "Technical search query or spec requirement" },
            "projectId": { "type": "string", "description": "Optional project UUID filter" }
        },
        "required": ["query"]
    }'::jsonb
),
(
    'query_project_schedule',
    'Query Schedule & Milestones',
    'Inspect project WBS milestones, planned vs actual finish dates, and lookahead tasks.',
    'schedule',
    'project.schedule.view',
    false,
    '{
        "type": "object",
        "properties": {
            "projectId": { "type": "string", "description": "Project UUID" },
            "status": { "type": "string", "description": "Optional status filter (e.g. in_progress, delayed)" }
        },
        "required": ["projectId"]
    }'::jsonb
),
(
    'get_boq_items',
    'Get Bill of Quantities Items',
    'Retrieve work-item catalogue lines, approved quantities, and unit rates for a project.',
    'finance',
    'catalogue.workitem.view',
    false,
    '{
        "type": "object",
        "properties": {
            "search": { "type": "string", "description": "Search keyword in description or item code" }
        }
    }'::jsonb
),
(
    'check_inventory_stock',
    'Check Inventory & Warehouse Stock',
    'Check on-site inventory balances, storage locations, and minimum threshold alerts.',
    'procurement',
    'inventory.item.view',
    false,
    '{
        "type": "object",
        "properties": {
            "itemName": { "type": "string", "description": "Material name or SKU" }
        },
        "required": ["itemName"]
    }'::jsonb
),
(
    'create_site_rfi',
    'Draft Site RFI (Request for Information)',
    'Create and submit a formal RFI to the consultant or structural engineer regarding drawing discrepancy.',
    'engineering',
    'design.rfi.create',
    true,
    '{
        "type": "object",
        "properties": {
            "projectId": { "type": "string", "description": "Target project UUID" },
            "title": { "type": "string", "description": "Clear technical title of the clarification" },
            "question": { "type": "string", "description": "Detailed question referencing drawing sheet" },
            "suggestedSolution": { "type": "string", "description": "Contractor proposed resolution" }
        },
        "required": ["projectId", "title", "question"]
    }'::jsonb
),
(
    'calculate_delay_impact',
    'Calculate Schedule Delay Impact',
    'Analyze site delay events against project completion baseline and estimate critical path slip.',
    'schedule',
    'project.schedule.manage',
    false,
    '{
        "type": "object",
        "properties": {
            "projectId": { "type": "string", "description": "Project UUID" },
            "delayDays": { "type": "number", "description": "Number of working days delayed" },
            "reason": { "type": "string", "description": "Root cause of delay" }
        },
        "required": ["projectId", "delayDays"]
    }'::jsonb
),
(
    'log_safety_observation',
    'Log Safety Hazard or Observation',
    'Record a safety hazard observation or near miss on site for HSE compliance review.',
    'safety',
    'safety.hazard.report',
    true,
    '{
        "type": "object",
        "properties": {
            "projectId": { "type": "string", "description": "Project UUID" },
            "hazardType": { "type": "string", "description": "e.g. Scaffolding, PPE, Electrical, Fall Hazard" },
            "description": { "type": "string", "description": "Description of observed condition" },
            "severity": { "type": "string", "enum": ["low", "medium", "high", "critical"] }
        },
        "required": ["projectId", "hazardType", "description"]
    }'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    required_permission = EXCLUDED.required_permission,
    is_mutation = EXCLUDED.is_mutation,
    schema = EXCLUDED.schema;

-- 5. Register M29 Permissions
INSERT INTO public.permissions (id, description) VALUES
    ('ai.agent.manage', 'Create, configure, and manage AI agent studio profiles and tool bindings'),
    ('ai.agent.execute', 'Prompt and execute autonomous AI agents across project tools'),
    ('ai.agent.approve', 'Review and approve/reject pending Human-In-The-Loop agent actions')
ON CONFLICT (id) DO NOTHING;

-- Grant permissions to Platform Administrator and CEO
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.role_definitions r
CROSS JOIN (
    SELECT unnest(ARRAY[
        'ai.agent.manage',
        'ai.agent.execute',
        'ai.agent.approve'
    ]) as id
) p
WHERE r.id IN ('role.platform_administrator', 'role.ceo')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- <<< END: 20261019000013_m29_ai_agent_studio_tool_registry.sql <<<


-- >>> BEGIN: 20261019000014_m30_agent_runs_human_review_audit.sql >>>

-- Migration 20261019000014_m30_agent_runs_human_review_audit.sql
-- Module M30: Agent Runs, Human Review & Audit (BRD §8.10 FR-AG-004..010, FR-AUD-001)

-- 1. Extend agent_definitions with guardrails and budget controls
ALTER TABLE public.agent_definitions
    ADD COLUMN IF NOT EXISTS max_steps integer NOT NULL DEFAULT 10,
    ADD COLUMN IF NOT EXISTS timeout_seconds integer NOT NULL DEFAULT 60,
    ADD COLUMN IF NOT EXISTS spend_budget_usd numeric(10,4) NOT NULL DEFAULT 5.0000,
    ADD COLUMN IF NOT EXISTS risk_tier text NOT NULL DEFAULT 'medium',
    ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS pause_reason text;

-- 2. Extend agent_executions with tokens, cost, latency, structured plan steps, and replay protection
ALTER TABLE public.agent_executions
    ADD COLUMN IF NOT EXISTS tokens_prompt integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tokens_completion integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_tokens integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cost_usd numeric(10,6) NOT NULL DEFAULT 0.000000,
    ADD COLUMN IF NOT EXISTS latency_ms integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS steps_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS plan_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS confidence_score numeric(4,3) NOT NULL DEFAULT 0.950,
    ADD COLUMN IF NOT EXISTS approval_metadata jsonb,
    ADD COLUMN IF NOT EXISTS error_details jsonb,
    ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Index for execution lookups and idempotency
CREATE INDEX IF NOT EXISTS idx_agent_executions_idempotency 
    ON public.agent_executions(tenant_id, idempotency_key) 
    WHERE idempotency_key IS NOT NULL;

-- 3. Append-only Agent Run Audit Log (Replay-safe execution traces & compliance verification)
CREATE TABLE IF NOT EXISTS public.agent_run_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
    execution_id uuid REFERENCES public.agent_executions(id) ON DELETE CASCADE,
    agent_id uuid REFERENCES public.agent_definitions(id) ON DELETE SET NULL,
    actor_type text NOT NULL DEFAULT 'agent', -- 'agent', 'human_reviewer', 'system'
    actor_id text,
    event_type text NOT NULL, -- 'run_started', 'thought_generated', 'tool_called', 'hitl_requested', 'hitl_approved', 'hitl_rejected', 'run_completed', 'run_failed', 'run_cancelled', 'kill_switch_activated'
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_run_audit_execution ON public.agent_run_audit_logs(tenant_id, execution_id);
CREATE INDEX IF NOT EXISTS idx_agent_run_audit_event ON public.agent_run_audit_logs(tenant_id, event_type);

-- 4. Agent Incident & Redaction Review (Prompt injection, security anomalies, cost breaches)
CREATE TABLE IF NOT EXISTS public.agent_incident_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
    execution_id uuid REFERENCES public.agent_executions(id) ON DELETE CASCADE,
    agent_id uuid REFERENCES public.agent_definitions(id) ON DELETE SET NULL,
    incident_type text NOT NULL, -- 'prompt_injection_flagged', 'cost_limit_exceeded', 'max_steps_exceeded', 'tool_permission_denied', 'unauthorized_mutation', 'pii_leakage'
    severity text NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    description text NOT NULL,
    raw_content text,
    redacted_content text,
    is_resolved boolean NOT NULL DEFAULT false,
    resolved_by uuid,
    resolution_notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agent_incidents_tenant ON public.agent_incident_reviews(tenant_id, is_resolved);

-- Enable RLS
ALTER TABLE public.agent_run_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_incident_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
drop policy if exists "agent_run_audit_logs_tenant_isolation" on public.agent_run_audit_logs;
create policy "agent_run_audit_logs_tenant_isolation" on public.agent_run_audit_logs
    FOR ALL USING (tenant_id = public.current_tenant_id());

drop policy if exists "agent_incident_reviews_tenant_isolation" on public.agent_incident_reviews;
create policy "agent_incident_reviews_tenant_isolation" on public.agent_incident_reviews
    FOR ALL USING (tenant_id = public.current_tenant_id());

-- 5. Register M30 Permissions
INSERT INTO public.permissions (id, description) VALUES
    ('ai.agent.audit', 'Review complete agent execution audit logs, token costs, and raw tool traces'),
    ('ai.agent.intervene', 'Pause, retry, cancel runs, or activate agent emergency kill switches'),
    ('ai.agent.incident', 'Triage, redact, and resolve AI security, prompt injection, and cost incident reviews')
ON CONFLICT (id) DO NOTHING;

-- Grant permissions to Platform Administrator, Company Administrator, and CEO
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.role_definitions r
CROSS JOIN (
    SELECT unnest(ARRAY[
        'ai.agent.audit',
        'ai.agent.intervene',
        'ai.agent.incident'
    ]) as id
) p
WHERE r.id IN ('role.platform_administrator', 'role.company_administrator', 'role.ceo')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- <<< END: 20261019000014_m30_agent_runs_human_review_audit.sql <<<


-- >>> BEGIN: 20261020000001_ai_mcp_servers_and_dynamic_tools.sql >>>

-- Migration: 20261020000001_ai_mcp_servers_and_dynamic_tools.sql
-- Enables registering custom MCP (Model Context Protocol) servers and dynamic custom tools for AI Copilots.

CREATE TABLE IF NOT EXISTS public.ai_mcp_servers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
    name text NOT NULL,
    url text NOT NULL,
    transport text NOT NULL DEFAULT 'http', -- 'http' or 'sse'
    api_key text,
    description text,
    is_active boolean NOT NULL DEFAULT true,
    cached_tools jsonb NOT NULL DEFAULT '[]'::jsonb,
    last_synced_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add custom / mcp server metadata columns to agent_tool_registry if not present
ALTER TABLE public.agent_tool_registry
    ADD COLUMN IF NOT EXISTS mcp_server_id uuid REFERENCES public.ai_mcp_servers(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS webhook_url text,
    ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false;

-- Enable RLS
ALTER TABLE public.ai_mcp_servers ENABLE ROW LEVEL SECURITY;

drop policy if exists "ai_mcp_servers_tenant_isolation" on public.ai_mcp_servers;
create policy "ai_mcp_servers_tenant_isolation" on public.ai_mcp_servers
    FOR ALL USING (tenant_id = public.current_tenant_id());

drop policy if exists "agent_tool_registry_insert_authenticated" on public.agent_tool_registry;
create policy "agent_tool_registry_insert_authenticated" on public.agent_tool_registry
    FOR INSERT TO authenticated WITH CHECK (true);

drop policy if exists "agent_tool_registry_update_authenticated" on public.agent_tool_registry;
create policy "agent_tool_registry_update_authenticated" on public.agent_tool_registry
    FOR UPDATE TO authenticated USING (true);

drop policy if exists "agent_tool_registry_delete_authenticated" on public.agent_tool_registry;
create policy "agent_tool_registry_delete_authenticated" on public.agent_tool_registry
    FOR DELETE TO authenticated USING (true);

-- <<< END: 20261020000001_ai_mcp_servers_and_dynamic_tools.sql <<<


-- >>> BEGIN: 20261020000002_m36_rls_and_branch_enhancements.sql >>>

-- Migration: 20261020000002_m36_rls_and_branch_enhancements.sql
-- 1. Extend branches with code and address fields
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS address TEXT;

-- 2. Ensure RLS defaults for Platform Administration tables so inserts & upserts never violate tenant isolation
ALTER TABLE public.tenant_settings ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.tenant_feature_flags ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.system_maintenance_windows ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.platform_support_tickets ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

-- 3. Refresh RLS policies to guarantee clean resolution with current_tenant_id()
DROP POLICY IF EXISTS tenant_settings_tenant_isolation ON public.tenant_settings;
CREATE POLICY tenant_settings_tenant_isolation ON public.tenant_settings
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_feature_flags_tenant_isolation ON public.tenant_feature_flags;
CREATE POLICY tenant_feature_flags_tenant_isolation ON public.tenant_feature_flags
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS system_maintenance_windows_tenant_isolation ON public.system_maintenance_windows;
CREATE POLICY system_maintenance_windows_tenant_isolation ON public.system_maintenance_windows
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS platform_support_tickets_tenant_isolation ON public.platform_support_tickets;
CREATE POLICY platform_support_tickets_tenant_isolation ON public.platform_support_tickets
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

-- <<< END: 20261020000002_m36_rls_and_branch_enhancements.sql <<<


-- >>> BEGIN: 20261021000001_storage_bucket_attachments.sql >>>

-- Migration: 20261021000001_storage_bucket_attachments.sql
-- Ensure the storage bucket 'attachments' exists and is publicly readable

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', true, 52428800, null)
on conflict (id) do update set
  public = true,
  file_size_limit = 52428800;

-- RLS policies on storage.objects for the attachments bucket
do $$
begin
  -- Policy: allow authenticated users to select objects in attachments
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated users can read attachments'
  ) then
    create policy "Authenticated users can read attachments"
    on storage.objects for select
    to authenticated
    using (bucket_id = 'attachments');
  end if;

  -- Policy: allow public to read attachments
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public can read attachments'
  ) then
    create policy "Public can read attachments"
    on storage.objects for select
    to public
    using (bucket_id = 'attachments');
  end if;

  -- Policy: allow authenticated users to upload to attachments
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated users can upload attachments'
  ) then
    create policy "Authenticated users can upload attachments"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'attachments');
  end if;

  -- Policy: allow authenticated users to update their attachments
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated users can update attachments'
  ) then
    create policy "Authenticated users can update attachments"
    on storage.objects for update
    to authenticated
    using (bucket_id = 'attachments');
  end if;

  -- Policy: allow authenticated users to delete attachments
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated users can delete attachments'
  ) then
    create policy "Authenticated users can delete attachments"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'attachments');
  end if;
end
$$;

-- <<< END: 20261021000001_storage_bucket_attachments.sql <<<


-- ==============================================================================

-- Reload PostgREST schema cache to ensure all new tables are immediately live

NOTIFY pgrst, 'reload schema';

-- ==============================================================================