import { NextRequest } from "next/server";

import fs from "node:fs";
import path from "node:path";

function readEnvPort(): number | null {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      const match = content.match(/^PORT\s*=\s*(\d+)/m);
      if (match && match[1]) {
        const num = Number(match[1]);
        if (!isNaN(num)) return num;
      }
    }
  } catch {}
  return null;
}

export function getGatewayPort(): number {
  const p = process.env.PORT || process.env.NEXT_PUBLIC_PORT;
  if (p && !isNaN(Number(p))) return Number(p);
  const fromFile = readEnvPort();
  if (fromFile !== null) return fromFile;
  return 3000;
}

export function getGatewayHost(): string {
  return process.env.HOST || "127.0.0.1";
}

/**
 * Returns the gateway base URL dynamically.
 * Priority:
 * 1. Request Host header (so whatever port or domain the user accessed is used)
 * 2. process.env.GATEWAY_URL
 * 3. http://127.0.0.1:<PORT from .env>
 */
export function getGatewayBaseUrl(req?: NextRequest | Request): string {
  if (req) {
    const host = req.headers.get("host");
    if (host) {
      const proto = req.headers.get("x-forwarded-proto") || "http";
      return `${proto}://${host}`;
    }
  }

  if (process.env.GATEWAY_URL) {
    return process.env.GATEWAY_URL.replace(/\/+$/, "");
  }

  const port = getGatewayPort();
  const host = getGatewayHost();
  return `http://${host}:${port}`;
}
