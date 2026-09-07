export type ComboStrategy =
  | "round-robin"
  | "weighted"
  | "failover"
  | "latency-based"
  | "cost-optimized";

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
}

export const VALID_COMBO_NAME_REGEX = /^[a-zA-Z0-9_.\-]+$/;

export const COMBO_STRATEGIES = [
  {
    value: "failover",
    label: "Fallback",
    sub: "Try in order on error",
    desc: "Tries Tier 1 first; automatically falls back to Tier 2, then Tier 3 on rate-limits (429), quota limits (403), or provider errors (5xx).",
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

const rrCursor = new Map<string, number>();

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
): ComboCandidate[] {
  const active = candidates.filter((c) => c.enabled);
  if (active.length === 0) return [];
  switch (strategy) {
    case "failover": {
      // Primary order: Priority 0 (Tier 1) -> Priority 1 (Tier 2) -> Priority 2 (Tier 3)
      return [...active].sort((a, b) => a.priority - b.priority);
    }
    case "round-robin": {
      const cur = rrCursor.get(comboId) ?? 0;
      const ordered = [...active].sort((a, b) => a.priority - b.priority);
      const rotated = [...ordered.slice(cur % ordered.length), ...ordered.slice(0, cur % ordered.length)];
      rrCursor.set(comboId, cur + 1);
      return rotated;
    }
    case "weighted": {
      const expanded = active.flatMap((c) => Array(Math.max(1, c.weight)).fill(c));
      const cur = rrCursor.get(comboId) ?? 0;
      const rotated = [...expanded.slice(cur % expanded.length), ...expanded.slice(0, cur % expanded.length)];
      rrCursor.set(comboId, cur + 1);
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
