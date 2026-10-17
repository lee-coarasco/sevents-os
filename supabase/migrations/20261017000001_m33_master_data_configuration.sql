-- M33: Master Data & Configuration (ticket 0114)
--
-- Five new tenant-scoped, shared-catalogue-style master-data tables
-- (units of measure, currencies, cost codes, document types, numbering
-- schemes), plus additive nullable FK retrofits on existing modules that
-- were using free text as a workaround. `project_types` (M09a, ticket
-- 0073) already exists and already has `projects.project_type_id` wired
-- up — this migration only adds the `is_active` column it was missing,
-- it does not create a second project-types table.

create table public.uom (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  code text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uom_tenant_code_unique unique (tenant_id, code)
);

alter table public.uom enable row level security;

create policy "uom_tenant_isolation" on public.uom
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table public.currencies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  code text not null,
  name text not null,
  symbol text,
  is_base_currency boolean not null default false,
  exchange_rate_to_base numeric(18, 6) not null default 1,
  effective_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint currencies_tenant_code_unique unique (tenant_id, code)
);

alter table public.currencies enable row level security;

create policy "currencies_tenant_isolation" on public.currencies
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Only one base currency per tenant. A partial unique index (not a
-- check constraint) since the rule only applies when the flag is true.
create unique index currencies_one_base_per_tenant on public.currencies (tenant_id) where is_base_currency;

-- Self-referencing hierarchy (parent_id nullable = a root code).
create table public.cost_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  parent_id uuid references public.cost_codes (id),
  code text not null,
  description text,
  category text not null check (category in ('labour', 'material', 'plant', 'subcontract', 'overhead')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cost_codes_tenant_code_unique unique (tenant_id, code)
);

alter table public.cost_codes enable row level security;

create policy "cost_codes_tenant_isolation" on public.cost_codes
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Free-text `code`/`label`, not an enum: this module owns the controlled
-- list, other modules (documents.document_type today) reference it by id
-- going forward but the vocabulary itself is operator-configured, same
-- "don't invent a classification scheme" convention as ticket 0104's
-- document_type text column this table now gives an FK alternative to.
create table public.document_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  code text not null,
  label text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_types_tenant_code_unique unique (tenant_id, code)
);

alter table public.document_types enable row level security;

create policy "document_types_tenant_isolation" on public.document_types
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- next_sequence starts at 1 and is only ever read/incremented through
-- the atomic POST /master-data/numbering-schemes/:id/next endpoint
-- (optimistic-concurrency retry in the repository, same "no Postgres
-- function" convention as the rest of this codebase) — never written
-- directly by the plain PATCH edit endpoint.
create table public.numbering_schemes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  entity_type text not null,
  prefix text default '',
  suffix text default '',
  next_sequence integer not null default 1 check (next_sequence > 0),
  padding integer not null default 4 check (padding > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint numbering_schemes_tenant_entity_type_unique unique (tenant_id, entity_type)
);

alter table public.numbering_schemes enable row level security;

create policy "numbering_schemes_tenant_isolation" on public.numbering_schemes
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- project_types (M09a, ticket 0073) already exists with name/code; it
-- was just never given an is_active column, so it could never be
-- archived. Adding the missing column only — not a new table.
alter table public.project_types
  add column is_active boolean not null default true,
  add column updated_at timestamptz not null default now();

-- Retrofit: additive nullable FKs so documents/estimate_lines can move
-- off free text onto the new controlled lists without breaking any
-- existing row (the old text columns are kept, per the ticket's own
-- "backwards-compat" instruction).
alter table public.documents
  add column document_type_id uuid references public.document_types (id);

alter table public.estimate_lines
  add column cost_code_id uuid references public.cost_codes (id);

-- Platform-administrator-only for writes; reads are open to any
-- authenticated tenant member (same broad-read/narrow-write split as
-- every other shared-config module, e.g. catalogue.workitem.manage).
insert into public.permissions (id, description) values
  ('master-data.manage', 'Create, edit and archive master data (UoM, currencies, cost codes, document types, project types, numbering schemes)');

insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions
where id = 'master-data.manage';
