import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveModelSpecs } from "@/lib/model-info";

export async function POST() {
  const setting = await prisma.setting.findUnique({ where: { key: "pull_info_strategy" } });
  const strategy = setting?.value || "cascade";

  const existingModels = await prisma.model.findMany({
    include: { provider: true },
  });

  if (existingModels.length === 0) {
    return NextResponse.json({ ok: true, count: 0, updated: 0 });
  }

  let updatedCount = 0;
  for (const m of existingModels) {
    const specs = await resolveModelSpecs(m.slug, m.provider?.slug || "", strategy);
    await prisma.model.update({
      where: { id: m.id },
      data: {
        contextWindow: specs.contextWindow,
        inputPrice: specs.inputPrice,
        outputPrice: specs.outputPrice,
        modalities: specs.modalities,
      },
    }).catch(() => {});
    updatedCount++;
  }

  return NextResponse.json({
    ok: true,
    totalExisting: existingModels.length,
    updated: updatedCount,
    strategy,
  });
}
