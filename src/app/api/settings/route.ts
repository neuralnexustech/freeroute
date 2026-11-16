import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { adminGuard } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  const rows = await prisma.setting.findMany();
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  return NextResponse.json({
    strategy: settings["pull_info_strategy"] || "cascade",
    settings,
  });
}

export async function POST(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const { strategy } = body;
  if (typeof strategy === "string") {
    await prisma.setting.upsert({
      where: { key: "pull_info_strategy" },
      update: { value: strategy },
      create: { key: "pull_info_strategy", value: strategy },
    });
  }
  return NextResponse.json({ ok: true, strategy });
}
