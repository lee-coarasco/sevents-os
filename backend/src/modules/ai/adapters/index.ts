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
const configuredCredentialsMap = new Map<
  string,
  { apiKey?: string; baseUrl?: string; defaultModel?: string }
>();

export function configureProviderCredentials(
  providerId: string,
  creds: { apiKey?: string; baseUrl?: string; defaultModel?: string }
): ProviderMeta | null {
  const pId = providerId.toLowerCase().trim();
  const existing = configuredCredentialsMap.get(pId) || {};
  configuredCredentialsMap.set(pId, {
    apiKey: creds.apiKey !== undefined ? creds.apiKey.trim() : existing.apiKey,
    baseUrl: creds.baseUrl !== undefined ? creds.baseUrl.trim() : existing.baseUrl,
    defaultModel: creds.defaultModel !== undefined ? creds.defaultModel.trim() : existing.defaultModel,
  });

  if (customProvidersMap.has(pId)) {
    const custom = customProvidersMap.get(pId)!;
    if (creds.apiKey !== undefined) custom.apiKey = creds.apiKey.trim() || undefined;
    if (creds.baseUrl) custom.baseUrl = creds.baseUrl.trim();
    if (creds.defaultModel) custom.defaultModel = creds.defaultModel.trim();
    custom.isConfigured = Boolean(custom.apiKey || custom.baseUrl.includes("localhost") || custom.baseUrl.includes("127.0.0.1"));
    return custom;
  }

  const all = listSupportedProviders();
  return all.find((p) => p.id === pId) || null;
}

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
      defaultModel: configuredCredentialsMap.get("openai")?.defaultModel || "gpt-4o-mini",
      supportedModels: ["gpt-4o-mini", "gpt-4o", "o1-mini", "text-embedding-3-small"],
      isConfigured: Boolean(configuredCredentialsMap.get("openai")?.apiKey || process.env.OPENAI_API_KEY),
      requiresKey: true,
      isCustom: false,
      baseUrl: configuredCredentialsMap.get("openai")?.baseUrl || process.env.OPENAI_BASE_URL,
    },
    {
      id: "gemini",
      name: "Google Gemini",
      defaultModel: configuredCredentialsMap.get("gemini")?.defaultModel || "gemini-1.5-flash",
      supportedModels: ["gemini-1.5-flash", "gemini-1.5-pro", "text-embedding-004"],
      isConfigured: Boolean(configuredCredentialsMap.get("gemini")?.apiKey || process.env.GEMINI_API_KEY),
      requiresKey: true,
      isCustom: false,
      baseUrl: configuredCredentialsMap.get("gemini")?.baseUrl || process.env.GEMINI_BASE_URL,
    },
    {
      id: "anthropic",
      name: "Anthropic Claude",
      defaultModel: configuredCredentialsMap.get("anthropic")?.defaultModel || "claude-3-5-sonnet-20241022",
      supportedModels: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
      isConfigured: Boolean(configuredCredentialsMap.get("anthropic")?.apiKey || process.env.ANTHROPIC_API_KEY),
      requiresKey: true,
      isCustom: false,
      baseUrl: configuredCredentialsMap.get("anthropic")?.baseUrl || process.env.ANTHROPIC_BASE_URL,
    },
    {
      id: "azure",
      name: "Azure OpenAI",
      defaultModel: configuredCredentialsMap.get("azure")?.defaultModel || "gpt-4o",
      supportedModels: ["gpt-4o", "gpt-4o-mini", "text-embedding-3-small"],
      isConfigured: Boolean(
        (configuredCredentialsMap.get("azure")?.apiKey && configuredCredentialsMap.get("azure")?.baseUrl) ||
        (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY)
      ),
      requiresKey: true,
      isCustom: false,
      baseUrl: configuredCredentialsMap.get("azure")?.baseUrl || process.env.AZURE_OPENAI_ENDPOINT,
    },
    {
      id: "openrouter",
      name: "OpenRouter (Free & Multi-LLM)",
      defaultModel: configuredCredentialsMap.get("openrouter")?.defaultModel || "openrouter/free",
      supportedModels: [
        "openrouter/free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "deepseek/deepseek-r1:free",
        "google/gemini-2.0-flash-exp:free",
        "mistralai/mistral-7b-instruct:free",
        "qwen/qwen-2.5-coder-32b-instruct:free",
      ],
      isConfigured: Boolean(
        configuredCredentialsMap.get("openrouter")?.apiKey ||
        process.env.OPENROUTER_API_KEY ||
        (process.env.OPENAI_BASE_URL && process.env.OPENAI_BASE_URL.includes("openrouter"))
      ),
      requiresKey: true,
      isCustom: false,
      baseUrl: configuredCredentialsMap.get("openrouter")?.baseUrl || "https://openrouter.ai/api/v1",
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
  if (configuredCredentialsMap.get("openrouter")?.apiKey || process.env.OPENROUTER_API_KEY || (process.env.OPENAI_BASE_URL && process.env.OPENAI_BASE_URL.includes("openrouter"))) return "openrouter";
  if (configuredCredentialsMap.get("openai")?.apiKey || process.env.OPENAI_API_KEY) return "openai";
  if (configuredCredentialsMap.get("gemini")?.apiKey || process.env.GEMINI_API_KEY) return "gemini";
  if (configuredCredentialsMap.get("anthropic")?.apiKey || process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY) return "azure";

  return "local";
}

export function createAiAdapter(config?: Partial<AiProviderConfig>): AiAdapter {
  const providerType = config?.provider || resolveDefaultProvider();

  // Check custom providers first
  if (customProvidersMap.has(providerType)) {
    const custom = customProvidersMap.get(providerType)!;
    const cred = configuredCredentialsMap.get(providerType);
    return new OpenAiAdapter(config?.apiKey || cred?.apiKey || custom.apiKey, config?.baseUrl || cred?.baseUrl || custom.baseUrl, custom.id);
  }

  const cred = configuredCredentialsMap.get(providerType);
  const effectiveApiKey = config?.apiKey || cred?.apiKey;
  const effectiveBaseUrl = config?.baseUrl || cred?.baseUrl;

  switch (providerType) {
    case "openrouter":
      return new OpenAiAdapter(
        effectiveApiKey || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
        effectiveBaseUrl || process.env.OPENROUTER_BASE_URL || process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1",
        "openrouter"
      );
    case "openai":
      return new OpenAiAdapter(effectiveApiKey || process.env.OPENAI_API_KEY, effectiveBaseUrl || process.env.OPENAI_BASE_URL);
    case "gemini":
      return new GeminiAdapter(effectiveApiKey || process.env.GEMINI_API_KEY, effectiveBaseUrl || process.env.GEMINI_BASE_URL);
    case "anthropic":
      return new AnthropicAdapter(effectiveApiKey || process.env.ANTHROPIC_API_KEY, effectiveBaseUrl || process.env.ANTHROPIC_BASE_URL);
    case "azure":
      return new AzureOpenAiAdapter(
        effectiveBaseUrl || config?.azureEndpoint || process.env.AZURE_OPENAI_ENDPOINT || "https://example.openai.azure.com",
        effectiveApiKey || process.env.AZURE_OPENAI_API_KEY,
        config?.azureDeployment,
        config?.azureApiVersion
      );
    case "local":
    default:
      return new LocalAiAdapter();
  }
}
