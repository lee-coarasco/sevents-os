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
  isCustom?: boolean;
  baseUrl?: string;
}

export interface CustomProviderInput {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  defaultModel: string;
  supportedModels?: string[];
}

const customProvidersMap = new Map<string, ProviderMeta & { apiKey?: string; baseUrl: string }>();
const extraModelsMap = new Map<string, Set<string>>();

export function registerCustomProvider(input: CustomProviderInput): ProviderMeta {
  const cleanId = input.id.toLowerCase().trim().replace(/[^a-z0-9_-]/g, "");
  const models = Array.from(
    new Set([input.defaultModel, ...(input.supportedModels || [])].filter(Boolean))
  );

  const meta: ProviderMeta & { apiKey?: string; baseUrl: string } = {
    id: cleanId,
    name: input.name.trim(),
    baseUrl: input.baseUrl.trim(),
    apiKey: input.apiKey?.trim() || undefined,
    defaultModel: input.defaultModel.trim(),
    supportedModels: models,
    isConfigured: Boolean(input.apiKey?.trim() || input.baseUrl.includes("localhost") || input.baseUrl.includes("127.0.0.1")),
    requiresKey: !input.baseUrl.includes("localhost") && !input.baseUrl.includes("127.0.0.1"),
    isCustom: true,
  };

  customProvidersMap.set(cleanId, meta);
  return meta;
}

export function removeCustomProvider(id: string): boolean {
  const cleanId = id.toLowerCase().trim();
  return customProvidersMap.delete(cleanId);
}

export function addModelToProvider(providerId: string, modelName: string): ProviderMeta | null {
  const pId = providerId.toLowerCase().trim();
  const cleanModel = modelName.trim();
  if (!cleanModel) return null;

  if (customProvidersMap.has(pId)) {
    const existing = customProvidersMap.get(pId)!;
    if (!existing.supportedModels.includes(cleanModel)) {
      existing.supportedModels.push(cleanModel);
    }
    return existing;
  }

  // Built-in provider
  if (!extraModelsMap.has(pId)) {
    extraModelsMap.set(pId, new Set<string>());
  }
  extraModelsMap.get(pId)!.add(cleanModel);

  const all = listSupportedProviders();
  return all.find((p) => p.id === pId) || null;
}

export function listSupportedProviders(): ProviderMeta[] {
  const builtIn: ProviderMeta[] = [
    {
      id: "openai",
      name: "OpenAI",
      defaultModel: "gpt-4o-mini",
      supportedModels: ["gpt-4o-mini", "gpt-4o", "o1-mini", "text-embedding-3-small"],
      isConfigured: Boolean(process.env.OPENAI_API_KEY),
      requiresKey: true,
      isCustom: false,
    },
    {
      id: "gemini",
      name: "Google Gemini",
      defaultModel: "gemini-1.5-flash",
      supportedModels: ["gemini-1.5-flash", "gemini-1.5-pro", "text-embedding-004"],
      isConfigured: Boolean(process.env.GEMINI_API_KEY),
      requiresKey: true,
      isCustom: false,
    },
    {
      id: "anthropic",
      name: "Anthropic Claude",
      defaultModel: "claude-3-5-sonnet-20241022",
      supportedModels: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
      isConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
      requiresKey: true,
      isCustom: false,
    },
    {
      id: "azure",
      name: "Azure OpenAI",
      defaultModel: "gpt-4o",
      supportedModels: ["gpt-4o", "gpt-4o-mini", "text-embedding-3-small"],
      isConfigured: Boolean(process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY),
      requiresKey: true,
      isCustom: false,
    },
    {
      id: "openrouter",
      name: "OpenRouter (Free & Multi-LLM)",
      defaultModel: "openrouter/free",
      supportedModels: [
        "openrouter/free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "deepseek/deepseek-r1:free",
        "google/gemini-2.0-flash-exp:free",
        "mistralai/mistral-7b-instruct:free",
        "qwen/qwen-2.5-coder-32b-instruct:free",
      ],
      isConfigured: Boolean(process.env.OPENROUTER_API_KEY || (process.env.OPENAI_BASE_URL && process.env.OPENAI_BASE_URL.includes("openrouter"))),
      requiresKey: true,
      isCustom: false,
      baseUrl: "https://openrouter.ai/api/v1",
    },
    {
      id: "local",
      name: "SEVENTS Local Engine",
      defaultModel: "sevents-local-v1",
      supportedModels: ["sevents-local-v1", "deterministic-1536"],
      isConfigured: true,
      requiresKey: false,
      isCustom: false,
    },
  ];

  // Merge extra models for built-in providers
  for (const p of builtIn) {
    const extras = extraModelsMap.get(p.id);
    if (extras) {
      for (const m of extras) {
        if (!p.supportedModels.includes(m)) {
          p.supportedModels.push(m);
        }
      }
    }
  }

  // Merge custom providers (without exposing sensitive apiKey directly)
  const customs: ProviderMeta[] = Array.from(customProvidersMap.values()).map((c) => ({
    id: c.id,
    name: c.name,
    defaultModel: c.defaultModel,
    supportedModels: [...c.supportedModels],
    isConfigured: c.isConfigured,
    requiresKey: c.requiresKey,
    isCustom: true,
    baseUrl: c.baseUrl,
  }));

  return [...builtIn, ...customs];
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
  if (["openai", "gemini", "anthropic", "azure", "openrouter", "local"].includes(envChoice) || customProvidersMap.has(envChoice)) {
    return envChoice;
  }

  // Auto-detect based on configured credentials
  if (process.env.OPENROUTER_API_KEY || (process.env.OPENAI_BASE_URL && process.env.OPENAI_BASE_URL.includes("openrouter"))) return "openrouter";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY) return "azure";

  return "local";
}

export function createAiAdapter(config?: Partial<AiProviderConfig>): AiAdapter {
  const providerType = config?.provider || resolveDefaultProvider();

  // Check custom providers first
  if (customProvidersMap.has(providerType)) {
    const custom = customProvidersMap.get(providerType)!;
    return new OpenAiAdapter(config?.apiKey || custom.apiKey, config?.baseUrl || custom.baseUrl, custom.id);
  }

  switch (providerType) {
    case "openrouter":
      return new OpenAiAdapter(
        config?.apiKey || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
        config?.baseUrl || process.env.OPENROUTER_BASE_URL || process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1",
        "openrouter"
      );
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
