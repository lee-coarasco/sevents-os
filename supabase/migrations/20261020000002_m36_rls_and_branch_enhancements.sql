-- Migration: 20261020000002_m36_rls_and_branch_enhancements.sql
-- 1. Extend branches with code and address fields
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS address TEXT;

-- 2. Ensure RLS defaults for Platform Administration tables so inserts & upserts never violate tenant isolation
ALTER TABLE public.tenant_settings ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.tenant_feature_flags ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.system_maintenance_windows ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.platform_support_tickets ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

-- 3. Refresh RLS policies to guarantee clean resolution with current_tenant_id()
DROP POLICY IF EXISTS tenant_settings_tenant_isolation ON public.tenant_settings;
CREATE POLICY tenant_settings_tenant_isolation ON public.tenant_settings
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_feature_flags_tenant_isolation ON public.tenant_feature_flags;
CREATE POLICY tenant_feature_flags_tenant_isolation ON public.tenant_feature_flags
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS system_maintenance_windows_tenant_isolation ON public.system_maintenance_windows;
CREATE POLICY system_maintenance_windows_tenant_isolation ON public.system_maintenance_windows
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS platform_support_tickets_tenant_isolation ON public.platform_support_tickets;
CREATE POLICY platform_support_tickets_tenant_isolation ON public.platform_support_tickets
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());
