-- M35c: Data export & deletion policy (ticket 0080)
--
-- Request-and-approval flow, not instant self-service: a data_requests
-- row always starts a request_approval workflow instance via the
-- existing M06/M08 seam (same convention as ticket 0075's baseline
-- change requests) and only acts once that instance resolves approved.
-- Export bundles are built on demand from already-tenant-scoped rows,
-- never duplicated into a second store ahead of time. Real deletion is
-- scoped to `app_users` only and is anonymize-in-place, never a hard
-- delete — see DECISIONS.md 2026-10-16 (ticket 0080) for why.

create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  request_type text not null check (request_type in ('export', 'deletion')),
  entity_type text not null,
  entity_id uuid not null,
  reason text not null check (length(trim(reason)) > 0),
  requested_by uuid references public.app_users (id),
  workflow_instance_id uuid not null references public.workflow_instances (id),
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected', 'returned_for_correction', 'refused', 'completed')
  ),
  result jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.data_requests enable row level security;

create policy "data_requests_tenant_isolation" on public.data_requests
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Compliance-sensitive action, same deny-by-default / platform-
-- administrator-only bootstrap precedent as ticket 0079's
-- audit.retention.manage.
insert into public.permissions (id, description) values
  ('data.request.manage', 'Submit and resolve data export/deletion requests');

insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions
where id = 'data.request.manage';
