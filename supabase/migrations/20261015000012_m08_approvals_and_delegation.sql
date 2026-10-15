-- M08: Approvals & Delegation (ticket 0066)
--
-- BRD §8.3 FR-APP-001..006. Builds on the `request_approval` seam
-- ticket 0062 (M06c) left on workflow_step_instances: this migration
-- adds the multi-approver decision trail a sequential/parallel chain
-- needs (one workflow_step_instance can require more than one person's
-- decision before it resolves) and the compensating-revocation table
-- FR-APP-006 requires, plus turns ticket 0056's approval_limits
-- placeholder into an effective-dated ("versioned") table per
-- FR-APP-005.

-- FR-APP-005: a new limit for a given scope supersedes the old one by
-- closing its valid_to (see modules/authority/repository.ts
-- createApprovalLimit) — it is never edited in place, so history of
-- what the threshold used to be is preserved.
alter table public.approval_limits
  add column valid_from timestamptz not null default now(),
  add column valid_to timestamptz;

alter table public.approval_limits
  add constraint approval_limits_valid_range check (valid_to is null or valid_to > valid_from);

-- One row per approver's decision against a request_approval step
-- instance. A sequential chain has one row per approverUserIds entry,
-- numbered by sequence_order as they decide in turn; a parallel chain
-- has one row per approver with sequence_order left null since order
-- doesn't matter. FR-APP-003: decided_by + decided_at carry identity
-- and timestamp; rejected/returned_for_correction require a reason.
create table public.approval_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  workflow_step_instance_id uuid not null references public.workflow_step_instances (id),
  sequence_order integer,
  approver_id uuid not null references public.app_users (id),
  decision text not null check (decision in ('approved', 'rejected', 'returned_for_correction')),
  reason text,
  decided_by uuid not null references public.app_users (id),
  decided_at timestamptz not null default now(),
  constraint approval_decisions_reason_required check (
    decision = 'approved' or (reason is not null and length(trim(reason)) > 0)
  )
);

alter table public.approval_decisions enable row level security;

create policy "approval_decisions_tenant_isolation" on public.approval_decisions
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- FR-APP-006: an approval can only be revoked/corrected through this
-- controlled compensating record — never by deleting or editing the
-- original approval_decisions row. No update/delete policy on either
-- table: both are append-only, same construction as workflow_events.
create table public.approval_revocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  approval_decision_id uuid not null references public.approval_decisions (id),
  revoked_by uuid not null references public.app_users (id),
  reason text not null check (length(trim(reason)) > 0),
  created_at timestamptz not null default now()
);

alter table public.approval_revocations enable row level security;

create policy "approval_revocations_tenant_isolation" on public.approval_revocations
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Revocation is a controlled process, not every approver's own undo
-- button — a dedicated permission, deny-by-default like every other
-- permission added so far (only role.platform_administrator holds it
-- until a future session assigns it to a real process-owner role).
insert into public.permissions (id, description) values
  ('workflow.approval.revoke', 'Revoke an approval decision via the FR-APP-006 compensating process (never deletes the original decision)');

insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions
where id = 'workflow.approval.revoke';
