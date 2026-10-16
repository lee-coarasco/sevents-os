-- M11a: Tender document register & scope matrix/clarification log
-- (ticket 0096). Extends ticket 0091's (M10b) `tender_submissions`
-- table — these are child rows of a tender, not a new tender entity.
--
-- BRD §10.1 step 5 ("tender documents and deadline register") plus the
-- catalogue's tender-intake cluster (ticket 0014 rows 217-221): the
-- document register (drawings/BOQ/specifications/addenda metadata) and
-- the clarification log (missing-information/contradiction/
-- commercial-risk queries and responses) are both real relational
-- rows, not jsonb blobs. `storage_reference` is a plain text/URL field
-- only — no bespoke upload pipeline or file_objects FK invented here;
-- that belongs to M13 (Documents, Drawings & Records), same restraint
-- ticket 0091 already took with `evidence_reference`.

create table public.tender_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  tender_submission_id uuid not null references public.tender_submissions (id),
  document_type text not null,
  title text not null,
  document_number text,
  revision text,
  received_date date,
  storage_reference text,
  created_by uuid references public.app_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tender_documents enable row level security;

create policy "tender_documents_tenant_isolation" on public.tender_documents
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create index tender_documents_tender_submission_id_idx on public.tender_documents (tender_submission_id);

-- Scope matrix / clarification log: a query raised against the tender
-- package and (eventually) its response — not a two-way messaging
-- feature, same "log, not inbox" shape as ticket 0091's
-- client_communications.
create table public.tender_clarifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  tender_submission_id uuid not null references public.tender_submissions (id),
  item text not null,
  raised_by uuid not null references public.app_users (id),
  raised_at timestamptz not null default now(),
  response text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tender_clarifications enable row level security;

create policy "tender_clarifications_tenant_isolation" on public.tender_clarifications
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create index tender_clarifications_tender_submission_id_idx on public.tender_clarifications (tender_submission_id);

-- Permission: this module's named owners (BRD §7 row 437: "Estimator;
-- Commercial; Technical; Finance") are a different cluster from M10's
-- Sales/Marketing/Technical (which owns `crm.lead.manage`) — so this
-- gets its own permission rather than reusing M10's, granted to the
-- real role IDs matching that cluster plus the platform administrator.
insert into public.permissions (id, description) values
  ('tendering.document.manage', 'Create or update a tender document register entry or clarification log entry');

insert into public.role_permissions (role_id, permission_id) values
  ('role.platform_administrator', 'tendering.document.manage'),
  ('role.civil_estimator', 'tendering.document.manage'),
  ('role.mep_estimator', 'tendering.document.manage'),
  ('role.quantity_surveyor', 'tendering.document.manage'),
  ('role.cto', 'tendering.document.manage'),
  ('role.cfo', 'tendering.document.manage');
