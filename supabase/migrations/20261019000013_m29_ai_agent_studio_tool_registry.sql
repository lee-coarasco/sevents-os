-- Migration 20261019000013_m29_ai_agent_studio_tool_registry.sql
-- Module M29: AI Agent Studio & Tool Registry (BRD §8.10.2)

-- 1. Agent Definitions
CREATE TABLE IF NOT EXISTS public.agent_definitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
    key text NOT NULL,
    name text NOT NULL,
    description text,
    system_prompt text NOT NULL,
    model text NOT NULL DEFAULT 'gpt-4o-mini',
    temperature numeric NOT NULL DEFAULT 0.2,
    canonical_role_id text,
    allowed_tools jsonb NOT NULL DEFAULT '[]'::jsonb,
    hitl_policy text NOT NULL DEFAULT 'require_for_mutations', -- 'always', 'require_for_mutations', 'never'
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_agent_definitions_tenant_key UNIQUE (tenant_id, key)
);

-- 2. Tool Registry
CREATE TABLE IF NOT EXISTS public.agent_tool_registry (
    key text PRIMARY KEY,
    name text NOT NULL,
    description text NOT NULL,
    category text NOT NULL DEFAULT 'general',
    required_permission text NOT NULL,
    is_mutation boolean NOT NULL DEFAULT false,
    schema jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Agent Executions (Audit Log & HITL State Machine)
CREATE TABLE IF NOT EXISTS public.agent_executions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
    agent_id uuid REFERENCES public.agent_definitions(id) ON DELETE CASCADE,
    user_id uuid,
    session_id text,
    input_prompt text NOT NULL,
    status text NOT NULL DEFAULT 'completed', -- 'running', 'paused_waiting_approval', 'completed', 'failed', 'rejected'
    messages jsonb NOT NULL DEFAULT '[]'::jsonb,
    pending_action jsonb, -- { toolKey, toolName, input, rationale, callId }
    output_summary text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_definitions_tenant ON public.agent_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_tenant_agent ON public.agent_executions(tenant_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_status ON public.agent_executions(status);

-- Enable RLS
ALTER TABLE public.agent_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tool_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "agent_definitions_tenant_isolation" ON public.agent_definitions
    FOR ALL USING (tenant_id = public.current_tenant_id());

CREATE POLICY "agent_tool_registry_read_all" ON public.agent_tool_registry
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "agent_executions_tenant_isolation" ON public.agent_executions
    FOR ALL USING (tenant_id = public.current_tenant_id());

-- 4. Pre-seed Standard SEVENTS Operational Tools
INSERT INTO public.agent_tool_registry (key, name, description, category, required_permission, is_mutation, schema) VALUES
(
    'search_knowledge_base',
    'Search Project Knowledge Base',
    'Semantic vector search across project drawings, specifications, RFIs, and contracts with citations.',
    'engineering',
    'ai.assistant.query',
    false,
    '{
        "type": "object",
        "properties": {
            "query": { "type": "string", "description": "Technical search query or spec requirement" },
            "projectId": { "type": "string", "description": "Optional project UUID filter" }
        },
        "required": ["query"]
    }'::jsonb
),
(
    'query_project_schedule',
    'Query Schedule & Milestones',
    'Inspect project WBS milestones, planned vs actual finish dates, and lookahead tasks.',
    'schedule',
    'project.schedule.view',
    false,
    '{
        "type": "object",
        "properties": {
            "projectId": { "type": "string", "description": "Project UUID" },
            "status": { "type": "string", "description": "Optional status filter (e.g. in_progress, delayed)" }
        },
        "required": ["projectId"]
    }'::jsonb
),
(
    'get_boq_items',
    'Get Bill of Quantities Items',
    'Retrieve work-item catalogue lines, approved quantities, and unit rates for a project.',
    'finance',
    'catalogue.workitem.view',
    false,
    '{
        "type": "object",
        "properties": {
            "search": { "type": "string", "description": "Search keyword in description or item code" }
        }
    }'::jsonb
),
(
    'check_inventory_stock',
    'Check Inventory & Warehouse Stock',
    'Check on-site inventory balances, storage locations, and minimum threshold alerts.',
    'procurement',
    'inventory.item.view',
    false,
    '{
        "type": "object",
        "properties": {
            "itemName": { "type": "string", "description": "Material name or SKU" }
        },
        "required": ["itemName"]
    }'::jsonb
),
(
    'create_site_rfi',
    'Draft Site RFI (Request for Information)',
    'Create and submit a formal RFI to the consultant or structural engineer regarding drawing discrepancy.',
    'engineering',
    'design.rfi.create',
    true,
    '{
        "type": "object",
        "properties": {
            "projectId": { "type": "string", "description": "Target project UUID" },
            "title": { "type": "string", "description": "Clear technical title of the clarification" },
            "question": { "type": "string", "description": "Detailed question referencing drawing sheet" },
            "suggestedSolution": { "type": "string", "description": "Contractor proposed resolution" }
        },
        "required": ["projectId", "title", "question"]
    }'::jsonb
),
(
    'calculate_delay_impact',
    'Calculate Schedule Delay Impact',
    'Analyze site delay events against project completion baseline and estimate critical path slip.',
    'schedule',
    'project.schedule.manage',
    false,
    '{
        "type": "object",
        "properties": {
            "projectId": { "type": "string", "description": "Project UUID" },
            "delayDays": { "type": "number", "description": "Number of working days delayed" },
            "reason": { "type": "string", "description": "Root cause of delay" }
        },
        "required": ["projectId", "delayDays"]
    }'::jsonb
),
(
    'log_safety_observation',
    'Log Safety Hazard or Observation',
    'Record a safety hazard observation or near miss on site for HSE compliance review.',
    'safety',
    'safety.hazard.report',
    true,
    '{
        "type": "object",
        "properties": {
            "projectId": { "type": "string", "description": "Project UUID" },
            "hazardType": { "type": "string", "description": "e.g. Scaffolding, PPE, Electrical, Fall Hazard" },
            "description": { "type": "string", "description": "Description of observed condition" },
            "severity": { "type": "string", "enum": ["low", "medium", "high", "critical"] }
        },
        "required": ["projectId", "hazardType", "description"]
    }'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    required_permission = EXCLUDED.required_permission,
    is_mutation = EXCLUDED.is_mutation,
    schema = EXCLUDED.schema;

-- 5. Register M29 Permissions
INSERT INTO public.permissions (id, description) VALUES
    ('ai.agent.manage', 'Create, configure, and manage AI agent studio profiles and tool bindings'),
    ('ai.agent.execute', 'Prompt and execute autonomous AI agents across project tools'),
    ('ai.agent.approve', 'Review and approve/reject pending Human-In-The-Loop agent actions')
ON CONFLICT (id) DO NOTHING;

-- Grant permissions to Platform Administrator and CEO
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.role_definitions r
CROSS JOIN (
    SELECT unnest(ARRAY[
        'ai.agent.manage',
        'ai.agent.execute',
        'ai.agent.approve'
    ]) as id
) p
WHERE r.id IN ('role.platform_administrator', 'role.ceo')
ON CONFLICT (role_id, permission_id) DO NOTHING;
