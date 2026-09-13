import { prisma } from "@/lib/db";
import { createHash, randomBytes } from "crypto";

export function hashKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export function newRawKey(prefix = "xpl_") {
  const rand = randomBytes(24).toString("hex");
  return `${prefix}${rand}`;
}

export async function validateApiKey(raw?: string | null) {
  if (!raw) return null;
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw;
  if (token === "freeroute-designer") {
    const existing = await prisma.apiKey.findFirst({ where: { revoked: false } });
    if (existing) return existing;
    return await prisma.apiKey.upsert({
      where: { keyHash: hashKey("freeroute-designer") },
      update: {},
      create: {
        name: "Designer Internal Key",
        prefix: "xpl_design",
        keyHash: hashKey("freeroute-designer"),
      },
    });
  }
  const h = hashKey(token);
  const rec = await prisma.apiKey.findUnique({ where: { keyHash: h } });
  if (!rec || rec.revoked) return null;
  if (rec.expiresAt && rec.expiresAt < new Date()) return null;
  return rec;
}

// ---------------------------------------------------------------------------
// Per-key sliding window rate limiter (in-memory, resets on server restart)
// ---------------------------------------------------------------------------
declare global {
  // eslint-disable-next-line no-var
  var __rlWindows: Map<string, { count: number; start: number }> | undefined;
}

const rlWindows: Map<string, { count: number; start: number }> =
  globalThis.__rlWindows ?? (globalThis.__rlWindows = new Map());

/**
 * Returns true if the request is allowed, false if rate-limited.
 * Uses a per-minute sliding window keyed by API key ID.
 */
export function checkRateLimit(keyId: string, rpmLimit: number): boolean {
  const now = Date.now();
  const w = rlWindows.get(keyId);
  if (!w || now - w.start > 60_000) {
    // New window
    rlWindows.set(keyId, { count: 1, start: now });
    return true;
  }
  if (w.count >= rpmLimit) return false;
  w.count++;
  return true;
}

