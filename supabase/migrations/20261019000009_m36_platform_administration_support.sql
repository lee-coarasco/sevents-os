-- Migration: 20261019000009_m36_platform_administration_support.sql
-- Module M36: Platform Administration & Support
-- Tables: tenant_settings, tenant_feature_flags, system_maintenance_windows, platform_support_tickets

-- 1. Tenant Settings & Operational Quotas
CREATE TABLE IF NOT EXISTS public.tenant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    organization_name TEXT NOT NULL,
    default_timezone TEXT NOT NULL DEFAULT 'Asia/Dubai',
    default_currency TEXT NOT NULL DEFAULT 'AED',
    fiscal_year_start_month INTEGER NOT NULL DEFAULT 1,
    storage_quota_gb INTEGER NOT NULL DEFAULT 100,
    session_timeout_minutes INTEGER NOT NULL DEFAULT 60,
    mfa_enforced BOOLEAN NOT NULL DEFAULT false,
    support_email TEXT,
    support_phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tenant_settings_tenant UNIQUE (tenant_id)
);

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_settings_tenant_isolation ON public.tenant_settings
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

-- 2. Feature Flags
CREATE TABLE IF NOT EXISTS public.tenant_feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    flag_key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tenant_feature_flags UNIQUE (tenant_id, flag_key)
);

ALTER TABLE public.tenant_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_feature_flags_tenant_isolation ON public.tenant_feature_flags
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

-- 3. Maintenance Windows & System Announcements
CREATE TABLE IF NOT EXISTS public.system_maintenance_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_maintenance_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_maintenance_windows_tenant_isolation ON public.system_maintenance_windows
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

-- 4. Platform Support & Helpdesk Tickets
CREATE TABLE IF NOT EXISTS public.platform_support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    ticket_number TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('bug', 'access', 'data', 'performance', 'general')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    reported_by TEXT NOT NULL,
    assigned_to TEXT,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_support_tickets_tenant_isolation ON public.platform_support_tickets
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

-- 5. Seed Permissions for M36
INSERT INTO public.permissions (key, description, module)
VALUES
    ('platform.settings.view', 'View tenant configuration and settings', 'platform-admin'),
    ('platform.settings.manage', 'Modify tenant settings, quotas, and security policies', 'platform-admin'),
    ('platform.feature_flags.manage', 'Toggle tenant feature flags and experimental features', 'platform-admin'),
    ('platform.health.view', 'View system health probes, queue latency, and telemetry', 'platform-admin'),
    ('platform.maintenance.manage', 'Schedule and broadcast maintenance announcement banners', 'platform-admin'),
    ('platform.support.view', 'View helpdesk and support tickets', 'platform-admin'),
    ('platform.support.manage', 'Create and resolve platform support tickets', 'platform-admin')
ON CONFLICT (key) DO NOTHING;

-- Map permissions to roles
DO $$
DECLARE
    r RECORD;
    admin_roles TEXT[] := ARRAY['role.platform_administrator', 'role.company_administrator', 'role.it_administrator'];
    support_roles TEXT[] := ARRAY['role.platform_administrator', 'role.it_administrator', 'role.project_director'];
BEGIN
    -- Admin roles get full settings, feature flags, health, maintenance
    FOR r IN SELECT id FROM public.role_definitions WHERE canonical_name = ANY(admin_roles) LOOP
        UPDATE public.role_definitions
        SET permissions = array_cat(
            permissions,
            ARRAY[
                'platform.settings.view',
                'platform.settings.manage',
                'platform.feature_flags.manage',
                'platform.health.view',
                'platform.maintenance.manage',
                'platform.support.view',
                'platform.support.manage'
            ]
        )
        WHERE id = r.id;
    END LOOP;

    -- Standard staff roles can view support and report issues
    FOR r IN SELECT id FROM public.role_definitions WHERE canonical_name = ANY(support_roles) LOOP
        UPDATE public.role_definitions
        SET permissions = array_cat(
            permissions,
            ARRAY[
                'platform.settings.view',
                'platform.support.view',
                'platform.support.manage'
            ]
        )
        WHERE id = r.id;
    END LOOP;
END $$;
