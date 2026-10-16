-- M35a (ticket 0078): unified audit query surface, BRD §8.11 FR-AUD-001/002.
--
-- No new table and no new column on auth_audit_log — the one real gap
-- the ticket's survey found (auth_audit_log has no tenant_id column and
-- its only RLS policy is `auth.uid() = user_id`, so nobody but the row's
-- own user can read it, not even a platform administrator) is fixed by
-- a service-role-backed read in backend/src/modules/audit, gated on this
-- permission, not by loosening that RLS policy to "any tenant member."
insert into public.permissions (id, description) values
  ('audit.log.view', 'Read the unified, tenant-scoped audit log merged across auth, configuration, workflow and approval events');

insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions
where id = 'audit.log.view';
