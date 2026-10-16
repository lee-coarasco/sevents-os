-- M13a: Document register & revision control (ticket 0104).
--
-- General-purpose document-control spine (FR-DOC-001, FR-DOC-002) every
-- other module (M12 engineering, M14 procurement, M17 site ops, M19
-- quality, M27 legal, etc.) will eventually attach records to. This
-- migration only builds the spine itself, not any module-specific
-- document type's own fields.
--
-- Distinct from two existing precedents, neither duplicated here:
-- - `tender_documents` (ticket 0096/M11a) — a narrower, tender-package-
--   scoped document list. Left as-is.
-- - `retention_policies`/`legal_holds` (ticket 0079/M35b) — already
--   generic enough (free-text `entity_type` + nullable `entity_id`) to
--   cover a `document_type` value with no new code; reused directly,
--   nothing retention/legal-hold related is built here.

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  -- Free text, not an enum: this module does not own the list of
  -- document types other modules may register ("drawing", "spec",
  -- "BOQ", "RFI", ...).
  document_type text not null,
  document_number text,
  title text not null,
  -- Nullable: not every controlled document is project-scoped (e.g. a
  -- corporate SOP).
  project_id uuid references public.projects (id),
  discipline text,
  -- Free text, not a fixed classification scheme — per CLAUDE.md this
  -- module does not invent a controlled vocabulary; that is a later
  -- config decision if the owner wants one.
  access_class text,
  tags text[] not null default '{}',
  originator_id uuid references public.app_users (id),
  -- Set once the first revision is created; self-referencing FK added
  -- after document_revisions exists below (it would otherwise forward-
  -- reference a table that doesn't exist yet).
  current_revision_id uuid,
  created_at timestamptz not null default now()
);

alter table public.documents enable row level security;

create policy "documents_tenant_isolation" on public.documents
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create index documents_project_id_idx on public.documents (project_id);
create index documents_document_type_idx on public.documents (document_type);

create table public.document_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  document_id uuid not null references public.documents (id),
  -- Free text, caller-supplied (e.g. "A", "B", "P1") — this ticket does
  -- not invent a numbering scheme.
  revision_code text not null,
  -- Own vocabulary — broader than one approval decision
  -- (ApprovalChainDecision), since a revision's lifecycle spans intake
  -- through supersession, not just one approval's outcome.
  status text not null default 'draft'
    check (status in ('draft', 'under_review', 'approved', 'superseded', 'rejected')),
  -- Pointer only, same convention as ticket 0096's
  -- tender_documents.storage_reference — no file upload/storage wiring
  -- built here.
  storage_reference text,
  reviewer_id uuid references public.app_users (id),
  approver_id uuid references public.app_users (id),
  -- FR-DOC-002: set when a newer revision supersedes this one.
  superseded_by_revision_id uuid references public.document_revisions (id),
  created_by uuid references public.app_users (id),
  created_at timestamptz not null default now()
);

alter table public.document_revisions enable row level security;

create policy "document_revisions_tenant_isolation" on public.document_revisions
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create index document_revisions_document_id_idx on public.document_revisions (document_id);
create index document_revisions_status_idx on public.document_revisions (status);

alter table public.documents
  add constraint documents_current_revision_id_fkey
  foreign key (current_revision_id) references public.document_revisions (id);

-- Permission: write actions (create document, create revision, edit
-- metadata) are gated by this; read/list/get stays open to any
-- permitted authenticated user per BRD's "All permitted roles" owner
-- line, same broad-read/narrow-write split already used by
-- modules/projects (tenancy.project.manage gates writes only).
-- Granted only to the platform administrator and the Document
-- Controller (`role.document_controller`, confirmed in
-- docs/canonical-role-map.md) — any other role's write access to a
-- *specific* document type is a later module's concern (M12 etc.),
-- not this ticket's.
insert into public.permissions (id, description) values
  ('documents.register.manage', 'Create or update a document register entry or revision');

insert into public.role_permissions (role_id, permission_id) values
  ('role.platform_administrator', 'documents.register.manage'),
  ('role.document_controller', 'documents.register.manage');
