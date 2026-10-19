-- Migration 20261019000012: Module M28 - AI Knowledge Assistant & Search
-- Enables pgvector, creates knowledge repository, chunk embeddings, match RPC, and feedback tracking.

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Knowledge Documents Table
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN ('document', 'drawing', 'rfi', 'dpr', 'contract', 'work_item', 'sop')),
    source_id TEXT NOT NULL,
    title TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT 'v1',
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_knowledge_source UNIQUE (tenant_id, source_type, source_id, version)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_tenant ON public.knowledge_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_project ON public.knowledge_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_type ON public.knowledge_documents(source_type);

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY knowledge_documents_tenant_isolation ON public.knowledge_documents
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

-- 3. Knowledge Embeddings Table (vector dimension: 1536)
CREATE TABLE IF NOT EXISTS public.knowledge_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_tenant ON public.knowledge_embeddings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_doc ON public.knowledge_embeddings(document_id);

ALTER TABLE public.knowledge_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY knowledge_embeddings_tenant_isolation ON public.knowledge_embeddings
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

-- 4. AI Query & Feedback Table (BRD: Feedback & Knowledge Gap Reporting)
CREATE TABLE IF NOT EXISTS public.ai_query_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    query_text TEXT NOT NULL,
    answer_text TEXT NOT NULL,
    citations JSONB NOT NULL DEFAULT '[]'::jsonb,
    rating TEXT CHECK (rating IN ('positive', 'negative', 'inaccurate', 'missing_info')),
    feedback_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_tenant ON public.ai_query_feedback(tenant_id);

ALTER TABLE public.ai_query_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_feedback_tenant_isolation ON public.ai_query_feedback
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

-- 5. Stored Procedure: match_knowledge_chunks (Cosine Similarity Search)
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks (
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 5,
    filter_project_id uuid DEFAULT NULL,
    filter_tenant_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    document_id uuid,
    title text,
    source_type text,
    version text,
    project_id uuid,
    chunk_text text,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ke.id,
        ke.document_id,
        kd.title,
        kd.source_type,
        kd.version,
        kd.project_id,
        ke.chunk_text,
        1 - (ke.embedding <=> query_embedding) AS similarity
    FROM public.knowledge_embeddings ke
    JOIN public.knowledge_documents kd ON kd.id = ke.document_id
    WHERE
        (filter_tenant_id IS NULL OR ke.tenant_id = filter_tenant_id)
        AND (filter_project_id IS NULL OR kd.project_id = filter_project_id)
        AND ke.embedding IS NOT NULL
        AND (1 - (ke.embedding <=> query_embedding)) > match_threshold
    ORDER BY ke.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 6. Register M28 Permissions
INSERT INTO public.permissions (id, description) VALUES
    ('ai.assistant.query', 'Query the AI knowledge assistant and semantic search'),
    ('ai.knowledge.manage', 'Ingest, index, and manage documents in the AI knowledge base'),
    ('ai.feedback.submit', 'Submit feedback and report knowledge gaps on AI answers')
ON CONFLICT (id) DO NOTHING;

-- Grant permissions to Platform Administrator and CEO
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.role_definitions r
CROSS JOIN (
    SELECT unnest(ARRAY[
        'ai.assistant.query',
        'ai.knowledge.manage',
        'ai.feedback.submit'
    ]) as id
) p
WHERE r.id IN ('role.platform_administrator', 'role.ceo')
ON CONFLICT (role_id, permission_id) DO NOTHING;
