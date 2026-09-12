import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PROVIDERS, getProvider } from "@/lib/providers";

const ALLOWED_SLUGS = ["groq", "experiential", "google", "nvidia", "ollama", "openrouter", "kiosapi", "orcarouter"];

async function ensureProviders() {
  // Remove any providers that are not in the allowed providers list
  await prisma.provider.deleteMany({
    where: {
      slug: {
        notIn: ALLOWED_SLUGS,
      },
    },
  });

  const existing = await prisma.provider.findMany({ select: { slug: true, baseUrl: true } });
  const existingSlugs = new Set(existing.map((e) => e.slug));
  const missing = PROVIDERS.filter((p) => ALLOWED_SLUGS.includes(p.slug) && !existingSlugs.has(p.slug));

  if (missing.length > 0) {
    for (const p of missing) {
      await prisma.provider.create({
        data: {
          slug: p.slug,
          name: p.name,
          icon: p.icon || "⏣",
          baseUrl: p.baseUrl || "",
          connected: false,
        },
      }).catch(() => {});
    }
  }

  // Update names, icons, and fix outdated baseUrls
  for (const def of PROVIDERS) {
    if (ALLOWED_SLUGS.includes(def.slug)) {
      const current = existing.find((p) => p.slug === def.slug);
      const isOutdatedBase =
        !current?.baseUrl ||
        current.baseUrl === "https://kiosapi.com/v1" ||
        current.baseUrl === "https://kiosapi.com/v1/";

      await prisma.provider.updateMany({
        where: { slug: def.slug },
        data: {
          name: def.name,
          icon: def.icon,
          ...(isOutdatedBase && def.baseUrl ? { baseUrl: def.baseUrl } : {}),
        },
      }).catch(() => {});
    }
  }
}

export async function GET() {
  await ensureProviders();
  const providers = await prisma.provider.findMany({
    where: {
      slug: {
        in: ALLOWED_SLUGS,
      },
    },
    include: { _count: { select: { models: true } } },
    orderBy: { name: "asc" },
  });

  let logos: Record<string, string> = {};
  try {
    const rows = (await prisma.$queryRaw<{ id: string; logoUrl: string | null }[]>`SELECT "id", "logoUrl" FROM "Provider"`) ?? [];
    for (const r of rows) if (r.logoUrl) logos[r.id] = r.logoUrl;
  } catch { /* fall back */ }

  return NextResponse.json({
    providers: providers.map((p) => {
      const def = getProvider(p.slug);
      return {
        slug: p.slug,
        name: p.name,
        icon: p.icon || def?.icon || "⏣",
        color: def?.color || "#6366f1",
        category: def?.category || "apikey",
        website: def?.website || "",
        apiKeyUrl: def?.apiKeyUrl || "",
        docUrl: def?.docUrl || def?.website || "",
        logoUrl: logos[p.id] || `/providers/${p.slug}.png`,
        connected: p.connected,
        modelCount: p._count.models,
        serviceKinds: def?.serviceKinds || ["llm"],
      };
    }),
  });
}
