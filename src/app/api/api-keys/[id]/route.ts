import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const permanent = url.searchParams.get("permanent") === "true";
  const existing = await prisma.apiKey.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ ok: true, message: "Already removed" });
  }

  if (permanent || existing.revoked) {
    await prisma.apiKey.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true, deleted: true });
  }

  await prisma.apiKey.update({ where: { id: params.id }, data: { revoked: true } });
  return NextResponse.json({ ok: true, revoked: true });
}
