// Curated Provider Registry: Groq, Experiential Labs, Google Gemini, NVIDIA NIM, Ollama Cloud, OpenRouter, KiosAPI, OrcaRouter, and APInex

export interface ProviderDef {
  slug: string;
  name: string;
  category: "apikey" | "freeTier" | "free" | "oauth" | "webCookie";
  icon: string;
  color?: string;
  baseUrl: string;
  chatPath: string;
  modelsPath?: string;
  apiKeyUrl?: string;
  website?: string;
  docUrl?: string;
  authType: "bearer" | "x-api-key" | "api-key" | "google" | "none" | "cookie";
  authHeader: (apiKey: string) => Record<string, string>;
  serviceKinds?: string[];
  thinkingConfig?: {
    type: "extended" | "effort";
    options: string[];
    defaultMode: string;
    defaultBudgetTokens?: number;
  } | null;
  providerSpecificFields?: {
    key: string;
    label: string;
    placeholder: string;
  }[];
}

function makeAuthHeader(authType: string): (apiKey: string) => Record<string, string> {
  switch (authType) {
    case "x-api-key":
      return (k) => ({ "x-api-key": k, "anthropic-version": "2023-06-01" });
    case "api-key":
      return (k) => ({ "api-key": k });
    case "google":
      return (k) => ({ Authorization: `Bearer ${k}`, "x-goog-api-key": k });
    case "none":
      return () => ({});
    case "cookie":
      return (k) => ({ Cookie: k, Authorization: `Bearer ${k}` });
    case "bearer":
    default:
      return (k) => ({ Authorization: `Bearer ${k}` });
  }
}

export const RAW_PROVIDERS_DATA = [
  {
    slug: "groq",
    name: "Groq",
    category: "apikey" as const,
    icon: "bolt",
    color: "#F55036",
    baseUrl: "https://api.groq.com/openai/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    apiKeyUrl: "https://console.groq.com/keys",
    website: "https://console.groq.com",
    docUrl: "https://console.groq.com/docs",
    authType: "bearer" as const,
    serviceKinds: ["llm"],
    thinkingConfig: null,
  },
  {
    slug: "experiential",
    name: "Experiential Labs",
    category: "apikey" as const,
    icon: "⏣",
    color: "#8B5CF6",
    baseUrl: "https://platform.experientiallabs.ai/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    website: "https://platform.experientiallabs.ai/",
    docUrl: "https://platform.experientiallabs.ai/docs",
    authType: "bearer" as const,
    serviceKinds: ["llm"],
    thinkingConfig: null,
  },
  {
    slug: "google",
    name: "Google Gemini",
    category: "apikey" as const,
    icon: "auto_awesome",
    color: "#4285F4",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    apiKeyUrl: "https://aistudio.google.com/app/apikey",
    website: "https://aistudio.google.com",
    docUrl: "https://ai.google.dev/docs",
    authType: "google" as const,
    serviceKinds: ["llm"],
    thinkingConfig: {
      type: "effort" as const,
      options: ["low", "medium", "high"],
      defaultMode: "high",
    },
  },
  {
    slug: "nvidia",
    name: "NVIDIA NIM",
    category: "freeTier" as const,
    icon: "developer_board",
    color: "#76B900",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    apiKeyUrl: "https://build.nvidia.com",
    website: "https://build.nvidia.com",
    docUrl: "https://docs.api.nvidia.com",
    authType: "bearer" as const,
    serviceKinds: ["llm"],
    thinkingConfig: null,
  },
  {
    slug: "ollama",
    name: "Ollama Cloud",
    category: "free" as const,
    icon: "terminal",
    color: "#111827",
    baseUrl: "http://localhost:11434/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    website: "https://ollama.com",
    docUrl: "https://github.com/ollama/ollama/blob/main/docs/openai.md",
    authType: "none" as const,
    serviceKinds: ["llm"],
    thinkingConfig: null,
  },
  {
    slug: "openrouter",
    name: "OpenRouter",
    category: "apikey" as const,
    icon: "alt_route",
    color: "#6366F1",
    baseUrl: "https://openrouter.ai/api/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    apiKeyUrl: "https://openrouter.ai/keys",
    website: "https://openrouter.ai",
    docUrl: "https://openrouter.ai/docs",
    authType: "bearer" as const,
    serviceKinds: ["llm"],
    thinkingConfig: null,
  },
  {
    slug: "kiosapi",
    name: "KiosAPI",
    category: "apikey" as const,
    icon: "api",
    color: "#3B82F6",
    baseUrl: "https://router.kiosapi.com/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    apiKeyUrl: "https://kiosapi.com",
    website: "https://kiosapi.com/",
    docUrl: "https://kiosapi.mintlify.app/api-base-url",
    authType: "bearer" as const,
    serviceKinds: ["llm"],
    thinkingConfig: null,
  },
  {
    slug: "orcarouter",
    name: "OrcaRouter",
    category: "apikey" as const,
    icon: "waves",
    color: "#0EA5E9",
    baseUrl: "https://api.orcarouter.ai/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    apiKeyUrl: "https://www.orcarouter.ai",
    website: "https://www.orcarouter.ai/",
    docUrl: "https://www.orcarouter.ai/docs",
    authType: "bearer" as const,
    serviceKinds: ["llm"],
    thinkingConfig: null,
  },
  {
    slug: "apinex",
    name: "APInex",
    category: "apikey" as const,
    icon: "hub",
    color: "#10B981",
    baseUrl: "https://api.apinex.bond/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    apiKeyUrl: "https://apinex.bond",
    website: "https://apinex.bond/",
    docUrl: "https://apinex.bond/docs",
    authType: "bearer" as const,
    serviceKinds: ["llm"],
    thinkingConfig: null,
  },
];

export const PROVIDERS: ProviderDef[] = RAW_PROVIDERS_DATA.map((p: any) => ({
  ...p,
  authHeader: makeAuthHeader(p.authType),
}));

export function getProvider(slug: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.slug === slug);
}

// Minimal format translation (OpenAI <-> Anthropic)
export function openAIToAnthropic(body: any) {
  const messages = (body.messages ?? []).map((m: any) => ({
    role: m.role === "system" ? "user" : m.role,
    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
  }));
  const system = (body.messages ?? []).find((m: any) => m.role === "system")?.content;
  return {
    model: body.model,
    max_tokens: body.max_tokens ?? 1024,
    system: typeof system === "string" ? system : undefined,
    messages: messages.filter((m: any) => m.role !== "system"),
    stream: body.stream ?? false,
  };
}

export function anthropicToOpenAIChunk(data: any, model: string) {
  const delta =
    data?.delta?.text ?? data?.content_block?.text ?? data?.message?.content?.[0]?.text ?? "";
  return {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta: { content: delta }, finish_reason: null }],
  };
}
