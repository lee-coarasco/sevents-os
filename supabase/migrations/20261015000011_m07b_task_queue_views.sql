-- M07b: My Work / Team Work queue views (ticket 0071)
--
-- No new tables — the seven BRD-named queue views (My Work, Team Work,
-- Due Soon, Overdue, Blocked, Waiting Approval, Completed) are all
-- read-only filter combinations over workflow_step_instances (ticket
-- 0062) plus the metadata columns ticket 0070 (M07a) added. This
-- migration only adds the permission that gates the six non-"My Work"
-- views (My Work itself is self-service, same "own row" exemption as
-- GET /employees/me).

insert into public.permissions (id, description) values
  ('workflow.task.view_team', 'View every open/completed task in the caller''s tenant across the Team Work / Due Soon / Overdue / Blocked / Waiting Approval / Completed queues (not just the caller''s own My Work)');

-- Same deny-by-default bootstrap as every permission added so far.
insert into public.role_permissions (role_id, permission_id)
select 'role.platform_administrator', id from public.permissions
where id = 'workflow.task.view_team';
