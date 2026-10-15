-- M03: Organization, Departments, Roles & Authority (ticket 0056)
--
-- Builds the authority data model (departments, canonical roles,
-- permissions, effective-dated role assignments, delegations, approval
-- limit placeholders) plus the audit trail for changes to it. This is
-- the third and last Phase 1 module: M01 (identity) and M02
-- (tenant/company) exist already, nobody has a role or a permission
-- until this migration lands.
--
-- RoleDefinition/Permission/role_permissions are a shared canonical
-- catalogue, not tenant-owned business data (BRD §6.3: canonical
-- department/role records are separate from raw per-company labels).
-- tenant_id is nullable on those three tables: a NULL row is a
-- platform-wide catalogue entry visible to every tenant; a non-NULL row
-- is reserved for a future tenant-specific custom role/permission. This
-- still satisfies "RLS scoped by tenant_id" (the policy checks it), it
-- just doesn't require duplicating the 44-role catalogue per tenant on
-- day one. DepartmentDefinition/RoleAssignment/Delegation/ApprovalLimit
-- are genuinely tenant-owned data and tenant_id is NOT NULL on those,
-- consistent with ticket 0055's companies/branches/projects pattern.

-- Ticket 0055's companies/branches/projects/file_objects require
-- tenant_id but the application code never supplies it on insert (see
-- backend/src/modules/tenancy/repository.ts) — relying on RLS's `with
-- check` alone does not fill in a NOT NULL column with no default, so a
-- real insert against those tables would fail. Fixing forward here
-- since this migration establishes the same tenant_id-default pattern
-- for its own new tables; not a ticket-0056 scope table, just closing an
-- already-latent gap while touching the same tenant_id convention.
alter table public.companies alter column tenant_id set default public.current_tenant_id();
alter table public.branches alter column tenant_id set default public.current_tenant_id();
alter table public.projects alter column tenant_id set default public.current_tenant_id();
alter table public.file_objects alter column tenant_id set default public.current_tenant_id();

create table public.department_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  company_id uuid not null references public.companies (id),
  parent_id uuid references public.department_definitions (id),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.department_definitions enable row level security;

create policy "department_definitions_tenant_isolation" on public.department_definitions
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create table public.role_definitions (
  id text primary key,
  tenant_id uuid references public.tenants (id),
  label text not null,
  department_cluster text,
  brd_persona text,
  is_platform_role boolean not null default false,
  source_row_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.role_definitions enable row level security;

create policy "role_definitions_select" on public.role_definitions
  for select
  using (tenant_id is null or tenant_id = public.current_tenant_id());

-- No insert/update/delete policy for anon/authenticated: the canonical
-- catalogue is seeded below and maintained by migrations/service-role
-- tooling, not through a tenant-admin API in this ticket.

create table public.permissions (
  id text primary key,
  tenant_id uuid references public.tenants (id),
  description text not null,
  created_at timestamptz not null default now()
);

alter table public.permissions enable row level security;

create policy "permissions_select" on public.permissions
  for select
  using (tenant_id is null or tenant_id = public.current_tenant_id());

-- Same as role_definitions: catalogue, not tenant data; no write policy
-- for anon/authenticated.

create table public.role_permissions (
  role_id text not null references public.role_definitions (id),
  permission_id text not null references public.permissions (id),
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

alter table public.role_permissions enable row level security;

-- A role-to-permission mapping carries no tenant-sensitive data by
-- itself (it only names catalogue ids); readable by any authenticated
-- caller so the effective-permissions service can resolve it regardless
-- of which tenant granted which catalogue role. Written by migrations
-- only in this ticket (no grant/revoke endpoint yet).
create policy "role_permissions_select" on public.role_permissions
  for select
  using (true);

create table public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  user_id uuid not null references public.app_users (id),
  role_id text not null references public.role_definitions (id),
  department_id uuid references public.department_definitions (id),
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_by uuid references public.app_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint role_assignments_valid_range check (valid_to is null or valid_to > valid_from)
);

create index role_assignments_user_idx on public.role_assignments (user_id);

alter table public.role_assignments enable row level security;

create policy "role_assignments_tenant_isolation" on public.role_assignments
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Effective-dated, never overwritten: history is kept by inserting a new
-- row and setting valid_to on the old one rather than mutating valid_from.
create table public.delegations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  role_assignment_id uuid not null references public.role_assignments (id),
  delegate_user_id uuid not null references public.app_users (id),
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  reason text,
  created_by uuid references public.app_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delegations_valid_range check (valid_to is null or valid_to > valid_from)
);

alter table public.delegations enable row level security;

create policy "delegations_tenant_isolation" on public.delegations
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Value-band placeholder only (PRD §5 open decision #1, still unresolved
-- with the business owner). Zero rows seeded. The application-layer
-- check for this table must treat "no matching row" as "not authorized"
-- — never as "unlimited" — see backend/src/modules/authority/service.ts.
create table public.approval_limits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  role_id text references public.role_definitions (id),
  department_id uuid references public.department_definitions (id),
  currency text not null,
  max_value numeric(18, 2) not null check (max_value >= 0),
  created_by uuid references public.app_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approval_limits_scope check (role_id is not null or department_id is not null)
);

alter table public.approval_limits enable row level security;

create policy "approval_limits_tenant_isolation" on public.approval_limits
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Extend ticket 0054's audit-log event_type enum rather than inventing a
-- second audit mechanism, per this ticket's own scope note. Covers every
-- create to RoleAssignment/Delegation/ApprovalLimit (the acceptance
-- requirement) plus DepartmentDefinition for the same reason — org
-- structure changes are sensitive per BRD §6.1.
alter table public.auth_audit_log drop constraint if exists auth_audit_log_event_type_check;
alter table public.auth_audit_log add constraint auth_audit_log_event_type_check check (
  event_type in (
    'invited',
    'invite_accepted',
    'deactivated',
    'sign_in',
    'sign_out',
    'sign_in_failed',
    'password_reset_requested',
    'password_reset_completed',
    'mfa_enrolled',
    'mfa_verified',
    'mfa_verification_failed',
    'department_created',
    'role_assignment_created',
    'delegation_created',
    'approval_limit_created'
  )
);

-- Seed: the 44 canonical catalogue roles + 3 platform-only roles from
-- docs/canonical-role-map.md, generated by scripts/generate_role_seed.py
-- (run that script and re-paste its output here if the map changes —
-- the ticket requires these not be hand-enumerated a second time).
insert into public.role_definitions
  (id, label, department_cluster, brd_persona, is_platform_role, source_row_count)
values
  ('role.chairman', 'Chairman', 'Company / Leadership', 'Chairman/Owners', false, 20),
  ('role.ceo', 'Chief Executive Officer (CEO)', 'Company / Leadership', 'CEO', false, 50),
  ('role.cto', 'Chief Technical Officer (CTO)', 'Technical Engineering', 'CTO/Technical Engineering Head', false, 25),
  ('role.architect_lead', 'Architect (Lead)', 'Technical Engineering', 'Architect/Design Engineer/Discipline Lead', false, 30),
  ('role.structural_designer', 'Structural Designer', 'Technical Engineering', 'Architect/Design Engineer/Discipline Lead', false, 22),
  ('role.civil_draftsman', 'Civil Draftsman', 'Technical Engineering', 'Architect/Design Engineer/Discipline Lead (new)', false, 20),
  ('role.electrical_draftsman', 'Electrical Draftsman', 'Technical Engineering', 'Architect/Design Engineer/Discipline Lead (new)', false, 24),
  ('role.hvac_plumbing_draftsman', 'HVAC & Plumbing Draftsman', 'Technical Engineering', 'Architect/Design Engineer/Discipline Lead (new)', false, 25),
  ('role.civil_estimator', 'Civil Estimator', 'Technical Engineering', 'Estimator/Commercial Manager', false, 25),
  ('role.mep_estimator', 'MEP Estimator', 'Technical Engineering', 'Estimator/Commercial Manager', false, 25),
  ('role.coo', 'Chief Operations Officer (COO)', 'Projects', 'COO/Operations Head', false, 25),
  ('role.project_engineer_lead', 'Project Engineer (Lead)', 'Projects', 'Project Manager (new, PM support role)', false, 35),
  ('role.quantity_surveyor', 'Quantity Surveyor', 'Projects', 'Estimator/Commercial Manager', false, 28),
  ('role.qhse_engineer', 'QHSE Engineer', 'Projects', 'QA/QC Engineer + Safety Officer (dual-scope, new)', false, 30),
  ('role.site_civil_engineer', 'Site Civil Engineer', 'Projects', 'Site Manager/Site Engineer', false, 28),
  ('role.site_mep_engineer', 'Site MEP Engineer', 'Projects', 'Site Manager/Site Engineer', false, 28),
  ('role.civil_supervisor', 'Civil Supervisor', 'Projects', 'Site Manager/Site Engineer (new, field supervisor)', false, 20),
  ('role.mep_supervisor', 'MEP Supervisor', 'Projects', 'Site Manager/Site Engineer (new, field supervisor)', false, 20),
  ('role.foreman', 'Foreman', 'Projects', '(new) field supervisory, reports to Supervisor', false, 18),
  ('role.chargehand', 'Chargehand', 'Projects', '(new) crew-level supervisory, reports to Foreman', false, 16),
  ('role.plant_equipment_operator', 'Plant & Equipment Operator', 'Projects', '(new) — see M25 Equipment/Plant/Fleet', false, 16),
  ('role.skilled_labour', 'Skilled Labour', 'Projects', '(new)', false, 14),
  ('role.driver', 'Driver', 'Projects', '(new)', false, 14),
  ('role.unskilled_labour', 'Unskilled Labour', 'Projects', '(new)', false, 12),
  ('role.cpo', 'Chief Procurement Officer (CPO)', 'Procurement', 'Department Head (new — not separately named in §3.1)', false, 30),
  ('role.procurement_lead', 'Procurement Lead', 'Procurement', 'Procurement Manager/Buyer', false, 55),
  ('role.logistics_coordinator', 'Logistics Coordinator', 'Procurement', 'Procurement Manager/Buyer (new, logistics sub-role)', false, 35),
  ('role.storekeeper', 'Storekeeper', 'Procurement', 'Storekeeper', false, 40),
  ('role.cfo', 'Chief Financial Officer (CFO)', 'Finance', 'CFO/Finance Head', false, 30),
  ('role.senior_accountant_lead', 'Senior Accountant (Lead)', 'Finance', 'Finance Executive/Accountant', false, 45),
  ('role.accountant', 'Accountant', 'Finance', 'Finance Executive/Accountant', false, 45),
  ('role.cmo', 'Chief Marketing Officer (CMO)', 'Marketing & Sales', 'Department Head (new)', false, 30),
  ('role.marketing_manager_lead', 'Marketing Manager (Lead)', 'Marketing & Sales', 'Department Head (new)', false, 50),
  ('role.business_development_executive', 'Business Development Executive', 'Marketing & Sales', '(new — Sales is not a named §3.1 persona; M10 refers to "Sales" generically)', false, 40),
  ('role.cpco', 'Chief People & Culture Officer (CPCO)', 'People & Culture', 'Department Head (new)', false, 6),
  ('role.hr_admin_lead', 'HR & Admin Lead', 'People & Culture', 'HR/People & Culture', false, 27),
  ('role.hr_admin_assistant', 'HR & Admin Assistant', 'People & Culture', 'HR/People & Culture', false, 31),
  ('role.office_assistant', 'Office Assistant', 'People & Culture', '(new — general admin support)', false, 21),
  ('role.it_support_engineer', 'IT Support Engineer', 'People & Culture', '(new — distinct from Platform Administrator; internal IT, not SEVENTS app config)', false, 13),
  ('role.cro', 'Chief Research Officer (CRO)', 'Research & Development', 'Department Head (new)', false, 60),
  ('role.document_controller', 'Document Controller', 'Research & Development', 'Document Controller', false, 60),
  ('role.clo', 'Chief Legal Officer (CLO)', 'Legal', 'Legal/Contracts Manager (Head)', false, 30),
  ('role.legal_counsel_lead', 'Legal Counsel (Lead)', 'Legal', 'Legal/Contracts Manager', false, 50),
  ('role.contracts_legal_assistant', 'Contracts & Legal Assistant', 'Legal', 'Legal/Contracts Manager (assistant)', false, 40),
  ('role.platform_administrator', 'Platform Administrator', 'Platform', 'Platform Administrator', true, 0),
  ('role.vendor_subcontractor_portal', 'Vendor/Subcontractor (restricted portal, later phase)', 'Platform', 'Vendor/Subcontractor (restricted portal, later phase)', true, 0),
  ('role.client_consultant_portal', 'Client/Consultant (restricted portal, later phase)', 'Platform', 'Client/Consultant (restricted portal, later phase)', true, 0);

-- Minimal permission catalogue: just enough to close the "deferred to
-- ticket 0056" authorization gaps ticket 0054/0055 left open (invite,
-- deactivate, company/branch/project creation) plus this ticket's own
-- admin endpoints (department/role-assignment/delegation/approval-limit
-- management). Not an exhaustive permission set for every future
-- module — later modules add their own permission rows as they land.
insert into public.permissions (id, description) values
  ('identity.user.invite', 'Invite a new platform user'),
  ('identity.user.deactivate', 'Deactivate a platform user'),
  ('tenancy.company.manage', 'Create or update a company'),
  ('tenancy.branch.manage', 'Create or update a branch'),
  ('tenancy.project.manage', 'Create or update a project'),
  ('authority.department.manage', 'Create or update a department'),
  ('authority.role_assignment.manage', 'Assign a role to a user'),
  ('authority.delegation.manage', 'Create a role delegation'),
  ('authority.approval_limit.manage', 'Create or update an approval limit');

-- Bootstrap default: the Platform Administrator role holds every
-- permission defined above. No other role is granted anything by
-- default (deny-by-default for every other canonical role) — per-role
-- grants beyond this are an admin action via future tooling, not
-- invented here. The very first Platform Administrator role_assignment
-- itself is a service-role bootstrap step (same precedent as ticket
-- 0055's tenant creation: "admin operation, not self-service"), since
-- nobody holds authority.role_assignment.manage until one does.
insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions;
