-- Migration: 20261019000005_m26_customer_stakeholder_communications.sql
-- Module: M26 Customer / Stakeholder Communications
-- Multi-tenant isolation enforced via tenant_id = public.current_tenant_id()

-- 1. STAKEHOLDERS DIRECTORY
create table if not exists public.stakeholders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  name text not null,
  organization text not null,
  stakeholder_type text not null check (stakeholder_type in ('client', 'consultant', 'subcontractor', 'authority', 'community', 'utility')),
  role_title text not null,
  email text,
  phone text,
  engagement_level text not null default 'medium' check (engagement_level in ('low', 'medium', 'high')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_stakeholders_tenant_project on public.stakeholders (tenant_id, project_id);
create index if not exists idx_stakeholders_type on public.stakeholders (tenant_id, stakeholder_type);

alter table public.stakeholders enable row level security;

create policy "stakeholders_tenant_isolation"
  on public.stakeholders
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 2. COMMUNICATION LOGS & FORMAL NOTICES
create table if not exists public.communication_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  reference_number text not null,
  channel text not null check (channel in ('letter', 'email', 'site_instruction', 'transmittal', 'notice', 'circular')),
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_name text not null,
  recipient_name text not null,
  subject text not null,
  summary text not null,
  requires_response boolean not null default false,
  response_due_date date,
  status text not null default 'draft' check (status in ('draft', 'sent', 'received', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_communication_logs_tenant_project on public.communication_logs (tenant_id, project_id);
create index if not exists idx_communication_logs_status on public.communication_logs (tenant_id, status);

alter table public.communication_logs enable row level security;

create policy "communication_logs_tenant_isolation"
  on public.communication_logs
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 3. MEETING MINUTES (MOM) & ACTION ITEMS
create table if not exists public.meeting_minutes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  meeting_title text not null,
  meeting_type text not null check (meeting_type in ('site_coordination', 'client_review', 'technical_clarification', 'progress_meeting')),
  meeting_date date not null,
  location text,
  attendees text[] not null default '{}',
  summary text not null,
  action_items jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_meeting_minutes_tenant_project on public.meeting_minutes (tenant_id, project_id);

alter table public.meeting_minutes enable row level security;

create policy "meeting_minutes_tenant_isolation"
  on public.meeting_minutes
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 4. CLIENT FEEDBACK & COMPLAINTS
create table if not exists public.client_complaints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  complaint_number text not null,
  client_name text not null,
  contact_info text,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  category text not null check (category in ('quality', 'schedule', 'safety', 'billing', 'conduct', 'other')),
  description text not null,
  resolution_plan text,
  status text not null default 'received' check (status in ('received', 'investigating', 'resolved', 'closed')),
  assigned_to text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_complaints_tenant_severity on public.client_complaints (tenant_id, severity, status);

alter table public.client_complaints enable row level security;

create policy "client_complaints_tenant_isolation"
  on public.client_complaints
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 5. PERMISSIONS & ROLE ASSIGNMENTS
insert into public.permissions (id, description) values
  ('communications.stakeholder.manage', 'Register and manage project stakeholders and directories'),
  ('communications.log.manage', 'Record and manage communication logs, letters and formal notices'),
  ('communications.minutes.manage', 'Draft, publish and track meeting minutes and action items'),
  ('communications.complaint.manage', 'Log and triage client complaints and escalations'),
  ('communications.complaint.resolve', 'Resolve, close and verify corrective actions for client complaints')
on conflict (id) do nothing;

-- Seed role permissions using public.role_definitions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.role_definitions r
cross join public.permissions p
where r.id in ('role.platform_administrator', 'role.project_engineer_lead', 'role.business_development_executive', 'role.cmo')
  and p.id in (
    'communications.stakeholder.manage',
    'communications.log.manage',
    'communications.minutes.manage',
    'communications.complaint.manage',
    'communications.complaint.resolve'
  )
on conflict do nothing;
