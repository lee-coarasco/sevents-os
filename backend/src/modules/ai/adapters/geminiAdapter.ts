import type { AiAdapter, AiCompletionOptions, AiCompletionResponse } from "./types.js";
import { createDeterministicMockEmbedding } from "./localAdapter.js";

export class GeminiAdapter implements AiAdapter {
  readonly provider = "gemini" as const;
  private apiKey?: string;
  private baseUrl = "https://generativelanguage.googleapis.com/v1beta";

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY;
    if (baseUrl) this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async generateEmbedding(text: string, _model: string = "text-embedding-004"): Promise<number[]> {
    if (!this.apiKey) {
      return createDeterministicMockEmbedding(text, 1536);
    }

    try {
      const res = await fetch(
        `${this.baseUrl}/models/text-embedding-004:embedContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: { parts: [{ text: text.slice(0, 8000) }] },
          }),
        }
      );

      if (!res.ok) {
        throw new Error(`Gemini embedding failed with status ${res.status}`);
      }

      const json = (await res.json()) as any;
      const values: number[] = json.embedding?.values || [];
      // If dimension is 768, pad or interpolate to 1536 for pgvector schema consistency
      if (values.length === 768) {
        const padded = new Array(1536).fill(0);
        for (let i = 0; i < 768; i++) {
          padded[i * 2] = values[i];
          padded[i * 2 + 1] = values[i];
        }
        return padded;
      }
      return values.slice(0, 1536);
    } catch (err) {
      console.warn("[GeminiAdapter] Embedding error, using fallback:", err);
      return createDeterministicMockEmbedding(text, 1536);
    }
  }

  async chatComplete(prompt: string, options?: AiCompletionOptions): Promise<AiCompletionResponse> {
    const rawModel = options?.model || "gemini-1.5-flash";
    const model = rawModel.startsWith("gemini") ? rawModel : "gemini-1.5-flash";

    if (!this.apiKey) {
      return {
        content: `[Gemini (Simulated - No API Key)] Grounded analysis for: "${prompt}"`,
        model,
        provider: this.provider,
      };
    }

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    if (options?.history && options.history.length > 0) {
      for (const h of options.history) {
        contents.push({
          role: h.role === "assistant" ? "model" : "user",
          parts: [{ text: h.content }],
        });
      }
    }

    contents.push({ role: "user", parts: [{ text: prompt }] });

    const body: Record<string, any> = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.2,
        maxOutputTokens: options?.maxTokens ?? 1500,
      },
    };

    if (options?.systemPrompt) {
      body.systemInstruction = { parts: [{ text: options.systemPrompt }] };
    }

    const res = await fetch(
      `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Gemini completion error (${res.status}): ${errorText}`);
    }

    const json = (await res.json()) as any;
    const candidate = json.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || "";
    const meta = json.usageMetadata;

    return {
      content,
      model,
      provider: this.provider,
      tokensUsed: meta
        ? {
            prompt: meta.promptTokenCount || 0,
            completion: meta.candidatesTokenCount || 0,
            total: meta.totalTokenCount || 0,
          }
        : undefined,
    };
  }

  async testConnection(): Promise<{ ok: boolean; message: string; latencyMs: number }> {
    const start = Date.now();
    if (!this.apiKey) {
      return {
        ok: false,
        message: "GEMINI_API_KEY is not configured.",
        latencyMs: 0,
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/models?key=${this.apiKey}`);
      const latency = Date.now() - start;
      if (res.ok) {
        return {
          ok: true,
          message: "Google Gemini connection established successfully.",
          latencyMs: latency,
        };
      } else {
        return {
          ok: false,
          message: `Gemini returned status ${res.status}: ${res.statusText}`,
          latencyMs: latency,
        };
      }
    } catch (err: any) {
      return {
        ok: false,
        message: err.message || "Failed to reach Gemini API.",
        latencyMs: Date.now() - start,
      };
    }
  }
}
