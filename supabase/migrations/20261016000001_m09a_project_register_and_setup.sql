-- M09a: Project register & setup (ticket 0073)
--
-- Extends ticket 0055's (M02) stub public.projects table in place with
-- the FR-PROJ-002 setup fields (BRD §8.4). Does NOT create a second
-- parallel project table. client_name/contract fields are free-text
-- placeholders — the real Client (M10/CRM) and Contract (M23) entities
-- are later phases; project_manager_id/project_type_id are the only
-- real FKs this ticket adds. Document register reuses the existing
-- file_objects.project_id FK from ticket 0055 — no new table needed.

create table public.project_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  name text not null,
  code text,
  created_at timestamptz not null default now(),
  constraint project_types_tenant_name_unique unique (tenant_id, name)
);

alter table public.project_types enable row level security;

create policy "project_types_tenant_isolation" on public.project_types
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

alter table public.projects
  add column client_name text,
  add column location text,
  add column project_type_id uuid references public.project_types (id),
  add column contract_reference text,
  add column contract_value numeric(18, 2),
  add column contract_currency text,
  add column project_manager_id uuid references public.app_users (id),
  add column baseline_start_date date,
  add column baseline_end_date date,
  add column budget_amount numeric(18, 2),
  add column budget_currency text;
