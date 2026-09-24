export type ComboStrategy =
  | "round-robin"
  | "weighted"
  | "failover"
  | "latency-based"
  | "cost-optimized"
  | "lkgp";

/** Error categories that trigger different healing durations */
export type CooldownReason = "rpm" | "quota" | "auth" | "server" | "context" | "unknown";

export interface CooldownEntry {
  /** Unix timestamp when this model will be re-activated */
  until: number;
  /** Human-readable error classification */
  reason: CooldownReason;
  /** Short description from the upstream error */
  detail: string;
  /** When it was placed into cooldown */
  since: number;
}

export interface ComboCandidate {
  modelId: string;
  modelSlug: string;
  providerSlug: string;
  providerName?: string;
  weight: number;
  priority: number;
  latencyMs?: number | null;
  inputPrice?: number;
  outputPrice?: number;
  enabled: boolean;
  contextTokens?: number;
  contextWindow?: string;
}

export const VALID_COMBO_NAME_REGEX = /^[a-zA-Z0-9_.\-]+$/;

export const COMBO_STRATEGIES = [
  {
    value: "failover",
    label: "Fallback",
    sub: "Try in order on error",
    desc: "Tries Tier 1 first; automatically falls back to Tier 2, then Tier 3 on rate-limits (429), quota limits (403), context limits (400), or provider errors (5xx).",
  },
  {
    value: "lkgp",
    label: "Last Good (LKGP)",
    sub: "Stick until error",
    desc: "Sticks to the last-known-good healthy provider until an error occurs, then seamlessly moves to the next candidate.",
  },
  {
    value: "round-robin",
    label: "Round-Robin",
    sub: "Rotate across calls",
    desc: "Rotates starting target across calls to distribute traffic, with automatic fallback on failure.",
  },
  {
    value: "weighted",
    label: "Load Balance",
    sub: "Distribute by capacity",
    desc: "Distributes traffic across models according to configured capacity, with automatic fallback.",
  },
] as const;

/**
 * Parses human-readable context window strings like "1M", "256K", "64k", "32768" into integer tokens.
 */
export function parseContextTokens(str?: string | null): number {
  if (!str) return 128000;
  const s = String(str).trim().toUpperCase();
  if (s.endsWith("M")) {
    const val = parseFloat(s.slice(0, -1));
    return isNaN(val) ? 1000000 : Math.round(val * 1000000);
  }
  if (s.endsWith("K")) {
    const val = parseFloat(s.slice(0, -1));
    return isNaN(val) ? 128000 : Math.round(val * 1000);
  }
  const num = parseInt(s, 10);
  return isNaN(num) ? 128000 : num;
}

/**
 * Fast zero-dependency estimator for request input tokens from payload body.
 */
export function estimateBodyTokens(body: any): number {
  if (!body) return 0;
  try {
    let chars = 0;
    if (typeof body.system === "string") chars += body.system.length;
    else if (body.system) chars += JSON.stringify(body.system).length;

    if (body.tools) chars += JSON.stringify(body.tools).length;

    if (Array.isArray(body.messages)) {
      for (const m of body.messages) {
        if (typeof m?.content === "string") chars += m.content.length;
        else if (m?.content) chars += JSON.stringify(m.content).length;
      }
    } else if (typeof body.prompt === "string") {
      chars += body.prompt.length;
    }
    return Math.max(1, Math.ceil(chars / 4));
  } catch {
    return 0;
  }
}

// LKGP (Last-Known-Good-Provider) state cache
const lkgpCache = new Map<string, string>(); // comboId -> modelId

export function setLkgpTarget(comboId: string, modelId: string) {
  lkgpCache.set(comboId, modelId);
}

export function clearLkgpTarget(comboId: string) {
  lkgpCache.delete(comboId);
}

// ─── Circuit Breaker / Intelligent Healing Tracker ───────────────────────────
// Keys are modelId or providerSlug, values carry rich healing metadata.
const cooldownMap = new Map<string, CooldownEntry>();

/**
 * Classifies an upstream HTTP status + error text into a CooldownReason
 * and returns the appropriate healing duration in milliseconds.
 */
export function classifyErrorForHealing(
  status: number,
  errorText: string = "",
): { reason: CooldownReason; durationMs: number; detail: string } {
  const lower = (errorText || "").toLowerCase();

  // RPM / short-window rate limits — wait 60 s then retry
  if (
    status === 429 ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("resource exhausted") ||
    lower.includes("tpm") ||
    lower.includes("rpm")
  ) {
    // Try to parse retry-after from the error body
    const retryAfterMatch = lower.match(/retry.{0,10}after[^0-9]*(\d+)/);
    const retrySeconds = retryAfterMatch ? parseInt(retryAfterMatch[1], 10) : 60;
    const durationMs = Math.min(Math.max(retrySeconds, 30), 3600) * 1000;
    return { reason: "rpm", durationMs, detail: errorText.slice(0, 120) };
  }

  // Daily quota / billing exhausted — wait until midnight UTC (next day)
  if (
    status === 403 ||
    lower.includes("quota exceeded") ||
    lower.includes("daily limit") ||
    lower.includes("insufficient_quota") ||
    lower.includes("billing") ||
    lower.includes("credit balance") ||
    lower.includes("trial quota")
  ) {
    const now = new Date();
    const midnight = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    );
    const durationMs = Math.max(midnight.getTime() - Date.now(), 300_000); // at least 5 min
    return { reason: "quota", durationMs, detail: errorText.slice(0, 120) };
  }

  // Auth / key issues — longer wait (5 min) as key rotation is manual
  if (
    status === 401 ||
    lower.includes("invalid api key") ||
    lower.includes("unauthorized") ||
    lower.includes("no credentials")
  ) {
    return { reason: "auth", durationMs: 300_000, detail: errorText.slice(0, 120) };
  }

  // Context length — don't penalise the model long, just 30 s to allow smaller retry
  if (
    lower.includes("context length") ||
    lower.includes("prompt is too long") ||
    lower.includes("token limit") ||
    lower.includes("too many tokens")
  ) {
    return { reason: "context", durationMs: 30_000, detail: errorText.slice(0, 120) };
  }

  // Upstream server errors — short wait 30 s
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return { reason: "server", durationMs: 30_000, detail: errorText.slice(0, 120) };
  }

  return { reason: "unknown", durationMs: 60_000, detail: errorText.slice(0, 120) };
}

/** Place a target into intelligent healing cooldown based on error classification */
export function markTargetCooldown(
  targetKey: string,
  durationMsOrStatus: number = 60_000,
  errorText?: string,
) {
  // If called with an HTTP status code (< 1000), classify it properly
  if (durationMsOrStatus < 1000 && errorText !== undefined) {
    const { reason, durationMs, detail } = classifyErrorForHealing(durationMsOrStatus, errorText);
    cooldownMap.set(targetKey, { until: Date.now() + durationMs, reason, detail, since: Date.now() });
  } else {
    // Legacy call with explicit ms duration
    cooldownMap.set(targetKey, {
      until: Date.now() + durationMsOrStatus,
      reason: "unknown",
      detail: "",
      since: Date.now(),
    });
  }
}

/** Place a target into cooldown with explicit classification (preferred API) */
export function markTargetCooldownClassified(
  targetKey: string,
  status: number,
  errorText: string,
) {
  const { reason, durationMs, detail } = classifyErrorForHealing(status, errorText);
  cooldownMap.set(targetKey, { until: Date.now() + durationMs, reason, detail, since: Date.now() });
}

export function isTargetInCooldown(targetKey: string): boolean {
  const entry = cooldownMap.get(targetKey);
  if (!entry) return false;
  if (Date.now() > entry.until) {
    cooldownMap.delete(targetKey);
    return false;
  }
  return true;
}

/** Returns the full cooldown entry for a key (for UI display) */
export function getCooldownEntry(targetKey: string): CooldownEntry | null {
  const entry = cooldownMap.get(targetKey);
  if (!entry) return null;
  if (Date.now() > entry.until) {
    cooldownMap.delete(targetKey);
    return null;
  }
  return entry;
}

/** Manually clear a single target from cooldown (admin force-heal) */
export function clearTargetCooldown(targetKey: string) {
  cooldownMap.delete(targetKey);
}

/** Dumps all active (non-expired) cooldown entries for the health API */
export function getAllCooldownState(): Record<string, CooldownEntry & { key: string; remainingMs: number }> {
  const now = Date.now();
  const out: Record<string, CooldownEntry & { key: string; remainingMs: number }> = {};
  for (const [key, entry] of cooldownMap.entries()) {
    if (now > entry.until) {
      cooldownMap.delete(key);
      continue;
    }
    out[key] = { ...entry, key, remainingMs: entry.until - now };
  }
  return out;
}

const rrCursor = new Map<string, number>();

type CursorPersistListener = (comboId: string, cursor: number) => void;
let cursorListener: CursorPersistListener | null = null;

export function setComboCursorPersistListener(listener: CursorPersistListener | null) {
  cursorListener = listener;
}

export function updateComboCursorInMemory(comboId: string, val: number) {
  rrCursor.set(comboId, val);
}

export function getComboCursor(comboId: string): number {
  return rrCursor.get(comboId) ?? 0;
}

export function resetComboRotation(comboId?: string) {
  if (comboId) rrCursor.delete(comboId);
  else rrCursor.clear();
}

/**
 * 9Router-inspired fallback error classifier.
 * Determines whether an upstream error should trigger an automatic fallback
 * to the next candidate in the combo.
 */
export function checkFallbackError(status: number, errorText: string = ""): {
  shouldFallback: boolean;
  reason: string;
} {
  const lower = (errorText || "").toLowerCase();

  // Explicit rate-limit matches (429 or text)
  if (
    status === 429 ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("resource exhausted") ||
    lower.includes("tpm") ||
    lower.includes("rpm")
  ) {
    return { shouldFallback: true, reason: "Rate limit exceeded (429)" };
  }

  // Quota exhaustion / Billing limits (403 or text)
  if (
    status === 403 ||
    lower.includes("quota exceeded") ||
    lower.includes("insufficient_quota") ||
    lower.includes("billing") ||
    lower.includes("credit balance")
  ) {
    return { shouldFallback: true, reason: "Quota/billing limit reached (403)" };
  }

  // Context length limit matches (400 or text)
  if (
    lower.includes("context length") ||
    lower.includes("context_length") ||
    lower.includes("maximum context") ||
    lower.includes("prompt is too long") ||
    lower.includes("token limit") ||
    lower.includes("max_tokens") ||
    lower.includes("too many tokens")
  ) {
    return { shouldFallback: true, reason: "Context length limit exceeded (Prompt too large for model)" };
  }

  // Auth / Key issues on a specific provider (401 or invalid key)
  if (
    status === 401 ||
    lower.includes("invalid api key") ||
    lower.includes("unauthorized") ||
    lower.includes("no credentials")
  ) {
    return { shouldFallback: true, reason: "Authentication / Key error (401)" };
  }

  // Model not found on that specific provider (404)
  if (status === 404 || lower.includes("model not found") || lower.includes("does not exist")) {
    return { shouldFallback: true, reason: "Model not found on provider (404)" };
  }

  // Upstream server errors (500, 502, 503, 504, overloaded, timeout)
  if (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    lower.includes("overloaded") ||
    lower.includes("service unavailable") ||
    lower.includes("bad gateway") ||
    lower.includes("gateway timeout") ||
    lower.includes("internal server error") ||
    lower.includes("timeout") ||
    lower.includes("econnrefused") ||
    lower.includes("fetch failed")
  ) {
    return { shouldFallback: true, reason: `Upstream service error (${status || "5xx"})` };
  }

  // Client format errors (400) generally shouldn't fallback unless provider-specific
  if (status === 400 && (lower.includes("model is overloaded") || lower.includes("capacity"))) {
    return { shouldFallback: true, reason: "Provider capacity error (400)" };
  }

  return { shouldFallback: status >= 400, reason: `Upstream error HTTP ${status}` };
}

export function pickTargets(
  comboId: string,
  strategy: ComboStrategy,
  candidates: ComboCandidate[],
  estimatedPromptTokens?: number,
): ComboCandidate[] {
  let active = candidates.filter((c) => c.enabled);
  if (active.length === 0) return [];

  // Cooldown filter: prefer targets that are not currently rate-limited
  const nonCooled = active.filter((c) => !isTargetInCooldown(c.modelId) && !isTargetInCooldown(c.providerSlug));
  if (nonCooled.length > 0) {
    active = nonCooled;
  }

  // Context window check: if prompt tokens estimated, prioritize models capable of fitting the prompt
  if (estimatedPromptTokens && estimatedPromptTokens > 0) {
    const fits = active.filter((c) => (c.contextTokens ?? 128000) >= estimatedPromptTokens);
    const doesNotFit = active.filter((c) => (c.contextTokens ?? 128000) < estimatedPromptTokens);
    if (fits.length > 0 && doesNotFit.length > 0) {
      active = [...fits, ...doesNotFit];
    }
  }

  switch (strategy) {
    case "lkgp": {
      const lastGoodId = lkgpCache.get(comboId);
      const ordered = [...active].sort((a, b) => a.priority - b.priority);
      if (lastGoodId) {
        const foundIdx = ordered.findIndex((c) => c.modelId === lastGoodId);
        if (foundIdx > 0) {
          const [found] = ordered.splice(foundIdx, 1);
          ordered.unshift(found);
        }
      }
      return ordered;
    }
    case "failover": {
      // Primary order: Priority 0 (Tier 1) -> Priority 1 (Tier 2) -> Priority 2 (Tier 3)
      return [...active].sort((a, b) => a.priority - b.priority);
    }
    case "round-robin": {
      const cur = rrCursor.get(comboId) ?? 0;
      const ordered = [...active].sort((a, b) => a.priority - b.priority);
      const rotated = [...ordered.slice(cur % ordered.length), ...ordered.slice(0, cur % ordered.length)];
      const next = cur + 1;
      rrCursor.set(comboId, next);
      cursorListener?.(comboId, next);
      return rotated;
    }
    case "weighted": {
      const expanded = active.flatMap((c) => Array(Math.max(1, c.weight)).fill(c));
      const cur = rrCursor.get(comboId) ?? 0;
      const rotated = [...expanded.slice(cur % expanded.length), ...expanded.slice(0, cur % expanded.length)];
      const next = cur + 1;
      rrCursor.set(comboId, next);
      cursorListener?.(comboId, next);
      const seen = new Set<string>();
      const ordered: ComboCandidate[] = [];
      for (const c of rotated) {
        if (!seen.has(c.modelId)) {
          seen.add(c.modelId);
          ordered.push(c);
        }
      }
      return ordered;
    }
    case "latency-based": {
      return [...active].sort((a, b) => (a.latencyMs ?? 999999) - (b.latencyMs ?? 999999));
    }
    case "cost-optimized": {
      return [...active].sort(
        (a, b) => (a.inputPrice ?? 0) + (a.outputPrice ?? 0) - ((b.inputPrice ?? 0) + (b.outputPrice ?? 0)),
      );
    }
    default:
      return [...active].sort((a, b) => a.priority - b.priority);
  }
}
