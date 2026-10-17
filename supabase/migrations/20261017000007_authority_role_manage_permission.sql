-- Add permission for creating/managing custom role definitions.
-- Grants it to the platform administrator by default (deny-by-default
-- for every other role, same pattern as the original permissions seed).

insert into public.permissions (id, description) values
  ('authority.role.manage', 'Create or update a custom role definition');

insert into public.role_permissions (role_id, permission_id)
values ('role.platform_administrator', 'authority.role.manage');

-- Allow authenticated tenant users to insert role_definitions scoped to
-- their own tenant (platform-wide rows, is_platform_role = true, remain
-- write-only from migrations / service-role calls).
create policy "role_definitions_insert_tenant"
  on public.role_definitions
  for insert
  with check (
    tenant_id = public.current_tenant_id()
    and is_platform_role = false
  );
