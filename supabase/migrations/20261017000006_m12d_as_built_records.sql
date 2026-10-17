-- M12d: As-built closeout records (ticket 0156).
--
-- Marks a drawing as confirmed as-built at project closeout. One record
-- per document per project. Linked to specific M13 document revisions for
-- the original design and the as-built mark-up.

create table public.as_built_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  project_id uuid not null references public.projects (id),
  document_id uuid not null references public.documents (id),
  original_revision_id uuid references public.document_revisions (id),
  as_built_revision_id uuid references public.document_revisions (id),
  confirmed_by uuid references public.app_users (id),
  confirmed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  -- One as-built record per document per project.
  unique (tenant_id, project_id, document_id)
);

alter table public.as_built_records enable row level security;

create policy "as_built_records_tenant_isolation" on public.as_built_records
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create index as_built_records_project_id_idx on public.as_built_records (project_id);
create index as_built_records_document_id_idx on public.as_built_records (document_id);

insert into public.permissions (id, description) values
  ('engineering.as_built.manage', 'Create or confirm an as-built record');

insert into public.role_permissions (role_id, permission_id) values
  ('role.platform_administrator',  'engineering.as_built.manage'),
  ('role.architect_lead',          'engineering.as_built.manage'),
  ('role.project_engineer_lead',   'engineering.as_built.manage'),
  ('role.site_civil_engineer',     'engineering.as_built.manage'),
  ('role.document_controller',     'engineering.as_built.manage');
