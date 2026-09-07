import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProvider } from "@/lib/providers";

function maskApiKey(key?: string | null): string {
  if (!key) return "";
  const trimmed = key.trim();
  if (trimmed.length >= 24) {
    return `${trimmed.slice(0, 7)}.............${trimmed.slice(-16)}`;
  }
  if (trimmed.length > 8) {
    return `${trimmed.slice(0, 3)}.............${trimmed.slice(-4)}`;
  }
  return trimmed ? `${trimmed.slice(0, 2)}........` : "";
}

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  let provider = await prisma.provider.findUnique({ where: { slug: params.slug } });
  const def = getProvider(params.slug);
  
  if (!provider && def) {
    provider = await prisma.provider.create({
      data: {
        slug: def.slug,
        name: def.name,
        icon: def.icon || "⏣",
        baseUrl: def.baseUrl || "",
        connected: false,
      },
    });
  }

  if (!provider) return NextResponse.json({ error: "Unknown provider" }, { status: 404 });

  let logoUrl = "";
  try {
    const rows = (await prisma.$queryRaw<{ logoUrl: string | null }[]>`SELECT "logoUrl" FROM "Provider" WHERE "id" = ${provider.id} LIMIT 1`) ?? [];
    logoUrl = rows[0]?.logoUrl ?? "";
  } catch { /* fall back */ }

  const models = await prisma.model.findMany({ where: { providerId: provider.id }, orderBy: { slug: "asc" } });

  let bench: Record<string, { ttftMs: number | null; httpStatus: number | null }> = {};
  try {
    const rows = (await prisma.$queryRaw<{ id: string; ttftMs: number | null; httpStatus: number | null }[]>`SELECT "id", "ttftMs", "httpStatus" FROM "Model" WHERE "providerId" = ${provider.id}`) ?? [];
    for (const r of rows) bench[r.id] = { ttftMs: r.ttftMs, httpStatus: r.httpStatus };
  } catch { /* fall back */ }

  const hasKey = Boolean(provider.apiKey && provider.apiKey.trim().length > 0) || def?.authType === "none";
  const maskedKey = maskApiKey(provider.apiKey);

  return NextResponse.json({
    provider: {
      ...provider,
      apiKey: provider.apiKey || "",
      maskedKey,
      hasKey,
      logoUrl: logoUrl || `/providers/${provider.slug}.png`,
      website: def?.website || "",
      docUrl: def?.docUrl || def?.website || "",
      apiKeyUrl: def?.apiKeyUrl || "",
      category: def?.category || "apikey",
      authType: def?.authType || "bearer",
      color: def?.color || "#6366f1",
      serviceKinds: def?.serviceKinds || ["llm"],
      thinkingConfig: def?.thinkingConfig || null,
      providerSpecificFields: def?.providerSpecificFields || [],
      defaultModels: def?.defaultModels || [],
    },
    models: models.map((m) => ({ ...m, ttftMs: bench[m.id]?.ttftMs ?? null, httpStatus: bench[m.id]?.httpStatus ?? null })),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { slug: string } }) {
  const { apiKey, logoUrl, baseUrl } = await req.json().catch(() => ({}));
  if (typeof logoUrl === "string") {
    await prisma.$executeRaw`UPDATE "Provider" SET "logoUrl" = ${logoUrl.slice(0, 500)} WHERE "slug" = ${params.slug}`.catch(() => {});
  }

  const updateData: Record<string, any> = {};
  if (typeof apiKey === "string") {
    const trimmed = apiKey.trim();
    updateData.apiKey = trimmed;
    updateData.connected = trimmed.length > 0;
  }
  if (typeof baseUrl === "string") {
    updateData.baseUrl = baseUrl.trim();
  }

  if (Object.keys(updateData).length === 0 && typeof logoUrl === "string") {
    return NextResponse.json({ ok: true });
  }

  const provider = await prisma.provider.update({
    where: { slug: params.slug },
    data: updateData,
  });

  return NextResponse.json({
    ok: true,
    connected: provider.connected,
    hasKey: provider.connected,
    apiKey: provider.apiKey || "",
    maskedKey: maskApiKey(provider.apiKey),
    baseUrl: provider.baseUrl,
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { slug: string } }) {
  const provider = await prisma.provider.update({
    where: { slug: params.slug },
    data: { apiKey: "", connected: false },
  });
  return NextResponse.json({
    ok: true,
    connected: false,
    hasKey: false,
    maskedKey: "",
  });
}

