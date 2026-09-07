import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProvider, openAIToAnthropic } from "@/lib/providers";
import {
  pickTargets,
  checkFallbackError,
  ComboCandidate,
  ComboStrategy,
} from "@/lib/combo";

export async function POST(
  req: NextRequest,
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

    if (combo.targets.length === 0) {
      return NextResponse.json(
        { error: "Combo has no targets configured" },
        { status: 400 },
      );
    }

    const modelIds = combo.targets.map((t) => t.modelId);
    const models = await prisma.model.findMany({
      where: {
        OR: [{ id: { in: modelIds } }, { slug: { in: modelIds } }],
      },
      include: { provider: true },
    });
    const modelMap = new Map();
    for (const m of models) {
      modelMap.set(m.id, m);
      modelMap.set(m.slug, m);
    }

    const candidates: ComboCandidate[] = combo.targets.map((t) => {
      const m = modelMap.get(t.modelId);
      const isConnected = !!(m && m.enabled && m.provider.connected && m.provider.apiKey);
      return {
        modelId: t.modelId,
        modelSlug: m?.slug ?? "",
        providerSlug: m?.provider?.slug ?? "",
        providerName: m?.provider?.name ?? "",
        weight: t.weight,
        priority: t.priority,
        latencyMs: m?.latencyMs ?? null,
        inputPrice: m?.inputPrice ?? 0,
        outputPrice: m?.outputPrice ?? 0,
        enabled: isConnected,
      };
    });

    const ordered = pickTargets(combo.id, combo.strategy as ComboStrategy, candidates);
    if (ordered.length === 0) {
      return NextResponse.json(
        {
          error:
            "No active connected targets available in this combo. Please ensure targets are enabled and provider API keys are saved.",
        },
        { status: 400 },
      );
    }

    const testBody = {
      messages: [{ role: "user", content: "Reply in under 10 words: System test OK." }],
      temperature: 0.2,
      max_tokens: 30,
    };

    const overallStart = Date.now();
    const hops: Array<{
      hop: number;
      modelSlug: string;
      providerName: string;
      providerSlug: string;
      status: number;
      success: boolean;
      error?: string;
      reply?: string;
      latencyMs: number;
    }> = [];

    let successfulResponse: any = null;
    let servingTarget: ComboCandidate | null = null;

    for (let i = 0; i < ordered.length; i++) {
      const candidate = ordered[i];
      const m = modelMap.get(candidate.modelId);
      if (!m) continue;

      const def = getProvider(m.provider.slug);
      if (!def) {
        hops.push({
          hop: i + 1,
          modelSlug: candidate.modelSlug,
          providerName: candidate.providerName || m.provider.name,
          providerSlug: candidate.providerSlug,
          status: 400,
          success: false,
          error: "Provider definition not found",
          latencyMs: 0,
        });
        continue;
      }

      const hopStart = Date.now();
      try {
        const url =
          m.provider.slug === "azure" && m.provider.baseUrl
            ? `${m.provider.baseUrl}${def.chatPath.replace("{model}", m.slug)}`
            : `${def.baseUrl || m.provider.baseUrl}${def.chatPath}`;

        const isAnthropic = m.provider.slug === "anthropic";
        const upstreamBody = isAnthropic
          ? openAIToAnthropic({ ...testBody, model: m.slug })
          : { ...testBody, model: m.slug };

        const upstream = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...def.authHeader(m.provider.apiKey),
          },
          body: JSON.stringify(upstreamBody),
          signal: AbortSignal.timeout(15000),
        });

        const hopDuration = Date.now() - hopStart;

        if (!upstream.ok) {
          let errText = "";
          try {
            const errJson = await upstream.json();
            errText = errJson?.error?.message || JSON.stringify(errJson);
          } catch {
            errText = await upstream.text().catch(() => "");
          }
          const { reason } = checkFallbackError(upstream.status, errText);

          hops.push({
            hop: i + 1,
            modelSlug: candidate.modelSlug,
            providerName: candidate.providerName || m.provider.name,
            providerSlug: candidate.providerSlug,
            status: upstream.status,
            success: false,
            error: `${reason} - ${errText.slice(0, 100)}`,
            latencyMs: hopDuration,
          });
          continue; // seamlessly failover to next target
        }

        const data = await upstream.json().catch(() => null);
        const replyText =
          data?.choices?.[0]?.message?.content ||
          data?.content?.[0]?.text ||
          JSON.stringify(data).slice(0, 100);

        hops.push({
          hop: i + 1,
          modelSlug: candidate.modelSlug,
          providerName: candidate.providerName || m.provider.name,
          providerSlug: candidate.providerSlug,
          status: 200,
          success: true,
          reply: replyText,
          latencyMs: hopDuration,
        });

        successfulResponse = data;
        servingTarget = candidate;
        break; // Successfully handled!
      } catch (err: any) {
        const hopDuration = Date.now() - hopStart;
        hops.push({
          hop: i + 1,
          modelSlug: candidate.modelSlug,
          providerName: candidate.providerName || m.provider.name,
          providerSlug: candidate.providerSlug,
          status: 500,
          success: false,
          error: err?.message || "Network request failed",
          latencyMs: hopDuration,
        });
      }
    }

    const totalDurationMs = Date.now() - overallStart;

    if (!successfulResponse) {
      return NextResponse.json({
        success: false,
        message: "All fallback targets in combo failed",
        hops,
        totalDurationMs,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Request succeeded on Hop #${hops.length} via ${servingTarget?.modelSlug} (${servingTarget?.providerName})`,
      servingTarget,
      hops,
      totalDurationMs,
      responseSample: successfulResponse,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal test error" },
      { status: 500 },
    );
  }
}
