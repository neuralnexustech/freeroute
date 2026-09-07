import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashKey, newRawKey } from "@/lib/auth";
import { encSecret } from "@/lib/secretbox";

function expiry(expire: string): Date | null {
  if (expire === "30d") return new Date(Date.now() + 30 * 86400_000);
  if (expire === "90d") return new Date(Date.now() + 90 * 86400_000);
  if (expire === "1y") return new Date(Date.now() + 365 * 86400_000);
  return null;
}

export async function GET() {
  const keys = await prisma.apiKey.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({
    keys: keys.map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt, expiresAt: k.expiresAt, revoked: k.revoked })),
  });
}

export async function POST(req: NextRequest) {
  const { name, expire } = await req.json().catch(() => ({}));
  if (!name || typeof name !== "string") return NextResponse.json({ error: "name required" }, { status: 400 });
  const secret = newRawKey("xpl_");
  const rec = await prisma.apiKey.create({
    data: { name, keyHash: hashKey(secret), prefix: secret.slice(0, 12), expiresAt: expiry(expire ?? "never") },
  });
  // Vault the secret for dashboard reveal. Raw SQL: generated client lags
  // behind schema until `prisma generate` reruns. Silent if master key missing.
  try {
    await prisma.$executeRaw`UPDATE "ApiKey" SET "secretEnc" = ${encSecret(secret)} WHERE "id" = ${rec.id}`;
  } catch { /* reveal unavailable for this key */ }
  return NextResponse.json({ id: rec.id, secret });
}
