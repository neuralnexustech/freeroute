import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.apiKey.update({ where: { id: params.id }, data: { revoked: true } });
  return NextResponse.json({ ok: true });
}
