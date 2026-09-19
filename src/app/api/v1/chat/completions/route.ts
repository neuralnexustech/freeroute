import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey, checkRateLimit } from "@/lib/auth";
import { getProvider, openAIToAnthropic, anthropicToOpenAIChunk } from "@/lib/providers";
import {
  pickTargets,
  checkFallbackError,
  setLkgpTarget,
  clearLkgpTarget,
  markTargetCooldown,
  ComboCandidate,
  ComboStrategy,
} from "@/lib/combo";
import { loadComboCursor } from "@/lib/combo-server";
import { detectApp } from "@/lib/detect-app";
import { broadcastTelemetry } from "@/lib/telemetryEvents";
import { peekStreamForFailover } from "@/lib/claude-translator";
import { compressToolResults } from "@/lib/rtk/compressToolResults";

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
  rtkTokensSaved?: number,
) {
  const log = await prisma.requestLog.create({ data });
  if (appName && appName !== "Unknown") {
    await prisma.$executeRaw`UPDATE "RequestLog" SET "app" = ${appName} WHERE "id" = ${log.id}`.catch(() => {});
  }
  if (errorMessage) {
    await prisma.$executeRaw`UPDATE "RequestLog" SET "errorMessage" = ${errorMessage} WHERE "id" = ${log.id}`.catch(() => {});
  }

  // Update persistent RTK saved tokens counter in Setting
  if (rtkTokensSaved && rtkTokensSaved > 0) {
    prisma.setting
      .findUnique({ where: { key: "rtk_total_tokens_saved" } })
      .then(async (cur) => {
        const prev = parseInt(cur?.value || "0", 10) || 0;
        await prisma.setting.upsert({
          where: { key: "rtk_total_tokens_saved" },
          update: { value: String(prev + rtkTokensSaved) },
          create: { key: "rtk_total_tokens_saved", value: String(rtkTokensSaved) },
        });
      })
      .catch(() => {});
  }

  // Immediately broadcast live event to all connected dashboard clients
  broadcastTelemetry({
    type: "request",
    timestamp: Date.now(),
    modelSlug: log.modelSlug,
    tokens: (log.promptTokens || 0) + (log.completionTokens || 0),
    status: log.status,
    cost: log.cost,
    app: appName,
    rtkTokensSaved: rtkTokensSaved ?? 0,
  });

  // Phase 5.5: Webhook notifications on request complete
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

interface SsePumpStats {
  text: string;
  promptTokens: number;
  completionTokens: number;
  ttftMs: number | null;
  totalMs: number;
}

function toSafeHeaderAscii(val: string): string {
  if (!val) return "";
  return val.replace(/→/g, "->").replace(/[^\x20-\x7E]/g, " ").trim();
}

/**
 * Pipes an upstream SSE (or buffered JSON) response to the client as an
 * OpenAI-compatible text/event-stream, while accumulating the full text and
 * token usage so the gateway can still log the request when the stream ends.
 */
function createSseResponse(opts: {
  upstream: Response;
  existingReader?: ReadableStreamDefaultReader<Uint8Array>;
  initialChunk?: Uint8Array;
  initialChunks?: Uint8Array[];
  isAnthropic: boolean;
  model: string;
  providerSlug: string;
  started: number;
  requestId: string;
  comboHops?: string;
  comboStrategy?: string;
  rtkTokensSaved?: number;
  rtkCompressedCount?: number;
  onFinish: (stats: SsePumpStats) => Promise<void> | void;
}): Response {
  const { upstream, existingReader, initialChunk, initialChunks, isAnthropic, model, providerSlug, started, requestId, comboHops, comboStrategy, rtkTokensSaved, rtkCompressedCount, onFinish } = opts;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const prependedChunks: Uint8Array[] = initialChunks
    ? [...initialChunks]
    : initialChunk
      ? [initialChunk]
      : [];
  let prependedIdx = 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let text = "";
      let ttftMs: number | null = null;
      let promptTokens = 0;
      let completionTokens = 0;
      let sseBuffer = "";
      let jsonBuffer = "";
      let closed = false;

      const sendFrame = (payload: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(payload));
      };

      const sendChunk = (deltaContent: string) => {
        if (!deltaContent || closed) return;
        sendFrame(
          `data: ${JSON.stringify({
            id: `chatcmpl-${Date.now()}`,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [{ index: 0, delta: { content: deltaContent }, finish_reason: null }],
          })}\n\n`,
        );
      };

      const handleSseEvent = (rawEvent: string) => {
        const dataLines = rawEvent
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim())
          .filter(Boolean);
        if (dataLines.length === 0) return;
        const dataStr = dataLines.join("\n");
        if (dataStr === "[DONE]") return;

        let evt: any = null;
        try {
          evt = JSON.parse(dataStr);
        } catch {
          return;
        }

        if (isAnthropic) {
          if (evt?.type === "message_start") {
            const u = evt?.message?.usage ?? {};
            promptTokens = u.input_tokens ?? u.prompt_tokens ?? promptTokens;
            return;
          }
          if (evt?.type === "message_delta") {
            const u = evt?.usage ?? {};
            completionTokens = u.output_tokens ?? completionTokens;
            return;
          }
          if (evt?.type === "message_stop") return;
          const chunk: any = anthropicToOpenAIChunk(evt, model);
          const delta = chunk?.choices?.[0]?.delta?.content;
          if (delta) {
            text += delta;
            sendChunk(delta);
          }
          return;
        }

        // OpenAI-compatible chunk passthrough (plus usage capture)
        const u = evt?.usage;
        if (u) {
          promptTokens = u.prompt_tokens ?? u.input_tokens ?? promptTokens;
          completionTokens = u.completion_tokens ?? u.output_tokens ?? completionTokens;
        }
        const delta = evt?.choices?.[0]?.delta?.content ?? evt?.choices?.[0]?.text ?? "";
        if (delta) {
          text += delta;
        }
        sendFrame(`data: ${JSON.stringify(evt)}\n\n`);
      };

      try {
        const contentType = upstream.headers.get("content-type") || "";
        const reader = existingReader || upstream.body!.getReader();
        const isSse = contentType.includes("text/event-stream");
        for (;;) {
          let value: Uint8Array | undefined;
          if (prependedIdx < prependedChunks.length) {
            value = prependedChunks[prependedIdx++];
          } else if (reader) {
            const res = await reader.read();
            if (res.done) break;
            value = res.value;
          } else {
            break;
          }
          if (!value) continue;
          if (ttftMs === null) {
            ttftMs = Date.now() - started;
            broadcastTelemetry({
              type: "request_end",
              modelSlug: model,
              timestamp: Date.now(),
              phase: "stream",
            });
          }
          const chunkText = decoder.decode(value, { stream: true });

          if (!isSse) {
            // Upstream ignored stream:true and returned a JSON body — emit it as one delta.
            jsonBuffer += chunkText;
            continue;
          }
          sseBuffer += chunkText;
          let nl: number;
          while ((nl = sseBuffer.indexOf("\n")) !== -1) {
            const line = sseBuffer.slice(0, nl).replace(/\r$/, "");
            sseBuffer = sseBuffer.slice(nl + 1);
            if (line === "") continue;
            if (line.startsWith("data:")) {
              handleSseEvent(line);
            }
          }
          // Keep only the trailing partial line in the buffer
          if (sseBuffer && !sseBuffer.includes("\n")) {
            // partial line — leave for next chunk
          }
        }
        sseBuffer += decoder.decode();
        if (sseBuffer.startsWith("data:")) handleSseEvent(sseBuffer);

        if (!isSse && jsonBuffer) {
          let data: any = null;
          try {
            data = JSON.parse(jsonBuffer);
          } catch {}
          const content = data?.choices?.[0]?.message?.content ?? "";
          const u = data?.usage ?? {};
          promptTokens = u.prompt_tokens ?? u.input_tokens ?? 0;
          completionTokens = u.completion_tokens ?? u.output_tokens ?? 0;
          if (content) {
            text += content;
            sendChunk(content);
          }
        }

        sendFrame("data: [DONE]\n\n");
        closed = true;
        controller.close();
      } catch (e: any) {
        const msg = e?.message ?? "stream interrupted";
        if (!closed) {
          sendFrame(
            `data: ${JSON.stringify({
              error: { message: msg, type: "gateway_stream_error" },
            })}\n\n`,
          );
          sendFrame("data: [DONE]\n\n");
          closed = true;
          try {
            controller.close();
          } catch {}
        }
      }

      // Rough estimates when the provider didn't report usage on the stream
      if (completionTokens === 0 && text) completionTokens = Math.ceil(text.length / 4);

      const totalMs = Date.now() - started;
      try {
        await onFinish({ text, promptTokens, completionTokens, ttftMs, totalMs });
      } catch {}
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
      "x-request-id": requestId,
      "x-model-slug": model,
      "x-provider": providerSlug,
      "x-rtk-tokens-saved": String(rtkTokensSaved ?? 0),
      "x-rtk-compressed": String(rtkCompressedCount ?? 0),
      ...(comboHops ? { "x-combo-hops": toSafeHeaderAscii(comboHops) } : {}),
      ...(comboStrategy ? { "x-combo-strategy": comboStrategy } : {}),
    },
  });
}

export async function POST(req: NextRequest) {
  const key = await validateApiKey(req.headers.get("authorization"));
  if (!key) {
    return NextResponse.json(
      { error: { message: "Invalid or missing API key", type: "auth" } },
      { status: 401 },
    );
  }

  // Per-key rate limiting (RPM) — only enforced when rpmLimit is set on the key
  const rpmLimit = (key as any).rpmLimit as number | null;
  if (rpmLimit && !checkRateLimit(key.id, rpmLimit)) {
    return NextResponse.json(
      { error: { message: `Rate limit exceeded: ${rpmLimit} requests/minute`, type: "rate_limit_error" } },
      {
        status: 429,
        headers: {
          "Retry-After": "60",
          "x-ratelimit-limit-rpm": String(rpmLimit),
        },
      },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body?.model || !body?.messages) {
    return NextResponse.json(
      { error: { message: "model and messages are required" } },
      { status: 400 },
    );
  }

  // Apply RTK (Reduce Token Konversion) to compress verbose tool outputs (git diff, grep, ls)
  const rtk = compressToolResults(body.messages);
  body.messages = rtk.messages;

  const detectedApp = detectApp(req, key.name, body);
  const wantsStream = body?.stream === true;
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  const rawModel: string = body.model;
  const cleanModelName = rawModel.startsWith("combo:")
    ? rawModel.slice(6)
    : rawModel;

  // 1. Check if model name matches a configured Combo
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
    // Resolve combo targets
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
      const def = m?.provider ? getProvider(m.provider.slug) : null;
      const isNoAuth = def?.authType === "none" || m?.provider?.slug === "onerouter";
      const isConnected = !!(m && m.enabled && m.provider.connected && (m.provider.apiKey || isNoAuth));
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
          error: {
            message: errMsg,
            type: "combo_unavailable_error",
          },
        },
        { status: 503 },
      );
    }

    let lastError = "";
    const attemptedHops: string[] = [];

    // Fallback loop across ordered combo targets
    for (let i = 0; i < orderedTargets.length; i++) {
      const target = orderedTargets[i];
      const m = modelMap.get(target.modelId);
      if (!m) continue;

      const def = getProvider(m.provider.slug);
      if (!def) continue;

      const started = Date.now();
      try {
        const rawBase = (m.provider.baseUrl || def.baseUrl || "").replace(/\/+$/, "");
        let url = `${rawBase}${def.chatPath || "/chat/completions"}`;
        if (m.provider.slug === "azure" && m.provider.baseUrl) {
          url = `${rawBase}${def.chatPath.replace("{model}", m.slug)}`;
        }

        const isAnthropic = m.provider.slug === "anthropic";
        const upstreamHeaders: Record<string, string> = {
          "content-type": "application/json",
          "x-request-id": requestId,
          ...def.authHeader(m.provider.apiKey || ""),
          ...(def.extraHeaders ?? {}),
        };

        const upstreamBody = isAnthropic
          ? openAIToAnthropic({ ...body, model: m.slug })
          : { ...body, model: m.slug };

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

        // Check if status triggers fallback (e.g. 429 rate limit, 403 quota, 5xx error)
        if (!upstreamRes.ok) {
          const errText = await upstreamRes.text().catch(() => "");
          if (upstreamRes.status === 429) {
            markTargetCooldown(m.id, 60000);
            markTargetCooldown(m.provider.slug, 60000);
            clearLkgpTarget(combo.id);
          }
          if (checkFallbackError(upstreamRes.status, errText) && i < orderedTargets.length - 1) {
            lastError = `${m.slug} (${m.provider.name}) -> HTTP ${upstreamRes.status}: ${errText.slice(0, 100)}`;
            attemptedHops.push(lastError);
            continue; // Fallback to next target
          }
          return new Response(errText, {
            status: upstreamRes.status,
            headers: { "content-type": "application/json" },
          });
        }

        // Streaming combo request: peek stream to ensure it is valid and has tokens before committing headers
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

          setLkgpTarget(combo.id, m.id);
          const servedModel = m;
          const comboHopsStr =
            attemptedHops.length > 0
              ? toSafeHeaderAscii([...attemptedHops, `${m.slug} (served)`].join(" -> "))
              : toSafeHeaderAscii(m.slug);
          return createSseResponse({
            existingReader: reader,
            initialChunks: peekResult.chunks,
            upstream: upstreamRes,
            isAnthropic,
            model: m.slug,
            providerSlug: m.provider.slug,
            started,
            requestId,
            comboHops: comboHopsStr,
            comboStrategy: combo.strategy,
            rtkTokensSaved: rtk.tokensSaved,
            rtkCompressedCount: rtk.compressedCount,
            onFinish: async (stats) => {
              const pt = stats.promptTokens;
              const ct = stats.completionTokens;
              const cost = estimateCost(servedModel, pt, ct);
              const toksPerSec =
                ct > 0 && stats.totalMs > 0
                  ? Math.round((ct / stats.totalMs) * 100000) / 100
                  : null;
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
                rtk.tokensSaved,
              );
              await prisma.apiKey.update({
                where: { id: key.id },
                data: { lastUsedAt: new Date() },
              }).catch(() => {});
              await prisma.model
                .update({
                  where: { id: servedModel.id },
                  data: {
                    status: "ok",
                    latencyMs: stats.totalMs,
                    ...(stats.ttftMs != null ? { ttftMs: stats.ttftMs } : {}),
                    ...(toksPerSec != null ? { toksPerSec } : {}),
                  },
                })
                .catch(() => {});
              await prisma.$executeRaw`UPDATE "Model" SET "httpStatus" = 200 WHERE "id" = ${servedModel.id}`.catch(
                () => {},
              );
            },
          });
        }

        const rawText = await upstreamRes.text();
        const totalMs = Date.now() - started;
        const ttftMs = Math.round(totalMs * 0.35);

        let data: any = null;
        try {
          data = JSON.parse(rawText || "null");
        } catch {
          data = null;
        }

        if ((!data || !data.choices) && i < orderedTargets.length - 1) {
          lastError = `${m.slug} (${m.provider.name}) -> non-JSON or invalid response`;
          attemptedHops.push(lastError);
          continue;
        }

        setLkgpTarget(combo.id, m.id);

        const usage = data?.usage ?? {};
        const pt = usage.prompt_tokens ?? usage.input_tokens ?? 0;
        const ct = usage.completion_tokens ?? usage.output_tokens ?? 0;
        const cost = estimateCost(m, pt, ct);
        const toksPerSec =
          ct > 0 && totalMs > 0 ? Math.round((ct / totalMs) * 100000) / 100 : null;

        // Log request with combo route and the specific model served
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
          rtk.tokensSaved,
        );
        await prisma.apiKey.update({
          where: { id: key.id },
          data: { lastUsedAt: new Date() },
        });

        // Update model benchmark metrics
        await prisma.model
          .update({
            where: { id: m.id },
            data: {
              status: "ok",
              latencyMs: totalMs,
              ...(toksPerSec != null ? { toksPerSec } : {}),
            },
          })
          .catch(() => {});
        if (ttftMs != null) {
          await prisma.$executeRaw`UPDATE "Model" SET "ttftMs" = ${ttftMs} WHERE "id" = ${m.id}`.catch(
            () => {},
          );
        }
        await prisma.$executeRaw`UPDATE "Model" SET "httpStatus" = 200 WHERE "id" = ${m.id}`.catch(
          () => {},
        );

        return NextResponse.json(data, {
          headers: {
            "x-request-id": requestId,
            "x-model-slug": m.slug,
            "x-provider": m.provider.slug,
            "x-rtk-tokens-saved": String(rtk.tokensSaved),
            "x-rtk-compressed": String(rtk.compressedCount),
            "openai-processing-ms": String(totalMs),
            ...(attemptedHops.length > 0 ? { "x-combo-hops": toSafeHeaderAscii([...attemptedHops, `${m.slug} (served)`].join(" -> ")) } : { "x-combo-hops": toSafeHeaderAscii(m.slug) }),
            "x-combo-strategy": combo.strategy,
          },
        });
      } catch (e: any) {
        lastError = `${m.slug} (${m.provider.name}) -> ${e?.message ?? "network error"}`;
        attemptedHops.push(lastError);
        continue;
      }
    }

    // All fallback targets failed
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
        error: {
          message: failoverMsg,
          type: "combo_failover_exhausted",
        },
      },
      { status: 502 },
    );
  }

  // 2. Standard single model routing
  const modelSlug: string = rawModel;
  let candidates = await prisma.model.findMany({
    where: { slug: modelSlug, enabled: true },
    include: { provider: true },
    orderBy: { provider: { name: "asc" } },
  });

  // Fuzzy match if exact slug wasn't found (e.g. "ling-3.0-flash" -> "inclusionai/ling-3.0-flash-fin:free")
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

  // Fallback to smart-coding-fallback if model not found
  if (candidates.length === 0 && (modelSlug.includes("ling") || modelSlug.includes("flash") || modelSlug.includes("smart") || modelSlug.includes("auto"))) {
    const fallbackModel = await prisma.model.findFirst({
      where: { enabled: true, provider: { connected: true, apiKey: { not: "" } } },
      include: { provider: true },
    });
    if (fallbackModel) {
      candidates = [fallbackModel];
    }
  }

  const usable = candidates.filter((m) => {
    const def = getProvider(m.provider.slug);
    const isNoAuth = def?.authType === "none" || m.provider.slug === "onerouter";
    return m.provider.connected && (Boolean(m.provider.apiKey) || isNoAuth);
  });
  if (usable.length === 0) {
    const notAvailMsg =
      candidates.length === 0
        ? `Model '${modelSlug}' not found in catalog. Connect a provider and pull models first.`
        : `Model '${modelSlug}' exists under provider '${candidates[0].provider.name}', but this provider is disconnected or missing an API key.`;
    await saveLogWithApp(
      {
        apiKeyId: key.id,
        modelSlug,
        route: "openai-compatible",
        status: 404,
      },
      detectedApp,
      notAvailMsg,
    );
    return NextResponse.json(
      {
        error: {
          message: notAvailMsg,
        },
      },
      { status: 404 },
    );
  }

  let lastError = "";
  for (const m of usable) {
    const def = getProvider(m.provider.slug);
    if (!def) continue;
    const started = Date.now();
    try {
      const rawBase = (m.provider.baseUrl || def.baseUrl || "").replace(/\/+$/, "");
      let url = `${rawBase}${def.chatPath || "/chat/completions"}`;
      if (m.provider.slug === "azure" && m.provider.baseUrl) {
        url = `${rawBase}${def.chatPath.replace("{model}", m.slug)}`;
      }

      const isAnthropic = m.provider.slug === "anthropic";
      const upstreamBody = isAnthropic
        ? openAIToAnthropic({ ...body, model: m.slug })
        : { ...body, model: m.slug };

      broadcastTelemetry({
        type: "request_start",
        modelSlug: m.slug,
        timestamp: started,
        phase: "prompt",
      });

      const upstream = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-request-id": requestId,
          ...def.authHeader(m.provider.apiKey || ""),
          ...(def.extraHeaders ?? {}),
        },
        body: JSON.stringify(upstreamBody),
      });

      if (!upstream.ok) {
        lastError = `upstream ${upstream.status}`;
        continue; // failover to next candidate
      }

      // Streaming direct-model request: pipe SSE deltas and log on finish.
      if (wantsStream) {
        const servedModel = m;
        return createSseResponse({
          upstream,
          isAnthropic: m.provider.slug === "anthropic",
          model: m.slug,
          providerSlug: m.provider.slug,
          started,
          requestId,
          rtkTokensSaved: rtk.tokensSaved,
          rtkCompressedCount: rtk.compressedCount,
          onFinish: async (stats) => {
            const pt = stats.promptTokens;
            const ct = stats.completionTokens;
            const cost = estimateCost(servedModel, pt, ct);
            const toksPerSec =
              ct > 0 && stats.totalMs > 0
                ? Math.round((ct / stats.totalMs) * 100000) / 100
                : null;
            await saveLogWithApp(
              {
                apiKeyId: key.id,
                modelId: servedModel.id,
                providerId: servedModel.provider.id,
                modelSlug: m.slug,
                route: "openai-compatible",
                status: 200,
                promptTokens: pt,
                completionTokens: ct,
                cost,
                latencyMs: stats.totalMs,
              },
              detectedApp,
              undefined,
              key,
              rtk.tokensSaved,
            );
            await prisma.apiKey.update({
              where: { id: key.id },
              data: { lastUsedAt: new Date() },
            }).catch(() => {});
            await prisma.model
              .update({
                where: { id: servedModel.id },
                data: {
                  status: "ok",
                  latencyMs: stats.totalMs,
                  ...(stats.ttftMs != null ? { ttftMs: stats.ttftMs } : {}),
                  ...(toksPerSec != null ? { toksPerSec } : {}),
                },
              })
              .catch(() => {});
            await prisma.$executeRaw`UPDATE "Model" SET "ttftMs" = ${stats.ttftMs} WHERE "id" = ${servedModel.id}`.catch(
              () => {},
            );
            await prisma.$executeRaw`UPDATE "Model" SET "httpStatus" = 200 WHERE "id" = ${servedModel.id}`.catch(
              () => {},
            );
          },
        });
      }

      const latencyMs = Date.now() - started;
      let ttftMs: number | null = null;
      let rawText = "";
      try {
        if (upstream.body) {
          const reader = upstream.body.getReader();
          const decoder = new TextDecoder();
          let first = true;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (first) {
              ttftMs = Date.now() - started;
              first = false;
            }
            rawText += decoder.decode(value, { stream: true });
          }
          rawText += decoder.decode();
        } else {
          rawText = await upstream.text();
          ttftMs = Date.now() - started;
        }
      } catch {
        rawText = await upstream.text().catch(() => "");
      }
      const totalMs = Date.now() - started;
      let data: any = null;
      try {
        data = JSON.parse(rawText || "null");
      } catch {
        data = null;
      }
      const usage = data?.usage ?? {};
      const pt = usage.prompt_tokens ?? usage.input_tokens ?? 0;
      const ct = usage.completion_tokens ?? usage.output_tokens ?? 0;
      const cost = estimateCost(m, pt, ct);
      const toksPerSec =
        ct > 0 && totalMs > 0 ? Math.round((ct / totalMs) * 100000) / 100 : null;

      await saveLogWithApp(
        {
          apiKeyId: key.id,
          modelId: m.id,
          providerId: m.provider.id,
          modelSlug: m.slug,
          route: "openai-compatible",
          status: 200,
          promptTokens: pt,
          completionTokens: ct,
          cost,
          latencyMs: totalMs,
        },
        detectedApp,
        undefined,
        key,
        rtk.tokensSaved,
      );
      await prisma.apiKey.update({
        where: { id: key.id },
        data: { lastUsedAt: new Date() },
      });

      await prisma.model
        .update({
          where: { id: m.id },
          data: {
            status: "ok",
            latencyMs: totalMs,
            ...(toksPerSec != null ? { toksPerSec } : {}),
          },
        })
        .catch(() => {});
      if (ttftMs != null) {
        await prisma.$executeRaw`UPDATE "Model" SET "ttftMs" = ${ttftMs} WHERE "id" = ${m.id}`.catch(
          () => {},
        );
      }
      await prisma.$executeRaw`UPDATE "Model" SET "httpStatus" = 200 WHERE "id" = ${m.id}`.catch(
        () => {},
      );

      return NextResponse.json(data, {
        headers: {
          "x-request-id": requestId,
          "x-model-slug": m.slug,
          "x-provider": m.provider.slug,
          "x-rtk-tokens-saved": String(rtk.tokensSaved),
          "x-rtk-compressed": String(rtk.compressedCount),
          "openai-processing-ms": String(totalMs),
        },
      });
    } catch (e: any) {
      lastError = e?.message ?? "upstream error";
      continue;
    }
  }

  await saveLogWithApp(
    {
      apiKeyId: key.id,
      modelSlug,
      route: "openai-compatible",
      status: 502,
    },
    detectedApp,
    lastError ? `All upstreams failed (${lastError})` : "All upstream connections failed.",
    key,
  );
  return NextResponse.json(
    { error: { message: `All upstreams failed (${lastError})` } },
    { status: 502 },
  );
}
