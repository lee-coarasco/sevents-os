-- M12a: Design briefs (ticket 0153).
--
-- Project-level planning artefacts that drive the engineering scope for a
-- discipline area. They reference (soft-link) M13 documents but are not
-- document revisions — they live in their own table so a project engineer
-- can manage them without needing the Document Controller permission.

create table public.design_briefs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  project_id uuid not null references public.projects (id),
  title text not null,
  discipline text,
  scope_description text,
  status text not null default 'draft'
    check (status in ('draft', 'issued', 'superseded')),
  -- Soft references only — no FK array in Postgres; integrity enforced
  -- at the application layer (get-document returns 404 if the id is gone).
  reference_document_ids uuid[] not null default '{}',
  issued_by uuid references public.app_users (id),
  issued_at timestamptz,
  created_by uuid references public.app_users (id),
  created_at timestamptz not null default now()
);

alter table public.design_briefs enable row level security;

create policy "design_briefs_tenant_isolation" on public.design_briefs
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create index design_briefs_project_id_idx on public.design_briefs (project_id);
create index design_briefs_status_idx on public.design_briefs (status);

-- Permission: write actions for design briefs.
-- Lead engineer and project engineer can manage briefs; platform admin
-- as always. Read access is open to any authenticated tenant member.
insert into public.permissions (id, description) values
  ('engineering.design_brief.manage', 'Create or update a design brief');

insert into public.role_permissions (role_id, permission_id) values
  ('role.platform_administrator',  'engineering.design_brief.manage'),
  ('role.architect_lead',          'engineering.design_brief.manage'),
  ('role.project_engineer_lead',   'engineering.design_brief.manage'),
  ('role.structural_designer',     'engineering.design_brief.manage'),
  ('role.site_civil_engineer',     'engineering.design_brief.manage'),
  ('role.site_mep_engineer',       'engineering.design_brief.manage');
