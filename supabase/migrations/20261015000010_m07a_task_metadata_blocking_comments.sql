-- M07a: Task data model — metadata, blocking, comments & evidence (ticket 0070)
--
-- Reuses ticket 0062's `workflow_step_instances` as the task record (the
-- documented M07/M08 hand-off seam) rather than creating a second task
-- table. All changes here are additive to existing tables plus two
-- small new pieces: `task_comments` and a nullable evidence FK on
-- `file_objects`.

alter table public.workflow_step_instances
  add column owner_id uuid references public.app_users (id),
  add column reviewer_id uuid references public.app_users (id),
  add column due_at timestamptz,
  add column priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  add column blocked_reason text,
  add column blocked_at timestamptz;

-- Append-only, same construction as auth_audit_log / task-adjacent
-- event logs elsewhere in this project.
create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  workflow_step_instance_id uuid not null references public.workflow_step_instances (id),
  author_id uuid references public.app_users (id),
  body text not null,
  created_at timestamptz not null default now()
);

create index task_comments_step_instance_idx on public.task_comments (workflow_step_instance_id);

alter table public.task_comments enable row level security;

create policy "task_comments_select" on public.task_comments
  for select using (tenant_id = public.current_tenant_id());

create policy "task_comments_insert" on public.task_comments
  for insert with check (tenant_id = public.current_tenant_id());

-- No update/delete policy: comments are append-only.

-- Evidence reuses ticket 0055's file_objects rather than a second
-- attachment table — a file can now also be registered against a step
-- instance the same way it's already registered against a
-- project/company.
alter table public.file_objects
  add column workflow_step_instance_id uuid references public.workflow_step_instances (id);

-- workflow_events.event_type has no check constraint (free text, see
-- ticket 0062's migration) so no constraint change is needed for the
-- new task_blocked/task_unblocked/comment_added/evidence_attached
-- event types added to types.ts's WORKFLOW_EVENT_TYPES.
