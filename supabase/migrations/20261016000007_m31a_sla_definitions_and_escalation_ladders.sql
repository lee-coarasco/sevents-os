-- M31a (ticket 0081): SLA definitions & escalation ladders.
-- BRD §7 M31 module row + §8.11 FR-NOT-001/002 as they apply to
-- escalation specifically (notification delivery itself is ticket 0082).
--
-- Every threshold/delay here is caller-supplied — no default calendar,
-- warning threshold or escalation delay is invented (CLAUDE.md: must
-- not invent SLA values). A `workflow_nodes.config.slaDefinitionKey`
-- (free-form jsonb, same convention as every other node type's config,
-- e.g. request_approval's `roleId`) opts a node into SLA tracking by
-- referencing one of these definitions by key; nodes with no such key
-- are simply never SLA-tracked.

create table public.sla_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  key text not null,
  name text not null,
  -- Seconds of elapsed, unpaused step time before this SLA's state
  -- moves from 'on_time' to 'warning'.
  warning_threshold_seconds integer not null check (warning_threshold_seconds > 0),
  -- Seconds before state moves to 'breached'. Must exceed the warning
  -- threshold — a breach is always preceded by a warning.
  breach_threshold_seconds integer not null check (breach_threshold_seconds > warning_threshold_seconds),
  created_by uuid references public.app_users (id),
  created_at timestamptz not null default now(),
  constraint sla_definitions_tenant_key_unique unique (tenant_id, key)
);

alter table public.sla_definitions enable row level security;

create policy "sla_definitions_tenant_isolation" on public.sla_definitions
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Ordered rungs an SLA's breach climbs through. Rung 1 is typically
-- delay_after_breach_seconds = 0 (fires immediately on breach); later
-- rungs fire progressively later if the breach is still unresolved.
create table public.escalation_rungs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  sla_definition_id uuid not null references public.sla_definitions (id),
  rung_order integer not null check (rung_order > 0),
  delay_after_breach_seconds integer not null check (delay_after_breach_seconds >= 0),
  action_type text not null check (action_type in ('notify_owner', 'notify_role')),
  -- Required when action_type = 'notify_role' (which canonical role,
  -- M03's role_definitions.id); null for 'notify_owner', which always
  -- targets the step's own owner_id, not a configured role.
  action_role_id text,
  created_at timestamptz not null default now(),
  constraint escalation_rungs_role_required_for_notify_role check (
    action_type <> 'notify_role' or action_role_id is not null
  ),
  constraint escalation_rungs_tenant_definition_order_unique unique (tenant_id, sla_definition_id, rung_order)
);

alter table public.escalation_rungs enable row level security;

create policy "escalation_rungs_tenant_isolation" on public.escalation_rungs
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Defining/editing SLA policy is administration, distinct from working
-- a task under one (workflow.instance.act, already gates that) — same
-- "administration vs. doing the work" split as every other module.
insert into public.permissions (id, description) values
  ('workflow.sla.manage', 'Define and edit SLA definitions and escalation ladders');

insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions
where id = 'workflow.sla.manage';
