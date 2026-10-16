-- M09d: issue/risk/decision/assumption/dependency/change-request
-- register (ticket 0076). BRD §8.4 FR-PROJ-005. BRD §6.2 lists no
-- dedicated entity for this beyond the generic Project relationship —
-- this migration defines the minimal schema itself.
--
-- One table, not six: all six FR-PROJ-005 categories share the same
-- fields (title, description, status, owner, due date, who raised it,
-- resolution) — BRD only asks that each be "tracked," not that they be
-- structurally distinct entities. Splitting into six near-identical
-- tables would be premature normalization.
--
-- A `change_request` row here is a logged intent/record only — it
-- never triggers workflow/approval itself. Ticket 0075 (M09c) already
-- owns the one approval path BRD actually names (FR-PROJ-004,
-- baseline changes); this table does not duplicate that.

create table public.project_register_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  project_id uuid not null references public.projects (id),
  kind text not null check (kind in ('issue', 'risk', 'decision', 'assumption', 'dependency', 'change_request')),
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  owner_id uuid references public.app_users (id),
  due_date date,
  raised_by uuid references public.app_users (id),
  raised_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_note text,
  -- Free-text, tenant-configurable classification for `risk` rows only
  -- in practice (nullable, no CHECK on either value or on kind='risk')
  -- — never a computed/numeric risk score. FR-PROJ-006 explicitly bans
  -- displaying an unexplained AI/computed score as fact, and a
  -- likelihood x impact risk-matrix score is exactly that.
  likelihood text,
  impact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_register_entries_project_idx on public.project_register_entries (project_id);

alter table public.project_register_entries enable row level security;

create policy "project_register_entries_tenant_isolation" on public.project_register_entries
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Register CRUD reuses tenancy.project.manage (ticket 0056), same as
-- ticket 0074's WBS/milestone/activity routes — this is project
-- administration, not a new actor class.
