import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const [models, combos] = await Promise.all([
    prisma.model.findMany({
      where: { enabled: true },
      include: { provider: { select: { slug: true, name: true, icon: true, connected: true } } },
      orderBy: { slug: "asc" },
    }),
    prisma.combo.findMany({
      include: {
        targets: { orderBy: { priority: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  // Merge bench columns via raw SQL
  let bench: Record<string, { ttftMs: number | null; httpStatus: number | null }> = {};
  try {
    const rows =
      (await prisma.$queryRaw<
        { id: string; ttftMs: number | null; httpStatus: number | null }[]
      >`SELECT "id", "ttftMs", "httpStatus" FROM "Model" WHERE "enabled" = 1`) ?? [];
    for (const r of rows) bench[r.id] = { ttftMs: r.ttftMs, httpStatus: r.httpStatus };
  } catch {
    /* fall back gracefully */
  }

  const comboEntries = combos.map((c) => ({
    id: c.name,
    modelId: c.id,
    object: "model",
    created: Math.floor(c.createdAt.getTime() / 1000),
    owned_by: "combo",
    permission: [],
    root: c.name,
    parent: null,
    displayName: `Combo: ${c.name} (${c.strategy})`,
    provider: { slug: "combo", name: "Freeroute Combo", icon: "☲" },
    contextWindow: "128K",
    inputPrice: 0,
    outputPrice: 0,
    modalities: "T,IMG,DOC",
    enabled: true,
    status: "ok",
    isCombo: true,
    strategy: c.strategy,
    targetCount: c.targets.length,
  }));

  const modelEntries = models.map((m) => ({
    id: m.slug,
    modelId: m.id,
    object: "model",
    created: Math.floor(m.createdAt.getTime() / 1000),
    owned_by: m.provider.slug,
    permission: [],
    root: m.slug,
    parent: null,
    displayName: m.displayName,
    provider: m.provider,
    contextWindow: m.contextWindow,
    inputPrice: m.inputPrice,
    outputPrice: m.outputPrice,
    modalities: m.modalities,
    enabled: m.enabled,
    status: m.status,
    toksPerSec: m.toksPerSec,
    latencyMs: m.latencyMs,
    isCombo: false,
    ttftMs:
      bench[m.id]?.ttftMs ??
      (m as unknown as { ttftMs: number | null }).ttftMs ??
      null,
    httpStatus: bench[m.id]?.httpStatus ?? null,
  }));

  return NextResponse.json({
    object: "list",
    data: [...comboEntries, ...modelEntries],
  });
}
