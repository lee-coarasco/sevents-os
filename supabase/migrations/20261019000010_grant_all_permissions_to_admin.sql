-- Migration: 20261019000010_grant_all_permissions_to_admin.sql
-- Assigns every registered permission in public.permissions to role.platform_administrator
-- to guarantee that platform administrators have unrestricted access across all modules.

insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id
from public.permissions
on conflict do nothing;
