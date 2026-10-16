-- M13b: Approval stamps & IFC release gate (ticket 0105).
--
-- Additive only — extends document_revisions (ticket 0104/M13a) with the
-- two columns the request_approval workflow seam needs on this table,
-- same nullable shape ticket 0097 used on estimates:
-- - workflow_instance_id: which workflow instance is deciding a revision
--   submitted for IFC release (submitRevisionForRelease sets it;
--   resolveRevisionApproval reads it back).
-- - approved_at: the "approval stamp" timestamp FR-DOC-003 asks for,
--   alongside the reviewer_id/approver_id columns ticket 0104 already
--   added.
--
-- No new status vocabulary, no is_ifc flag, no second approval
-- mechanism — "IFC" is just "approved and current" for a drawing-type
-- document, per this ticket's text.

alter table public.document_revisions
  add column workflow_instance_id uuid references public.workflow_instances (id),
  add column approved_at timestamptz;

create index document_revisions_workflow_instance_id_idx on public.document_revisions (workflow_instance_id);
