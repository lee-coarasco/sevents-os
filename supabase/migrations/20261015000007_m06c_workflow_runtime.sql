-- M06c: Workflow Runtime / Instance Engine (ticket 0062)
--
-- Third of four M06 sub-tickets. Builds the instance/step-instance/
-- event data model the executor (backend/src/modules/workflow/
-- runtime.ts, service.ts) reads and writes at runtime. Does NOT build
-- the task-queue/My Work UI (M07) or the approval workflow UI (M08) —
-- those modules will read/write workflow_step_instances once they
-- exist (see the seam comment on WorkflowStepInstance.assigned_to in
-- types.ts); this migration only creates the rows they will plug into.
--
-- Same NOT NULL tenant_id + RLS pattern as tickets 0060/0061's
-- workflow tables — a running instance belongs to one tenant, not a
-- shared catalogue.

create table public.workflow_instances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) default public.current_tenant_id(),
  workflow_definition_id uuid not null references public.workflow_definitions (id),
  -- Pinned at creation (BRD §6.3: "workflow instances reference the
  -- exact published workflow/configuration version used at
  -- creation"). Application code must never update this column after
  -- insert, even if a newer version of the same definition publishes
  -- later — enforced in code (service.ts never issues an update to
  -- this column) since Postgres has no first-class "immutable after
  -- insert" constraint; the _update policy below still scopes any
  -- update to tenant_id the same as every other mutable column.
  workflow_version_id uuid not null references public.workflow_versions (id),
  status text not null default 'running' check (status in ('running', 'paused', 'completed', 'cancelled')),
  started_by uuid references public.app_users (id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  context jsonb not null default '{}'::jsonb
);

alter table public.workflow_instances enable row level security;

create policy "workflow_instances_select" on public.workflow_instances
  for select using (tenant_id = public.current_tenant_id());

create policy "workflow_instances_insert" on public.workflow_instances
  for insert with check (tenant_id = public.current_tenant_id());

create policy "workflow_instances_update" on public.workflow_instances
  for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table public.workflow_step_instances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) default public.current_tenant_id(),
  workflow_instance_id uuid not null references public.workflow_instances (id),
  node_id uuid not null references public.workflow_nodes (id),
  status text not null default 'pending' check (status in (
    'pending', 'active', 'waiting', 'completed', 'skipped', 'failed'
  )),
  -- A user id (assign_role_user once resolved to a person) or role id
  -- (create_task/request_approval before anyone claims it); null once
  -- no human hand-off is outstanding. M07/M08 seam — see types.ts.
  assigned_to text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  -- Form data / evidence reference / approval decision / call_service
  -- response recorded against this step.
  output jsonb not null default '{}'::jsonb
);

alter table public.workflow_step_instances enable row level security;

create policy "workflow_step_instances_select" on public.workflow_step_instances
  for select using (tenant_id = public.current_tenant_id());

create policy "workflow_step_instances_insert" on public.workflow_step_instances
  for insert with check (tenant_id = public.current_tenant_id());

create policy "workflow_step_instances_update" on public.workflow_step_instances
  for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Append-only audit/event trail for an instance's whole lifecycle
-- (started/step_activated/step_completed/paused/resumed/cancelled/
-- completed/escalated/timer_fired/gate_blocked/gate_exception/etc —
-- see WorkflowEventType in types.ts). Same construction as
-- configuration_changes (ticket 0060) and auth_audit_log (ticket
-- 0054): no update/delete policy for anyone.
create table public.workflow_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) default public.current_tenant_id(),
  workflow_instance_id uuid not null references public.workflow_instances (id),
  step_instance_id uuid references public.workflow_step_instances (id),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.workflow_events enable row level security;

create policy "workflow_events_select" on public.workflow_events
  for select using (tenant_id = public.current_tenant_id());

create policy "workflow_events_insert" on public.workflow_events
  for insert with check (tenant_id = public.current_tenant_id());

-- No update/delete policy for anyone: append-only.

insert into public.permissions (id, description) values
  ('workflow.instance.manage', 'Start, pause, resume and cancel a workflow instance'),
  ('workflow.instance.act', 'Complete a workflow step instance (the eventual M07/M08 task-queue/approval-inbox seam)');

-- Same deny-by-default bootstrap as every permission added so far: only
-- Platform Administrator holds these by default until M07/M08 assign
-- them to real process-owner/approver roles.
insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions
where id in ('workflow.instance.manage', 'workflow.instance.act');
