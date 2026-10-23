import type { AiAdapter, AiCompletionOptions, AiCompletionResponse } from "./types.js";
import { createDeterministicMockEmbedding } from "./localAdapter.js";

export class AnthropicAdapter implements AiAdapter {
  readonly provider = "anthropic" as const;
  private apiKey?: string;
  private baseUrl = "https://api.anthropic.com/v1";

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY;
    if (baseUrl) this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // Anthropic does not provide a native embeddings endpoint — use normalized fallback
    return createDeterministicMockEmbedding(text, 1536);
  }

  async chatComplete(prompt: string, options?: AiCompletionOptions): Promise<AiCompletionResponse> {
    const rawModel = options?.model || "claude-3-5-sonnet-20241022";
    const model = rawModel.includes("claude") ? rawModel : "claude-3-5-sonnet-20241022";

    if (!this.apiKey) {
      return {
        content: `[Anthropic Claude (Simulated - No API Key)] Grounded analysis for: "${prompt}"`,
        model,
        provider: this.provider,
      };
    }

    const messages: Array<{ role: string; content: string }> = [];

    if (options?.history && options.history.length > 0) {
      for (const h of options.history) {
        messages.push({ role: h.role === "system" ? "user" : h.role, content: h.content });
      }
    }

    messages.push({ role: "user", content: prompt });

    const body: Record<string, any> = {
      model,
      messages,
      max_tokens: options?.maxTokens ?? 1500,
      temperature: options?.temperature ?? 0.2,
    };

    if (options?.systemPrompt) {
      body.system = options.systemPrompt;
    }

    const res = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Anthropic completion error (${res.status}): ${errorText}`);
    }

    const json = (await res.json()) as any;
    const textContent = json.content
      ?.filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n") || "";

    const usage = json.usage;

    return {
      content: textContent,
      model,
      provider: this.provider,
      tokensUsed: usage
        ? {
            prompt: usage.input_tokens || 0,
            completion: usage.output_tokens || 0,
            total: (usage.input_tokens || 0) + (usage.output_tokens || 0),
          }
        : undefined,
    };
  }

  async testConnection(): Promise<{ ok: boolean; message: string; latencyMs: number }> {
    const start = Date.now();
    if (!this.apiKey) {
      return {
        ok: false,
        message: "ANTHROPIC_API_KEY is not configured.",
        latencyMs: 0,
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 5,
          messages: [{ role: "user", content: "Ping" }],
        }),
      });

      const latency = Date.now() - start;
      if (res.ok) {
        return {
          ok: true,
          message: "Anthropic Claude connection established successfully.",
          latencyMs: latency,
        };
      } else {
        return {
          ok: false,
          message: `Anthropic returned status ${res.status}: ${res.statusText}`,
          latencyMs: latency,
        };
      }
    } catch (err: any) {
      return {
        ok: false,
        message: err.message || "Failed to reach Anthropic API.",
        latencyMs: Date.now() - start,
      };
    }
  }
}
