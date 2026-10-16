-- M10a: Client/Contact/Lead/Opportunity core data model (ticket 0090)
--
-- BRD §8.5 FR-CRM-001/FR-CRM-002, §6.2 entities: Client, Contact, Lead,
-- Opportunity. BRD uses "Lead" and "Opportunity" for what is the same
-- entity progressing through `stage` (§10.1's "Opportunity to project"
-- step list) — modeled as one `opportunities` table, not two, per the
-- ticket's own "pick one name and be consistent" instruction. `stage`
-- only covers the steps up through this module's own scope (lead
-- through won/lost); feasibility/estimate/bid-no-bid stages belong to
-- M11/M12 and are not invented here.
--
-- No column has a country-specific format (trade licence numbers vary
-- by jurisdiction) — same country-agnostic rule as every prior
-- migration.

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  name text not null,
  trade_license_number text,
  registration_country text,
  -- FK added below, once public.contacts exists (clients <-> contacts
  -- is a two-way reference: a contact belongs to a client, a client has
  -- one designated primary contact).
  primary_contact_id uuid,
  created_by uuid references public.app_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients enable row level security;

create policy "clients_tenant_isolation" on public.clients
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  client_id uuid not null references public.clients (id),
  name text not null,
  title text,
  email text,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contacts enable row level security;

create policy "contacts_tenant_isolation" on public.contacts
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

alter table public.clients
  add constraint clients_primary_contact_fk foreign key (primary_contact_id) references public.contacts (id);

create index contacts_client_id_idx on public.contacts (client_id);

-- FR-CRM-002: duplicate detection is a human-resolved search (GET
-- .../search), not an automatic merge or a hard uniqueness constraint —
-- a real client/contact can legitimately share a name. These indexes
-- just make that search fast.
create index clients_name_trgm_idx on public.clients (lower(name));
create index contacts_name_trgm_idx on public.contacts (lower(name));
create index contacts_email_idx on public.contacts (lower(email));
create index contacts_phone_idx on public.contacts (phone);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  client_id uuid not null references public.clients (id),
  title text not null,
  -- FR-CRM-001: source, client, owner, stage, expected value,
  -- probability, next action and due date are every one of these real
  -- columns, not a jsonb catch-all.
  source text not null,
  owner_id uuid not null references public.app_users (id),
  stage text not null default 'lead' check (
    stage in ('lead', 'qualified', 'site_visit', 'tender', 'negotiation', 'won', 'lost')
  ),
  expected_value numeric,
  probability integer check (probability is null or (probability >= 0 and probability <= 100)),
  next_action text,
  due_date date,
  created_by uuid references public.app_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.opportunities enable row level security;

create policy "opportunities_tenant_isolation" on public.opportunities
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create index opportunities_client_id_idx on public.opportunities (client_id);
create index opportunities_stage_idx on public.opportunities (stage);

-- Permission: an ordinary departmental CRUD action with real named
-- owners already in the role catalogue (BRD §7: "Sales; Marketing;
-- Technical" own this module) — unlike this project's
-- compliance-sensitive permissions, deny-to-everyone-but-admin would
-- just be unrequested friction, so this is granted to the Marketing &
-- Sales cluster too, not just role.platform_administrator.
insert into public.permissions (id, description) values
  ('crm.lead.manage', 'Create or update a client, contact, lead or opportunity');

insert into public.role_permissions (role_id, permission_id) values
  ('role.platform_administrator', 'crm.lead.manage'),
  ('role.business_development_executive', 'crm.lead.manage'),
  ('role.marketing_manager_lead', 'crm.lead.manage'),
  ('role.cmo', 'crm.lead.manage');
