-- M06d: Workflow Migration for Active Instances (ticket 0063)
--
-- Fourth and last of four M06 sub-tickets. Builds the explicit, audited
-- migration workflow BRD §5.4.2/§8.2/FR-WI-011 require before a running
-- workflow_instance's workflow_version_id pin (ticket 0062) is ever
-- moved — preview is read-only, execute only moves instances the
-- preview marked auto-mappable, and nothing happens without a prior
-- approval row's worth of state (approved_by/approved_at) on the
-- migration itself. Same NOT NULL tenant_id + RLS pattern as every
-- other workflow table (tickets 0060-0062) — a migration run belongs
-- to one tenant.

create table public.workflow_migrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) default public.current_tenant_id(),
  workflow_definition_id uuid not null references public.workflow_definitions (id),
  from_version_id uuid not null references public.workflow_versions (id),
  to_version_id uuid not null references public.workflow_versions (id),
  status text not null default 'draft' check (status in (
    'draft', 'previewed', 'approved', 'executed', 'cancelled'
  )),
  -- Computed by previewMigration (read-only): which running instances on
  -- from_version_id map 1:1 by node_key into to_version_id, and which
  -- don't. Re-running preview overwrites this; execute reads whatever
  -- is stored here at approval time, it never recomputes live.
  impact_summary jsonb not null default '{}'::jsonb,
  approved_by uuid references public.app_users (id),
  approved_at timestamptz,
  executed_by uuid references public.app_users (id),
  executed_at timestamptz,
  created_by uuid references public.app_users (id),
  created_at timestamptz not null default now()
);

alter table public.workflow_migrations enable row level security;

create policy "workflow_migrations_select" on public.workflow_migrations
  for select using (tenant_id = public.current_tenant_id());

create policy "workflow_migrations_insert" on public.workflow_migrations
  for insert with check (tenant_id = public.current_tenant_id());

create policy "workflow_migrations_update" on public.workflow_migrations
  for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Append-only per-instance audit trail of one execute run. One row per
-- old (from_version) step instance that was open at execute time —
-- 'migrated' if a new step instance was created on the target version
-- and the old one superseded, 'skipped' if the preview never marked it
-- auto-mappable, 'failed' if something about that specific move broke.
create table public.workflow_migration_instance_results (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) default public.current_tenant_id(),
  migration_id uuid not null references public.workflow_migrations (id),
  workflow_instance_id uuid not null references public.workflow_instances (id),
  old_step_instance_id uuid references public.workflow_step_instances (id),
  new_step_instance_id uuid references public.workflow_step_instances (id),
  outcome text not null check (outcome in ('migrated', 'skipped', 'failed')),
  detail text,
  created_at timestamptz not null default now()
);

alter table public.workflow_migration_instance_results enable row level security;

create policy "workflow_migration_instance_results_select" on public.workflow_migration_instance_results
  for select using (tenant_id = public.current_tenant_id());

create policy "workflow_migration_instance_results_insert" on public.workflow_migration_instance_results
  for insert with check (tenant_id = public.current_tenant_id());

-- No update/delete policy for anyone: append-only, same construction as
-- workflow_events (ticket 0062).

-- No new permissions: reuses workflow.definition.manage (create/preview/
-- cancel a migration, same authoring tier as everyday draft editing) and
-- workflow.definition.publish (approve/execute, the same two-step gate
-- ticket 0060 already set up for publish/rollback) from migration
-- 20261015000005.
