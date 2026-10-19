import type { AiAdapter, AiCompletionOptions, AiCompletionResponse } from "./types.js";
import { createDeterministicMockEmbedding } from "./localAdapter.js";

export class AzureOpenAiAdapter implements AiAdapter {
  readonly provider = "azure" as const;
  private endpoint?: string;
  private apiKey?: string;
  private deployment: string;
  private apiVersion: string;

  constructor(endpoint?: string, apiKey?: string, deployment?: string, apiVersion?: string) {
    this.endpoint = (endpoint || process.env.AZURE_OPENAI_ENDPOINT || "").replace(/\/+$/, "");
    this.apiKey = apiKey || process.env.AZURE_OPENAI_API_KEY;
    this.deployment = deployment || process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4o";
    this.apiVersion = apiVersion || process.env.AZURE_OPENAI_API_VERSION || "2024-02-15-preview";
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.endpoint || !this.apiKey) {
      return createDeterministicMockEmbedding(text, 1536);
    }

    try {
      const url = `${this.endpoint}/openai/deployments/text-embedding-3-small/embeddings?api-version=${this.apiVersion}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": this.apiKey,
        },
        body: JSON.stringify({ input: text.slice(0, 8000) }),
      });

      if (!res.ok) throw new Error(`Azure embedding failed: ${res.statusText}`);
      const json = (await res.json()) as any;
      return json.data[0].embedding;
    } catch (err) {
      console.warn("[AzureOpenAiAdapter] Embedding fallback:", err);
      return createDeterministicMockEmbedding(text, 1536);
    }
  }

  async chatComplete(prompt: string, options?: AiCompletionOptions): Promise<AiCompletionResponse> {
    const deployment = options?.model || this.deployment;

    if (!this.endpoint || !this.apiKey) {
      return {
        content: `[Azure OpenAI (Simulated - No Endpoint/Key)] Grounded analysis for: "${prompt}"`,
        model: deployment,
        provider: this.provider,
      };
    }

    const messages: Array<{ role: string; content: string }> = [];
    if (options?.systemPrompt) messages.push({ role: "system", content: options.systemPrompt });
    if (options?.history) {
      for (const h of options.history) messages.push({ role: h.role, content: h.content });
    }
    messages.push({ role: "user", content: prompt });

    const url = `${this.endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${this.apiVersion}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": this.apiKey,
      },
      body: JSON.stringify({
        messages,
        temperature: options?.temperature ?? 0.2,
        max_tokens: options?.maxTokens ?? 1500,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Azure OpenAI error (${res.status}): ${errText}`);
    }

    const json = (await res.json()) as any;
    const content = json.choices?.[0]?.message?.content || "";
    const usage = json.usage;

    return {
      content,
      model: deployment,
      provider: this.provider,
      tokensUsed: usage
        ? {
            prompt: usage.prompt_tokens,
            completion: usage.completion_tokens,
            total: usage.total_tokens,
          }
        : undefined,
    };
  }

  async testConnection(): Promise<{ ok: boolean; message: string; latencyMs: number }> {
    const start = Date.now();
    if (!this.endpoint || !this.apiKey) {
      return {
        ok: false,
        message: "AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_API_KEY is not configured.",
        latencyMs: 0,
      };
    }

    try {
      const url = `${this.endpoint}/openai/models?api-version=${this.apiVersion}`;
      const res = await fetch(url, {
        headers: { "api-key": this.apiKey },
      });
      const latency = Date.now() - start;
      return {
        ok: res.ok,
        message: res.ok
          ? "Azure OpenAI endpoint reached successfully."
          : `Azure returned ${res.status}: ${res.statusText}`,
        latencyMs: latency,
      };
    } catch (err: any) {
      return {
        ok: false,
        message: err.message || "Failed to reach Azure OpenAI.",
        latencyMs: Date.now() - start,
      };
    }
  }
}
