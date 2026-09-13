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
  const CHUNK_SIZE = 10;
  for (let i = 0; i < existingModels.length; i += CHUNK_SIZE) {
    const chunk = existingModels.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (m) => {
        try {
          const specs = await resolveModelSpecs(m.slug, m.provider?.slug || "", strategy);
          await prisma.model.update({
            where: { id: m.id },
            data: {
              contextWindow: specs.contextWindow,
              inputPrice: specs.inputPrice,
              outputPrice: specs.outputPrice,
              modalities: specs.modalities,
            },
          });
          updatedCount++;
        } catch {}
      })
    );
  }

  // Backfill / recalculate RequestLog costs for any requests that had 0 cost before pulling pricing info
  const allUpdatedModels = await prisma.model.findMany({
    select: { id: true, slug: true, inputPrice: true, outputPrice: true },
  });
  const priceMap = new Map<string, { inputPrice: number; outputPrice: number }>();
  for (const m of allUpdatedModels) {
    if (m.inputPrice > 0 || m.outputPrice > 0) {
      priceMap.set(m.id, { inputPrice: m.inputPrice, outputPrice: m.outputPrice });
      priceMap.set(m.slug, { inputPrice: m.inputPrice, outputPrice: m.outputPrice });
    }
  }

  const logsToUpdate = await prisma.requestLog.findMany({
    where: { cost: 0 },
    select: { id: true, modelId: true, modelSlug: true, promptTokens: true, completionTokens: true },
  });

  let backfilledLogs = 0;
  for (const log of logsToUpdate) {
    const p = (log.modelId ? priceMap.get(log.modelId) : null) || priceMap.get(log.modelSlug);
    if (p && (log.promptTokens > 0 || log.completionTokens > 0)) {
      const c = (log.promptTokens / 1_000_000) * p.inputPrice + (log.completionTokens / 1_000_000) * p.outputPrice;
      if (c > 0) {
        await prisma.requestLog.update({
          where: { id: log.id },
          data: { cost: c },
        }).catch(() => {});
        backfilledLogs++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    totalExisting: existingModels.length,
    updated: updatedCount,
    backfilledLogs,
    strategy,
  });
}
