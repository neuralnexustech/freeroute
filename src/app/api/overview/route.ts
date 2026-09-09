import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const DAY = 86400_000;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const range = url.searchParams.get("range") ?? "7d";
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const since =
      range === "today"
        ? startOfToday
        : range === "7d"
        ? new Date(now.getTime() - 7 * DAY)
        : range === "30d"
        ? new Date(now.getTime() - 30 * DAY)
        : range === "90d"
        ? new Date(now.getTime() - 90 * DAY)
        : range === "1y"
        ? new Date(now.getTime() - 365 * DAY)
        : null;

    const where = since ? { createdAt: { gte: since } } : {};

    // 1. Fetch real logs and aggregates
    const [logs, allLogs, totalSpendAgg, totalTokensAgg, allCatalogModels, apiKeys] = await Promise.all([
      prisma.requestLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.requestLog.findMany({
        select: {
          createdAt: true,
          promptTokens: true,
          completionTokens: true,
          cost: true,
        },
      }),
      prisma.requestLog.aggregate({ where, _sum: { cost: true } }),
      prisma.requestLog.aggregate({
        where,
        _sum: { promptTokens: true, completionTokens: true },
      }),
      prisma.model.findMany({
        include: {
          provider: {
            select: { name: true, slug: true, icon: true },
          },
        },
      }),
      prisma.apiKey.findMany({
        where: { revoked: false },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const totalSpend = totalSpendAgg._sum.cost ?? 0;
    const promptTokens = totalTokensAgg._sum.promptTokens ?? 0;
    const completionTokens = totalTokensAgg._sum.completionTokens ?? 0;
    const totalTokens = promptTokens + completionTokens;
    const totalRequests = logs.length;

    // 2. Map catalog models by slug
    const catalogMap = new Map<string, { displayName: string; providerName: string; providerSlug: string }>();
    for (const m of allCatalogModels) {
      catalogMap.set(m.slug, {
        displayName: m.displayName,
        providerName: m.provider.name,
        providerSlug: m.provider.slug,
      });
    }

    // 3. Aggregate usage by model slug
    const usageByModel = new Map<
      string,
      {
        slug: string;
        name: string;
        provider: string;
        requests: number;
        tokens: number;
        promptTokens: number;
        completionTokens: number;
        spend: number;
      }
    >();

    for (const l of logs) {
      const cat = catalogMap.get(l.modelSlug);
      const provSlug = cat?.providerSlug || l.modelSlug.split("/")[0] || "custom";
      const displayName = cat?.displayName || l.modelSlug.split("/").pop() || l.modelSlug;

      const existing = usageByModel.get(l.modelSlug) ?? {
        slug: l.modelSlug,
        name: displayName,
        provider: provSlug,
        requests: 0,
        tokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        spend: 0,
      };

      existing.requests += 1;
      existing.promptTokens += l.promptTokens;
      existing.completionTokens += l.completionTokens;
      existing.tokens += l.promptTokens + l.completionTokens;
      existing.spend += l.cost;
      usageByModel.set(l.modelSlug, existing);
    }

    // Assign distinct palette colors to used models
    const MODEL_PALETTE = ["#2dd4bf", "#818cf8", "#f97316", "#f43f5e", "#fb7185", "#06b6d4", "#a855f7", "#ec4899", "#3b82f6", "#10b981"];
    const usedModelsList = Array.from(usageByModel.values()).map((m, idx) => ({
      ...m,
      color: MODEL_PALETTE[idx % MODEL_PALETTE.length],
    }));

    // 4. Build 7-day daily breakdown for chart
    const numDays = range === "today" ? 1 : range === "30d" ? 30 : 7;
    const dailyChart: Array<{
      date: string;
      fullDate: string;
      totalTokens: number;
      totalSpend: number;
      totalRequests: number;
      segments: Array<{
        slug: string;
        name: string;
        color: string;
        tokens: number;
        spend: number;
        requests: number;
      }>;
    }> = [];

    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * DAY);
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const endOfDay = startOfDay + DAY;
      const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`;
      const fullDateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

      const dayLogs = logs.filter((l) => {
        const t = new Date(l.createdAt).getTime();
        return t >= startOfDay && t < endOfDay;
      });

      const dayByModel = new Map<string, { tokens: number; spend: number; requests: number }>();
      let dayTokens = 0;
      let daySpend = 0;

      for (const dl of dayLogs) {
        const cur = dayByModel.get(dl.modelSlug) ?? { tokens: 0, spend: 0, requests: 0 };
        const tok = dl.promptTokens + dl.completionTokens;
        cur.tokens += tok;
        cur.spend += dl.cost;
        cur.requests += 1;
        dayTokens += tok;
        daySpend += dl.cost;
        dayByModel.set(dl.modelSlug, cur);
      }

      const segments = Array.from(dayByModel.entries()).map(([slug, stats]) => {
        const usedModel = usedModelsList.find((um) => um.slug === slug);
        return {
          slug,
          name: usedModel?.name || slug,
          color: usedModel?.color || "#64748b",
          tokens: stats.tokens,
          spend: stats.spend,
          requests: stats.requests,
        };
      });

      dailyChart.push({
        date: dateLabel,
        fullDate: fullDateStr,
        totalTokens: dayTokens,
        totalSpend: daySpend,
        totalRequests: dayLogs.length,
        segments,
      });
    }

    // 5. Complete ranked list of models for drawer — used models first, then catalog
    const usedSlugs = new Set(usedModelsList.map((u) => u.slug));

    const PRIORITY_SLUGS = [
      "nemotron-3.5-content-safety",
      "nemotron-3-nano-omni",
      "minimax-m3",
      "minimax-m2.7",
      "north-mini-code",
      "laguna-xs",
      "nemotron-3-super",
      "gemma-4-31b",
      "ling-3.0-flash-sante",
      "nemotron-3.5-lightning",
      "ling-3.0-flash-fin",
      "laguna-s",
      "lfm2.5",
      "dots3-note-preview",
    ];

    const catalogSorted = allCatalogModels
      .filter((m) => !usedSlugs.has(m.slug))
      .sort((a, b) => {
        const idxA = PRIORITY_SLUGS.findIndex((s) => a.slug.toLowerCase().includes(s.toLowerCase()));
        const idxB = PRIORITY_SLUGS.findIndex((s) => b.slug.toLowerCase().includes(s.toLowerCase()));
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.displayName.localeCompare(b.displayName);
      });

    // Deduplicate catalog models by unique model key to ensure 14 completely distinct models
    const normalizeKey = (slug: string) => {
      const s = slug.toLowerCase();
      if (s.includes("nemotron-3.5-content-safety")) return "nemotron-3.5-content-safety";
      if (s.includes("nemotron-3-nano-omni")) return "nemotron-3-nano-omni";
      if (s.includes("nemotron-3-super")) return "nemotron-3-super";
      if (s.includes("nemotron-3.5-lightning")) return "nemotron-3.5-lightning";
      if (s.includes("minimax-m3")) return "minimax-m3";
      if (s.includes("minimax-m2.7")) return "minimax-m2.7";
      if (s.includes("north-mini-code")) return "north-mini-code";
      if (s.includes("gemma-4-31b")) return "gemma-4-31b";
      if (s.includes("ling-3.0-flash-sante")) return "ling-3.0-flash-sante";
      if (s.includes("ling-3.0-flash-fin")) return "ling-3.0-flash-fin";
      if (s.includes("laguna-xs")) return "laguna-xs";
      if (s.includes("laguna-s")) return "laguna-s";
      if (s.includes("lfm2.5")) return "lfm2.5";
      if (s.includes("dots3-note")) return "dots3-note";
      return s.split("/").pop() || s;
    };

    const seenKeys = new Set(usedModelsList.map((u) => normalizeKey(u.slug)));
    const distinctCatalog: typeof allCatalogModels = [];
    for (const cm of catalogSorted) {
      const k = normalizeKey(cm.slug);
      if (!seenKeys.has(k)) {
        seenKeys.add(k);
        distinctCatalog.push(cm);
      }
    }

    // topDisplayModels only contains models the user actually used (no zero-padding).
    // The UI will show an empty state if this is empty.
    // Limit to 6 for the main card (the rest are in the drawer).
    const topDisplayModels = usedModelsList.slice(0, 6);

    // Complete list of 14 distinct models for the "View all (14)" slide-out drawer
    const allModelsForDrawer = [...usedModelsList];
    for (const cm of distinctCatalog) {
      if (allModelsForDrawer.length >= 14) break;
      allModelsForDrawer.push({
        slug: cm.slug,
        name: cm.displayName,
        provider: cm.provider.slug,
        requests: 0,
        tokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        spend: 0,
        color: "#94a3b8",
      });
    }

    // 6. Calculate Activity Streak and Daily Averages
    const activeDates = new Set<string>();
    for (const l of allLogs) {
      const d = new Date(l.createdAt);
      activeDates.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
    }

    const activeDaysCount = Math.max(1, activeDates.size);
    const avgDailyTokens = Math.round(totalTokens / activeDaysCount);
    const avgWeeklyTokens = Math.round(avgDailyTokens * 7);

    const avgDailySpend = totalSpend / activeDaysCount;
    const avgWeeklySpend = avgDailySpend * 7;

    // 7. Compute real API key usage and Apps breakdown
    let rawAppRows: Array<{ id: string; app: string | null }> = [];
    try {
      rawAppRows = await prisma.$queryRawUnsafe<Array<{ id: string; app: string | null }>>(
        'SELECT id, app FROM "RequestLog"'
      );
    } catch {
      rawAppRows = [];
    }
    const appById = new Map<string, string>();
    for (const r of rawAppRows) {
      if (r.app) appById.set(r.id, r.app);
    }

    const keyUsage = new Map<string, { tokens: number; requests: number; spend: number }>();
    const appUsage = new Map<string, { tokens: number; requests: number; spend: number }>();

    for (const l of logs) {
      // Key stats
      const kId = l.apiKeyId || "none";
      const ku = keyUsage.get(kId) ?? { tokens: 0, requests: 0, spend: 0 };
      const tok = l.promptTokens + l.completionTokens;
      ku.tokens += tok;
      ku.requests += 1;
      ku.spend += l.cost;
      keyUsage.set(kId, ku);

      // App stats
      const appName = appById.get(l.id) || (l.apiKeyId ? "CLI / API" : "Unknown");
      const cleanApp = appName === "Unknown" ? "CLI / Direct" : appName;
      const au = appUsage.get(cleanApp) ?? { tokens: 0, requests: 0, spend: 0 };
      au.tokens += tok;
      au.requests += 1;
      au.spend += l.cost;
      appUsage.set(cleanApp, au);
    }

    const enrichedApiKeys = apiKeys.map((k) => {
      const u = keyUsage.get(k.id) ?? { tokens: 0, requests: 0, spend: 0 };
      return {
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        createdAt: k.createdAt,
        tokens: u.tokens,
        requests: u.requests,
        spend: u.spend,
      };
    }).sort((a, b) => (b.tokens !== a.tokens ? b.tokens - a.tokens : b.requests - a.requests));

    const enrichedApps = Array.from(appUsage.entries()).map(([name, stats]) => ({
      name,
      tokens: stats.tokens,
      requests: stats.requests,
      spend: stats.spend,
    })).sort((a, b) => (b.tokens !== a.tokens ? b.tokens - a.tokens : b.requests - a.requests));

    // 8. Build 31-day insights series (Aug 8 to Sep 7)
    const insights31Days: Array<{
      date: string;
      fullDate: string;
      requests: number;
      tokens: number;
      promptTokens: number;
      completionTokens: number;
      cachedTokens: number;
      uncachedTokens: number;
      spend: number;
      byModel: Record<string, { requests: number; tokens: number }>;
    }> = [];

    for (let i = 30; i >= 0; i--) {
      const d = new Date(now.getTime() - i * DAY);
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const endOfDay = startOfDay + DAY;
      const monthName = d.toLocaleDateString("en-US", { month: "short" });
      const dayNum = d.getDate();
      const dateLabel = `${monthName} ${dayNum}`;
      const fullDateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

      const dayLogs = logs.filter((l) => {
        const t = new Date(l.createdAt).getTime();
        return t >= startOfDay && t < endOfDay;
      });

      let dReqs = 0;
      let dPrompt = 0;
      let dComp = 0;
      let dSpend = 0;
      const byModel: Record<string, { requests: number; tokens: number }> = {};

      for (const dl of dayLogs) {
        dReqs += 1;
        dPrompt += dl.promptTokens;
        dComp += dl.completionTokens;
        dSpend += dl.cost;
        const cur = byModel[dl.modelSlug] ?? { requests: 0, tokens: 0 };
        cur.requests += 1;
        cur.tokens += dl.promptTokens + dl.completionTokens;
        byModel[dl.modelSlug] = cur;
      }

      insights31Days.push({
        date: dateLabel,
        fullDate: fullDateStr,
        requests: dReqs,
        tokens: dPrompt + dComp,
        promptTokens: dPrompt,
        completionTokens: dComp,
        cachedTokens: 0,
        uncachedTokens: dPrompt,
        spend: dSpend,
        byModel,
      });
    }

    return NextResponse.json({
      spend: totalSpend,
      tokens: totalTokens,
      promptTokens,
      completionTokens,
      requests: totalRequests,
      usedModels: topDisplayModels,
      allModels: allModelsForDrawer,
      dailyChart,
      insights31Days,
      apps: enrichedApps,
      activity: {
        longestStreak: `${activeDaysCount} day${activeDaysCount > 1 ? "s" : ""}`,
        avgDayTokens: avgDailyTokens,
        avgWeekTokens: avgWeeklyTokens,
        avgDaySpend: avgDailySpend,
        avgWeekSpend: avgWeeklySpend,
        totalTokens,
        totalSpend,
      },
      apiKeys: enrichedApiKeys,
    });
  } catch (error: any) {
    console.error("overview route error:", error?.message);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
