import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";

const DAY = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  // Require valid API key
  const key = await validateApiKey(req.headers.get("authorization"));
  if (!key) {
    return NextResponse.json(
      { error: { message: "Invalid or missing API key", type: "auth" } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") ?? "7d";
  const groupBy = searchParams.get("group_by") ?? "model"; // model | app | key

  // Compute date range
  const now = Date.now();
  const from = new Date(
    range === "today"
      ? new Date().setHours(0, 0, 0, 0)
      : range === "30d"
      ? now - 30 * DAY
      : range === "90d"
      ? now - 90 * DAY
      : now - 7 * DAY
  );
  const to = new Date();

  const logs = await prisma.requestLog.findMany({
    where: {
      apiKeyId: key.id,
      createdAt: { gte: from, lte: to },
    },
    select: {
      modelSlug: true,
      app: true,
      apiKeyId: true,
      status: true,
      promptTokens: true,
      completionTokens: true,
      cost: true,
      latencyMs: true,
      createdAt: true,
    },
  });

  // Total aggregates
  const total = {
    requests: logs.length,
    successfulRequests: logs.filter((l) => l.status >= 200 && l.status < 300).length,
    failedRequests: logs.filter((l) => l.status >= 400).length,
    promptTokens: logs.reduce((s, l) => s + (l.promptTokens ?? 0), 0),
    completionTokens: logs.reduce((s, l) => s + (l.completionTokens ?? 0), 0),
    tokens: 0 as number,
    spend: logs.reduce((s, l) => s + (l.cost ?? 0), 0),
    avgLatencyMs:
      logs.length > 0
        ? Math.round(logs.reduce((s, l) => s + (l.latencyMs ?? 0), 0) / logs.length)
        : 0,
  };
  total.tokens = total.promptTokens + total.completionTokens;

  // Group by breakdown
  const groupMap = new Map<
    string,
    { requests: number; tokens: number; promptTokens: number; completionTokens: number; spend: number }
  >();

  for (const l of logs) {
    const groupKey =
      groupBy === "app" ? (l.app ?? "Unknown")
      : groupBy === "key" ? (l.apiKeyId ?? "Unknown")
      : l.modelSlug;

    const entry = groupMap.get(groupKey) ?? {
      requests: 0, tokens: 0, promptTokens: 0, completionTokens: 0, spend: 0,
    };
    entry.requests++;
    entry.promptTokens += l.promptTokens ?? 0;
    entry.completionTokens += l.completionTokens ?? 0;
    entry.tokens += (l.promptTokens ?? 0) + (l.completionTokens ?? 0);
    entry.spend += l.cost ?? 0;
    groupMap.set(groupKey, entry);
  }

  const breakdown = Array.from(groupMap.entries())
    .map(([key, v]) => ({ [groupBy]: key, ...v }))
    .sort((a, b) => b.requests - a.requests);

  return NextResponse.json({
    period: {
      from: from.toISOString(),
      to: to.toISOString(),
      range,
    },
    total,
    [groupBy === "model" ? "by_model" : groupBy === "app" ? "by_app" : "by_key"]: breakdown,
  });
}
