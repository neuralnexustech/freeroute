import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const limit = Math.min(500, Number(new URL(req.url).searchParams.get("limit") ?? 100));
    const logs = await prisma.requestLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        provider: {
          select: {
            id: true,
            slug: true,
            name: true,
            icon: true,
          },
        },
        model: {
          select: {
            id: true,
            slug: true,
            displayName: true,
            latencyMs: true,
          },
        },
        apiKey: {
          select: {
            id: true,
            name: true,
            prefix: true,
          },
        },
      },
    });

    // Query app and errorMessage columns from RequestLog table
    const ids = logs.map((l) => l.id);
    const appMap: Record<string, string> = {};
    const errMap: Record<string, string> = {};
    if (ids.length > 0) {
      try {
        const rawRows = await prisma.$queryRawUnsafe<Array<{ id: string; app: string | null; errorMessage: string | null }>>(
          `SELECT id, app, errorMessage FROM "RequestLog" WHERE id IN (${ids.map((id) => `'${id.replace(/'/g, "''")}'`).join(",")})`
        );
        for (const row of rawRows) {
          if (row.app) appMap[row.id] = row.app;
          if (row.errorMessage) errMap[row.id] = row.errorMessage;
        }
      } catch (err: any) {
        console.error("raw app/error query error:", err?.message);
      }
    }

    const enrichedLogs = logs.map((log) => {
      let errReason = errMap[log.id] || "";
      if (!errReason && log.status === 404) {
        errReason = log.modelSlug?.includes("gemini") || log.modelSlug?.includes("google")
          ? `Model '${log.modelSlug}' cannot be routed: Google AI Studio provider is not connected or missing an API key.`
          : `Model '${log.modelSlug}' was not found in catalog or its upstream provider is disconnected / missing an API key.`;
      } else if (!errReason && log.status === 502) {
        errReason = "All upstream connection targets failed or timed out.";
      } else if (!errReason && log.status === 503) {
        errReason = "No active, connected models available in the configured combo route.";
      }

      return {
        ...log,
        app: appMap[log.id] || (log.apiKey?.name && log.apiKey.name !== "Default Key" ? log.apiKey.name : "Unknown"),
        errorMessage: errReason || null,
      };
    });

    return NextResponse.json({ logs: enrichedLogs });
  } catch (e: any) {
    console.error("logs GET error:", e?.message);
    return NextResponse.json({ logs: [], error: e?.message }, { status: 500 });
  }
}
