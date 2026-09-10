import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";
import { getProvider, openAIToAnthropic, anthropicToOpenAIChunk } from "@/lib/providers";
import {
  pickTargets,
  checkFallbackError,
  ComboCandidate,
  ComboStrategy,
} from "@/lib/combo";
import { detectApp } from "@/lib/detect-app";
import { broadcastTelemetry } from "@/lib/telemetryEvents";

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
) {
  const log = await prisma.requestLog.create({ data });
  if (appName && appName !== "Unknown") {
    await prisma.$executeRaw`UPDATE "RequestLog" SET "app" = ${appName} WHERE "id" = ${log.id}`.catch(() => {});
  }
  if (errorMessage) {
    await prisma.$executeRaw`UPDATE "RequestLog" SET "errorMessage" = ${errorMessage} WHERE "id" = ${log.id}`.catch(() => {});
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
  });
  return log;
}

interface SsePumpStats {
  text: string;
  promptTokens: number;
  completionTokens: number;
  ttftMs: number | null;
  totalMs: number;
}

/**
 * Pipes an upstream SSE (or buffered JSON) response to the client as an
 * OpenAI-compatible text/event-stream, while accumulating the full text and
 * token usage so the gateway can still log the request when the stream ends.
 */
function createSseResponse(opts: {
  upstream: Response;
  isAnthropic: boolean;
  model: string;
  started: number;
  onFinish: (stats: SsePumpStats) => Promise<void> | void;
}): Response {
  const { upstream, isAnthropic, model, started, onFinish } = opts;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

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
        const reader = upstream.body!.getReader();
        const isSse = contentType.includes("text/event-stream");

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (ttftMs === null) ttftMs = Date.now() - started;
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

  const body = await req.json().catch(() => null);
  if (!body?.model || !body?.messages) {
    return NextResponse.json(
      { error: { message: "model and messages are required" } },
      { status: 400 },
    );
  }

  const detectedApp = detectApp(req, key.name, body);
  const wantsStream = body?.stream === true;

  const rawModel: string = body.model;
  const cleanModelName = rawModel.startsWith("combo:")
    ? rawModel.slice(6)
    : rawModel;

  // 1. Check if model name matches a configured Combo
  const combo = await prisma.combo.findFirst({
    where: {
      OR: [{ name: rawModel }, { name: cleanModelName }],
    },
    include: {
      targets: {
        orderBy: { priority: "asc" },
      },
    },
  });

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
        const url =
          m.provider.slug === "azure" && m.provider.baseUrl
            ? `${m.provider.baseUrl}${def.chatPath.replace("{model}", m.slug)}`
            : `${def.baseUrl || m.provider.baseUrl}${def.chatPath}`;

        const isAnthropic = m.provider.slug === "anthropic";
        const upstreamHeaders: Record<string, string> = {
          "content-type": "application/json",
          ...def.authHeader(m.provider.apiKey),
        };

        const upstreamBody = isAnthropic
          ? openAIToAnthropic({ ...body, model: m.slug })
          : { ...body, model: m.slug };

        const upstreamRes = await fetch(url, {
          method: "POST",
          headers: upstreamHeaders,
          body: JSON.stringify(upstreamBody),
        });

        // Check if status triggers fallback (e.g. 429 rate limit, 403 quota, 5xx error)
        if (!upstreamRes.ok) {
          const errText = await upstreamRes.text().catch(() => "");
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

        // Streaming combo request: commit to this target and pipe SSE deltas.
        if (wantsStream) {
          const servedModel = m;
          return createSseResponse({
            upstream: upstreamRes,
            isAnthropic,
            model: m.slug,
            started,
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

        return NextResponse.json(data);
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

  const usable = candidates.filter((m) => m.provider.connected && m.provider.apiKey);
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
      const url =
        m.provider.slug === "azure" && m.provider.baseUrl
          ? `${m.provider.baseUrl}${def.chatPath.replace("{model}", m.slug)}`
          : `${def.baseUrl || m.provider.baseUrl}${def.chatPath}`;

      const isAnthropic = m.provider.slug === "anthropic";
      const upstreamBody = isAnthropic
        ? openAIToAnthropic({ ...body, model: m.slug })
        : { ...body, model: m.slug };

      const upstream = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...def.authHeader(m.provider.apiKey),
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
          started,
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
                modelSlug,
                route: "openai-compatible",
                status: 200,
                promptTokens: pt,
                completionTokens: ct,
                cost,
                latencyMs: stats.totalMs,
              },
              detectedApp,
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
          modelSlug,
          route: "openai-compatible",
          status: 200,
          promptTokens: pt,
          completionTokens: ct,
          cost,
          latencyMs: totalMs,
        },
        detectedApp,
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

      return NextResponse.json(data);
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
  );
  return NextResponse.json(
    { error: { message: `All upstreams failed (${lastError})` } },
    { status: 502 },
  );
}
