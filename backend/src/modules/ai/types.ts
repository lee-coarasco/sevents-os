export type KnowledgeSourceType =
  | "document"
  | "drawing"
  | "rfi"
  | "dpr"
  | "contract"
  | "work_item"
  | "sop";

export type AiOutputType =
  | "summary"
  | "extracted_field"
  | "recommendation"
  | "draft"
  | "proposed_action";

export interface KnowledgeDocument {
  id: string;
  tenant_id: string;
  project_id?: string | null;
  source_type: KnowledgeSourceType;
  source_id: string;
  title: string;
  version: string;
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeChunkMatch {
  id: string;
  document_id: string;
  title: string;
  source_type: KnowledgeSourceType;
  version: string;
  project_id?: string | null;
  chunk_text: string;
  similarity: number;
}

export interface Citation {
  documentId: string;
  title: string;
  sourceType: KnowledgeSourceType;
  version: string;
  snippet: string;
  similarity: number;
}

export interface AiChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AiChatRequest {
  message: string;
  projectId?: string;
  history?: AiChatMessage[];
}

export interface AiChatResponse {
  answer: string;
  citations: Citation[];
  confidence: number;
  outputType: AiOutputType;
  modelUsed: string;
  abstained: boolean;
}

export interface AiFeedbackInput {
  queryText: string;
  answerText: string;
  citations: Citation[];
  rating: "positive" | "negative" | "inaccurate" | "missing_info";
  feedbackNotes?: string;
}
