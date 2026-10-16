-- M09b: WBS, milestones, schedule activities, dependencies & progress
-- (ticket 0074). BRD §8.4 FR-PROJ-003. §6.2 entities: WBSNode,
-- Milestone, ScheduleActivity, ProgressEntry.
--
-- No critical-path/float computation lives here — that is M18
-- (Schedule, Progress & Resource Planning), a later Phase 3+ module.
-- This ticket only stores the structure, the dependency edges and the
-- planned/actual facts FR-PROJ-003 asks for.

create table public.wbs_nodes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  project_id uuid not null references public.projects (id),
  parent_wbs_node_id uuid references public.wbs_nodes (id),
  code text not null,
  name text not null,
  sequence integer not null default 0,
  -- Seam for M21 (Finance) to tag a WBS node with a real cost code once
  -- that entity exists. No FK target yet — deliberately nullable with
  -- no references clause, not a placeholder for a table built here.
  cost_code_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wbs_nodes_tenant_project_code_unique unique (tenant_id, project_id, code)
);

alter table public.wbs_nodes enable row level security;

create policy "wbs_nodes_tenant_isolation" on public.wbs_nodes
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  project_id uuid not null references public.projects (id),
  wbs_node_id uuid references public.wbs_nodes (id),
  name text not null,
  target_date date not null,
  -- Null until reached.
  actual_date date,
  status text not null default 'pending' check (status in ('pending', 'achieved', 'missed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.milestones enable row level security;

create policy "milestones_tenant_isolation" on public.milestones
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table public.schedule_activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  project_id uuid not null references public.projects (id),
  wbs_node_id uuid references public.wbs_nodes (id),
  name text not null,
  planned_start date,
  planned_end date,
  actual_start date,
  actual_end date,
  percent_complete numeric(5, 2) not null default 0
    check (percent_complete >= 0 and percent_complete <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.schedule_activities enable row level security;

create policy "schedule_activities_tenant_isolation" on public.schedule_activities
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- FR-PROJ-003 asks for "dependencies," not a scheduling engine — these
-- four types are the minimum vocabulary needed to express a dependency
-- edge, not a speculative full PM-software enum. No float/critical-path
-- is computed from this table.
create table public.schedule_activity_dependencies (
  activity_id uuid not null references public.schedule_activities (id),
  depends_on_activity_id uuid not null references public.schedule_activities (id),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  dependency_type text not null default 'finish_to_start'
    check (dependency_type in ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish')),
  created_at timestamptz not null default now(),
  primary key (activity_id, depends_on_activity_id),
  constraint schedule_activity_dependencies_no_self_reference check (activity_id <> depends_on_activity_id)
);

alter table public.schedule_activity_dependencies enable row level security;

create policy "schedule_activity_dependencies_tenant_isolation" on public.schedule_activity_dependencies
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Append-only, same construction as workflow_events/auth_audit_log — a
-- progress entry is a point-in-time fact; corrections are a new entry.
create table public.progress_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  schedule_activity_id uuid not null references public.schedule_activities (id),
  recorded_by uuid references public.app_users (id),
  recorded_at timestamptz not null default now(),
  percent_complete numeric(5, 2) not null check (percent_complete >= 0 and percent_complete <= 100),
  note text
);

create index progress_entries_activity_idx on public.progress_entries (schedule_activity_id);

alter table public.progress_entries enable row level security;

create policy "progress_entries_select" on public.progress_entries
  for select using (tenant_id = public.current_tenant_id());

create policy "progress_entries_insert" on public.progress_entries
  for insert with check (tenant_id = public.current_tenant_id());

-- No update/delete policy for anyone: append-only.

-- WBS/milestone/activity/dependency CRUD reuses tenancy.project.manage
-- (ticket 0056) — this is project administration, not a new actor
-- class. Recording progress is a distinct, more widely held action
-- (e.g. a site engineer updating % complete), hence its own permission.
insert into public.permissions (id, description) values
  ('project.progress.record', 'Record a progress entry against a schedule activity');

insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions
where id in ('project.progress.record');
