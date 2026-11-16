import { prisma } from "@/lib/db";
import { createHash, randomBytes, timingSafeEqual } from "crypto";

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

  // No silent fallback: an unrecognized identifier must never resolve to some
  // other key's secret. Callers treat "" as "user must supply a real key".
  return "";
}

// ---------------------------------------------------------------------------
// Dashboard (admin) surface protection
// ---------------------------------------------------------------------------
// The dashboard talks to /api/* from the same origin, so a request that
// originates on this machine needs no token: the security boundary is that the
// server binds to loopback only (scripts/dev.mjs and scripts/start.mjs pass
// `--hostname`, defaulting to 127.0.0.1, and export HOST so this guard can see
// the same value).
//
// Three modes, in precedence order:
//   1. FREEROUTE_REQUIRE_ADMIN=1  → token required always, loopback included.
//   2. server bound to loopback   → allowed (the local dashboard).
//   3. remote request             → allowed only with FREEROUTE_ADMIN_TOKEN.
//
// Callers that cannot send headers (EventSource, plain <a href> downloads) may
// pass the token as `?admin=<token>` instead of `Authorization: Bearer ...`.
//
// Caveat: mode 2 trusts the HOST env var. Launch through the wrapper scripts
// (which always set it) rather than passing `--hostname 0.0.0.0` to `next`
// directly, or the guard will still believe the server is local.

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function stripToken(raw: string | null): string {
  if (!raw) return "";
  return raw.startsWith("Bearer ") ? raw.slice(7).trim() : raw.trim();
}

/**
 * True when the *server* is bound to a loopback address, i.e. nothing but this
 * machine can reach it at all.
 *
 * This is the real security boundary — the `Host` header is client-controlled
 * and must never be the thing deciding trust. If the process is bound to
 * 127.0.0.1, a request can only have originated locally; if it is bound to
 * 0.0.0.0/LAN, the token is required no matter what the headers claim.
 */
export function serverBoundToLoopback(): boolean {
  const host = (process.env.HOST || "127.0.0.1").trim().toLowerCase();
  return host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "[::1]";
}

// The old `isLoopbackRequest(req)` helper inspected the `Host` and
// `x-forwarded-for` headers to decide whether a request was local. Both are
// client-controlled, so when the server is network-bound an attacker could send
// `Host: localhost` and be trusted. It was removed rather than left exported,
// so nothing can reintroduce that check: `serverBoundToLoopback()` is the only
// signal used.

export type AdminAuthResult =
  | { ok: true; via: "loopback" | "token" }
  | { ok: false; status: 401; message: string };

/**
 * Authorises a dashboard/admin request. Returns `ok: false` together with the
 * status a route should return; routes should early-return a JSON error.
 */
export function checkAdminAuth(req: Request, url?: URL): AdminAuthResult {
  const expected = (process.env.FREEROUTE_ADMIN_TOKEN || "").trim();
  const requireToken = process.env.FREEROUTE_REQUIRE_ADMIN === "1";
  let parsed = url;
  if (!parsed) {
    try {
      parsed = new URL(req.url);
    } catch {
      parsed = undefined;
    }
  }
  const supplied =
    stripToken(req.headers.get("authorization")) ||
    stripToken(req.headers.get("x-freeroute-admin-token")) ||
    (parsed?.searchParams.get("admin") || "").trim();

  // 1. Shared-machine mode: the token is mandatory, loopback included. This is
  //    the only mode where a local request is untrusted.
  if (requireToken) {
    if (!expected) {
      return {
        ok: false,
        status: 401,
        message: "FREEROUTE_REQUIRE_ADMIN=1 is set but FREEROUTE_ADMIN_TOKEN is empty.",
      };
    }
    if (supplied && safeEqual(supplied, expected)) return { ok: true, via: "token" };
    return { ok: false, status: 401, message: "Unauthorized. Send Authorization: Bearer <FREEROUTE_ADMIN_TOKEN>." };
  }

  // 2. Local dashboard: trust the request only when the server cannot be
  //    reached from the network. Requiring a token here would lock the
  //    operator out of their own UI — the dashboard's fetch/EventSource calls
  //    carry no credentials, because the loopback binding protects them.
  //
  //    When the server IS network-bound we deliberately ignore the Host header
  //    — a spoofed `Host: localhost` must not buy access — and fall through to
  //    token verification.
  if (serverBoundToLoopback()) return { ok: true, via: "loopback" };

  // 3. Remote request: only a matching token gets in.
  if (!expected) {
    return { ok: false, status: 401, message: "Admin API is restricted to loopback. Set FREEROUTE_ADMIN_TOKEN to allow remote access." };
  }
  if (supplied && safeEqual(supplied, expected)) return { ok: true, via: "token" };
  return { ok: false, status: 401, message: "Unauthorized. Send Authorization: Bearer <FREEROUTE_ADMIN_TOKEN>." };
}

/**
 * Route-level convenience wrapper: returns a 401 Response when the request is
 * not allowed, or `null` when the handler may proceed.
 *
 *   const denied = adminGuard(req);
 *   if (denied) return denied;
 */
export function adminGuard(req: Request, url?: URL): Response | null {
  const result = checkAdminAuth(req, url);
  if (result.ok) return null;
  return new Response(JSON.stringify({ error: { message: result.message, type: "unauthorized" } }), {
    status: result.status,
    headers: { "Content-Type": "application/json" },
  });
}

