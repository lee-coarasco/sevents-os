-- M09e: project health, forecast-vs-baseline & closeout checklist
-- (ticket 0077). BRD §8.4 FR-PROJ-006, FR-PROJ-007, FR-PROJ-008.
--
-- project_health_snapshots is append-only, same "point-in-time fact"
-- convention as progress_entries — every GET /projects/:id/health call
-- inserts a fresh row computed from existing recorded data only
-- (overdue schedule activities/milestones, open register entries,
-- baseline status). FR-PROJ-006 is explicit that health must show its
-- contributing factors and last refresh time and never display an
-- unexplained AI score as fact — there is no numeric score column
-- here, only `factors` (jsonb) and `summary` (plain text built from
-- those factors).
--
-- FR-PROJ-007's forecast-vs-baseline comparison needs no new table:
-- it reads project_baselines (ticket 0075) and schedule_activities
-- (ticket 0074) directly and returns two distinct labelled fields —
-- see backend/src/modules/projects/service.ts getProjectForecast.
--
-- project_closeout_checklists is the fixed four-item list FR-PROJ-008
-- names (handover records, final account, defects/DLP, lessons
-- learned) — not a configurable checklist builder (that's M06's job
-- if ever wanted).

create table public.project_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  project_id uuid not null references public.projects (id),
  computed_at timestamptz not null default now(),
  factors jsonb not null,
  summary text not null,
  -- Null means system-computed from recorded data (every snapshot so
  -- far) rather than a person manually attesting to a health
  -- assessment — that manual path doesn't exist yet in this ticket.
  computed_by uuid references public.app_users (id)
);

create index project_health_snapshots_project_idx on public.project_health_snapshots (project_id, computed_at desc);

alter table public.project_health_snapshots enable row level security;

create policy "project_health_snapshots_select" on public.project_health_snapshots
  for select using (tenant_id = public.current_tenant_id());

create policy "project_health_snapshots_insert" on public.project_health_snapshots
  for insert with check (tenant_id = public.current_tenant_id());

-- No update/delete policy for anyone: append-only.

create table public.project_closeout_checklists (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  project_id uuid not null references public.projects (id),
  item_key text not null check (item_key in ('handover_records', 'final_account', 'defects_dlp', 'lessons_learned')),
  status text not null default 'pending' check (status in ('pending', 'complete')),
  completed_by uuid references public.app_users (id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_closeout_checklists_tenant_project_item_unique unique (tenant_id, project_id, item_key)
);

alter table public.project_closeout_checklists enable row level security;

create policy "project_closeout_checklists_tenant_isolation" on public.project_closeout_checklists
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Health/forecast reads and the closeout list reuse tenancy.project.manage
-- (ticket 0056), same as ticket 0074/0076's read routes. Completing a
-- closeout item is a distinct, narrower administrative action (same
-- reasoning ticket 0075 used for project.baseline.manage) — its own
-- permission, deny-by-default.
insert into public.permissions (id, description) values
  ('project.closeout.manage', 'Mark a project closeout checklist item complete');

insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions
where id = 'project.closeout.manage';
