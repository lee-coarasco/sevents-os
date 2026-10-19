import { describe, expect, it } from "vitest";
import {
  createAiAdapter,
  listSupportedProviders,
  LocalAiAdapter,
  OpenAiAdapter,
  GeminiAdapter,
  AnthropicAdapter,
  AzureOpenAiAdapter,
} from "./adapters/index.js";

describe("AI Provider Adapter Architecture", () => {
  it("lists all 5 supported providers with models and config status", () => {
    const providers = listSupportedProviders();
    expect(providers.length).toBe(5);

    const ids = providers.map((p) => p.id);
    expect(ids).toContain("openai");
    expect(ids).toContain("gemini");
    expect(ids).toContain("anthropic");
    expect(ids).toContain("azure");
    expect(ids).toContain("local");

    const localMeta = providers.find((p) => p.id === "local");
    expect(localMeta?.isConfigured).toBe(true);
    expect(localMeta?.requiresKey).toBe(false);
  });

  it("instantiates LocalAiAdapter and generates 1536-dim embeddings", async () => {
    const adapter = createAiAdapter({ provider: "local" });
    expect(adapter).toBeInstanceOf(LocalAiAdapter);
    expect(adapter.provider).toBe("local");

    const embedding = await adapter.generateEmbedding("Reinforced concrete structural column");
    expect(embedding.length).toBe(1536);

    const health = await adapter.testConnection();
    expect(health.ok).toBe(true);
    expect(health.message).toContain("operational");
  });

  it("instantiates OpenAiAdapter with custom or env base url", () => {
    const adapter = createAiAdapter({
      provider: "openai",
      apiKey: "sk-mock-key",
      baseUrl: "https://custom-openai.proxy.com/v1",
    });
    expect(adapter).toBeInstanceOf(OpenAiAdapter);
    expect(adapter.provider).toBe("openai");
  });

  it("instantiates GeminiAdapter with model configuration", () => {
    const adapter = createAiAdapter({
      provider: "gemini",
      apiKey: "mock-gemini-key",
    });
    expect(adapter).toBeInstanceOf(GeminiAdapter);
    expect(adapter.provider).toBe("gemini");
  });

  it("instantiates AnthropicAdapter with Claude support", () => {
    const adapter = createAiAdapter({
      provider: "anthropic",
      apiKey: "mock-anthropic-key",
    });
    expect(adapter).toBeInstanceOf(AnthropicAdapter);
    expect(adapter.provider).toBe("anthropic");
  });

  it("instantiates AzureOpenAiAdapter with enterprise private endpoint", () => {
    const adapter = createAiAdapter({
      provider: "azure",
      azureEndpoint: "https://sevents-uae.openai.azure.com",
      apiKey: "mock-azure-key",
      azureDeployment: "gpt-4o-uae",
    });
    expect(adapter).toBeInstanceOf(AzureOpenAiAdapter);
    expect(adapter.provider).toBe("azure");
  });
});
