import { NextRequest, NextResponse } from "next/server";
import { prisma, getDatabasePath } from "@/lib/db";
import { adminGuard } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const [providers, models, apiKeys, combos, settings, requestLogs] = await Promise.all([
      prisma.provider.findMany(),
      prisma.model.findMany(),
      prisma.apiKey.findMany(),
      prisma.combo.findMany({ include: { targets: true } }),
      prisma.setting.findMany(),
      prisma.requestLog.findMany({ take: 1000, orderBy: { createdAt: "desc" } }),
    ]);

    // Redact credentials from the export. A backup JSON gets copied around,
    // mailed to support, and dropped in cloud folders — it must not carry
    // provider keys or vaulted gateway secrets in a usable form.
    const redactedProviders = providers.map((p) => ({
      ...p,
      apiKey: "",
      hasApiKey: Boolean(p.apiKey && p.apiKey.trim().length > 0),
    }));
    const redactedApiKeys = apiKeys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      revoked: k.revoked,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      expiresAt: k.expiresAt,
      // keyHash is deliberately omitted: it is a credential-equivalent digest
      // for anyone who can guess the raw key.
      secretEnc: "",
    }));

    const backup = {
      app: "freeroute",
      version: "0.1.0",
      exportedAt: new Date().toISOString(),
      dbLocation: getDatabasePath(),
      credentialsRedacted: true,
      counts: {
        providers: providers.length,
        models: models.length,
        apiKeys: apiKeys.length,
        combos: combos.length,
        settings: settings.length,
        requestLogs: requestLogs.length,
      },
      data: {
        providers: redactedProviders,
        models,
        apiKeys: redactedApiKeys,
        combos,
        settings,
        requestLogs,
      },
    };

    const download = req.nextUrl.searchParams.get("download") === "1";
    if (download) {
      const stamp = new Date().toISOString().slice(0, 10);
      return new NextResponse(JSON.stringify(backup, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="freeroute-backup-${stamp}.json"`,
        },
      });
    }

    return NextResponse.json(backup);
  } catch (err: any) {
    console.error("[Database Export Error]", err);
    return NextResponse.json({ error: err.message || "Failed to export database" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const data = body.data || body;

    if (!data || (!data.providers && !data.combos && !data.models && !data.apiKeys)) {
      return NextResponse.json({ error: "Invalid backup file: missing required database tables" }, { status: 400 });
    }

    const counts = {
      providers: 0,
      models: 0,
      apiKeys: 0,
      combos: 0,
      settings: 0,
    };

    await prisma.$transaction(async (tx) => {
      // 1. Providers
      if (Array.isArray(data.providers)) {
        for (const p of data.providers) {
          if (!p.slug || !p.name) continue;
          await (tx.provider as any).upsert({
            where: { slug: p.slug },
            create: {
              id: p.id,
              slug: p.slug,
              name: p.name,
              icon: p.icon || "⏣",
              logoUrl: p.logoUrl || "",
              baseUrl: p.baseUrl || "",
              connected: Boolean(p.connected),
              apiKey: p.apiKey || "",
            },
            update: {
              name: p.name,
              icon: p.icon || "⏣",
              logoUrl: p.logoUrl || "",
              baseUrl: p.baseUrl || "",
              connected: Boolean(p.connected),
              apiKey: p.apiKey || "",
            },
          });
          counts.providers++;
        }
      }

      // 2. Models
      if (Array.isArray(data.models)) {
        for (const m of data.models) {
          if (!m.providerId || !m.slug) continue;
          await (tx.model as any).upsert({
            where: { providerId_slug: { providerId: m.providerId, slug: m.slug } },
            create: {
              id: m.id,
              providerId: m.providerId,
              slug: m.slug,
              displayName: m.displayName || m.slug,
              contextWindow: m.contextWindow || "128K",
              inputPrice: m.inputPrice ?? 0,
              outputPrice: m.outputPrice ?? 0,
              modalities: m.modalities || "T",
              enabled: m.enabled ?? true,
              status: m.status || "ok",
              lastError: m.lastError || "",
              latencyMs: m.latencyMs,
              httpStatus: m.httpStatus,
              ttftMs: m.ttftMs,
              toksPerSec: m.toksPerSec,
              badge: m.badge || "",
            },
            update: {
              displayName: m.displayName || m.slug,
              contextWindow: m.contextWindow || "128K",
              inputPrice: m.inputPrice ?? 0,
              outputPrice: m.outputPrice ?? 0,
              modalities: m.modalities || "T",
              enabled: m.enabled ?? true,
              status: m.status || "ok",
              lastError: m.lastError || "",
              latencyMs: m.latencyMs,
              httpStatus: m.httpStatus,
              ttftMs: m.ttftMs,
              toksPerSec: m.toksPerSec,
              badge: m.badge || "",
            },
          });
          counts.models++;
        }
      }

      // 3. API Keys
      if (Array.isArray(data.apiKeys)) {
        for (const k of data.apiKeys) {
          if (!k.keyHash || !k.name) continue;
          await (tx.apiKey as any).upsert({
            where: { keyHash: k.keyHash },
            create: {
              id: k.id,
              name: k.name,
              keyHash: k.keyHash,
              prefix: k.prefix || "",
              secretEnc: k.secretEnc || "",
              expiresAt: k.expiresAt ? new Date(k.expiresAt) : null,
              lastUsedAt: k.lastUsedAt ? new Date(k.lastUsedAt) : null,
              revoked: Boolean(k.revoked),
            },
            update: {
              name: k.name,
              prefix: k.prefix || "",
              secretEnc: k.secretEnc || "",
              expiresAt: k.expiresAt ? new Date(k.expiresAt) : null,
              lastUsedAt: k.lastUsedAt ? new Date(k.lastUsedAt) : null,
              revoked: Boolean(k.revoked),
            },
          });
          counts.apiKeys++;
        }
      }

      // 4. Combos & Targets
      if (Array.isArray(data.combos)) {
        for (const c of data.combos) {
          if (!c.name) continue;
          const combo = await tx.combo.upsert({
            where: { name: c.name },
            create: {
              id: c.id,
              name: c.name,
              strategy: c.strategy || "failover",
            },
            update: {
              strategy: c.strategy || "failover",
            },
          });
          counts.combos++;

          if (Array.isArray(c.targets)) {
            await tx.comboTarget.deleteMany({ where: { comboId: combo.id } });
            for (const t of c.targets) {
              await tx.comboTarget.create({
                data: {
                  comboId: combo.id,
                  modelId: t.modelId,
                  weight: t.weight ?? 1,
                  priority: t.priority ?? 0,
                },
              });
            }
          }
        }
      }

      // 5. Settings
      if (Array.isArray(data.settings)) {
        for (const s of data.settings) {
          if (!s.key) continue;
          await tx.setting.upsert({
            where: { key: s.key },
            create: { key: s.key, value: String(s.value) },
            update: { value: String(s.value) },
          });
          counts.settings++;
        }
      }
    });

    return NextResponse.json({
      ok: true,
      message: "Database imported and synchronized successfully",
      imported: counts,
    });
  } catch (err: any) {
    console.error("[Database Import Error]", err);
    return NextResponse.json({ error: err.message || "Failed to import database" }, { status: 500 });
  }
}
