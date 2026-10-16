-- M09c: baseline snapshots & baseline-change control (ticket 0075).
-- BRD §8.4 FR-PROJ-004. §6.2 entity: ProjectBaseline.
--
-- Two tables: project_baselines (a frozen snapshot, never a live view)
-- and project_baseline_change_requests (the approval-gated path to a
-- new baseline). A change request never runs its own approval logic —
-- it plugs into the existing workflow_instances/request_approval seam
-- ticket 0066 (M08) built; see backend/src/modules/projects/service.ts
-- for how a request's resolution is read back from that seam.

create table public.project_baselines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  project_id uuid not null references public.projects (id),
  -- Incrementing per project, starting at 1. Enforced in application
  -- code (read current max + 1 inside the same request), not a
  -- sequence, since it must restart at 1 per project.
  version integer not null check (version > 0),
  -- The frozen copy: WBS/milestone/activity planned dates and budget
  -- at the moment this baseline was set. Free-shape jsonb, same
  -- convention as workflow_instances.context — this ticket does not
  -- define a rigid schema for it, the projects module does.
  snapshot jsonb not null,
  status text not null default 'approved'
    check (status in ('draft', 'pending_approval', 'approved', 'superseded')),
  created_by uuid references public.app_users (id),
  created_at timestamptz not null default now(),
  constraint project_baselines_tenant_project_version_unique unique (tenant_id, project_id, version)
);

alter table public.project_baselines enable row level security;

create policy "project_baselines_tenant_isolation" on public.project_baselines
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- FR-PROJ-004: "baseline changes require reason, impact analysis and
-- approval" — reason/impact_analysis are both required, non-blank.
-- workflow_instance_id is not null: a change request always starts a
-- real approval workflow instance (ticket 0066's request_approval
-- seam), this table never runs parallel approval logic of its own.
create table public.project_baseline_change_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  project_id uuid not null references public.projects (id),
  current_baseline_id uuid not null references public.project_baselines (id),
  proposed_snapshot jsonb not null,
  reason text not null check (length(trim(reason)) > 0),
  impact_analysis text not null check (length(trim(impact_analysis)) > 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'returned_for_correction')),
  submitted_by uuid references public.app_users (id),
  workflow_instance_id uuid not null references public.workflow_instances (id),
  -- Set once status moves to 'approved' — points at the new
  -- project_baselines row this request produced.
  resulting_baseline_id uuid references public.project_baselines (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_baseline_change_requests enable row level security;

create policy "project_baseline_change_requests_tenant_isolation" on public.project_baseline_change_requests
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Proposing a baseline change is a distinct, narrower action than
-- general project setup (tenancy.project.manage) — BRD doesn't say the
-- same role does both, so this is its own permission, deny-by-default
-- like every other permission added so far.
insert into public.permissions (id, description) values
  ('project.baseline.manage', 'Set a project''s initial baseline and propose/review baseline change requests');

insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions
where id = 'project.baseline.manage';
