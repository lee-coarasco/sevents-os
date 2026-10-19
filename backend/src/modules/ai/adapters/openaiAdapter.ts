import type { AiAdapter, AiCompletionOptions, AiCompletionResponse } from "./types.js";
import { createDeterministicMockEmbedding } from "./localAdapter.js";

export class OpenAiAdapter implements AiAdapter {
  readonly provider: string;
  private apiKey?: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string, providerId: string = "openai") {
    this.provider = providerId;
    this.apiKey = apiKey || (providerId === "openai" ? process.env.OPENAI_API_KEY : undefined);
    this.baseUrl = (baseUrl || (providerId === "openai" ? (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1") : "https://api.openai.com/v1")).replace(/\/+$/, "");
  }

  async generateEmbedding(text: string, model: string = "text-embedding-3-small"): Promise<number[]> {
    if (!this.apiKey) {
      return createDeterministicMockEmbedding(text, 1536);
    }

    try {
      const res = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          input: text.slice(0, 8000),
          model,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`OpenAI Embedding error (${res.status}): ${errorText}`);
      }

      const json = (await res.json()) as any;
      return json.data[0].embedding;
    } catch (err) {
      console.warn("[OpenAiAdapter] Embedding call failed, using fallback:", err);
      return createDeterministicMockEmbedding(text, 1536);
    }
  }

  async chatComplete(prompt: string, options?: AiCompletionOptions): Promise<AiCompletionResponse> {
    const model = options?.model || "gpt-4o-mini";

    if (!this.apiKey) {
      return {
        content: `[OpenAI (Simulated - No API Key)] Grounded analysis for: "${prompt}"`,
        model,
        provider: this.provider,
      };
    }

    const messages: Array<{ role: string; content: string }> = [];

    if (options?.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }

    if (options?.history && options.history.length > 0) {
      for (const h of options.history) {
        messages.push({ role: h.role, content: h.content });
      }
    }

    messages.push({ role: "user", content: prompt });

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.2,
        max_tokens: options?.maxTokens ?? 1500,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenAI Completion error (${res.status}): ${errorText}`);
    }

    const json = (await res.json()) as any;
    const content = json.choices?.[0]?.message?.content || "";
    const usage = json.usage;

    return {
      content,
      model,
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
    const isLocal = this.baseUrl.includes("localhost") || this.baseUrl.includes("127.0.0.1");

    if (!this.apiKey && !isLocal) {
      return {
        ok: false,
        message: `${this.provider.toUpperCase()} API key is not configured.`,
        latencyMs: 0,
      };
    }

    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }
      const res = await fetch(`${this.baseUrl}/models`, { headers });
      const latency = Date.now() - start;
      if (res.ok) {
        return {
          ok: true,
          message: `${this.provider} connection established successfully.`,
          latencyMs: latency,
        };
      } else {
        return {
          ok: false,
          message: `${this.provider} returned status ${res.status}: ${res.statusText}`,
          latencyMs: latency,
        };
      }
    } catch (err: any) {
      return {
        ok: false,
        message: err.message || `Failed to reach ${this.provider} API at ${this.baseUrl}.`,
        latencyMs: Date.now() - start,
      };
    }
  }
}
