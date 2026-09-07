import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveModelSpecs } from "@/lib/model-info";

// PULL INFO (Strictly updates existing models in database without fetching/inserting new models)
export async function POST(_req: NextRequest, { params }: { params: { slug: string } }) {
  const provider = await prisma.provider.findUnique({ where: { slug: params.slug } });
  if (!provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  // Get saved preference from Settings
  const setting = await prisma.setting.findUnique({ where: { key: "pull_info_strategy" } });
  const strategy = setting?.value || "cascade";

  // Fetch models ALREADY in database (NO NEW MODELS PULLED)
  const existingModels = await prisma.model.findMany({
    where: { providerId: provider.id },
  });

  if (existingModels.length === 0) {
    return NextResponse.json({
      ok: true,
      count: 0,
      updated: 0,
      message: "No existing models found for this provider. Pull or add models first.",
    });
  }

  let updatedCount = 0;
  const updates: { slug: string; contextWindow: string; inputPrice: number; outputPrice: number; modalities: string; source: string }[] = [];

  for (const m of existingModels) {
    const specs = await resolveModelSpecs(m.slug, provider.slug, strategy);
    await prisma.model.update({
      where: { id: m.id },
      data: {
        contextWindow: specs.contextWindow,
        inputPrice: specs.inputPrice,
        outputPrice: specs.outputPrice,
        modalities: specs.modalities,
      },
    }).catch(() => {});

    updates.push({
      slug: m.slug,
      contextWindow: specs.contextWindow,
      inputPrice: specs.inputPrice,
      outputPrice: specs.outputPrice,
      modalities: specs.modalities,
      source: specs.source,
    });
    updatedCount++;
  }

  return NextResponse.json({
    ok: true,
    totalExisting: existingModels.length,
    updated: updatedCount,
    strategy,
    updates,
  });
}
