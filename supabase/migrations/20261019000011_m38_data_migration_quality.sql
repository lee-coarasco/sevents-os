-- Migration 20261019000011: Module M38 - Implementation, Migration & Data Quality
-- Supports dry-run validation, column mapping, duplicate detection, reconciliation reports, and rollback snapshots.

CREATE TABLE IF NOT EXISTS public.migration_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('work_items', 'cost_codes', 'employees', 'vendors', 'inventory_items')),
    file_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'imported', 'rolled_back', 'failed')),
    total_rows INT NOT NULL DEFAULT 0,
    valid_rows INT NOT NULL DEFAULT 0,
    error_rows INT NOT NULL DEFAULT 0,
    row_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    rollback_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    imported_at TIMESTAMPTZ,
    rolled_back_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_migration_jobs_tenant ON public.migration_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_status ON public.migration_jobs(status);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_entity ON public.migration_jobs(entity_type);

-- Enable RLS
ALTER TABLE public.migration_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY migration_jobs_tenant_isolation ON public.migration_jobs
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

-- Register M38 Permissions
INSERT INTO public.permissions (id, description) VALUES
    ('migration.job.view', 'View migration history, dry-run validation reports and audit logs'),
    ('migration.import.execute', 'Execute CSV/Excel data import and staged activation'),
    ('migration.rollback.execute', 'Rollback a previous data import batch')
ON CONFLICT (id) DO NOTHING;

-- Grant permissions to Platform Administrator and CEO
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.role_definitions r
CROSS JOIN (
    SELECT unnest(ARRAY[
        'migration.job.view',
        'migration.import.execute',
        'migration.rollback.execute'
    ]) as id
) p
WHERE r.id IN ('role.platform_administrator', 'role.ceo')
ON CONFLICT (role_id, permission_id) DO NOTHING;

