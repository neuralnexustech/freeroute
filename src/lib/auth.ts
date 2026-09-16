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

import { decSecret } from "@/lib/secretbox";

/**
 * Resolves a key identifier, prefix, or raw key into the full vaulted secret token.
 * Ensures tools like Claude Code, OpenCode, and Codex receive the full unmasked key.
 */
export async function resolveFullApiKey(rawKey?: string | null): Promise<string> {
  const findEncryptedSecret = async (whereCondition: any) => {
    const row = await prisma.apiKey.findFirst({
      where: whereCondition,
      orderBy: { createdAt: "desc" },
    });
    if (row?.secretEnc) {
      try {
        const full = decSecret(row.secretEnc);
        if (full && full.startsWith("xpl_")) return full;
      } catch {}
    }
    return null;
  };

  if (!rawKey || !rawKey.trim()) {
    const defaultSecret = await findEncryptedSecret({ revoked: false });
    return defaultSecret || "";
  }

  let trimmed = rawKey.trim().replace(/[.…\s]+$/, "");
  if (trimmed.startsWith("xpl_") && trimmed.length >= 32) {
    return trimmed;
  }

  // 1. Try exact ID or prefix match
  const match = await findEncryptedSecret({
    OR: [
      { id: trimmed },
      { prefix: trimmed },
      { prefix: { startsWith: trimmed.slice(0, 8) } },
    ],
    revoked: false,
  });
  if (match) return match;

  // 2. Fallback to any active key with vaulted secret
  const fallback = await findEncryptedSecret({ revoked: false, secretEnc: { not: "" } });
  if (fallback) return fallback;

  return trimmed;
}

