-- M06b: Workflow Validation & Simulation (ticket 0061)
--
-- Second of four M06 sub-tickets. Adds BRD §5.4.2's "validate... graph
-- integrity" and "simulate against representative sample cases" record
-- tables. The validator/simulator themselves are pure TypeScript
-- (backend/src/modules/workflow/validation.ts, simulation.ts) — these
-- tables just persist each run's result for audit/display.
--
-- Same NOT NULL tenant_id pattern as ticket 0060's workflow tables (a
-- validation/simulation run belongs to one tenant's own workflow
-- version, not a shared catalogue).

create table public.configuration_validation_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) default public.current_tenant_id(),
  workflow_version_id uuid not null references public.workflow_versions (id),
  run_by uuid references public.app_users (id),
  result text not null check (result in ('pass', 'fail')),
  findings jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz not null default now()
);

alter table public.configuration_validation_runs enable row level security;

create policy "configuration_validation_runs_select" on public.configuration_validation_runs
  for select using (tenant_id = public.current_tenant_id());

create policy "configuration_validation_runs_insert" on public.configuration_validation_runs
  for insert with check (tenant_id = public.current_tenant_id());

create table public.configuration_simulation_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) default public.current_tenant_id(),
  workflow_version_id uuid not null references public.workflow_versions (id),
  run_by uuid references public.app_users (id),
  test_cases jsonb not null default '[]'::jsonb,
  result jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz not null default now()
);

alter table public.configuration_simulation_runs enable row level security;

create policy "configuration_simulation_runs_select" on public.configuration_simulation_runs
  for select using (tenant_id = public.current_tenant_id());

create policy "configuration_simulation_runs_insert" on public.configuration_simulation_runs
  for insert with check (tenant_id = public.current_tenant_id());
