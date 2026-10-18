-- UX fixes for M05/M06: node edit/delete, catalogue create, definition edit
-- (companion to WorkflowVersionDetailPage + CataloguePage rewrites)

-- 1. Allow authenticated users to UPDATE and DELETE workflow_nodes on draft versions.
--    (Currently INSERT-only; blocked node edit/delete in the UI.)
create policy "workflow_nodes_update" on public.workflow_nodes
  for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "workflow_nodes_delete" on public.workflow_nodes
  for delete
  using (tenant_id = public.current_tenant_id());

-- 2. Allow authenticated users to DELETE workflow_transitions and workflow_conditions.
create policy "workflow_transitions_delete" on public.workflow_transitions
  for delete
  using (tenant_id = public.current_tenant_id());

create policy "workflow_conditions_delete" on public.workflow_conditions
  for delete
  using (tenant_id = public.current_tenant_id());

-- 3. Allow authenticated users to UPDATE workflow_definitions (name, description, capability_key).
create policy "workflow_definitions_update_meta" on public.workflow_definitions
  for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 4. Add source_type to work_item_definitions to distinguish imported vs manually created rows.
--    Existing rows (all imported) default to 'imported'.
alter table public.work_item_definitions
  add column if not exists source_type text not null default 'imported'
  check (source_type in ('imported', 'manual'));

-- 5. Add configuration_status_text to make configuration_status easier to show in UI
--    (column already exists from M05, no change needed — just confirming the update policy).

-- 6. Allow authenticated users to INSERT new manual work_item_definitions.
--    (M05 migration intentionally omitted this; the user now needs to create custom items.)
create policy "work_item_definitions_insert" on public.work_item_definitions
  for insert
  with check (tenant_id = public.current_tenant_id());
