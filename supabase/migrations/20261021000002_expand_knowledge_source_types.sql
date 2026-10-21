-- Migration: 20261021000002_expand_knowledge_source_types.sql
-- Expands the allowed source_type values on knowledge_documents to include specifications, submittals, policies, and change orders.

ALTER TABLE public.knowledge_documents 
  DROP CONSTRAINT IF EXISTS knowledge_documents_source_type_check;

ALTER TABLE public.knowledge_documents 
  ADD CONSTRAINT knowledge_documents_source_type_check 
  CHECK (source_type IN (
    'document',
    'drawing',
    'rfi',
    'dpr',
    'contract',
    'work_item',
    'sop',
    'specification',
    'submittal',
    'policy',
    'change_order'
  ));

-- Notify PostgREST to refresh schema cache
NOTIFY pgrst, 'reload schema';
