-- M10c: Pipeline forecast & won-opportunity handover checklist
-- (ticket 0092). BRD §8.5 FR-CRM-004; §7's M10 row names this the
-- "sales-to-technical handoff" (§10.1 step 13).
--
-- Pipeline forecast (weighted value = expected_value * probability,
-- grouped by stage/owner/due-date window) needs no new table — it's a
-- pure aggregation over the existing opportunities rows, same as
-- ticket 0077's getProjectForecast needed no new table for
-- forecast-vs-baseline. See backend/src/modules/crm/forecast.ts.
--
-- opportunity_handover_checklists is a fixed four-item list, same
-- "not a configurable checklist builder" convention as ticket 0077's
-- project_closeout_checklists (M06 is the configurable-checklist
-- module, not this one). Unlike project_closeout_checklists, this
-- checklist IS a gate: FR-CRM-004 requires handover completion to
-- block while any item is pending, unless an authorized exception is
-- on file. opportunity_handover_exceptions is that exception path —
-- same request/resolve-via-workflow-instance shape as ticket 0075's
-- baseline change requests and ticket 0080's data requests, reusing
-- the M08 request_approval seam rather than inventing a second
-- approval mechanism.

create table public.opportunity_handover_checklists (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  opportunity_id uuid not null references public.opportunities (id),
  item_key text not null check (
    item_key in ('client_confirmation', 'commercial_terms_locked', 'site_information_handed_over', 'technical_owner_assigned')
  ),
  status text not null default 'pending' check (status in ('pending', 'complete')),
  completed_by uuid references public.app_users (id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunity_handover_checklists_tenant_opportunity_item_unique unique (tenant_id, opportunity_id, item_key)
);

alter table public.opportunity_handover_checklists enable row level security;

create policy "opportunity_handover_checklists_tenant_isolation" on public.opportunity_handover_checklists
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table public.opportunity_handover_exceptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  opportunity_id uuid not null references public.opportunities (id),
  reason text not null check (length(trim(reason)) > 0),
  requested_by uuid references public.app_users (id),
  workflow_instance_id uuid not null references public.workflow_instances (id),
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected', 'returned_for_correction')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.opportunity_handover_exceptions enable row level security;

create policy "opportunity_handover_exceptions_tenant_isolation" on public.opportunity_handover_exceptions
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- The opportunity itself records when handover actually completed —
-- additive, nullable columns, same "fact only once it happens"
-- convention as ticket 0077's closeout items.
alter table public.opportunities
  add column handover_completed_at timestamptz,
  add column handover_completed_by uuid references public.app_users (id);

-- Handover actions reuse crm.lead.manage (ticket 0090) — same single
-- departmental permission every other CRM route is gated on; the
-- approval authority for an exception itself comes from whoever the
-- chosen request_approval workflow definition names, not from this
-- permission.
