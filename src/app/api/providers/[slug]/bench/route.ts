import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getProvider, openAIToAnthropic } from "@/lib/providers";

// Default probe prompt — short enough to be fast, long enough to generate >1 token
const DEFAULT_PROMPT = "Say hello in exactly 5 words.";
const MAX_TOKENS = 80;
const TIMEOUT_MS = 30_000;

/**
 * POST /api/providers/[slug]/bench
 * Body: { modelSlug: string; prompt?: string }
 *
 * Fires a single streaming chat completion to the provider and streams
 * live SSE events back to the browser:
 *
 *   event: progress  data: { phase: "connecting"|"waiting"|"streaming"|"done" }
 *   event: chunk     data: { ttftMs, tokensReceived, elapsedMs, partialText }
 *   event: result    data: { ttftMs, toksPerSec, totalTokens, latencyMs, text }
 *   event: error     data: { message }
 *
 * All timing is server-side (Date.now()) so values are not inflated by
 * browser ↔ gateway round-trip jitter.
 */
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const slug = params.slug;

  // ── 1. Load provider + API key ───────────────────────────────────────────
  const provider = await prisma.provider.findUnique({ where: { slug } });
  const def = getProvider(slug);

  if (!def) {
    return new Response(JSON.stringify({ error: "Unknown provider" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Allow no-auth providers (ollama, onerouter, etc.)
  const isNoAuth = def.authType === "none" || slug === "onerouter";
  if (!isNoAuth && (!provider || !provider.apiKey || provider.apiKey.trim().length === 0)) {
    return new Response(JSON.stringify({ error: "Save a provider API key first" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── 2. Parse request body ────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as { modelSlug?: string; prompt?: string };
  const modelSlug = body.modelSlug?.trim();
  const prompt = body.prompt?.trim() || DEFAULT_PROMPT;

  if (!modelSlug) {
    return new Response(JSON.stringify({ error: "modelSlug is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawBase = (provider?.baseUrl || def.baseUrl).replace(/\/+$/, "");
  const upstreamUrl = `${rawBase}${def.chatPath || "/chat/completions"}`;

  const apiKey = provider?.apiKey ?? "";
  const authHeaders: Record<string, string> = {
    ...def.authHeader(apiKey),
    ...(def.extraHeaders ?? {}),
  };

  const isAnthropic = slug === "anthropic";
  const requestBody = isAnthropic
    ? openAIToAnthropic({
        model: modelSlug,
        messages: [{ role: "user", content: prompt }],
        max_tokens: MAX_TOKENS,
        temperature: 0,
      })
    : {
        model: modelSlug,
        messages: [{ role: "user", content: prompt }],
        max_tokens: MAX_TOKENS,
        temperature: 0,
        stream: true,
        stream_options: { include_usage: true },
      };

  // ── 4. Build SSE response stream ─────────────────────────────────────────
  const encoder = new TextEncoder();

  const sseStream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // controller may already be closed
        }
      };

      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);

      try {
        send("progress", { phase: "connecting" });

        const t0 = Date.now();

        const upstream = await fetch(upstreamUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify(requestBody),
          signal: abort.signal,
        });

        if (!upstream.ok) {
          let detail = `HTTP ${upstream.status}`;
          try {
            const raw = await upstream.text();
            const parsed = JSON.parse(raw);
            const msg =
              parsed?.error?.message ?? parsed?.detail ?? parsed?.message ?? parsed?.error;
            if (typeof msg === "string" && msg.length > 0)
              detail = `HTTP ${upstream.status} · ${msg.slice(0, 120)}`;
          } catch { /* use status-only detail */ }
          send("error", { message: detail });
          controller.close();
          return;
        }

        send("progress", { phase: "waiting" });

        if (isAnthropic || !upstream.body) {
          // Non-streaming fallback: Anthropic / providers that don't stream
          const raw = await upstream.arrayBuffer();
          const latencyMs = Date.now() - t0;
          const parsed = JSON.parse(Buffer.from(raw).toString("utf8"));
          const text =
            (parsed?.content?.[0]?.text ?? parsed?.choices?.[0]?.message?.content ?? "").slice(0, 300);
          const totalTokens =
            parsed?.usage?.completion_tokens ??
            parsed?.usage?.output_tokens ??
            parsed?.usage?.generated_tokens ??
            (text.length > 0 ? Math.ceil(text.length / 4) : 0);
          const toksPerSec =
            totalTokens > 0 && latencyMs > 0
              ? Math.round((totalTokens / latencyMs) * 100_000) / 100
              : null;
          // For non-streaming, TTFT = full latency (content only available at the end)
          send("result", { ttftMs: latencyMs, toksPerSec, totalTokens, latencyMs, text });
          controller.close();
          return;
        }

        // ── Streaming path ─────────────────────────────────────────────────
        send("progress", { phase: "streaming" });

        const reader = upstream.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let ttftMs: number | null = null;
        let tokensReceived = 0;
        let fullText = "";

        // Send a live chunk event periodically so the browser can animate tok/s
        let lastChunkEvent = Date.now();
        const CHUNK_INTERVAL_MS = 150;

        /** Extract text content from any SSE chunk format */
        function extractDelta(evt: any): string {
          // Standard OpenAI streaming delta
          if (typeof evt?.choices?.[0]?.delta?.content === "string")
            return evt.choices[0].delta.content;
          // Some providers put text in delta.text
          if (typeof evt?.choices?.[0]?.delta?.text === "string")
            return evt.choices[0].delta.text;
          // Reasoning / thinking content (o1-style, some MiniMax variants)
          if (typeof evt?.choices?.[0]?.delta?.reasoning_content === "string")
            return evt.choices[0].delta.reasoning_content;
          // Full message (non-delta streaming — single chunk with full response)
          if (typeof evt?.choices?.[0]?.message?.content === "string")
            return evt.choices[0].message.content;
          // Older APIs / some proxies use top-level text
          if (typeof evt?.choices?.[0]?.text === "string")
            return evt.choices[0].text;
          // MiniMax native format (direct, not through a proxy)
          if (typeof evt?.reply === "string") return evt.reply;
          if (typeof evt?.delta?.content === "string") return evt.delta.content;
          return "";
        }

        /** Extract token count from any SSE usage format */
        function extractUsage(evt: any): number {
          return (
            evt?.usage?.completion_tokens ??
            evt?.usage?.output_tokens ??
            evt?.usage?.generated_tokens ??
            evt?.usage?.completionTokens ??
            0
          );
        }

        /** Process a single parsed SSE event object */
        function processEvt(evt: any) {
          const delta = extractDelta(evt);

          if (delta) {
            if (ttftMs === null) {
              ttftMs = Date.now() - t0;
              send("progress", { phase: "streaming", ttftMs });
            }
            fullText += delta;
            tokensReceived += delta.length > 0 ? 1 : 0;
          }

          const usageTokens = extractUsage(evt);
          if (usageTokens > 0) tokensReceived = usageTokens;
        }

        /** Try to parse a line as an SSE data event */
        function parseLine(line: string) {
          const text = line.startsWith("data:") ? line.slice(5).trim() : "";
          if (!text || text === "[DONE]") return;
          try {
            processEvt(JSON.parse(text));
          } catch { /* skip malformed */ }
        }

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop()!; // keep incomplete line in buffer

          for (const line of lines) parseLine(line);

          // Throttled live chunk update
          const now = Date.now();
          if (now - lastChunkEvent >= CHUNK_INTERVAL_MS) {
            lastChunkEvent = now;
            const elapsedMs = now - t0;
            const toksPerSec =
              tokensReceived > 0 && elapsedMs > 0
                ? Math.round((tokensReceived / elapsedMs) * 100_000) / 100
                : null;
            send("chunk", {
              ttftMs,
              tokensReceived,
              elapsedMs,
              toksPerSec,
              partialText: fullText.slice(0, 200),
            });
          }
        }

        // Flush any remaining incomplete line in buffer (some providers omit trailing \n)
        if (buf.trim()) parseLine(buf.trim());

        // Also try to parse the entire buffer as a single JSON blob (non-SSE streaming response)
        if (fullText === "" && buf.trim()) {
          try {
            processEvt(JSON.parse(buf.trim()));
          } catch { /* not JSON */ }
        }

        const latencyMs = Date.now() - t0;

        // Token count fallback: estimate from character count if we got text but no token count
        if (tokensReceived === 0 && fullText.length > 0) {
          tokensReceived = Math.max(1, Math.ceil(fullText.length / 4));
        }

        const toksPerSec =
          tokensReceived > 0 && latencyMs > 0
            ? Math.round((tokensReceived / latencyMs) * 100_000) / 100
            : null;

        send("result", {
          ttftMs,
          toksPerSec,
          totalTokens: tokensReceived,
          latencyMs,
          text: fullText.slice(0, 300),
        });
        send("progress", { phase: "done" });
      } catch (e: any) {
        const isTimeout = e?.name === "AbortError" || e?.name === "TimeoutError";
        send("error", { message: isTimeout ? "Request timed out (30s)" : (e?.message ?? "Upstream error") });
      } finally {
        clearTimeout(timer);
        controller.close();
      }
    },
  });

  return new Response(sseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
