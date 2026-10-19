-- Migration 20261019000014_m30_agent_runs_human_review_audit.sql
-- Module M30: Agent Runs, Human Review & Audit (BRD §8.10 FR-AG-004..010, FR-AUD-001)

-- 1. Extend agent_definitions with guardrails and budget controls
ALTER TABLE public.agent_definitions
    ADD COLUMN IF NOT EXISTS max_steps integer NOT NULL DEFAULT 10,
    ADD COLUMN IF NOT EXISTS timeout_seconds integer NOT NULL DEFAULT 60,
    ADD COLUMN IF NOT EXISTS spend_budget_usd numeric(10,4) NOT NULL DEFAULT 5.0000,
    ADD COLUMN IF NOT EXISTS risk_tier text NOT NULL DEFAULT 'medium',
    ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS pause_reason text;

-- 2. Extend agent_executions with tokens, cost, latency, structured plan steps, and replay protection
ALTER TABLE public.agent_executions
    ADD COLUMN IF NOT EXISTS tokens_prompt integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tokens_completion integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_tokens integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cost_usd numeric(10,6) NOT NULL DEFAULT 0.000000,
    ADD COLUMN IF NOT EXISTS latency_ms integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS steps_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS plan_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS confidence_score numeric(4,3) NOT NULL DEFAULT 0.950,
    ADD COLUMN IF NOT EXISTS approval_metadata jsonb,
    ADD COLUMN IF NOT EXISTS error_details jsonb,
    ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Index for execution lookups and idempotency
CREATE INDEX IF NOT EXISTS idx_agent_executions_idempotency 
    ON public.agent_executions(tenant_id, idempotency_key) 
    WHERE idempotency_key IS NOT NULL;

-- 3. Append-only Agent Run Audit Log (Replay-safe execution traces & compliance verification)
CREATE TABLE IF NOT EXISTS public.agent_run_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
    execution_id uuid REFERENCES public.agent_executions(id) ON DELETE CASCADE,
    agent_id uuid REFERENCES public.agent_definitions(id) ON DELETE SET NULL,
    actor_type text NOT NULL DEFAULT 'agent', -- 'agent', 'human_reviewer', 'system'
    actor_id text,
    event_type text NOT NULL, -- 'run_started', 'thought_generated', 'tool_called', 'hitl_requested', 'hitl_approved', 'hitl_rejected', 'run_completed', 'run_failed', 'run_cancelled', 'kill_switch_activated'
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_run_audit_execution ON public.agent_run_audit_logs(tenant_id, execution_id);
CREATE INDEX IF NOT EXISTS idx_agent_run_audit_event ON public.agent_run_audit_logs(tenant_id, event_type);

-- 4. Agent Incident & Redaction Review (Prompt injection, security anomalies, cost breaches)
CREATE TABLE IF NOT EXISTS public.agent_incident_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
    execution_id uuid REFERENCES public.agent_executions(id) ON DELETE CASCADE,
    agent_id uuid REFERENCES public.agent_definitions(id) ON DELETE SET NULL,
    incident_type text NOT NULL, -- 'prompt_injection_flagged', 'cost_limit_exceeded', 'max_steps_exceeded', 'tool_permission_denied', 'unauthorized_mutation', 'pii_leakage'
    severity text NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    description text NOT NULL,
    raw_content text,
    redacted_content text,
    is_resolved boolean NOT NULL DEFAULT false,
    resolved_by uuid,
    resolution_notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agent_incidents_tenant ON public.agent_incident_reviews(tenant_id, is_resolved);

-- Enable RLS
ALTER TABLE public.agent_run_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_incident_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "agent_run_audit_logs_tenant_isolation" ON public.agent_run_audit_logs
    FOR ALL USING (tenant_id = public.current_tenant_id());

CREATE POLICY "agent_incident_reviews_tenant_isolation" ON public.agent_incident_reviews
    FOR ALL USING (tenant_id = public.current_tenant_id());

-- 5. Register M30 Permissions
INSERT INTO public.permissions (id, description) VALUES
    ('ai.agent.audit', 'Review complete agent execution audit logs, token costs, and raw tool traces'),
    ('ai.agent.intervene', 'Pause, retry, cancel runs, or activate agent emergency kill switches'),
    ('ai.agent.incident', 'Triage, redact, and resolve AI security, prompt injection, and cost incident reviews')
ON CONFLICT (id) DO NOTHING;

-- Grant permissions to Platform Administrator, Company Administrator, and CEO
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.role_definitions r
CROSS JOIN (
    SELECT unnest(ARRAY[
        'ai.agent.audit',
        'ai.agent.intervene',
        'ai.agent.incident'
    ]) as id
) p
WHERE r.id IN ('role.platform_administrator', 'role.company_administrator', 'role.ceo')
ON CONFLICT (role_id, permission_id) DO NOTHING;
