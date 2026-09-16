import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { inferModelParams, inferModelScore } from "@/lib/model-info";

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

  // Aggregate spend from RequestLog
  const logs = await prisma.requestLog.findMany({
    select: {
      modelId: true,
      modelSlug: true,
      promptTokens: true,
      completionTokens: true,
      cost: true,
    },
  });

  const priceMap = new Map<string, { inputPrice: number; outputPrice: number }>();
  for (const m of models) {
    priceMap.set(m.id, { inputPrice: m.inputPrice, outputPrice: m.outputPrice });
    priceMap.set(m.slug, { inputPrice: m.inputPrice, outputPrice: m.outputPrice });
  }

  const spendBySlug = new Map<string, number>();
  const spendById = new Map<string, number>();
  const requestsBySlug = new Map<string, number>();
  const requestsById = new Map<string, number>();
  const tokensBySlug = new Map<string, number>();
  const tokensById = new Map<string, number>();

  for (const l of logs) {
    let cost = l.cost ?? 0;
    const pt = l.promptTokens ?? 0;
    const ct = l.completionTokens ?? 0;
    const totTok = pt + ct;

    if (cost <= 0 && totTok > 0) {
      const p = (l.modelId ? priceMap.get(l.modelId) : null) || priceMap.get(l.modelSlug);
      if (p && (p.inputPrice > 0 || p.outputPrice > 0)) {
        cost = (pt / 1_000_000) * p.inputPrice + (ct / 1_000_000) * p.outputPrice;
      }
    }

    if (l.modelId) {
      spendById.set(l.modelId, (spendById.get(l.modelId) || 0) + cost);
      requestsById.set(l.modelId, (requestsById.get(l.modelId) || 0) + 1);
      tokensById.set(l.modelId, (tokensById.get(l.modelId) || 0) + totTok);
    }
    if (l.modelSlug) {
      spendBySlug.set(l.modelSlug, (spendBySlug.get(l.modelSlug) || 0) + cost);
      requestsBySlug.set(l.modelSlug, (requestsBySlug.get(l.modelSlug) || 0) + 1);
      tokensBySlug.set(l.modelSlug, (tokensBySlug.get(l.modelSlug) || 0) + totTok);
    }
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
    params: "Combo",
    score: 95,
    enabled: true,
    status: "ok",
    isCombo: true,
    strategy: c.strategy,
    targetCount: c.targets.length,
    spend: Math.round((spendBySlug.get(c.name) ?? 0) * 1_000_000) / 1_000_000,
    requests: requestsBySlug.get(c.name) ?? 0,
    tokens: tokensBySlug.get(c.name) ?? 0,
  }));

  const modelEntries = models.map((m) => {
    const mSpend = (m.id && spendById.has(m.id) ? spendById.get(m.id) : null) ?? spendBySlug.get(m.slug) ?? 0;
    const mReqs = (m.id && requestsById.has(m.id) ? requestsById.get(m.id) : null) ?? requestsBySlug.get(m.slug) ?? 0;
    const mToks = (m.id && tokensById.has(m.id) ? tokensById.get(m.id) : null) ?? tokensBySlug.get(m.slug) ?? 0;
    const params = inferModelParams(m.slug);
    const score = inferModelScore(m.slug, params);

    return {
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
      params,
      score,
      inputPrice: m.inputPrice,
      outputPrice: m.outputPrice,
      modalities: m.modalities,
      enabled: m.enabled,
      status: m.status,
      toksPerSec: m.toksPerSec,
      latencyMs: m.latencyMs,
      isCombo: false,
      spend: Math.round(mSpend * 1_000_000) / 1_000_000,
      requests: mReqs,
      tokens: mToks,
      ttftMs:
        bench[m.id]?.ttftMs ??
        (m as unknown as { ttftMs: number | null }).ttftMs ??
        null,
      httpStatus: bench[m.id]?.httpStatus ?? null,
    };
  });

  const claudeVirtualModels = [
    "claude-opus-4-8",
    "claude-opus-4-8[1m]",
    "claude-opus-5",
    "claude-opus-5[1m]",
    "claude-sonnet-5",
    "claude-sonnet-5[1m]",
    "claude-sonnet-4-5-20250929",
    "claude-sonnet-4-5-20250929[1m]",
    "claude-haiku-4-5-20251001",
    "claude-3-5-sonnet-20241022",
    "claude-3-7-sonnet-20250219",
  ].map((slug) => ({
    id: slug,
    modelId: slug,
    object: "model",
    created: 1780000000,
    owned_by: "anthropic",
    permission: [],
    root: slug,
    parent: null,
    displayName: slug,
    provider: { slug: "anthropic", name: "Anthropic", icon: "✳", connected: true },
    contextWindow: slug.includes("[1m]") ? "1M" : "200K",
    params: "Claude",
    score: 98,
    inputPrice: 3,
    outputPrice: 15,
    modalities: "T,IMG,DOC",
    enabled: true,
    status: "ok",
    isCombo: false,
    spend: 0,
    requests: 0,
    tokens: 0,
    ttftMs: 120,
    httpStatus: 200,
  }));

  const allModels = [...comboEntries, ...claudeVirtualModels, ...modelEntries];
  const uniqueModels = Array.from(new Map(allModels.map((m) => [m.id, m])).values());

  return NextResponse.json({
    object: "list",
    data: uniqueModels,
  });
}
