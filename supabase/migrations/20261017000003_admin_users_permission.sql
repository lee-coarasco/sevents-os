-- Ticket 0149: Admin User Management
-- Adds the admin.users.manage permission used by the GET/POST/PATCH /admin/users/* endpoints.
-- Platform Administrator holds it by default (same broad-admin pattern as every other
-- platform-administrator-only permission in ticket 0056).
insert into public.permissions (id, description)
values ('admin.users.manage', 'Invite, reassign roles, and deactivate tenant users')
on conflict (id) do nothing;

insert into public.role_permissions (role_id, permission_id)
values ('role.platform_administrator', 'admin.users.manage')
on conflict do nothing;
