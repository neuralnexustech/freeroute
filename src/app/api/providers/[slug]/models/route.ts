import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest) {
  const { id, enabled } = await req.json().catch(() => ({}));
  if (!id || typeof enabled !== "boolean") return NextResponse.json({ error: "id and enabled required" }, { status: 400 });
  const current = await prisma.model.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Model not found" }, { status: 404 });
  // Toggle flips routing only — the diagnostic verdict (status/code/TTFT)
  // is preserved so the row keeps showing what the error was.
  const m = await prisma.model.update({ where: { id }, data: { enabled } });
  return NextResponse.json({ ok: true, model: m });
}
