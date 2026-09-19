import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProvider } from "@/lib/providers";
import { broadcastTelemetry } from "@/lib/telemetryEvents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: NextRequest) {
  const models = await prisma.model.findMany({
    where: { enabled: true },
    include: {
      provider: {
        select: { slug: true, name: true, apiKey: true, baseUrl: true, connected: true },
      },
    },
  });

  const enabled = models.filter((m) => {
    const def = getProvider(m.provider.slug);
    const isNoAuth = def?.authType === "none" || m.provider.slug === "onerouter";
    return m.provider.connected && (Boolean(m.provider.apiKey) || isNoAuth);
  });

  const results = await Promise.allSettled(
    enabled.map(async (m) => {
      const def = getProvider(m.provider.slug);
      if (!def) return { slug: m.slug, status: "skip" };

      const rawBase = (m.provider.baseUrl || def.baseUrl || "").replace(/\/+$/, "");
      const chatPath = def.chatPath.startsWith("/") ? def.chatPath : `/${def.chatPath}`;
      const url =
        m.provider.slug === "azure" && m.provider.baseUrl
          ? `${rawBase}${chatPath.replace("{model}", m.slug)}`
          : `${rawBase}${chatPath}`;

      const started = Date.now();
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...def.authHeader(m.provider.apiKey || ""),
          },
          body: JSON.stringify({
            model: m.slug,
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 1,
            stream: false,
          }),
          signal: AbortSignal.timeout(12_000),
        });
        const latencyMs = Date.now() - started;
        const newStatus = res.ok ? "ok" : "fail";
        await prisma.model.update({
          where: { id: m.id },
          data: { status: newStatus, latencyMs, httpStatus: res.status },
        });
        broadcastTelemetry({ type: "model", modelSlug: m.slug, timestamp: Date.now() });
        return { slug: m.slug, status: newStatus, latencyMs, httpStatus: res.status };
      } catch (e: any) {
        await prisma.model.update({
          where: { id: m.id },
          data: { status: "fail", httpStatus: 0 },
        });
        return { slug: m.slug, status: "fail", error: e?.message };
      }
    })
  );

  const summary = results.map((r) => (r.status === "fulfilled" ? r.value : { status: "error" }));
  const ok = summary.filter((s: any) => s.status === "ok").length;
  const fail = summary.filter((s: any) => s.status === "fail").length;

  return NextResponse.json({
    checked: enabled.length,
    ok,
    fail,
    results: summary,
  });
}
