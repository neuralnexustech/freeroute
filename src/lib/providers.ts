// Curated Provider Registry: Groq, Mistral AI, Together AI, Fireworks AI, DeepSeek, Cohere, Novita AI, BazaarLink, Google Gemini, NVIDIA NIM, Ollama Cloud, OpenRouter, KiosAPI, OrcaRouter, Kilo, HCNSec AI, Tokenin, Infron, UnoRouter, Z.AI/GLM, and Cloudflare Workers AI

export interface ProviderDef {
  slug: string;
  name: string;
  category: "apikey" | "freeTier" | "free" | "oauth" | "webCookie";
  icon: string;
  logoUrl?: string;
  color?: string;
  baseUrl: string;
  chatPath: string;
  modelsPath?: string;
  apiKeyUrl?: string;
  website?: string;
  docUrl?: string;
  authType: "bearer" | "x-api-key" | "api-key" | "google" | "none" | "cookie";
  authHeader: (apiKey: string) => Record<string, string>;
  /** Extra static headers always injected when proxying (e.g. spoofed User-Agent). */
  extraHeaders?: Record<string, string>;
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
      return (k): Record<string, string> => (k && k.trim() ? { Authorization: `Bearer ${k.trim()}` } : {});
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
    slug: "mistral",
    name: "Mistral AI",
    category: "apikey" as const,
    icon: "blur_on",
    logoUrl: "https://mistral.ai/images/heros/brand/logo-gray.png",
    color: "#FF7000",
    baseUrl: "https://api.mistral.ai/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    apiKeyUrl: "https://console.mistral.ai/api-keys",
    website: "https://mistral.ai",
    docUrl: "https://docs.mistral.ai",
    authType: "bearer" as const,
    serviceKinds: ["llm"],
    thinkingConfig: null,
  },
  {
    slug: "together",
    name: "Together AI",
    category: "freeTier" as const,
    icon: "group",
    logoUrl: "https://cdn.sanity.io/images/pv37i0yn/production/46d329cfd46294a5986218e94752d5d283cbe16c-343x44.svg",
    color: "#0F6FFF",
    baseUrl: "https://api.together.ai/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    apiKeyUrl: "https://api.together.ai/settings/api-keys",
    website: "https://together.ai",
    docUrl: "https://docs.together.ai",
    authType: "bearer" as const,
    serviceKinds: ["llm"],
    thinkingConfig: null,
  },
  {
    slug: "fireworks",
    name: "Fireworks AI",
    category: "freeTier" as const,
    icon: "local_fire_department",
    logoUrl: "https://cdn.prod.website-files.com/69654e88dce9154b5f1206dd/6998eccd487ac54f69b05526_8ecdc2d7ae296951570e8aa976208fe6_hp-hero_mobile.avif",
    color: "#9333EA",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    apiKeyUrl: "https://fireworks.ai/account/api-keys",
    website: "https://fireworks.ai",
    docUrl: "https://docs.fireworks.ai",
    authType: "bearer" as const,
    serviceKinds: ["llm"],
    thinkingConfig: null,
  },
  {
    slug: "deepseek",
    name: "DeepSeek",
    category: "freeTier" as const,
    icon: "search",
    logoUrl: "https://cdn.deepseek.com/images/deepseek-chat-open-graph-image.jpeg",
    color: "#1677FF",
    baseUrl: "https://api.deepseek.com",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    website: "https://deepseek.com",
    docUrl: "https://platform.deepseek.com/docs",
    authType: "bearer" as const,
    serviceKinds: ["llm"],
    thinkingConfig: null,
  },
  {
    slug: "cohere",
    name: "Cohere",
    category: "freeTier" as const,
    icon: "waves",
    logoUrl: "https://cohere.com/logo.svg",
    color: "#39594D",
    baseUrl: "https://api.cohere.ai/compatibility/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    apiKeyUrl: "https://dashboard.cohere.com/api-keys",
    website: "https://cohere.com",
    docUrl: "https://docs.cohere.com",
    authType: "bearer" as const,
    serviceKinds: ["llm"],
    thinkingConfig: null,
  },
  {
    slug: "novita",
    name: "Novita AI",
    category: "freeTier" as const,
    icon: "bolt",
    logoUrl: "https://novita.ai/logo/logo.svg",
    color: "#7C3AED",
    baseUrl: "https://api.novita.ai/v3/openai",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    apiKeyUrl: "https://novita.ai/settings/key-management",
    website: "https://novita.ai",
    docUrl: "https://novita.ai/docs",
    authType: "bearer" as const,
    serviceKinds: ["llm"],
    thinkingConfig: null,
  },
  {
    slug: "bazaarlink",
    name: "BazaarLink",
    category: "free" as const,
    icon: "link",
    logoUrl: "/providers/bazaarlink.png",
    color: "#059669",
    baseUrl: "https://api.bazaarlink.ai/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    apiKeyUrl: "https://bazaarlink.ai",
    website: "https://bazaarlink.ai",
    docUrl: "https://bazaarlink.ai",
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
    category: "freeTier" as const,
    icon: "terminal",
    color: "#111827",
    baseUrl: "https://ollama.com",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    apiKeyUrl: "https://ollama.com",
    website: "https://ollama.com",
    docUrl: "https://github.com/ollama/ollama/blob/main/docs/openai.md",
    authType: "bearer" as const,
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
    slug: "kilo",
    name: "Kilo",
    category: "apikey" as const,
    icon: "gateway",
    color: "#eab308",
    baseUrl: "https://api.kilo.ai/api/gateway",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    apiKeyUrl: "https://app.kilo.ai",
    website: "https://kilo.ai/",
    docUrl: "https://kilo.ai/docs/gateway",
    authType: "bearer" as const,
    serviceKinds: ["llm"],
    thinkingConfig: null,
  },
  {
    slug: "hcnsec",
    name: "HCNSec AI",
    category: "apikey" as const,
    icon: "security",
    logoUrl: "https://hcnote.cn/ailogo.png",
    color: "#10b981",
    baseUrl: "https://api.hcnsec.cn/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    apiKeyUrl: "https://api.hcnsec.cn",
    website: "https://api.hcnsec.cn",
    docUrl: "https://api.hcnsec.cn",
    authType: "bearer" as const,
    serviceKinds: ["llm"],
    thinkingConfig: null,
  },
  {
    slug: "tokenin",
    name: "Tokenin",
    category: "apikey" as const,
    icon: "token",
    color: "#8b5cf6",
    baseUrl: "https://tokenin.my.id/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    apiKeyUrl: "https://tokenin.my.id/login",
    website: "https://tokenin.my.id",
    docUrl: "https://tokenin.my.id",
    authType: "bearer" as const,
    serviceKinds: ["llm"],
    thinkingConfig: null,
  },
  {
    slug: "onerouter",
    name: "Infron",
    category: "apikey" as const,
    icon: "hub",
    logoUrl: "https://framerusercontent.com/images/Dg6E9JPblFr0Q5yq0ouso2uGeok.png?scale-down-to=512&width=1072&height=208",
    color: "#f97316",
    baseUrl: "https://llm.onerouter.pro/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    apiKeyUrl: "https://onerouter.pro",
    website: "https://onerouter.pro",
    docUrl: "https://onerouter.pro",
    authType: "bearer" as const,
    serviceKinds: ["llm"],
    thinkingConfig: null,
  },
  {
    slug: "unorouter",
    name: "UnoRouter",
    category: "apikey" as const,
    icon: "router",
    color: "#06B6D4",
    baseUrl: "https://api.unorouter.com/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    apiKeyUrl: "https://unorouter.com",
    website: "https://unorouter.com",
    docUrl: "https://unorouter.com",
    authType: "bearer" as const,
    serviceKinds: ["llm"],
    thinkingConfig: null,
  },

  {
    slug: "glm-cn",
    name: "Z.AI / GLM Free",
    category: "freeTier" as const,
    icon: "bolt",
    color: "#2563EB",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    apiKeyUrl: "https://bigmodel.cn",
    website: "https://bigmodel.cn",
    docUrl: "https://bigmodel.cn/dev/api",
    authType: "bearer" as const,
    serviceKinds: ["llm"],
    thinkingConfig: null,
  },
  {
    slug: "cloudflare-ai",
    name: "Cloudflare Workers AI",
    category: "freeTier" as const,
    icon: "cloud",
    color: "#F38020",
    baseUrl: "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    apiKeyUrl: "https://dash.cloudflare.com",
    website: "https://developers.cloudflare.com/workers-ai",
    docUrl: "https://developers.cloudflare.com/workers-ai/models",
    authType: "bearer" as const,
    serviceKinds: ["llm"],
    thinkingConfig: null,
    providerSpecificFields: [
      {
        key: "accountId",
        label: "Account ID",
        placeholder: "e.g. 0123456789abcdef0123456789abcdef",
      },
    ],
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
