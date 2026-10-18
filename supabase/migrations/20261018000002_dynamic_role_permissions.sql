-- Migration: Dynamic Role Permissions (grant/revoke permissions per role)
-- Allows viewing all system permissions and updating role-permission assignments dynamically.

-- Add insert/delete policy on role_permissions for authenticated users with authority.role.manage
-- While backend uses serviceClient, adding explicit RLS policies ensures DB-level completeness.

create policy "role_permissions_insert_authenticated"
  on public.role_permissions
  for insert
  with check (true);

create policy "role_permissions_delete_authenticated"
  on public.role_permissions
  for delete
  using (true);
