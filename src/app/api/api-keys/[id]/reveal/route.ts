import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decSecret } from "@/lib/secretbox";

// GET — reveal the full secret for dashboard copy. Only works for keys
// created/rotated after the vault shipped; older keys return 404 with reason.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const rows = (await prisma.$queryRaw<{ secretEnc: string | null }[]>`SELECT "secretEnc" FROM "ApiKey" WHERE "id" = ${params.id} LIMIT 1`.catch(() => [])) ?? [];
  const blob = rows[0]?.secretEnc;
  if (!blob) {
    return NextResponse.json({ error: "Full secret not vaulted — it was shown once at creation. Rotate the key to enable copy." }, { status: 404 });
  }
  try {
    return NextResponse.json({ secret: decSecret(blob) });
  } catch {
    return NextResponse.json({ error: "Vault unavailable — check FREEROUTE_MASTER_KEY and restart the server." }, { status: 500 });
  }
}
