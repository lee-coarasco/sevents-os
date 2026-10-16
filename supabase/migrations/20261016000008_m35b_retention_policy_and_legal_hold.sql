-- M35b: Retention policy & legal hold (ticket 0079)
--
-- Framework only, per CLAUDE.md ("AI agents must not invent authority
-- limits, SLA values, approval policies or production data") and this
-- ticket's own scope note: no seeded rows, no default retention period
-- for any entity type, no scheduled purge job (none exists in this
-- codebase). retention_policies/legal_holds are both plain tenant-
-- scoped tables, same isolation pattern as every non-catalogue table
-- in this project (companies/branches/role_assignments/...), not the
-- nullable-tenant shared-catalogue pattern.

create table public.retention_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  entity_type text not null,
  retention_days integer not null check (retention_days > 0),
  set_by uuid references public.app_users (id),
  set_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.retention_policies enable row level security;

create policy "retention_policies_tenant_isolation" on public.retention_policies
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- entity_id null means "hold everything of this entity_type"; a specific
-- id means one record. Never deleted once placed — release is a
-- separate, audited action that fills released_by/released_at, same
-- "compensating record, never delete" pattern as ticket 0066's
-- approval_revocations.
create table public.legal_holds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  entity_type text not null,
  entity_id uuid,
  reason text not null check (length(trim(reason)) > 0),
  placed_by uuid references public.app_users (id),
  placed_at timestamptz not null default now(),
  released_by uuid references public.app_users (id),
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_holds_release_pair check (
    (released_by is null and released_at is null) or
    (released_by is not null and released_at is not null)
  )
);

alter table public.legal_holds enable row level security;

create policy "legal_holds_tenant_isolation" on public.legal_holds
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Compliance-officer action, distinct from audit.log.view (ticket 0078)
-- — same "narrower action gets its own permission" pattern as every
-- prior M09 sub-ticket. Deny-by-default: only the platform administrator
-- role is granted it here, same bootstrap-only precedent as every other
-- permission this project seeds.
insert into public.permissions (id, description) values
  ('audit.retention.manage', 'Create retention policies and place/release legal holds');

insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions
where id = 'audit.retention.manage';
