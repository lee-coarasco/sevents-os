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
