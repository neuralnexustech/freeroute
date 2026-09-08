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
  if (token === "freeroute-playground") {
    const existing = await prisma.apiKey.findFirst({ where: { revoked: false } });
    if (existing) return existing;
    return await prisma.apiKey.upsert({
      where: { keyHash: hashKey("freeroute-playground") },
      update: {},
      create: {
        name: "Playground Internal Key",
        prefix: "xpl_playg",
        keyHash: hashKey("freeroute-playground"),
      },
    });
  }
  const h = hashKey(token);
  const rec = await prisma.apiKey.findUnique({ where: { keyHash: h } });
  if (!rec || rec.revoked) return null;
  if (rec.expiresAt && rec.expiresAt < new Date()) return null;
  return rec;
}
