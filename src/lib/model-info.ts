// Comprehensive Model Info Resolution Engine
// Provides 4 Zero-Key options + optional AI Agent to resolve:
// - Context Window (e.g. '1M', '128K')
// - Input Price ($/1M tokens)
// - Output Price ($/1M tokens)
// - Modalities (T, IMG, DOC, VID, AUD)

export interface ResolvedModelSpecs {
  contextWindow: string;
  inputPrice: number;
  outputPrice: number;
  modalities: string;
  source: string;
  confidence: number; // 0 to 1
  detail?: string;
}

// -------------------------------------------------------------
// OPTION 3: Built-In Offline Model Spec Database (Verified, Instant)
// -------------------------------------------------------------
const OFFLINE_REGISTRY: Record<string, {
  displayName?: string;
  contextWindow: string;
  inputPrice: number;
  outputPrice: number;
  modalities: string;
}> = {
  // Google Gemini & Gemma
  "gemini-2.5-flash": { contextWindow: "1M", inputPrice: 0.075, outputPrice: 0.30, modalities: "T,IMG,DOC,VID,AUD" },
  "gemini-2.5-flash-lite": { contextWindow: "1M", inputPrice: 0.0375, outputPrice: 0.15, modalities: "T,IMG,DOC" },
  "gemini-2.5-pro": { contextWindow: "2M", inputPrice: 1.25, outputPrice: 5.00, modalities: "T,IMG,DOC,VID,AUD" },
  "gemini-2.0-flash": { contextWindow: "1M", inputPrice: 0.10, outputPrice: 0.40, modalities: "T,IMG,DOC,VID,AUD" },
  "gemini-1.5-flash": { contextWindow: "1M", inputPrice: 0.075, outputPrice: 0.30, modalities: "T,IMG,DOC,VID,AUD" },
  "gemini-1.5-pro": { contextWindow: "2M", inputPrice: 1.25, outputPrice: 5.00, modalities: "T,IMG,DOC,VID,AUD" },
  "gemini-3-flash-preview": { contextWindow: "1M", inputPrice: 0.10, outputPrice: 0.40, modalities: "T,IMG,DOC,VID,AUD" },
  "gemini-3.1-flash-lite": { contextWindow: "1M", inputPrice: 0.04, outputPrice: 0.16, modalities: "T,IMG,DOC" },
  "gemini-3.5-flash": { contextWindow: "1M", inputPrice: 0.08, outputPrice: 0.32, modalities: "T,IMG,DOC,VID,AUD" },
  "gemini-3.5-flash-lite": { contextWindow: "1M", inputPrice: 0.04, outputPrice: 0.16, modalities: "T,IMG,DOC" },
  "gemini-3.5-transcribe": { contextWindow: "128K", inputPrice: 0.05, outputPrice: 0.20, modalities: "T,AUD" },
  "gemma-2-2b": { contextWindow: "8K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T" },
  "gemma-2-9b": { contextWindow: "8K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T" },
  "gemma-2-27b": { contextWindow: "8K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T" },
  "gemma-4-31b": { contextWindow: "32K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T" },

  // OpenAI
  "gpt-4o": { contextWindow: "128K", inputPrice: 2.50, outputPrice: 10.00, modalities: "T,IMG,DOC" },
  "gpt-4o-mini": { contextWindow: "128K", inputPrice: 0.15, outputPrice: 0.60, modalities: "T,IMG,DOC" },
  "o1": { contextWindow: "200K", inputPrice: 15.00, outputPrice: 60.00, modalities: "T,IMG" },
  "o1-mini": { contextWindow: "128K", inputPrice: 1.10, outputPrice: 4.40, modalities: "T" },
  "o3-mini": { contextWindow: "200K", inputPrice: 1.10, outputPrice: 4.40, modalities: "T" },
  "gpt-4-turbo": { contextWindow: "128K", inputPrice: 10.00, outputPrice: 30.00, modalities: "T,IMG" },
  "gpt-3.5-turbo": { contextWindow: "16K", inputPrice: 0.50, outputPrice: 1.50, modalities: "T" },

  // Anthropic Claude
  "claude-3-7-sonnet": { contextWindow: "200K", inputPrice: 3.00, outputPrice: 15.00, modalities: "T,IMG,DOC" },
  "claude-3-5-sonnet": { contextWindow: "200K", inputPrice: 3.00, outputPrice: 15.00, modalities: "T,IMG,DOC" },
  "claude-3-5-haiku": { contextWindow: "200K", inputPrice: 0.80, outputPrice: 4.00, modalities: "T" },
  "claude-3-opus": { contextWindow: "200K", inputPrice: 15.00, outputPrice: 75.00, modalities: "T,IMG,DOC" },

  // Meta Llama
  "llama-3.1-8b": { contextWindow: "128K", inputPrice: 0.05, outputPrice: 0.08, modalities: "T" },
  "llama-3.1-70b": { contextWindow: "128K", inputPrice: 0.35, outputPrice: 0.40, modalities: "T" },
  "llama-3.1-405b": { contextWindow: "128K", inputPrice: 1.79, outputPrice: 2.50, modalities: "T" },
  "llama-3.2-1b": { contextWindow: "128K", inputPrice: 0.02, outputPrice: 0.04, modalities: "T" },
  "llama-3.2-3b": { contextWindow: "128K", inputPrice: 0.04, outputPrice: 0.06, modalities: "T" },
  "llama-3.2-11b-vision-instruct": { contextWindow: "128K", inputPrice: 0.06, outputPrice: 0.12, modalities: "T,IMG" },
  "llama-3.3-70b-instruct": { contextWindow: "128K", inputPrice: 0.35, outputPrice: 0.40, modalities: "T" },

  // DeepSeek
  "deepseek-chat": { contextWindow: "64K", inputPrice: 0.14, outputPrice: 0.28, modalities: "T" },
  "deepseek-v3": { contextWindow: "64K", inputPrice: 0.14, outputPrice: 0.28, modalities: "T" },
  "deepseek-r1": { contextWindow: "64K", inputPrice: 0.55, outputPrice: 2.19, modalities: "T" },
  "deepseek-v4-flash": { contextWindow: "128K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T" },

  // NVIDIA Nemotron & Poolside
  "nemotron-3-nano-omni": { contextWindow: "128K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T,IMG,AUD" },
  "nemotron-3.5-content-safety": { contextWindow: "128K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T" },
  "nemotron-3-super-120b": { contextWindow: "128K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T" },
  "nemotron-3.5-lightning": { contextWindow: "128K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T" },
  "laguna-s-2.1": { contextWindow: "128K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T" },
  "laguna-xs-2.1": { contextWindow: "128K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T" },

  // MiniMax, Liquid, Novita, AtlasCloud, Cohere
  "minimax-m2.7": { contextWindow: "1M", inputPrice: 0.20, outputPrice: 0.60, modalities: "T" },
  "minimax-m3": { contextWindow: "1M", inputPrice: 0.25, outputPrice: 0.80, modalities: "T" },
  "lfm-2.5-2.6b": { contextWindow: "32K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T" },
  "ling-3.0-flash-fin": { contextWindow: "128K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T" },
  "ling-3.0-flash-sante": { contextWindow: "128K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T" },
  "dots3-note-preview": { contextWindow: "64K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T,DOC" },
  "north-mini-code": { contextWindow: "32K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T" },
};

export function resolveViaOfflineRegistry(modelSlug: string): ResolvedModelSpecs | null {
  const norm = modelSlug.toLowerCase().replace(/^models\//, "").split("/").pop() ?? modelSlug.toLowerCase();
  // 1. Exact match
  if (OFFLINE_REGISTRY[norm]) {
    const item = OFFLINE_REGISTRY[norm];
    return { ...item, source: "Built-In Offline Registry", confidence: 0.98, detail: `Exact match for ${norm}` };
  }
  // 2. Base slug match (e.g. "gemini-2.5-flash-001" -> "gemini-2.5-flash")
  for (const [k, v] of Object.entries(OFFLINE_REGISTRY)) {
    if (norm.startsWith(k) || k.startsWith(norm)) {
      return { ...v, source: "Built-In Offline Registry", confidence: 0.92, detail: `Matched family base ${k}` };
    }
  }
  return null;
}

// -------------------------------------------------------------
// OPTION 1: Live OpenRouter Public Catalog (100% Free, Zero Key)
// -------------------------------------------------------------
let orCache: { at: number; data: any[] } | null = null;
const OR_TTL = 6 * 3600_000;

export async function resolveViaOpenRouter(modelSlug: string): Promise<ResolvedModelSpecs | null> {
  try {
    let list = orCache?.data ?? [];
    if (!orCache || Date.now() - orCache.at > OR_TTL) {
      const r = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { "User-Agent": "freeroute/1.0" },
        next: { revalidate: 3600 },
      });
      if (r.ok) {
        const json = await r.json().catch(() => ({}));
        list = Array.isArray(json?.data) ? json.data : [];
        orCache = { at: Date.now(), data: list };
      }
    }
    if (list.length === 0) return null;

    const norm = modelSlug.toLowerCase().replace(/^models\//, "");
    const basePart = norm.split("/").pop() ?? norm;

    const match = list.find((m: any) => {
      const id = String(m.id ?? "").toLowerCase();
      return id === norm || id.endsWith("/" + basePart) || id.includes(basePart);
    });

    if (!match) return null;

    const ctx = match.context_length
      ? match.context_length >= 1_000_000
        ? `${parseFloat((match.context_length / 1_000_000).toFixed(1))}M`
        : `${Math.round(match.context_length / 1_000)}K`
      : "128K";

    const promptP = parseFloat(match.pricing?.prompt ?? "0");
    const compP = parseFloat(match.pricing?.completion ?? "0");
    const inputPrice = isFinite(promptP) && promptP > 0 ? Math.round(promptP * 1_000_000 * 100) / 100 : 0;
    const outputPrice = isFinite(compP) && compP > 0 ? Math.round(compP * 1_000_000 * 100) / 100 : 0;

    const modSet = new Set<string>();
    const arch = match.architecture ?? {};
    const modString = `${arch.modality ?? ""} ${(arch.input_modalities ?? []).join(" ")} ${(arch.output_modalities ?? []).join(" ")}`.toLowerCase();
    if (modString.includes("image") || modString.includes("vision")) modSet.add("IMG");
    if (modString.includes("audio") || modString.includes("voice")) modSet.add("AUD");
    if (modString.includes("video")) modSet.add("VID");
    if (modString.includes("doc") || modString.includes("pdf")) modSet.add("DOC");
    modSet.add("T");
    const order = ["T", "IMG", "DOC", "VID", "AUD"];
    const modalities = [...modSet].sort((a, b) => order.indexOf(a) - order.indexOf(b)).join(",");

    return {
      contextWindow: ctx,
      inputPrice,
      outputPrice,
      modalities,
      source: "Live OpenRouter Catalog",
      confidence: 0.95,
      detail: `Catalog ID: ${match.id}`,
    };
  } catch (e: any) {
    return null;
  }
}

// -------------------------------------------------------------
// OPTION 2: DuckDuckGo Zero-Key Web Search Engine
// -------------------------------------------------------------
export async function resolveViaWebSearch(modelSlug: string, providerName = ""): Promise<ResolvedModelSpecs | null> {
  try {
    const cleanSlug = modelSlug.replace(/^models\//, "").replace(/[-_]/g, " ");
    const query = `${providerName} ${cleanSlug} context window pricing tokens`;
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!r.ok) return null;
    const html = await r.text();

    // Extract snippets
    const snippetMatches = html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi);
    let allText = "";
    for (const m of snippetMatches) {
      allText += " " + m[1].replace(/<[^>]+>/g, " ");
    }
    if (!allText.trim()) {
      allText = html.slice(0, 30000).replace(/<[^>]+>/g, " ");
    }

    // Heuristics on search snippets:
    // 1. Context window
    let contextWindow = "128K";
    if (/2[\s,-]?million|2[\s,-]?m\s*tokens/i.test(allText)) {
      contextWindow = "2M";
    } else if (/1[\s,-]?million|1[\s,-]?m\s*tokens|1,048,576\s*tokens/i.test(allText)) {
      contextWindow = "1M";
    } else if (/200k|200,000\s*tokens/i.test(allText)) {
      contextWindow = "200K";
    } else if (/128k|128,000\s*tokens/i.test(allText)) {
      contextWindow = "128K";
    } else if (/32k|32,000\s*tokens/i.test(allText)) {
      contextWindow = "32K";
    }

    // 2. Modalities
    const modSet = new Set<string>(["T"]);
    if (/image|vision|multimodal|visual|photo|picture/i.test(allText)) modSet.add("IMG");
    if (/audio|voice|speech|transcribe|sound/i.test(allText)) modSet.add("AUD");
    if (/video/i.test(allText)) modSet.add("VID");
    if (/document|pdf|file/i.test(allText)) modSet.add("DOC");
    const modalities = Array.from(modSet).join(",");

    // 3. Pricing
    let inputPrice = 0.0;
    let outputPrice = 0.0;
    const priceMatch = allText.match(/\$(\d+(?:\.\d+)?)\s*(?:per|\/)\s*(?:1m|million|m)\s*tokens?/i);
    if (priceMatch) {
      inputPrice = parseFloat(priceMatch[1]);
      outputPrice = inputPrice * 4;
    } else if (/free\s*tier|free\s*model|no\s*charge|\$0/i.test(allText) || modelSlug.includes("free")) {
      inputPrice = 0;
      outputPrice = 0;
    } else {
      inputPrice = 0.15;
      outputPrice = 0.60;
    }

    return {
      contextWindow,
      inputPrice: Math.round(inputPrice * 100) / 100,
      outputPrice: Math.round(outputPrice * 100) / 100,
      modalities,
      source: "DuckDuckGo Web Search Engine",
      confidence: 0.85,
      detail: `Extracted from web search results (${allText.length} chars analyzed)`,
    };
  } catch (e: any) {
    return null;
  }
}

// -------------------------------------------------------------
// OPTION 4: Smart Slug & Family Heuristic Parser (Always Works)
// -------------------------------------------------------------
export function resolveViaHeuristics(modelSlug: string, providerSlug = ""): ResolvedModelSpecs {
  const norm = modelSlug.toLowerCase();

  // Context window deduction
  let contextWindow = "128K";
  if (norm.includes("2m")) contextWindow = "2M";
  else if (norm.includes("1m") || norm.includes("gemini") || norm.includes("minimax")) contextWindow = "1M";
  else if (norm.includes("200k") || norm.includes("claude") || norm.includes("o1") || norm.includes("o3")) contextWindow = "200K";
  else if (norm.includes("64k") || norm.includes("deepseek")) contextWindow = "64K";
  else if (norm.includes("32k") || norm.includes("gemma")) contextWindow = "32K";
  else if (norm.includes("16k") || norm.includes("gpt-3.5")) contextWindow = "16K";
  else if (norm.includes("8k") || norm.includes("gemma-2")) contextWindow = "8K";

  // Modalities deduction
  const modSet = new Set<string>(["T"]);
  if (norm.includes("vision") || norm.includes("vl") || norm.includes("image") || norm.includes("gemini") || norm.includes("4o")) {
    modSet.add("IMG");
  }
  if (norm.includes("audio") || norm.includes("voice") || norm.includes("transcribe") || norm.includes("omni")) {
    modSet.add("AUD");
  }
  if (norm.includes("video") || norm.includes("omni") || norm.includes("gemini")) {
    modSet.add("VID");
  }
  if (norm.includes("doc") || norm.includes("gemini") || norm.includes("claude") || norm.includes("note")) {
    modSet.add("DOC");
  }
  const order = ["T", "IMG", "DOC", "VID", "AUD"];
  const modalities = [...modSet].sort((a, b) => order.indexOf(a) - order.indexOf(b)).join(",");

  // Pricing deduction
  const isFree = norm.includes("free") || norm.includes("trial") || providerSlug === "poolside" || providerSlug === "nvidia";
  let inputPrice = isFree ? 0 : 0.15;
  let outputPrice = isFree ? 0 : 0.60;

  if (!isFree) {
    if (norm.includes("pro") || norm.includes("opus") || norm.includes("405b") || norm.includes("o1")) {
      inputPrice = 1.25;
      outputPrice = 5.00;
    } else if (norm.includes("mini") || norm.includes("lite") || norm.includes("flash") || norm.includes("8b")) {
      inputPrice = 0.05;
      outputPrice = 0.20;
    }
  }

  return {
    contextWindow,
    inputPrice,
    outputPrice,
    modalities,
    source: "Smart Heuristic & Family Parser",
    confidence: 0.75,
    detail: "Rule-based structural deduction",
  };
}

// -------------------------------------------------------------
// Unified Cascading Function
// -------------------------------------------------------------
export async function resolveModelSpecs(
  modelSlug: string,
  providerSlug = "",
  strategy = "cascade"
): Promise<ResolvedModelSpecs> {
  // If specific strategy requested:
  if (strategy === "openrouter" || strategy === "1") {
    const res = await resolveViaOpenRouter(modelSlug);
    if (res) return res;
  }
  if (strategy === "web_search" || strategy === "2") {
    const res = await resolveViaWebSearch(modelSlug, providerSlug);
    if (res) return res;
  }
  if (strategy === "offline_registry" || strategy === "3") {
    const res = resolveViaOfflineRegistry(modelSlug);
    if (res) return res;
  }
  if (strategy === "heuristics" || strategy === "4") {
    return resolveViaHeuristics(modelSlug, providerSlug);
  }

  // Default "cascade" (Option 3 -> Option 1 -> Option 2 -> Option 4)
  const offline = resolveViaOfflineRegistry(modelSlug);
  if (offline) return offline;

  const openrouter = await resolveViaOpenRouter(modelSlug);
  if (openrouter) return openrouter;

  const web = await resolveViaWebSearch(modelSlug, providerSlug);
  if (web) return web;

  return resolveViaHeuristics(modelSlug, providerSlug);
}
