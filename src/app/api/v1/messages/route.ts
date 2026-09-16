import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey, checkRateLimit } from "@/lib/auth";
import { getProvider } from "@/lib/providers";
import {
  pickTargets,
  checkFallbackError,
  ComboCandidate,
  ComboStrategy,
} from "@/lib/combo";
import { loadComboCursor } from "@/lib/combo-server";
import { detectApp } from "@/lib/detect-app";
import { broadcastTelemetry } from "@/lib/telemetryEvents";
import {
  stripModelContextMarker,
  claudeToOpenAI,
  openAIToClaudeResponse,
  createAnthropicSseResponse,
  peekStreamForFailover,
} from "@/lib/claude-translator";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

function toSafeHeaderAscii(val: string): string {
  if (!val) return "";
  return val.replace(/→/g, "->").replace(/[^\x20-\x7E]/g, " ").trim();
}

function estimateCost(
  model: { inputPrice: number; outputPrice: number } | null,
  pt: number,
  ct: number,
) {
  if (!model) return 0;
  return (pt / 1_000_000) * model.inputPrice + (ct / 1_000_000) * model.outputPrice;
}

async function saveLogWithApp(
  data: Parameters<typeof prisma.requestLog.create>[0]["data"],
  appName: string,
  errorMessage?: string,
  keyObj?: any,
) {
  const log = await prisma.requestLog.create({ data });
  if (appName && appName !== "Unknown") {
    await prisma.$executeRaw`UPDATE "RequestLog" SET "app" = ${appName} WHERE "id" = ${log.id}`.catch(() => {});
  }
  if (errorMessage) {
    await prisma.$executeRaw`UPDATE "RequestLog" SET "errorMessage" = ${errorMessage} WHERE "id" = ${log.id}`.catch(() => {});
  }
  broadcastTelemetry({
    type: "request",
    timestamp: Date.now(),
    modelSlug: log.modelSlug,
    tokens: (log.promptTokens || 0) + (log.completionTokens || 0),
    status: log.status,
    cost: log.cost,
    app: appName,
  });

  const webhookUrl = keyObj?.webhookUrl;
  if (webhookUrl && typeof webhookUrl === "string" && webhookUrl.startsWith("http")) {
    fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-freeroute-event": "request.complete",
      },
      body: JSON.stringify({
        event: "request.complete",
        requestId: log.id,
        model: log.modelSlug,
        tokens: (log.promptTokens || 0) + (log.completionTokens || 0),
        cost: log.cost,
        latencyMs: log.latencyMs,
        status: log.status,
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  }

  return log;
}

export async function POST(req: NextRequest) {
  // Validate API key from header or query
  const rawKey =
    req.headers.get("x-api-key") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    req.nextUrl.searchParams.get("key");

  if (!rawKey) {
    return NextResponse.json(
      {
        type: "error",
        error: {
          type: "authentication_error",
          message: "Missing API key. Provide via 'x-api-key' or 'Authorization: Bearer <key>'.",
        },
      },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const key = await validateApiKey(rawKey);
  if (!key) {
    return NextResponse.json(
      {
        type: "error",
        error: {
          type: "authentication_error",
          message: "Invalid or inactive API key.",
        },
      },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  // Rate limiting
  const rpmLimit = (key as any).rpmLimit ?? 0;
  if (rpmLimit > 0 && !checkRateLimit(key.id, rpmLimit)) {
    return NextResponse.json(
      {
        type: "error",
        error: {
          type: "rate_limit_error",
          message: `Rate limit exceeded: ${rpmLimit} requests/minute`,
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": "60",
          "x-ratelimit-limit-rpm": String(rpmLimit),
          ...CORS_HEADERS,
        },
      },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || !body.model || (!body.messages && !body.prompt)) {
    return NextResponse.json(
      {
        type: "error",
        error: {
          type: "invalid_request_error",
          message: "'model' and 'messages' are required.",
        },
      },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Strip 1M context markers e.g. "powerfull[1m]" -> "powerfull"
  const { model: strippedModel } = stripModelContextMarker(body.model);
  const rawModel = strippedModel;
  const cleanModelName = rawModel.startsWith("combo:") ? rawModel.slice(6) : rawModel;

  const detectedApp = detectApp(req, key.name, body);
  const wantsStream = body.stream === true;
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  // 1. Check if model is a Combo
  let combo = await prisma.combo.findFirst({
    where: {
      OR: [{ name: rawModel }, { name: cleanModelName }],
    },
    include: {
      targets: {
        orderBy: { priority: "asc" },
      },
    },
  });

  // If not matching a combo directly, fallback to configured Claude default combo / powerfull / first combo
  if (!combo) {
    const isClaudeSlot =
      rawModel.includes("claude") ||
      rawModel.includes("sonnet") ||
      rawModel.includes("opus") ||
      rawModel.includes("haiku") ||
      rawModel.startsWith("cc/");

    if (isClaudeSlot) {
      const defaultSetting = await prisma.setting
        .findUnique({
          where: { key: "claude_default_combo" },
        })
        .catch(() => null);

      if (defaultSetting?.value) {
        combo = await prisma.combo.findFirst({
          where: { OR: [{ name: defaultSetting.value }, { id: defaultSetting.value }] },
          include: { targets: { orderBy: { priority: "asc" } } },
        });
      }

      if (!combo) {
        combo =
          (await prisma.combo.findFirst({
            where: { OR: [{ name: "powerfull" }, { name: "default" }] },
            include: { targets: { orderBy: { priority: "asc" } } },
          })) ||
          (await prisma.combo.findFirst({
            include: { targets: { orderBy: { priority: "asc" } } },
          }));
      }
    }
  }

  if (combo) {
    const targetModelIds = combo.targets.map((t) => t.modelId);
    const models = await prisma.model.findMany({
      where: {
        OR: [{ id: { in: targetModelIds } }, { slug: { in: targetModelIds } }],
        enabled: true,
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

    await loadComboCursor(combo.id);
    const orderedTargets = pickTargets(
      combo.id,
      combo.strategy as ComboStrategy,
      candidates,
    );

    if (orderedTargets.length === 0) {
      const errMsg = `No active, connected models available in combo '${combo.name}'. Please connect providers with valid API keys.`;
      await saveLogWithApp(
        {
          apiKeyId: key.id,
          modelSlug: rawModel,
          route: `combo:${combo.name}`,
          status: 503,
        },
        detectedApp,
        errMsg,
      );
      return NextResponse.json(
        {
          type: "error",
          error: {
            type: "unavailable_error",
            message: errMsg,
          },
        },
        { status: 503, headers: CORS_HEADERS },
      );
    }

    let lastError = "";
    const attemptedHops: string[] = [];

    for (let i = 0; i < orderedTargets.length; i++) {
      const target = orderedTargets[i];
      const m = modelMap.get(target.modelId);
      if (!m) continue;

      const def = getProvider(m.provider.slug);
      if (!def) continue;

      const started = Date.now();
      try {
        const rawBase = (m.provider.baseUrl || def.baseUrl || "").replace(/\/+$/, "");
        const isAnthropicNative = m.provider.slug === "anthropic";

        // Determine request URL
        const chatPath = def.chatPath.startsWith("/") ? def.chatPath : `/${def.chatPath}`;
        const url =
          m.provider.slug === "azure" && m.provider.baseUrl
            ? `${rawBase}${chatPath.replace("{model}", m.slug)}`
            : `${rawBase}${chatPath}`;

        const upstreamHeaders: Record<string, string> = {
          "content-type": "application/json",
          "x-request-id": requestId,
          ...def.authHeader(m.provider.apiKey),
        };

        // If target is Anthropic native, send original Anthropic payload.
        // Otherwise, translate Anthropic payload -> OpenAI chat payload.
        const upstreamBody = isAnthropicNative
          ? { ...body, model: m.slug }
          : claudeToOpenAI({ ...body, model: m.slug });

        broadcastTelemetry({
          type: "request_start",
          modelSlug: m.slug,
          timestamp: started,
          phase: "prompt",
        });

        const upstreamRes = await fetch(url, {
          method: "POST",
          headers: upstreamHeaders,
          body: JSON.stringify(upstreamBody),
        });

        // Failover check
        if (!upstreamRes.ok) {
          const errText = await upstreamRes.text().catch(() => "");
          if (checkFallbackError(upstreamRes.status, errText) && i < orderedTargets.length - 1) {
            lastError = `${m.slug} (${m.provider.name}) -> HTTP ${upstreamRes.status}: ${errText.slice(0, 100)}`;
            attemptedHops.push(lastError);
            continue;
          }
          return new Response(errText, {
            status: upstreamRes.status,
            headers: { "content-type": "application/json", ...CORS_HEADERS },
          });
        }

        // Streaming combo response: peek stream to ensure it is valid and has tokens before committing headers
        if (wantsStream) {
          const reader = upstreamRes.body?.getReader();
          if (!reader) {
            if (i < orderedTargets.length - 1) {
              lastError = `${m.slug} (${m.provider.name}) -> empty stream body`;
              attemptedHops.push(lastError);
              continue;
            }
          }

          const peekResult = reader
            ? await peekStreamForFailover(reader)
            : { isFailed: true, chunks: [], reason: "no stream reader" };

          if (peekResult.isFailed && i < orderedTargets.length - 1) {
            lastError = `${m.slug} (${m.provider.name}) -> ${peekResult.reason || "empty/invalid stream"}`;
            attemptedHops.push(lastError);
            continue;
          }

          const servedModel = m;
          const comboHopsStr =
            attemptedHops.length > 0
              ? toSafeHeaderAscii([...attemptedHops, `${m.slug} (served)`].join(" -> "))
              : toSafeHeaderAscii(m.slug);

          return createAnthropicSseResponse({
            existingReader: reader,
            initialChunks: peekResult.chunks,
            isAnthropicUpstream: isAnthropicNative,
            model: rawModel,
            providerSlug: m.provider.slug,
            started,
            requestId,
            comboHops: comboHopsStr,
            comboStrategy: combo.strategy,
            onFinish: async (stats) => {
              const pt = stats.promptTokens;
              const ct = stats.completionTokens;
              const cost = estimateCost(servedModel, pt, ct);
              await saveLogWithApp(
                {
                  apiKeyId: key.id,
                  modelId: servedModel.id,
                  providerId: servedModel.provider.id,
                  modelSlug: servedModel.slug,
                  route: `combo:${combo.name}`,
                  status: 200,
                  promptTokens: pt,
                  completionTokens: ct,
                  cost,
                  latencyMs: stats.totalMs,
                },
                detectedApp,
                undefined,
                key,
              );
              await prisma.apiKey.update({
                where: { id: key.id },
                data: { lastUsedAt: new Date() },
              }).catch(() => {});
              await prisma.model.update({
                where: { id: servedModel.id },
                data: {
                  status: "ok",
                  latencyMs: stats.totalMs,
                  ...(stats.ttftMs != null ? { ttftMs: stats.ttftMs } : {}),
                },
              }).catch(() => {});
            },
          });
        }

        // Non-streaming response
        const rawText = await upstreamRes.text();
        const totalMs = Date.now() - started;

        let upstreamData: any = null;
        try {
          upstreamData = JSON.parse(rawText || "null");
        } catch {
          upstreamData = null;
        }

        // Validate payload
        const isValid = isAnthropicNative
          ? upstreamData && (upstreamData.type === "message" || Array.isArray(upstreamData.content))
          : upstreamData && upstreamData.choices;

        if (!isValid && i < orderedTargets.length - 1) {
          lastError = `${m.slug} (${m.provider.name}) -> non-JSON or invalid response`;
          attemptedHops.push(lastError);
          continue;
        }

        const claudeResp = isAnthropicNative
          ? upstreamData
          : openAIToClaudeResponse(upstreamData, rawModel);

        const pt = claudeResp.usage?.input_tokens ?? 0;
        const ct = claudeResp.usage?.output_tokens ?? 0;
        const cost = estimateCost(m, pt, ct);

        await saveLogWithApp(
          {
            apiKeyId: key.id,
            modelId: m.id,
            providerId: m.provider.id,
            modelSlug: m.slug,
            route: `combo:${combo.name}`,
            status: 200,
            promptTokens: pt,
            completionTokens: ct,
            cost,
            latencyMs: totalMs,
          },
          detectedApp,
          undefined,
          key,
        );

        await prisma.apiKey.update({
          where: { id: key.id },
          data: { lastUsedAt: new Date() },
        }).catch(() => {});

        return NextResponse.json(claudeResp, {
          headers: {
            "x-request-id": requestId,
            "x-model-slug": m.slug,
            "x-provider": m.provider.slug,
            ...(attemptedHops.length > 0
              ? { "x-combo-hops": toSafeHeaderAscii([...attemptedHops, `${m.slug} (served)`].join(" -> ")) }
              : { "x-combo-hops": toSafeHeaderAscii(m.slug) }),
            "x-combo-strategy": combo.strategy,
            ...CORS_HEADERS,
          },
        });
      } catch (e: any) {
        lastError = `${m.slug} (${m.provider.name}) -> ${e?.message ?? "network error"}`;
        attemptedHops.push(lastError);
        continue;
      }
    }

    // All combo targets failed
    const failoverMsg = `All fallback targets in combo '${combo.name}' failed. Chain: ${attemptedHops.join("; ")}`;
    await saveLogWithApp(
      {
        apiKeyId: key.id,
        modelSlug: rawModel,
        route: `combo:${combo.name}`,
        status: 502,
      },
      detectedApp,
      failoverMsg,
      key,
    );
    return NextResponse.json(
      {
        type: "error",
        error: {
          type: "combo_failover_exhausted",
          message: failoverMsg,
        },
      },
      { status: 502, headers: CORS_HEADERS },
    );
  }

  // 2. Direct single model routing
  const modelSlug = rawModel;
  let candidates = await prisma.model.findMany({
    where: { slug: modelSlug, enabled: true },
    include: { provider: true },
    orderBy: { provider: { name: "asc" } },
  });

  if (candidates.length === 0) {
    candidates = await prisma.model.findMany({
      where: {
        enabled: true,
        OR: [
          { slug: { contains: modelSlug } },
          { displayName: { contains: modelSlug } },
        ],
      },
      include: { provider: true },
      orderBy: { provider: { name: "asc" } },
    });
  }

  const usable = candidates.filter((m) => m.provider.connected && m.provider.apiKey);
  if (usable.length === 0) {
    const notAvailMsg =
      candidates.length === 0
        ? `Model '${modelSlug}' not found in Freeroute. Check connected providers or create a combo named '${modelSlug}'.`
        : `Model '${modelSlug}' exists under '${candidates[0].provider.name}', but this provider is disconnected or missing an API key.`;

    await saveLogWithApp(
      {
        apiKeyId: key.id,
        modelSlug,
        route: "anthropic-messages",
        status: 404,
      },
      detectedApp,
      notAvailMsg,
    );

    return NextResponse.json(
      {
        type: "error",
        error: {
          type: "not_found_error",
          message: notAvailMsg,
        },
      },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  for (const m of usable) {
    const def = getProvider(m.provider.slug);
    if (!def) continue;

    const started = Date.now();
    try {
      const rawBase = (m.provider.baseUrl || def.baseUrl || "").replace(/\/+$/, "");
      const isAnthropicNative = m.provider.slug === "anthropic";

      const chatPath = def.chatPath.startsWith("/") ? def.chatPath : `/${def.chatPath}`;
      const url =
        m.provider.slug === "azure" && m.provider.baseUrl
          ? `${rawBase}${chatPath.replace("{model}", m.slug)}`
          : `${rawBase}${chatPath}`;

      const upstreamHeaders: Record<string, string> = {
        "content-type": "application/json",
        "x-request-id": requestId,
        ...def.authHeader(m.provider.apiKey),
      };

      const upstreamBody = isAnthropicNative
        ? { ...body, model: m.slug }
        : claudeToOpenAI({ ...body, model: m.slug });

      broadcastTelemetry({
        type: "request_start",
        modelSlug: m.slug,
        timestamp: started,
        phase: "prompt",
      });

      const upstreamRes = await fetch(url, {
        method: "POST",
        headers: upstreamHeaders,
        body: JSON.stringify(upstreamBody),
      });

      if (!upstreamRes.ok) {
        continue;
      }

      if (wantsStream) {
        const servedModel = m;
        return createAnthropicSseResponse({
          upstream: upstreamRes,
          isAnthropicUpstream: isAnthropicNative,
          model: rawModel,
          providerSlug: m.provider.slug,
          started,
          requestId,
          onFinish: async (stats) => {
            const pt = stats.promptTokens;
            const ct = stats.completionTokens;
            const cost = estimateCost(servedModel, pt, ct);
            await saveLogWithApp(
              {
                apiKeyId: key.id,
                modelId: servedModel.id,
                providerId: servedModel.provider.id,
                modelSlug: servedModel.slug,
                route: "anthropic-messages",
                status: 200,
                promptTokens: pt,
                completionTokens: ct,
                cost,
                latencyMs: stats.totalMs,
              },
              detectedApp,
              undefined,
              key,
            );
            await prisma.apiKey.update({
              where: { id: key.id },
              data: { lastUsedAt: new Date() },
            }).catch(() => {});
          },
        });
      }

      const rawText = await upstreamRes.text();
      const totalMs = Date.now() - started;
      const upstreamData = JSON.parse(rawText || "{}");
      const claudeResp = isAnthropicNative
        ? upstreamData
        : openAIToClaudeResponse(upstreamData, rawModel);

      const pt = claudeResp.usage?.input_tokens ?? 0;
      const ct = claudeResp.usage?.output_tokens ?? 0;
      const cost = estimateCost(m, pt, ct);

      await saveLogWithApp(
        {
          apiKeyId: key.id,
          modelId: m.id,
          providerId: m.provider.id,
          modelSlug: m.slug,
          route: "anthropic-messages",
          status: 200,
          promptTokens: pt,
          completionTokens: ct,
          cost,
          latencyMs: totalMs,
        },
        detectedApp,
        undefined,
        key,
      );

      return NextResponse.json(claudeResp, {
        headers: {
          "x-request-id": requestId,
          "x-model-slug": m.slug,
          "x-provider": m.provider.slug,
          ...CORS_HEADERS,
        },
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json(
    {
      type: "error",
      error: {
        type: "api_error",
        message: `Failed to fulfill request for model '${modelSlug}'.`,
      },
    },
    { status: 502, headers: CORS_HEADERS },
  );
}
