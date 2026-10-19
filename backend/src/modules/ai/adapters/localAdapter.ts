import type { AiAdapter, AiCompletionOptions, AiCompletionResponse } from "./types.js";

/**
 * Deterministic pseudo-embedding generator for offline, air-gapped, or test environments.
 * Generates normalized 1536-dimensional vectors based on prime polynomial rolling hash.
 */
export function createDeterministicMockEmbedding(text: string, dim = 1536): number[] {
  const vec = new Array(dim).fill(0);
  const clean = text.toLowerCase().trim();
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    const pos = (code * 31 + i) % dim;
    vec[pos] += 1;
  }
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => Number((v / norm).toFixed(6)));
}

export class LocalAiAdapter implements AiAdapter {
  readonly provider = "local" as const;

  async generateEmbedding(text: string): Promise<number[]> {
    return createDeterministicMockEmbedding(text, 1536);
  }

  async chatComplete(prompt: string, options?: AiCompletionOptions): Promise<AiCompletionResponse> {
    const model = options?.model || "sevents-local-v1";
    return {
      content: `[Local Engine] Processed prompt: "${prompt}". System instructions: "${options?.systemPrompt || "Standard SEVENTS Engineering Assistant"}".`,
      model,
      provider: this.provider,
      tokensUsed: { prompt: prompt.length / 4, completion: 50, total: prompt.length / 4 + 50 },
    };
  }

  async testConnection(): Promise<{ ok: boolean; message: string; latencyMs: number }> {
    const start = Date.now();
    await this.generateEmbedding("Health check connection test");
    return {
      ok: true,
      message: "Local deterministic AI engine operational (offline mode).",
      latencyMs: Date.now() - start,
    };
  }
}
