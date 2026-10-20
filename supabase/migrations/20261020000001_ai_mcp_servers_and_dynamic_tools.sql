-- Migration: 20261020000001_ai_mcp_servers_and_dynamic_tools.sql
-- Enables registering custom MCP (Model Context Protocol) servers and dynamic custom tools for AI Copilots.

CREATE TABLE IF NOT EXISTS public.ai_mcp_servers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
    name text NOT NULL,
    url text NOT NULL,
    transport text NOT NULL DEFAULT 'http', -- 'http' or 'sse'
    api_key text,
    description text,
    is_active boolean NOT NULL DEFAULT true,
    cached_tools jsonb NOT NULL DEFAULT '[]'::jsonb,
    last_synced_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add custom / mcp server metadata columns to agent_tool_registry if not present
ALTER TABLE public.agent_tool_registry
    ADD COLUMN IF NOT EXISTS mcp_server_id uuid REFERENCES public.ai_mcp_servers(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS webhook_url text,
    ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false;

-- Enable RLS
ALTER TABLE public.ai_mcp_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_mcp_servers_tenant_isolation" ON public.ai_mcp_servers
    FOR ALL USING (tenant_id = public.current_tenant_id());

CREATE POLICY "agent_tool_registry_insert_authenticated" ON public.agent_tool_registry
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "agent_tool_registry_update_authenticated" ON public.agent_tool_registry
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "agent_tool_registry_delete_authenticated" ON public.agent_tool_registry
    FOR DELETE TO authenticated USING (true);
