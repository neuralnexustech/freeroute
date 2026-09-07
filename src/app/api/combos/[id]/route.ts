import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { VALID_COMBO_NAME_REGEX, resetComboRotation } from "@/lib/combo";

const UpdateComboSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(80, "Name is too long")
    .regex(VALID_COMBO_NAME_REGEX, "Name can only contain letters, numbers, -, _ and .")
    .optional(),
  strategy: z
    .enum(["round-robin", "weighted", "failover", "latency-based", "cost-optimized"])
    .optional(),
  targets: z
    .array(
      z.object({
        modelId: z.string().min(1),
        weight: z.number().int().min(1).default(1),
        priority: z.number().int().min(0).default(0),
      }),
    )
    .optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const combo = await prisma.combo.findUnique({
      where: { id },
      include: {
        targets: {
          orderBy: { priority: "asc" },
        },
      },
    });

    if (!combo) {
      return NextResponse.json({ error: "Combo not found" }, { status: 404 });
    }

    const modelIds = combo.targets.map((t) => t.modelId);
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
      modelMap.set(m.id, m);
      modelMap.set(m.slug, m);
    }

    const enriched = {
      ...combo,
      targets: combo.targets.map((t) => ({
        ...t,
        model: modelMap.get(t.modelId) || null,
      })),
    };

    return NextResponse.json({ combo: enriched });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to fetch combo" },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const existing = await prisma.combo.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Combo not found" }, { status: 404 });
    }

    const raw = await req.json().catch(() => null);
    const parsed = UpdateComboSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid payload" },
        { status: 400 },
      );
    }

    const { name, strategy, targets } = parsed.data;

    // Check name uniqueness if name is changed
    if (name && name !== existing.name) {
      const duplicate = await prisma.combo.findUnique({ where: { name } });
      if (duplicate && duplicate.id !== id) {
        return NextResponse.json(
          { error: `Combo named '${name}' already exists` },
          { status: 409 },
        );
      }
    }

    // Run in transaction if targets are provided
    const updated = await prisma.$transaction(async (tx) => {
      if (targets !== undefined) {
        // Delete previous targets
        await tx.comboTarget.deleteMany({ where: { comboId: id } });
        // Create new targets with normalized priority
        const formattedTargets = targets.map((t, idx) => ({
          comboId: id,
          modelId: t.modelId,
          weight: t.weight ?? 1,
          priority: t.priority ?? idx,
        }));
        if (formattedTargets.length > 0) {
          await tx.comboTarget.createMany({ data: formattedTargets });
        }
      }

      return tx.combo.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(strategy ? { strategy } : {}),
        },
        include: {
          targets: {
            orderBy: { priority: "asc" },
          },
        },
      });
    });

    resetComboRotation(id);
    resetComboRotation(existing.name);
    if (name) resetComboRotation(name);

    return NextResponse.json({ combo: updated });
  } catch (err: any) {
    console.error("Error updating combo:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to update combo" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const existing = await prisma.combo.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Combo not found" }, { status: 404 });
    }

    await prisma.combo.delete({ where: { id } });
    resetComboRotation(id);
    resetComboRotation(existing.name);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting combo:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to delete combo" },
      { status: 500 },
    );
  }
}
