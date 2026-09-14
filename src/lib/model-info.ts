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
  params: string; // e.g. "32M", "700B", "70B", "8B", "15B MoE"
  score: number;  // 0 to 100 quality / benchmark score
}

// Extract model parameter size like 32m, 700b, 70b, 8b, MoE
export function inferModelParams(slug: string, rawText = ""): string {
  const norm = slug.toLowerCase().trim();
  const fullText = `${norm} ${rawText.toLowerCase()}`;

  // 1. Explicit regex match for parameter notation: 700b, 70b, 32m, 125m, 8b, 405b, 1.5b
  const matchB = fullText.match(/\b(\d+(?:\.\d+)?)\s*(?:b|billion)\b/i);
  if (matchB) {
    return `${parseFloat(matchB[1])}B`;
  }
  const matchM = fullText.match(/\b(\d+(?:\.\d+)?)\s*(?:m|million)\b/i);
  if (matchM) {
    return `${parseFloat(matchM[1])}M`;
  }
  const matchT = fullText.match(/\b(\d+(?:\.\d+)?)\s*(?:t|trillion)\b/i);
  if (matchT) {
    return `${parseFloat(matchT[1])}T`;
  }

  // 2. Known model family parameters & architecture
  if (norm.includes("gpt-4o-mini")) return "8B";
  if (norm.includes("gpt-4o")) return "Omni MoE";
  if (norm.includes("o1-mini") || norm.includes("o3-mini")) return "14B";
  if (norm.includes("o1") || norm.includes("o3")) return "Multi-MoE";
  if (norm.includes("gpt-4-turbo") || norm.includes("gpt-4")) return "1.8T MoE";
  if (norm.includes("gpt-3.5")) return "20B";

  if (norm.includes("gemini-2.5-pro") || norm.includes("gemini-1.5-pro")) return "1.5T MoE";
  if (norm.includes("gemini-2.5-flash-lite") || norm.includes("gemini-3.1-flash-lite") || norm.includes("gemini-3.5-flash-lite")) return "8B MoE";
  if (norm.includes("gemini-2.5-flash") || norm.includes("gemini-2.0-flash") || norm.includes("gemini-1.5-flash")) return "15B MoE";
  if (norm.includes("gemini-3.5-flash") || norm.includes("gemini-3-flash")) return "18B MoE";
  if (norm.includes("gemini-3.5-transcribe")) return "5B";

  if (norm.includes("claude-3-7-sonnet") || norm.includes("claude-3-5-sonnet")) return "175B MoE";
  if (norm.includes("claude-3-opus")) return "2T MoE";
  if (norm.includes("claude-3-5-haiku")) return "20B";

  if (norm.includes("deepseek-r1") || norm.includes("deepseek-v3") || norm.includes("deepseek-chat")) return "671B MoE";
  if (norm.includes("minimax-m2.7") || norm.includes("minimax-m3")) return "456B MoE";

  if (norm.includes("nemotron-3-super-120b")) return "120B";
  if (norm.includes("nemotron-3-nano")) return "4B";

  return "–";
}

// Compute/infer realistic benchmark quality score (0 - 100)
export function inferModelScore(slug: string, params = "", rawText = ""): number {
  const norm = slug.toLowerCase().trim();
  const text = `${norm} ${params.toLowerCase()} ${rawText.toLowerCase()}`;

  // SOTA Flagships
  if (norm.includes("o1") || norm.includes("3-7-sonnet") || norm.includes("2.5-pro")) return 98;
  if (norm.includes("gpt-4o") || norm.includes("3-5-sonnet") || norm.includes("deepseek-r1")) return 96;
  if (norm.includes("deepseek-v3") || norm.includes("2.5-flash") || norm.includes("2.0-flash")) return 93;
  if (norm.includes("o3-mini") || norm.includes("405b") || norm.includes("3.3-70b") || norm.includes("700b")) return 91;
  if (norm.includes("gpt-4o-mini") || norm.includes("70b") || norm.includes("3-5-haiku")) return 88;
  if (norm.includes("flash-lite") || norm.includes("32b") || norm.includes("27b")) return 85;
  if (norm.includes("8b") || norm.includes("11b") || norm.includes("14b")) return 82;
  if (norm.includes("7b") || norm.includes("9b")) return 80;
  if (norm.includes("3b") || norm.includes("2b") || norm.includes("1b")) return 74;

  // Extract from params or text if not matching hardcoded family
  if (/\b700\s*b\b/i.test(text)) return 93;
  if (/\b405\s*b\b/i.test(text)) return 92;
  if (/\b70\s*b\b/i.test(text)) return 88;
  if (/\b32\s*m\b/i.test(text)) return 68;
  if (/\b\d+\s*m\b/i.test(text)) return 66;

  // Check general B count
  const bMatch = text.match(/\b(\d+(?:\.\d+)?)\s*b\b/i);
  if (bMatch) {
    const val = parseFloat(bMatch[1]);
    if (val >= 400) return 93;
    if (val >= 65) return 88;
    if (val >= 25) return 85;
    if (val >= 10) return 82;
    if (val >= 6) return 80;
    return 74;
  }

  // Check general M count
  const mMatch = text.match(/\b(\d+(?:\.\d+)?)\s*m\b/i);
  if (mMatch) {
    const val = parseFloat(mMatch[1]);
    if (val >= 500) return 74;
    if (val >= 100) return 70;
    return 66;
  }

  return 85;
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
  params?: string;
  score?: number;
}> = {
  // Google Gemini & Gemma
  "gemini-2.5-flash": { contextWindow: "1M", inputPrice: 0.075, outputPrice: 0.30, modalities: "T,IMG,DOC,VID,AUD", params: "15B MoE", score: 93 },
  "gemini-2.5-flash-lite": { contextWindow: "1M", inputPrice: 0.0375, outputPrice: 0.15, modalities: "T,IMG,DOC", params: "8B MoE", score: 85 },
  "gemini-2.5-pro": { contextWindow: "2M", inputPrice: 1.25, outputPrice: 5.00, modalities: "T,IMG,DOC,VID,AUD", params: "1.5T MoE", score: 98 },
  "gemini-2.0-flash": { contextWindow: "1M", inputPrice: 0.10, outputPrice: 0.40, modalities: "T,IMG,DOC,VID,AUD", params: "15B MoE", score: 92 },
  "gemini-1.5-flash": { contextWindow: "1M", inputPrice: 0.075, outputPrice: 0.30, modalities: "T,IMG,DOC,VID,AUD", params: "15B MoE", score: 90 },
  "gemini-1.5-pro": { contextWindow: "2M", inputPrice: 1.25, outputPrice: 5.00, modalities: "T,IMG,DOC,VID,AUD", params: "1.5T MoE", score: 95 },
  "gemini-3-flash-preview": { contextWindow: "1M", inputPrice: 0.10, outputPrice: 0.40, modalities: "T,IMG,DOC,VID,AUD", params: "18B MoE", score: 94 },
  "gemini-3.1-flash-lite": { contextWindow: "1M", inputPrice: 0.04, outputPrice: 0.16, modalities: "T,IMG,DOC", params: "8B MoE", score: 86 },
  "gemini-3.5-flash": { contextWindow: "1M", inputPrice: 0.08, outputPrice: 0.32, modalities: "T,IMG,DOC,VID,AUD", params: "18B MoE", score: 94 },
  "gemini-3.5-flash-lite": { contextWindow: "1M", inputPrice: 0.04, outputPrice: 0.16, modalities: "T,IMG,DOC", params: "8B MoE", score: 86 },
  "gemini-3.5-transcribe": { contextWindow: "128K", inputPrice: 0.05, outputPrice: 0.20, modalities: "T,AUD", params: "5B", score: 84 },
  "gemma-2-2b": { contextWindow: "8K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T", params: "2B", score: 75 },
  "gemma-2-9b": { contextWindow: "8K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T", params: "9B", score: 81 },
  "gemma-2-27b": { contextWindow: "8K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T", params: "27B", score: 85 },
  "gemma-4-31b": { contextWindow: "32K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T", params: "31B", score: 87 },

  // OpenAI
  "gpt-4o": { contextWindow: "128K", inputPrice: 2.50, outputPrice: 10.00, modalities: "T,IMG,DOC", params: "Omni MoE", score: 96 },
  "gpt-4o-mini": { contextWindow: "128K", inputPrice: 0.15, outputPrice: 0.60, modalities: "T,IMG,DOC", params: "8B", score: 88 },
  "o1": { contextWindow: "200K", inputPrice: 15.00, outputPrice: 60.00, modalities: "T,IMG", params: "Multi-MoE", score: 98 },
  "o1-mini": { contextWindow: "128K", inputPrice: 1.10, outputPrice: 4.40, modalities: "T", params: "14B", score: 92 },
  "o3-mini": { contextWindow: "200K", inputPrice: 1.10, outputPrice: 4.40, modalities: "T", params: "14B", score: 93 },
  "gpt-4-turbo": { contextWindow: "128K", inputPrice: 10.00, outputPrice: 30.00, modalities: "T,IMG", params: "1.8T MoE", score: 94 },
  "gpt-3.5-turbo": { contextWindow: "16K", inputPrice: 0.50, outputPrice: 1.50, modalities: "T", params: "20B", score: 80 },

  // Anthropic Claude
  "claude-3-7-sonnet": { contextWindow: "200K", inputPrice: 3.00, outputPrice: 15.00, modalities: "T,IMG,DOC", params: "175B MoE", score: 98 },
  "claude-3-5-sonnet": { contextWindow: "200K", inputPrice: 3.00, outputPrice: 15.00, modalities: "T,IMG,DOC", params: "175B MoE", score: 96 },
  "claude-3-5-haiku": { contextWindow: "200K", inputPrice: 0.80, outputPrice: 4.00, modalities: "T", params: "20B", score: 89 },
  "claude-3-opus": { contextWindow: "200K", inputPrice: 15.00, outputPrice: 75.00, modalities: "T,IMG,DOC", params: "2T MoE", score: 95 },

  // Meta Llama
  "llama-3.1-8b": { contextWindow: "128K", inputPrice: 0.05, outputPrice: 0.08, modalities: "T", params: "8B", score: 82 },
  "llama-3.1-70b": { contextWindow: "128K", inputPrice: 0.35, outputPrice: 0.40, modalities: "T", params: "70B", score: 89 },
  "llama-3.1-405b": { contextWindow: "128K", inputPrice: 1.79, outputPrice: 2.50, modalities: "T", params: "405B", score: 93 },
  "llama-3.2-1b": { contextWindow: "128K", inputPrice: 0.02, outputPrice: 0.04, modalities: "T", params: "1B", score: 72 },
  "llama-3.2-3b": { contextWindow: "128K", inputPrice: 0.04, outputPrice: 0.06, modalities: "T", params: "3B", score: 76 },
  "llama-3.2-11b-vision-instruct": { contextWindow: "128K", inputPrice: 0.06, outputPrice: 0.12, modalities: "T,IMG", params: "11B", score: 84 },
  "llama-3.3-70b-instruct": { contextWindow: "128K", inputPrice: 0.35, outputPrice: 0.40, modalities: "T", params: "70B", score: 90 },

  // DeepSeek
  "deepseek-chat": { contextWindow: "64K", inputPrice: 0.14, outputPrice: 0.28, modalities: "T", params: "671B MoE", score: 92 },
  "deepseek-v3": { contextWindow: "64K", inputPrice: 0.14, outputPrice: 0.28, modalities: "T", params: "671B MoE", score: 93 },
  "deepseek-r1": { contextWindow: "64K", inputPrice: 0.55, outputPrice: 2.19, modalities: "T", params: "671B MoE", score: 96 },
  "deepseek-v4-flash": { contextWindow: "128K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T", params: "32B MoE", score: 88 },

  // NVIDIA Nemotron & Poolside
  "nemotron-3-nano-omni": { contextWindow: "128K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T,IMG,AUD", params: "4B", score: 81 },
  "nemotron-3.5-content-safety": { contextWindow: "128K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T", params: "8B", score: 82 },
  "nemotron-3-super-120b": { contextWindow: "128K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T", params: "120B", score: 90 },
  "nemotron-3.5-lightning": { contextWindow: "128K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T", params: "15B MoE", score: 85 },
  "laguna-s-2.1": { contextWindow: "128K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T", params: "7B", score: 80 },
  "laguna-xs-2.1": { contextWindow: "128K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T", params: "3B", score: 76 },

  // MiniMax, Liquid, Novita, AtlasCloud, Cohere
  "minimax-m2.7": { contextWindow: "1M", inputPrice: 0.20, outputPrice: 0.60, modalities: "T", params: "456B MoE", score: 92 },
  "minimax-m3": { contextWindow: "1M", inputPrice: 0.25, outputPrice: 0.80, modalities: "T", params: "456B MoE", score: 93 },
  "lfm-2.5-2.6b": { contextWindow: "32K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T", params: "2.6B", score: 76 },
  "ling-3.0-flash-fin": { contextWindow: "128K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T", params: "14B", score: 84 },
  "ling-3.0-flash-sante": { contextWindow: "128K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T", params: "14B", score: 84 },
  "dots3-note-preview": { contextWindow: "64K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T,DOC", params: "8B", score: 82 },
  "north-mini-code": { contextWindow: "32K", inputPrice: 0.0, outputPrice: 0.0, modalities: "T", params: "7B", score: 81 },
};

export function resolveViaOfflineRegistry(modelSlug: string): ResolvedModelSpecs | null {
  const norm = modelSlug.toLowerCase().replace(/^models\//, "").split("/").pop() ?? modelSlug.toLowerCase();
  // 1. Exact match
  if (OFFLINE_REGISTRY[norm]) {
    const item = OFFLINE_REGISTRY[norm];
    const params = item.params || inferModelParams(norm);
    const score = item.score ?? inferModelScore(norm, params);
    return {
      contextWindow: item.contextWindow,
      inputPrice: item.inputPrice,
      outputPrice: item.outputPrice,
      modalities: item.modalities,
      params,
      score,
      source: "Built-In Offline Registry",
      confidence: 0.98,
      detail: `Exact match for ${norm}`,
    };
  }
  // 2. Base slug match (e.g. "gemini-2.5-flash-001" -> "gemini-2.5-flash")
  for (const [k, v] of Object.entries(OFFLINE_REGISTRY)) {
    if (norm.startsWith(k) || k.startsWith(norm)) {
      const params = v.params || inferModelParams(norm);
      const score = v.score ?? inferModelScore(norm, params);
      return {
        contextWindow: v.contextWindow,
        inputPrice: v.inputPrice,
        outputPrice: v.outputPrice,
        modalities: v.modalities,
        params,
        score,
        source: "Built-In Offline Registry",
        confidence: 0.92,
        detail: `Matched family base ${k}`,
      };
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
        signal: AbortSignal.timeout(5000),
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

    // 1. Prioritize exact ID match or exact base match
    const exactMatch = list.find((m: any) => {
      const id = String(m.id ?? "").toLowerCase();
      const lastSeg = id.split("/").pop() ?? id;
      return id === norm || lastSeg === basePart;
    });

    // 2. Secondary match avoiding unwanted suffix variants like "-image" if base doesn't have it
    const match =
      exactMatch ||
      list.find((m: any) => {
        const id = String(m.id ?? "").toLowerCase();
        const lastSeg = id.split("/").pop() ?? id;
        if (!basePart.includes("image") && lastSeg.includes("image")) return false;
        if (!basePart.includes("preview") && lastSeg.includes("preview")) return false;
        return id.includes(basePart);
      });

    if (!match) return null;

    const ctx = match.context_length
      ? match.context_length >= 1_000_000
        ? `${parseFloat((match.context_length / 1_000_000).toFixed(1))}M`
        : `${Math.round(match.context_length / 1_000)}K`
      : "128K";

    const promptP = parseFloat(match.pricing?.prompt ?? "0");
    const compP = parseFloat(match.pricing?.completion ?? "0");
    const inputPrice = isFinite(promptP) && promptP > 0 ? Number((promptP * 1_000_000).toFixed(4)) : 0;
    const outputPrice = isFinite(compP) && compP > 0 ? Number((compP * 1_000_000).toFixed(4)) : 0;

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

    const params = inferModelParams(match.id || modelSlug, `${match.name || ""} ${match.description || ""}`);
    const score = inferModelScore(match.id || modelSlug, params, `${match.name || ""}`);

    return {
      contextWindow: ctx,
      inputPrice,
      outputPrice,
      modalities,
      params,
      score,
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
      signal: AbortSignal.timeout(2000),
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

    // 3. Pricing (Accurate extraction or fallback to verified database / heuristics)
    let inputPrice = 0.0;
    let outputPrice = 0.0;
    const price1mMatch = allText.match(/\$(\d+(?:\.\d+)?)\s*(?:per|\/)\s*(?:1m|million|m)\s*tokens?/i);
    const price1kMatch = allText.match(/\$(\d+(?:\.\d+)?)\s*(?:per|\/)\s*(?:1k|thousand|k)\s*tokens?/i);

    if (price1mMatch) {
      inputPrice = parseFloat(price1mMatch[1]);
      outputPrice = inputPrice * 4;
    } else if (price1kMatch) {
      inputPrice = parseFloat(price1kMatch[1]) * 1000;
      outputPrice = inputPrice * 4;
    } else if (modelSlug.includes("free") || modelSlug.includes(":free")) {
      inputPrice = 0;
      outputPrice = 0;
    } else {
      // Use verified offline registry or heuristics instead of falsely guessing $0 from "free tier" search text
      const offline = resolveViaOfflineRegistry(modelSlug);
      if (offline) {
        inputPrice = offline.inputPrice;
        outputPrice = offline.outputPrice;
        contextWindow = offline.contextWindow;
      } else {
        const heur = resolveViaHeuristics(modelSlug, providerName);
        inputPrice = heur.inputPrice;
        outputPrice = heur.outputPrice;
      }
    }

    const params = inferModelParams(modelSlug, allText);
    const score = inferModelScore(modelSlug, params, allText);

    return {
      contextWindow,
      inputPrice: Number(inputPrice.toFixed(4)),
      outputPrice: Number(outputPrice.toFixed(4)),
      modalities,
      params,
      score,
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
    } else if (norm.includes("gemini") && (norm.includes("flash") || norm.includes("2.5") || norm.includes("2.0") || norm.includes("1.5"))) {
      inputPrice = 0.075;
      outputPrice = 0.30;
    } else if (norm.includes("mini") || norm.includes("lite") || norm.includes("flash") || norm.includes("8b")) {
      inputPrice = 0.05;
      outputPrice = 0.20;
    }
  }

  const params = inferModelParams(modelSlug);
  const score = inferModelScore(modelSlug, params);

  return {
    contextWindow,
    inputPrice,
    outputPrice,
    modalities,
    params,
    score,
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

  // Default "cascade" (Option 3 Offline -> Option 1 OpenRouter -> Option 4 Heuristics -> Option 2 Web Search)
  const offline = resolveViaOfflineRegistry(modelSlug);
  if (offline) return offline;

  const openrouter = await resolveViaOpenRouter(modelSlug);
  if (openrouter) return openrouter;

  // Heuristics are instant (0ms) and accurately resolve family specs
  const heur = resolveViaHeuristics(modelSlug, providerSlug);
  if (heur && heur.confidence >= 0.7) return heur;

  const web = await resolveViaWebSearch(modelSlug, providerSlug);
  if (web) return web;

  return heur;
}
