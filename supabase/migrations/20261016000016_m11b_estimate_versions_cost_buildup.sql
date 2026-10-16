-- M11b: Estimate versions & cost build-up (ticket 0097).
-- BRD §10.1 step 6; FR-EST-001/002/003.
--
-- An estimate is built against a registered tender (M10b's
-- `tender_submissions`, ticket 0091) — `estimates.tender_submission_id`
-- is a required FK, not an optional one. Two tables, same "every FR-
-- EST-001 field a real column, not a jsonb catch-all" discipline
-- ticket 0090 used for FR-CRM-001:
--   * `estimates` — one row per version. assumptions/inclusions/
--     exclusions are free text (narrative fields the BRD names
--     individually but does not give a further sub-schema for);
--     taxes/overheads/contingency/margin are numeric amounts;
--     subtotal/total are stored/computed at write time by the
--     application layer (same "snapshot, not a live view" discipline
--     ticket 0075's project_baselines used) rather than a generated
--     column, since the total depends on summing `estimate_lines`,
--     which live in a different table.
--   * `estimate_lines` — quantity take-off x labour/material/
--     equipment/subcontractor rate build-up rows, FK'd to `estimates`.
--     FR-EST-002 reserves `source`/`confidence` for a future AI
--     quantity-extraction/rate-suggestion feature (M28/M29, not
--     started) — no AI call exists behind these columns yet.
--
-- FR-EST-003's approval/lock flow reuses the exact
-- workflow_instances/request_approval seam (ticket 0066) ticket 0075's
-- project_baseline_change_requests already established — see
-- `workflow_instance_id` below, same nullable-until-submitted,
-- not-null-once-submitted shape. Approving an estimate version locks
-- it (status 'approved'); any further change creates a new version
-- row, never an in-place edit of an approved one — enforced in the
-- application layer (backend/src/modules/estimating/service.ts), same
-- as ticket 0075's baseline-change supersede logic.

create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  tender_submission_id uuid not null references public.tender_submissions (id),
  -- Incrementing per tender submission, starting at 1. Enforced in
  -- application code (read current max + 1 inside the same request),
  -- same convention as project_baselines.version.
  version integer not null check (version > 0),
  status text not null default 'draft'
    check (status in ('draft', 'pending_approval', 'approved', 'rejected', 'returned_for_correction', 'superseded')),
  assumptions text,
  inclusions text,
  exclusions text,
  taxes numeric(14, 2) not null default 0,
  overheads numeric(14, 2) not null default 0,
  contingency numeric(14, 2) not null default 0,
  margin numeric(14, 2) not null default 0,
  -- Sum of estimate_lines.line_total at the moment this version was
  -- last (re)computed — a stored snapshot, not a generated column,
  -- since it depends on a child table. total_amount additionally
  -- folds in taxes/overheads/contingency/margin on top of subtotal.
  subtotal_amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  -- Set only once status moves to 'approved' or later (approved/
  -- rejected/superseded) via the request_approval seam; null while
  -- still draft/not yet submitted. Same nullable-then-pinned shape as
  -- project_baseline_change_requests.workflow_instance_id, except this
  -- lives on the estimate itself (an estimate version IS the thing
  -- being approved, unlike baselines where a separate change-request
  -- row is the subject of approval).
  workflow_instance_id uuid references public.workflow_instances (id),
  created_by uuid references public.app_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estimates_tenant_tender_version_unique unique (tenant_id, tender_submission_id, version)
);

alter table public.estimates enable row level security;

create policy "estimates_tenant_isolation" on public.estimates
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create index estimates_tender_submission_id_idx on public.estimates (tender_submission_id);
create index estimates_workflow_instance_id_idx on public.estimates (workflow_instance_id);

-- Quantity take-off x rate build-up line items. cost_category mirrors
-- the catalogue's Civil/MEP Estimator "rate build-up" rows (ticket
-- 0014 group C): labour/material/equipment/subcontractor.
create table public.estimate_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  estimate_id uuid not null references public.estimates (id),
  item text not null,
  quantity numeric(14, 3) not null,
  unit text not null,
  rate numeric(14, 2) not null,
  cost_category text not null check (cost_category in ('labour', 'material', 'equipment', 'subcontractor')),
  line_total numeric(14, 2) not null,
  -- FR-EST-002: AI-ready, not AI-backed. 'manual' is the only value any
  -- code path in this ticket ever writes; 'ai_suggested' exists so a
  -- future M28/M29 feature has somewhere to write without a schema
  -- change, and so a line can never silently claim AI provenance it
  -- doesn't have.
  source text not null default 'manual' check (source in ('manual', 'ai_suggested')),
  confidence numeric(4, 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.estimate_lines enable row level security;

create policy "estimate_lines_tenant_isolation" on public.estimate_lines
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create index estimate_lines_estimate_id_idx on public.estimate_lines (estimate_id);

-- Permission: reuses ticket 0096's `tendering.document.manage` — same
-- M11 module, same named-owner cluster (BRD §7 row 437: Estimator;
-- Commercial; Technical; Finance) ticket 0096 already granted this
-- permission to. No new permission minted here. The actual CFO/CTO
-- approval sign-off is gated by whoever the workflow definition names
-- as approver (a separate mechanism from this CRUD permission), same
-- separation ticket 0075/0066 already has between "who can propose a
-- baseline change" and "who approves it."
