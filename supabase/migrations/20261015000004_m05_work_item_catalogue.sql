-- M05: Work-Item Catalogue & Disposition (ticket 0058)
--
-- Imports the 1,308-row source catalogue as real data and stores the
-- normalized classification (canonical role mapping, disposition,
-- status, risk/priority/phase placeholders) that tickets 0001-0051
-- already produced in docs/catalogue/disposition-workbook.csv. Does NOT
-- build the configuration studio/workflow engine itself (BRD §5.4,
-- §8.2's trigger/form/SLA/simulation requirements) — that is M06
-- (ticket 0059), which depends on the work_item_definitions table this
-- migration creates.
--
-- Same shared-taxonomy precedent as ticket 0056's role_definitions
-- (recorded in DECISIONS.md, 2026-10-15 "RoleDefinition/Permission
-- catalogue is platform-wide"): the work-item catalogue is a canonical
-- library, not per-tenant business data. tenant_id is nullable on all
-- four tables below; a NULL row is the shared platform catalogue, a
-- non-NULL row is reserved for a future tenant-specific custom entry.
--
-- source_catalogue_imports / source_work_items are write-once by
-- service-role tooling (the ticket 0058 CLI import script), same as
-- role_definitions: no insert/update/delete policy for authenticated.
-- work_item_definitions gets an authenticated UPDATE policy (process
-- owners edit disposition/priority/risk/etc. through the app) but no
-- authenticated INSERT (only the bulk import creates rows).
-- work_item_definition_versions gets an authenticated INSERT (created
-- alongside an authenticated update) and is otherwise append-only, same
-- construction as ticket 0054's auth_audit_log.

create table public.source_catalogue_imports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id),
  source_file_name text not null,
  source_file_checksum text not null,
  row_count integer not null,
  imported_by uuid references public.app_users (id),
  imported_at timestamptz not null default now()
);

alter table public.source_catalogue_imports enable row level security;

create policy "source_catalogue_imports_select" on public.source_catalogue_imports
  for select
  using (tenant_id is null or tenant_id = public.current_tenant_id());

-- No insert/update/delete policy for anon/authenticated: written only by
-- the service-role import script (backend/src/scripts/import-catalogue.ts).

create table public.source_work_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id),
  import_id uuid not null references public.source_catalogue_imports (id),
  source_serial integer not null unique,
  department text not null,
  work_item_name text not null,
  who_is_responsible text not null,
  description text,
  trigger_text text,
  action_text text,
  output_evidence text,
  control_handoff text,
  continuity_escalation text,
  timing text,
  governance_understanding text,
  governance_sop_inputs text,
  created_at timestamptz not null default now()
);

alter table public.source_work_items enable row level security;

create policy "source_work_items_select" on public.source_work_items
  for select
  using (tenant_id is null or tenant_id = public.current_tenant_id());

-- No insert/update/delete policy for anon/authenticated: raw provenance,
-- never edited after import (BRD §6.3 "never overwrite raw source text").

create table public.work_item_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id),
  source_work_item_id uuid not null unique references public.source_work_items (id),
  canonical_role_id text references public.role_definitions (id),
  department_cluster text,
  disposition text not null check (disposition in (
    'Configure workflow',
    'Configure approval/decision',
    'Track obligation/document',
    'Periodic review/monitor',
    'Reference/policy only',
    'Clarify/de-duplicate',
    'Defer'
  )),
  status text not null default 'draft' check (status in (
    'draft', 'under_review', 'approved', 'published', 'retired'
  )),
  priority text,
  risk_tier text,
  phase_target text,
  validation_state text not null default 'not_validated',
  configuration_status text not null default 'unconfigured',
  -- Placeholders for M06 (ticket 0059) to wire up once a capability
  -- catalogue and workflow_definitions table exist. No FK yet.
  capability_key text,
  workflow_template_id uuid,
  ticket_ref text,
  current_version integer not null default 1,
  created_by uuid references public.app_users (id),
  updated_by uuid references public.app_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.work_item_definitions enable row level security;

create policy "work_item_definitions_select" on public.work_item_definitions
  for select
  using (tenant_id is null or tenant_id = public.current_tenant_id());

create policy "work_item_definitions_update" on public.work_item_definitions
  for update
  using (tenant_id is null or tenant_id = public.current_tenant_id())
  with check (tenant_id is null or tenant_id = public.current_tenant_id());

-- No insert/delete policy for anon/authenticated: rows are created only
-- by the bulk import (service-role); process owners may only update an
-- existing row's normalized fields, gated by catalogue.workitem.manage
-- at the application layer (see backend/src/modules/catalogue/guard
-- usage in routes.ts), same as every other mutation in this codebase.

create table public.work_item_definition_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id),
  work_item_definition_id uuid not null references public.work_item_definitions (id),
  version integer not null,
  snapshot jsonb not null,
  change_note text,
  created_by uuid references public.app_users (id),
  created_at timestamptz not null default now(),
  unique (work_item_definition_id, version)
);

alter table public.work_item_definition_versions enable row level security;

create policy "work_item_definition_versions_select" on public.work_item_definition_versions
  for select
  using (tenant_id is null or tenant_id = public.current_tenant_id());

create policy "work_item_definition_versions_insert" on public.work_item_definition_versions
  for insert
  with check (tenant_id is null or tenant_id = public.current_tenant_id());

-- No update/delete policy for anyone: append-only, same construction as
-- ticket 0054's auth_audit_log.

insert into public.permissions (id, description) values
  ('catalogue.workitem.import', 'Bulk-import the work-item catalogue'),
  ('catalogue.workitem.manage', 'View and edit work-item catalogue definitions');

-- Same deny-by-default bootstrap as ticket 0056: only Platform
-- Administrator holds these by default. A future admin action grants
-- catalogue.workitem.manage to a Process Admin / CRO-style role; not
-- invented here.
insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions
where id in ('catalogue.workitem.import', 'catalogue.workitem.manage');
