import type { AiAdapter, AiProviderConfig, AiProviderType } from "./types.js";
import { OpenAiAdapter } from "./openaiAdapter.js";
import { GeminiAdapter } from "./geminiAdapter.js";
import { AnthropicAdapter } from "./anthropicAdapter.js";
import { AzureOpenAiAdapter } from "./azureAdapter.js";
import { LocalAiAdapter } from "./localAdapter.js";

export * from "./types.js";
export * from "./openaiAdapter.js";
export * from "./geminiAdapter.js";
export * from "./anthropicAdapter.js";
export * from "./azureAdapter.js";
export * from "./localAdapter.js";

export interface ProviderMeta {
  id: AiProviderType;
  name: string;
  defaultModel: string;
  supportedModels: string[];
  isConfigured: boolean;
  requiresKey: boolean;
}

export function listSupportedProviders(): ProviderMeta[] {
  return [
    {
      id: "openai",
      name: "OpenAI",
      defaultModel: "gpt-4o-mini",
      supportedModels: ["gpt-4o-mini", "gpt-4o", "o1-mini", "text-embedding-3-small"],
      isConfigured: Boolean(process.env.OPENAI_API_KEY),
      requiresKey: true,
    },
    {
      id: "gemini",
      name: "Google Gemini",
      defaultModel: "gemini-1.5-flash",
      supportedModels: ["gemini-1.5-flash", "gemini-1.5-pro", "text-embedding-004"],
      isConfigured: Boolean(process.env.GEMINI_API_KEY),
      requiresKey: true,
    },
    {
      id: "anthropic",
      name: "Anthropic Claude",
      defaultModel: "claude-3-5-sonnet-20241022",
      supportedModels: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
      isConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
      requiresKey: true,
    },
    {
      id: "azure",
      name: "Azure OpenAI",
      defaultModel: "gpt-4o",
      supportedModels: ["gpt-4o", "gpt-4o-mini", "text-embedding-3-small"],
      isConfigured: Boolean(process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY),
      requiresKey: true,
    },
    {
      id: "local",
      name: "SEVENTS Local Engine",
      defaultModel: "sevents-local-v1",
      supportedModels: ["sevents-local-v1", "deterministic-1536"],
      isConfigured: true,
      requiresKey: false,
    },
  ];
}

let runtimeDefaultProvider: AiProviderType | null = null;

export function setRuntimeDefaultProvider(provider: AiProviderType): void {
  runtimeDefaultProvider = provider;
}

export function resolveDefaultProvider(): AiProviderType {
  if (runtimeDefaultProvider) {
    return runtimeDefaultProvider;
  }

  const envChoice = (process.env.AI_DEFAULT_PROVIDER || "").toLowerCase().trim() as AiProviderType;
  if (["openai", "gemini", "anthropic", "azure", "local"].includes(envChoice)) {
    return envChoice;
  }

  // Auto-detect based on configured credentials
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY) return "azure";

  return "local";
}

export function createAiAdapter(config?: Partial<AiProviderConfig>): AiAdapter {
  const providerType = config?.provider || resolveDefaultProvider();

  switch (providerType) {
    case "openai":
      return new OpenAiAdapter(config?.apiKey, config?.baseUrl);
    case "gemini":
      return new GeminiAdapter(config?.apiKey);
    case "anthropic":
      return new AnthropicAdapter(config?.apiKey);
    case "azure":
      return new AzureOpenAiAdapter(
        config?.azureEndpoint,
        config?.apiKey,
        config?.azureDeployment,
        config?.azureApiVersion
      );
    case "local":
    default:
      return new LocalAiAdapter();
  }
}
