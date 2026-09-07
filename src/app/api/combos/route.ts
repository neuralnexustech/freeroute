import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { VALID_COMBO_NAME_REGEX } from "@/lib/combo";

const CreateComboSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(80, "Name is too long")
    .regex(VALID_COMBO_NAME_REGEX, "Name can only contain letters, numbers, -, _ and ."),
  strategy: z
    .enum(["round-robin", "weighted", "failover", "latency-based", "cost-optimized"])
    .default("failover"),
  targets: z
    .array(
      z.object({
        modelId: z.string().min(1),
        weight: z.number().int().min(1).default(1),
        priority: z.number().int().min(0).default(0),
      }),
    )
    .default([]),
});

export async function GET() {
  try {
    const combos = await prisma.combo.findMany({
      include: {
        targets: {
          orderBy: { priority: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Gather all referenced modelIds to attach full model + provider details
    const modelIds = Array.from(
      new Set(combos.flatMap((c) => c.targets.map((t) => t.modelId))),
    );

    const models = await prisma.model.findMany({
      where: {
        OR: [{ id: { in: modelIds } }, { slug: { in: modelIds } }],
      },
      include: {
        provider: {
          select: {
            id: true,
            slug: true,
            name: true,
            icon: true,
            connected: true,
            apiKey: true,
          },
        },
      },
    });

    const modelMap = new Map();
    for (const m of models) {
      const entry = {
        id: m.id,
        slug: m.slug,
        displayName: m.displayName,
        contextWindow: m.contextWindow,
        inputPrice: m.inputPrice,
        outputPrice: m.outputPrice,
        modalities: m.modalities,
        enabled: m.enabled,
        status: m.status,
        latencyMs: m.latencyMs,
        toksPerSec: m.toksPerSec,
        provider: {
          id: m.provider.id,
          slug: m.provider.slug,
          name: m.provider.name,
          icon: m.provider.icon,
          connected: m.provider.connected,
          hasApiKey: !!m.provider.apiKey,
        },
      };
      modelMap.set(m.id, entry);
      modelMap.set(m.slug, entry);
    }

    const enrichedCombos = combos.map((c) => ({
      ...c,
      targets: c.targets.map((t) => ({
        ...t,
        model: modelMap.get(t.modelId) || null,
      })),
    }));

    return NextResponse.json({ combos: enrichedCombos });
  } catch (err: any) {
    console.error("Error fetching combos:", err);
    return NextResponse.json(
      { error: "Failed to fetch combos" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json().catch(() => null);
    const parsed = CreateComboSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid payload" },
        { status: 400 },
      );
    }

    const { name, strategy, targets } = parsed.data;

    // Check duplicate name
    const existing = await prisma.combo.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json(
        { error: `Combo named '${name}' already exists` },
        { status: 409 },
      );
    }

    // Ensure priority numbers are strictly indexed if not set
    const formattedTargets = targets.map((t, idx) => ({
      modelId: t.modelId,
      weight: t.weight ?? 1,
      priority: t.priority ?? idx,
    }));

    const combo = await prisma.combo.create({
      data: {
        name,
        strategy,
        targets: {
          create: formattedTargets,
        },
      },
      include: {
        targets: {
          orderBy: { priority: "asc" },
        },
      },
    });

    return NextResponse.json({ combo }, { status: 201 });
  } catch (err: any) {
    console.error("Error creating combo:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to create combo" },
      { status: 500 },
    );
  }
}
