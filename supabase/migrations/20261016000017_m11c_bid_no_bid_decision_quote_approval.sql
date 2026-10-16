-- M11c: Bid/no-bid decision & quote/proposal approval (ticket 0098).
-- BRD §10.1 steps 7-8; FR-BID-001.
--
-- Extends ticket 0066's shared approval_decisions.decision vocabulary
-- with 'approved_with_conditions' (FR-BID-001's own word) before
-- introducing the module that actually uses it — see
-- backend/src/modules/workflow/types.ts APPROVAL_CHAIN_DECISIONS for
-- the application-layer rationale (treated as terminal, exactly like
-- 'rejected'/'returned_for_correction', so resolveChainOutcome needs no
-- code change). approval_decisions_reason_required already reads
-- "anything other than approved requires a reason" — unchanged, so the
-- new value automatically requires a reason too, which is what the
-- conditions text actually is.
alter table public.approval_decisions
  drop constraint approval_decisions_decision_check;

alter table public.approval_decisions
  add constraint approval_decisions_decision_check
  check (decision in ('approved', 'approved_with_conditions', 'rejected', 'returned_for_correction'));

-- FR-BID-001: a bid/no-bid decision record tied to an estimate (ticket
-- 0097). `recommendation` is the concrete thing being decided — bid or
-- no_bid — captured up front by whoever proposes it; the approval
-- chain (ticket 0066's request_approval seam) then approves/approves-
-- with-conditions/rejects/returns that recommendation, same propose->
-- approve shape as estimates.status.
--
-- `conditions` is filled in only on an 'approved_with_conditions'
-- resolution, copied up from the resolving approver's
-- approval_decisions.reason (application layer, service.ts) — not a
-- second place to type the same text.
create table public.bid_no_bid_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  estimate_id uuid not null references public.estimates (id),
  recommendation text not null check (recommendation in ('bid', 'no_bid')),
  status text not null default 'draft'
    check (status in ('draft', 'pending_approval', 'approved', 'approved_with_conditions', 'rejected', 'returned_for_correction')),
  conditions text,
  workflow_instance_id uuid references public.workflow_instances (id),
  created_by uuid references public.app_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bid_no_bid_decisions enable row level security;

create policy "bid_no_bid_decisions_tenant_isolation" on public.bid_no_bid_decisions
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create index bid_no_bid_decisions_estimate_id_idx on public.bid_no_bid_decisions (estimate_id);
create index bid_no_bid_decisions_workflow_instance_id_idx on public.bid_no_bid_decisions (workflow_instance_id);

-- FR-BID-001: criteria/score as real structured rows, not a freeform
-- blob, "so a reviewer can actually compare across decisions" (ticket
-- text). Fixed small criteria set — a reasonable starter list grounded
-- in the BRD's own commercial/technical/risk threads (§7 row 437's
-- named owners: Estimator; Commercial; Technical; Finance), not a
-- business policy value, so it does not need a TBD placeholder the way
-- an authority limit or SLA value would; the business owner can extend
-- this check constraint later if a different criteria set is wanted.
create table public.bid_no_bid_criteria_scores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  bid_no_bid_decision_id uuid not null references public.bid_no_bid_decisions (id),
  criterion text not null check (criterion in (
    'financial_viability', 'technical_capability', 'risk_exposure', 'strategic_fit', 'resource_availability'
  )),
  score numeric(3, 1) not null check (score between 1 and 5),
  rationale text not null check (length(trim(rationale)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bid_no_bid_criteria_scores_decision_criterion_unique unique (bid_no_bid_decision_id, criterion)
);

alter table public.bid_no_bid_criteria_scores enable row level security;

create policy "bid_no_bid_criteria_scores_tenant_isolation" on public.bid_no_bid_criteria_scores
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create index bid_no_bid_criteria_scores_decision_id_idx on public.bid_no_bid_criteria_scores (bid_no_bid_decision_id);

-- BRD §10.1 step 8: "Proposal approval and submission" — once bid/
-- no-bid is approved (or approved with conditions), a submission
-- record for what was actually sent, when, and to whom.
-- evidence_reference is the same "plain text/URL reference, no bespoke
-- upload pipeline" restraint ticket 0096 used for tender_documents.
create table public.bid_submissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  bid_no_bid_decision_id uuid not null references public.bid_no_bid_decisions (id),
  submitted_to text not null,
  submitted_at timestamptz not null,
  evidence_reference text,
  submitted_by uuid references public.app_users (id),
  created_at timestamptz not null default now()
);

alter table public.bid_submissions enable row level security;

create policy "bid_submissions_tenant_isolation" on public.bid_submissions
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create index bid_submissions_decision_id_idx on public.bid_submissions (bid_no_bid_decision_id);

-- Permission: reuses ticket 0096/0097's `tendering.document.manage` —
-- same M11 module, same named-owner cluster (BRD §7 row 437:
-- Estimator; Commercial; Technical; Finance). No new permission minted.
-- The CEO's actual bid/no-bid sign-off (BRD Company/Leadership #36) is
-- gated by whoever the published workflow definition names as approver
-- via the generic request_approval seam, same separation every other
-- M11 approval flow already has between "who can propose" and "who
-- approves."
