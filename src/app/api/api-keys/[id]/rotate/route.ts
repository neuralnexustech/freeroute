import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashKey, newRawKey } from "@/lib/auth";
import { encSecret } from "@/lib/secretbox";

// POST — rotate a key: issue a new secret, invalidate the old one.
// The new secret is returned once; an encrypted copy is vaulted for reveal.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const existing = await prisma.apiKey.findUnique({ where: { id: params.id } });
  if (!existing || existing.revoked) {
    return NextResponse.json({ error: "Key not found or revoked" }, { status: 404 });
  }
  const secret = newRawKey("xpl_");
  await prisma.apiKey.update({
    where: { id: params.id },
    data: { keyHash: hashKey(secret), prefix: secret.slice(0, 12), lastUsedAt: null },
  });
  try {
    await prisma.$executeRaw`UPDATE "ApiKey" SET "secretEnc" = ${encSecret(secret)} WHERE "id" = ${params.id}`;
  } catch { /* reveal unavailable for this key */ }
  return NextResponse.json({ id: params.id, secret });
}
