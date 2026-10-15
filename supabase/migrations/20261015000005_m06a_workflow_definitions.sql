-- M06a: Workflow Definition Data Model, CRUD & Versioning (ticket 0060)
--
-- First of four M06 sub-tickets (ticket 0059 split this module per its
-- own instruction, see DECISIONS.md 2026-10-15 "M06 split into four
-- sequential sub-tickets"). Builds the data model and author/publish
-- lifecycle for BRD §5.4's workflow configuration domain. Does NOT
-- build validation/simulation (ticket 0061), the runtime engine that
-- executes instances (ticket 0062), or the migration workflow for
-- moving active instances to a newer version (ticket 0063).
--
-- Unlike M03's role_definitions and M05's work-item catalogue tables
-- (which use a nullable tenant_id for a shared platform-wide
-- taxonomy), every table here uses a plain NOT NULL tenant_id: a
-- workflow definition is a concrete per-tenant business-process
-- configuration (BRD §5.4.1 item 3), not a shared taxonomy. Same
-- isolation pattern as companies/branches/projects (ticket 0055).

create table public.workflow_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) default public.current_tenant_id(),
  key text not null,
  name text not null,
  description text,
  -- Links back to work_item_definitions.capability_key (ticket 0058's
  -- placeholder) once a real capability catalogue exists; no FK yet.
  capability_key text,
  status text not null default 'draft' check (status in (
    'draft', 'under_review', 'approved', 'published', 'retired'
  )),
  -- Version number of the currently published version new instances
  -- would pin to. Null until the first publish; only changes on
  -- publish/rollback, never on draft creation (BRD §5.4.2: "existing
  -- instances remain pinned," so this pointer must not move just
  -- because someone started editing a new draft).
  current_version integer,
  created_by uuid references public.app_users (id),
  updated_by uuid references public.app_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key)
);

alter table public.workflow_definitions enable row level security;

create policy "workflow_definitions_select" on public.workflow_definitions
  for select using (tenant_id = public.current_tenant_id());

create policy "workflow_definitions_insert" on public.workflow_definitions
  for insert with check (tenant_id = public.current_tenant_id());

create policy "workflow_definitions_update" on public.workflow_definitions
  for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table public.workflow_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) default public.current_tenant_id(),
  workflow_definition_id uuid not null references public.workflow_definitions (id),
  version integer not null,
  -- A version's own lifecycle: draft while authored, published once
  -- live, retired if explicitly deprecated. Never flips back once
  -- published — BRD §5.4.2 "never erase historical versions or rewrite
  -- completed approvals."
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  effective_from timestamptz,
  effective_to timestamptz,
  -- Set when this version's content is a republish of an earlier
  -- version (BRD §5.4.2 "rollback means publish a previous
  -- configuration version").
  rollback_of_version integer,
  published_by uuid references public.app_users (id),
  published_at timestamptz,
  created_by uuid references public.app_users (id),
  created_at timestamptz not null default now(),
  unique (workflow_definition_id, version)
);

alter table public.workflow_versions enable row level security;

create policy "workflow_versions_select" on public.workflow_versions
  for select using (tenant_id = public.current_tenant_id());

create policy "workflow_versions_insert" on public.workflow_versions
  for insert with check (tenant_id = public.current_tenant_id());

create policy "workflow_versions_update" on public.workflow_versions
  for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table public.workflow_nodes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) default public.current_tenant_id(),
  workflow_version_id uuid not null references public.workflow_versions (id),
  node_key text not null,
  -- BRD §5.4.3's finite supported step-type list. A new, unsupported
  -- step type is engineering work (a migration + code change), not
  -- configuration.
  node_type text not null check (node_type in (
    'create_task', 'assign_role_user', 'collect_form_data', 'request_upload_evidence',
    'evaluate_condition', 'call_service', 'request_approval', 'send_notification',
    'wait_event_time', 'create_linked_followup', 'escalate', 'complete', 'cancel'
  )),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workflow_version_id, node_key)
);

alter table public.workflow_nodes enable row level security;

create policy "workflow_nodes_select" on public.workflow_nodes
  for select using (tenant_id = public.current_tenant_id());

create policy "workflow_nodes_insert" on public.workflow_nodes
  for insert with check (tenant_id = public.current_tenant_id());

create table public.workflow_conditions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) default public.current_tenant_id(),
  workflow_version_id uuid not null references public.workflow_versions (id),
  -- A deterministic, structured condition ({field, operator, value}) —
  -- never free text or an LLM call (BRD §5.4.3: conditions affecting
  -- money/legal/engineering/safety must be deterministic and testable).
  expression jsonb not null,
  description text,
  created_at timestamptz not null default now()
);

alter table public.workflow_conditions enable row level security;

create policy "workflow_conditions_select" on public.workflow_conditions
  for select using (tenant_id = public.current_tenant_id());

create policy "workflow_conditions_insert" on public.workflow_conditions
  for insert with check (tenant_id = public.current_tenant_id());

create table public.workflow_transitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) default public.current_tenant_id(),
  workflow_version_id uuid not null references public.workflow_versions (id),
  from_node_id uuid not null references public.workflow_nodes (id),
  to_node_id uuid not null references public.workflow_nodes (id),
  condition_id uuid references public.workflow_conditions (id),
  -- Deterministic evaluation order among multiple transitions leaving
  -- the same node.
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.workflow_transitions enable row level security;

create policy "workflow_transitions_select" on public.workflow_transitions
  for select using (tenant_id = public.current_tenant_id());

create policy "workflow_transitions_insert" on public.workflow_transitions
  for insert with check (tenant_id = public.current_tenant_id());

-- Append-only audit trail for every create/edit/submit/approve/reject/
-- publish/rollback on a workflow definition or version (BRD §5.4.2:
-- "record all changes in an audit trail and show a human-readable diff").
create table public.configuration_changes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) default public.current_tenant_id(),
  entity_type text not null default 'workflow_definition',
  entity_id uuid not null,
  workflow_version_id uuid references public.workflow_versions (id),
  change_type text not null check (change_type in (
    'create', 'edit', 'submit', 'approve', 'reject', 'publish', 'rollback'
  )),
  diff jsonb not null default '{}'::jsonb,
  reason text,
  changed_by uuid references public.app_users (id),
  created_at timestamptz not null default now()
);

alter table public.configuration_changes enable row level security;

create policy "configuration_changes_select" on public.configuration_changes
  for select using (tenant_id = public.current_tenant_id());

create policy "configuration_changes_insert" on public.configuration_changes
  for insert with check (tenant_id = public.current_tenant_id());

-- No update/delete policy for anyone: append-only, same construction as
-- ticket 0054's auth_audit_log.

create table public.configuration_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) default public.current_tenant_id(),
  workflow_version_id uuid not null references public.workflow_versions (id),
  approver_id uuid references public.app_users (id),
  decision text not null check (decision in ('approved', 'rejected')),
  comment text,
  decided_at timestamptz not null default now()
);

alter table public.configuration_approvals enable row level security;

create policy "configuration_approvals_select" on public.configuration_approvals
  for select using (tenant_id = public.current_tenant_id());

create policy "configuration_approvals_insert" on public.configuration_approvals
  for insert with check (tenant_id = public.current_tenant_id());

-- Append-only record of each publish event, separate from
-- workflow_versions.published_at so the history of "what was active
-- when" survives even a future rollback that republishes an older
-- version under a new version number.
create table public.published_configurations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) default public.current_tenant_id(),
  workflow_definition_id uuid not null references public.workflow_definitions (id),
  workflow_version_id uuid not null references public.workflow_versions (id),
  effective_from timestamptz not null,
  published_by uuid references public.app_users (id),
  published_at timestamptz not null default now()
);

alter table public.published_configurations enable row level security;

create policy "published_configurations_select" on public.published_configurations
  for select using (tenant_id = public.current_tenant_id());

create policy "published_configurations_insert" on public.published_configurations
  for insert with check (tenant_id = public.current_tenant_id());

create table public.configuration_rollback_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) default public.current_tenant_id(),
  workflow_definition_id uuid not null references public.workflow_definitions (id),
  from_version integer,
  to_version integer not null,
  rolled_back_by uuid references public.app_users (id),
  reason text,
  created_at timestamptz not null default now()
);

alter table public.configuration_rollback_events enable row level security;

create policy "configuration_rollback_events_select" on public.configuration_rollback_events
  for select using (tenant_id = public.current_tenant_id());

create policy "configuration_rollback_events_insert" on public.configuration_rollback_events
  for insert with check (tenant_id = public.current_tenant_id());

insert into public.permissions (id, description) values
  ('workflow.definition.manage', 'Create and edit draft workflow definitions, versions, nodes, transitions and conditions'),
  ('workflow.definition.publish', 'Approve, publish and roll back workflow definition versions');

-- Same deny-by-default bootstrap as every permission added so far: only
-- Platform Administrator holds these by default. A later ticket grants
-- workflow.definition.manage/.publish to real process-owner roles once
-- PRD's open role-mapping decisions are answered.
insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions
where id in ('workflow.definition.manage', 'workflow.definition.publish');
