import type { AiChatMessage, AiOutputType } from "./types.js";

export interface LlmProvider {
  generateEmbedding(text: string): Promise<number[]>;
  generateAnswer(
    query: string,
    contextPassages: { title: string; version: string; text: string }[],
    history?: AiChatMessage[]
  ): Promise<{
    answer: string;
    outputType: AiOutputType;
    model: string;
    abstained: boolean;
  }>;
}

/**
 * Deterministic pseudo-embedding generator for testing and offline development.
 * Produces a normalized 1536-dimensional vector based on text token frequencies.
 */
function createDeterministicMockEmbedding(text: string, dim = 1536): number[] {
  const vec = new Array(dim).fill(0);
  const clean = text.toLowerCase().trim();
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    const pos = (code * 31 + i) % dim;
    vec[pos] += 1;
  }
  // Normalize vector
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => Number((v / norm).toFixed(6)));
}

export class DefaultLlmProvider implements LlmProvider {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (this.apiKey && process.env.OPENAI_API_KEY) {
      try {
        const response = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            input: text.slice(0, 8000),
            model: "text-embedding-3-small",
          }),
        });

        if (response.ok) {
          const json = (await response.json()) as any;
          return json.data[0].embedding;
        }
      } catch (err) {
        console.warn("[LlmProvider] External embedding call failed, falling back to mock:", err);
      }
    }

    return createDeterministicMockEmbedding(text, 1536);
  }

  async generateAnswer(
    query: string,
    contextPassages: { title: string; version: string; text: string }[],
    _history?: AiChatMessage[]
  ): Promise<{
    answer: string;
    outputType: AiOutputType;
    model: string;
    abstained: boolean;
  }> {
    // If no context passages were matched with sufficient similarity
    if (!contextPassages || contextPassages.length === 0) {
      return {
        answer:
          "Based on current authorized project records and SOPs, no verified information was found to answer your inquiry. Per company governance policy (FR-AI-003), this request has been flagged for human clarification.",
        outputType: "recommendation",
        model: "sevents-grounding-engine",
        abstained: true,
      };
    }

    const contextSummary = contextPassages
      .map(
        (p, idx) =>
          `[Source ${idx + 1}: ${p.title} (${p.version})]\n${p.text}`
      )
      .join("\n\n");

    // If live API key is present
    if (this.apiKey && process.env.OPENAI_API_KEY) {
      try {
        const systemPrompt =
          "You are the SEVENTS Construction OS AI Knowledge Assistant. You answer questions strictly grounded in the provided company records and project documents.\n" +
          "Rules:\n" +
          "1. Answer ONLY using the facts from the provided sources.\n" +
          "2. Cite each source explicitly with [Document Title (Version)].\n" +
          "3. If the context does not contain enough evidence, state that evidence is insufficient and abstain from guessing.\n" +
          "4. Maintain a professional, technical construction engineering tone.";

        const userPrompt = `Context:\n${contextSummary}\n\nQuestion: ${query}`;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.2,
          }),
        });

        if (response.ok) {
          const json = (await response.json()) as any;
          const text = json.choices?.[0]?.message?.content || "";
          return {
            answer: text,
            outputType: query.toLowerCase().includes("draft") ? "draft" : "summary",
            model: "gpt-4o-mini",
            abstained: false,
          };
        }
      } catch (err) {
        console.warn("[LlmProvider] External chat completion failed, falling back to grounded builder:", err);
      }
    }

    // Default High-Fidelity Grounded Generator (Offline/Local)
    const primarySource = contextPassages[0]!;
    const citationsList = contextPassages
      .map((p) => `• ${p.title} (${p.version})`)
      .join("\n");

    const answer =
      `Based on approved project records, regarding **"${query}"**:\n\n` +
      `According to **${primarySource.title}** (${primarySource.version}):\n` +
      `> "${primarySource.text.slice(0, 320)}..."\n\n` +
      `Verified Grounding Sources:\n${citationsList}\n\n` +
      `*Note: As per SEVENTS AI Governance (FR-AI-004), this response is provided as a structured informational summary and does not constitute a legally approved contract instruction.*`;

    return {
      answer,
      outputType: query.toLowerCase().includes("draft") ? "draft" : "summary",
      model: "sevents-grounded-rag-v1",
      abstained: false,
    };
  }
}
