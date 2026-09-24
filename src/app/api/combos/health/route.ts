import { NextRequest, NextResponse } from "next/server";
import { getAllCooldownState, clearTargetCooldown } from "@/lib/combo";
import { prisma } from "@/lib/db";

/**
 * GET /api/combos/health
 * Returns the real-time healing/cooldown state for all combo targets.
 * Each entry describes why a model is in cooldown and when it will recover.
 */
export async function GET(req: NextRequest) {
  try {
    const cooldowns = getAllCooldownState();

    // Enrich with model/provider display names where possible
    const keys = Object.keys(cooldowns);
    const enriched: Record<string, any> = {};

    if (keys.length > 0) {
      // Fetch display names for model IDs (cuid format) and provider slugs
      const [models, providers] = await Promise.all([
        prisma.model.findMany({
          where: { id: { in: keys } },
          select: { id: true, displayName: true, slug: true, provider: { select: { name: true, slug: true, icon: true } } },
        }),
        prisma.provider.findMany({
          where: { slug: { in: keys } },
          select: { slug: true, name: true, icon: true },
        }),
      ]).catch(() => [[], []] as any);

      const modelMap = new Map((models as any[]).map((m: any) => [m.id, m]));
      const providerMap = new Map((providers as any[]).map((p: any) => [p.slug, p]));

      for (const [key, entry] of Object.entries(cooldowns)) {
        const model = modelMap.get(key);
        const provider = providerMap.get(key);
        enriched[key] = {
          ...entry,
          displayName: model?.displayName || model?.slug || provider?.name || key,
          providerName: model?.provider?.name || provider?.name || null,
          providerIcon: model?.provider?.icon || provider?.icon || null,
          isModel: !!model,
          isProvider: !!provider,
        };
      }
    }

    return NextResponse.json({
      cooldowns: enriched,
      count: Object.keys(enriched).length,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    console.error("Error fetching combo health:", err);
    return NextResponse.json({ error: "Failed to fetch health state" }, { status: 500 });
  }
}

/**
 * DELETE /api/combos/health?key=<targetKey>
 * Force-clears a specific model/provider from cooldown (admin force-heal).
 */
export async function DELETE(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "key parameter required" }, { status: 400 });
  }
  clearTargetCooldown(key);
  return NextResponse.json({ ok: true, key, message: `'${key}' force-healed and reactivated` });
}
