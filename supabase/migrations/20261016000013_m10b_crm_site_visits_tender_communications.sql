-- M10b: Site visits, tender deadline tracking & client communication log
-- (ticket 0091). Depends on ticket 0090's opportunities/clients.
--
-- FR-CRM-003: "tender deadlines and submission evidence are tracked."
-- BRD gives no indication multiple deadlines exist per opportunity in
-- this ticket's scope (that granularity — clarification vs. final
-- submission vs. resubmission — belongs to M11's tender/bid machinery),
-- but a small table (rather than columns on opportunities) still costs
-- nothing and allows more than one submission per opportunity without a
-- later migration. "Submission evidence" is a reference/note, not a
-- document-management feature (that's M13/M11's job) — no file_objects
-- FK, since file_objects requires a company_id opportunities don't carry.

create table public.site_visits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  opportunity_id uuid not null references public.opportunities (id),
  visited_by uuid not null references public.app_users (id),
  visit_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_visits enable row level security;

create policy "site_visits_tenant_isolation" on public.site_visits
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create index site_visits_opportunity_id_idx on public.site_visits (opportunity_id);

create table public.tender_submissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  opportunity_id uuid not null references public.opportunities (id),
  deadline_date date not null,
  submitted_at timestamptz,
  evidence_reference text,
  notes text,
  created_by uuid references public.app_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tender_submissions enable row level security;

create policy "tender_submissions_tenant_isolation" on public.tender_submissions
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create index tender_submissions_opportunity_id_idx on public.tender_submissions (opportunity_id);

-- A log, not a two-way messaging feature — no send/receive, same
-- "ticket 0082 is the only place this project sends anything" rule the
-- ticket itself called out.
create table public.client_communications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  client_id uuid not null references public.clients (id),
  opportunity_id uuid references public.opportunities (id),
  channel text not null,
  summary text not null,
  logged_by uuid not null references public.app_users (id),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.client_communications enable row level security;

create policy "client_communications_tenant_isolation" on public.client_communications
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create index client_communications_client_id_idx on public.client_communications (client_id);
create index client_communications_opportunity_id_idx on public.client_communications (opportunity_id);

-- Same module, same permission as ticket 0090 — no new permission row;
-- this ticket adds no new actor beyond who can already manage
-- clients/opportunities.
