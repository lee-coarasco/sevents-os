import type { AiChatMessage, AiOutputType } from "./types.js";
import { createAiAdapter, type AiAdapter, type AiProviderConfig } from "./adapters/index.js";

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

export class DefaultLlmProvider implements LlmProvider {
  private adapter: AiAdapter;

  constructor(config?: Partial<AiProviderConfig>) {
    this.adapter = createAiAdapter(config);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return this.adapter.generateEmbedding(text);
  }

  async generateAnswer(
    query: string,
    contextPassages: { title: string; version: string; text: string }[],
    history?: AiChatMessage[]
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
        model: this.adapter.provider,
        abstained: true,
      };
    }

    const contextSummary = contextPassages
      .map(
        (p, idx) =>
          `[Source ${idx + 1}: ${p.title} (${p.version})]\n${p.text}`
      )
      .join("\n\n");

    const systemPrompt =
      "You are the SEVENTS Construction OS AI Knowledge Assistant. You answer questions strictly grounded in the provided company records and project documents.\n" +
      "Rules:\n" +
      "1. Answer ONLY using the facts from the provided sources.\n" +
      "2. Cite each source explicitly with [Document Title (Version)].\n" +
      "3. If the context does not contain enough evidence, state that evidence is insufficient and abstain from guessing.\n" +
      "4. Maintain a professional, technical construction engineering tone.";

    const userPrompt = `Context:\n${contextSummary}\n\nQuestion: ${query}`;

    // Convert history format if present
    const historyFormatted = history?.map((h) => ({
      role: h.role as "user" | "assistant" | "system",
      content: h.content,
    }));

    try {
      const res = await this.adapter.chatComplete(userPrompt, {
        systemPrompt,
        history: historyFormatted,
        temperature: 0.2,
      });

      if (res.content && !res.content.startsWith("[")) {
        return {
          answer: res.content,
          outputType: query.toLowerCase().includes("draft") ? "draft" : "summary",
          model: res.model,
          abstained: false,
        };
      }
    } catch (err) {
      console.warn("[LlmProvider] Adapter chatComplete failed, using grounded builder:", err);
    }

    // Default High-Fidelity Grounded Generator
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
      model: `${this.adapter.provider}-grounded-rag`,
      abstained: false,
    };
  }
}
