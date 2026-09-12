import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProvider } from "@/lib/providers";
import { enrich, getCatalog } from "@/lib/openrouter-meta";

function fmtContext(tokens: number): string {
  if (tokens >= 1000000) return `${Math.round(tokens / 1000000)}M`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
  return `${tokens}`;
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const provider = await prisma.provider.findUnique({ where: { slug: params.slug } });
  const def = getProvider(params.slug);
  if (!provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  const forceDefaults = req.nextUrl?.searchParams?.get("defaults") === "1";

  const isNoAuth = def?.authType === "none";
  if (!isNoAuth && !forceDefaults && (!provider.apiKey || provider.apiKey.trim().length === 0)) {
    return NextResponse.json({ error: "Save a provider API key first" }, { status: 400 });
  }

  let list: any[] = [];

  if (!forceDefaults && def?.modelsPath) {
    const rawBase = (provider.baseUrl?.trim() || def?.baseUrl || "").replace(/\/+$/, "");
    const modelsPath = def.modelsPath.startsWith("/") ? def.modelsPath : `/${def.modelsPath}`;
    let url = `${rawBase}${modelsPath}`;
    if (provider.slug === "google") {
      url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(provider.apiKey)}&pageSize=1000`;
    }

    try {
      let upstream = await fetch(url, { headers: { ...def.authHeader(provider.apiKey) }, signal: AbortSignal.timeout(10000) });
      if (!upstream.ok && provider.slug === "google") {
        url = "https://generativelanguage.googleapis.com/v1beta/openai/models";
        upstream = await fetch(url, { headers: { Authorization: `Bearer ${provider.apiKey}` }, signal: AbortSignal.timeout(10000) });
      }

      if (upstream.ok) {
        const data = await upstream.json().catch(() => null);
        list = data?.data ?? data?.models ?? data ?? [];
      } else {
        const errJson = await upstream.json().catch(() => null);
        const errMsg =
          errJson?.error?.message ||
          errJson?.message ||
          (typeof errJson?.error === "string" ? errJson.error : "") ||
          `HTTP ${upstream.status} ${upstream.statusText}`;

        return NextResponse.json(
          {
            error: `${def?.name || provider.name} error (${upstream.status}): ${errMsg}`,
            upstreamStatus: upstream.status,
            upstreamError: errJson,
            canSeedDefaults: Boolean(def?.defaultModels && def.defaultModels.length > 0),
          },
          { status: 400 }
        );
      }
    } catch (err: any) {
      return NextResponse.json(
        {
          error: `Network error connecting to ${def?.name || provider.name} (${url}): ${err?.message || "Unreachable or timed out"}`,
          canSeedDefaults: Boolean(def?.defaultModels && def.defaultModels.length > 0),
        },
        { status: 504 }
      );
    }
  }

  // Fallback to default catalog models if list is empty or forceDefaults requested
  if (!Array.isArray(list) || list.length === 0) {
    if (def?.defaultModels && def.defaultModels.length > 0) {
      list = def.defaultModels.map((m) => ({ id: m.id, displayName: m.name }));
    } else {
      return NextResponse.json({ error: "No models available from provider endpoint or catalog" }, { status: 502 });
    }
  }

  let count = 0;
  const slugs: string[] = [];
  for (const m of list.slice(0, 300)) {
    const rawId: string = m.id ?? m.name ?? m.slug ?? "";
    if (!rawId || typeof rawId !== "string") continue;
    const slug = rawId.replace(/^models\//, "").trim();
    if (!slug) continue;

    // For Google Gemini, skip non-chat models
    if (provider.slug === "google" && Array.isArray(m.supportedGenerationMethods)) {
      const methods: string[] = m.supportedGenerationMethods;
      const isChat = methods.includes("generateContent") || methods.includes("generateAnswer");
      if (!isChat) continue;
    }

    const displayName = m.displayName && typeof m.displayName === "string" ? m.displayName : slug;
    const initialContext = m.inputTokenLimit && typeof m.inputTokenLimit === "number" ? fmtContext(m.inputTokenLimit) : "128K";

    await prisma.model.upsert({
      where: { providerId_slug: { providerId: provider.id, slug } },
      update: { displayName, contextWindow: initialContext, enabled: true },
      create: { providerId: provider.id, slug, displayName, contextWindow: initialContext, enabled: true, status: "pending" },
    });
    slugs.push(slug);
    count++;
  }

  // Enrich with full metadata from OpenRouter public catalog
  let enriched = 0;
  try {
    const catalog = await getCatalog();
    for (const slug of slugs) {
      const meta = enrich(slug, catalog);
      if (!meta) continue;
      await prisma.model.update({
        where: { providerId_slug: { providerId: provider.id, slug } },
        data: {
          displayName: meta.displayName,
          contextWindow: meta.contextWindow,
          inputPrice: meta.inputPrice,
          outputPrice: meta.outputPrice,
          modalities: meta.modalities,
        },
      }).catch(() => {});
      enriched++;
    }
  } catch { /* catalog unreachable */ }

  return NextResponse.json({ ok: true, count, enriched });
}

