-- Ticket 0108 (Ticket A): the shared <UserPicker> component (M03/M04/M07/M08)
-- needs to look up other users in the same tenant by name/email — today
-- app_users (ticket 0054/M01) only has an "own row" select policy, added
-- before tenant_id existed on the table (ticket 0055/M02 added it later).
--
-- Additive only: this is a second, OR'd permissive policy alongside
-- "app_users_select_own" (Postgres RLS policies for the same command are
-- combined with OR), so existing behavior (a user can always read their
-- own row even before tenant_id is set, e.g. mid-invite) is unchanged.

create policy "app_users_select_same_tenant" on public.app_users
  for select
  using (tenant_id = public.current_tenant_id());
