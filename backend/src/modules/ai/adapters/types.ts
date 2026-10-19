export type AiProviderType = "openai" | "gemini" | "anthropic" | "azure" | "local" | string;

export interface AiProviderConfig {
  provider: AiProviderType;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  embeddingModel?: string;
  azureEndpoint?: string;
  azureDeployment?: string;
  azureApiVersion?: string;
}

export interface AiCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  history?: Array<{ role: "user" | "assistant" | "system"; content: string }>;
}

export interface AiCompletionResponse {
  content: string;
  model: string;
  provider: AiProviderType;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface AiAdapter {
  readonly provider: AiProviderType;
  generateEmbedding(text: string, model?: string): Promise<number[]>;
  chatComplete(prompt: string, options?: AiCompletionOptions): Promise<AiCompletionResponse>;
  testConnection(): Promise<{ ok: boolean; message: string; latencyMs: number }>;
}
