import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getProvider, openAIToAnthropic } from "@/lib/providers";

const RETRIES = 3;
const TIMEOUT_MS = 30000;
const CONCURRENCY = 10;
const PROMPT = "Say hello in exactly 5 words.";
const MAX_TOKENS = 64;

type Verdict = "ok" | "fail" | "slow";

interface ProbeResult {
  verdict: Verdict;
  latencyMs: number | null;
  httpStatus: number | null;
  ttftMs: number | null;
  toksPerSec: number | null;
  detail: string;
  tokens: number;
  response: string;
  attempts: number;
}

const noResult = (verdict: Verdict, detail: string, attempts: number, httpStatus: number | null = null): ProbeResult =>
  ({ verdict, latencyMs: null, httpStatus, ttftMs: null, toksPerSec: null, detail, tokens: 0, response: "", attempts });

// Streaming probe: measures real TTFT (time to first content chunk) plus total
// latency, tokens and tok/s. Anthropic uses its native non-streaming format
// (TTFT stays null there).
async function probe(
  baseUrl: string,
  headers: Record<string, string>,
  body: unknown,
  streaming: boolean,
): Promise<ProbeResult> {
  let lastErr = "";
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const started = Date.now();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });

      if (!r.ok) {
        const raw = await r.arrayBuffer().catch(() => null);
        if (r.status === 404 || r.status === 410) {
          return noResult("fail", `HTTP ${r.status}`, attempt + 1, r.status);
        }
        let detail = `HTTP ${r.status}`;
        try {
          const txt = Buffer.from(raw ?? new ArrayBuffer(0)).toString("utf8", 0, 400);
          const parsed = JSON.parse(txt);
          const msg = parsed?.detail ?? parsed?.title ?? parsed?.error?.message ?? parsed?.message ?? parsed?.error;
          if (typeof msg === "string" && msg.length > 0) detail = `HTTP ${r.status} · ${msg.slice(0, 100)}`;
        } catch { /* keep status-only */ }
        lastErr = detail;
        if (attempt === RETRIES - 1) {
          return noResult("fail", lastErr || "unknown", RETRIES, r.status);
        }
      } else if (!streaming || !r.body) {
        // Non-streaming path (Anthropic): total latency only, no TTFT.
        const raw = await r.arrayBuffer().catch(() => null);
        const latencyMs = Date.now() - started;
        let toksPerSec: number | null = null;
        let tokens = 0;
        let response = "";
        try {
          const parsed = JSON.parse(Buffer.from(raw ?? new ArrayBuffer(0)).toString("utf8"));
          tokens = parsed?.usage?.completion_tokens ?? parsed?.usage?.output_tokens ?? 0;
          response = JSON.stringify(parsed?.content ?? parsed?.choices ?? "").slice(0, 150);
          if (tokens > 0 && latencyMs > 0) toksPerSec = Math.round((tokens / latencyMs) * 100000) / 100;
        } catch { /* no usage data */ }
        return { verdict: "ok", latencyMs, httpStatus: r.status, ttftMs: null, toksPerSec, detail: `${r.status}`, tokens, response, attempts: attempt + 1 };
      } else {
        // Streaming path: walk SSE chunks, stamp TTFT on first content.
        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let ttftMs: number | null = null;
        let tokens = 0;
        let response = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const chunks = buf.split("\n");
          buf = chunks.pop()!;
          for (const line of chunks) {
            const text = line.startsWith("data:") ? line.slice(5).trim() : "";
            if (!text || text === "[DONE]") continue;
            let evt: any;
            try { evt = JSON.parse(text); } catch { continue; }
            const delta = evt?.choices?.[0]?.delta?.content ?? evt?.choices?.[0]?.message?.content ?? "";
            if (delta && ttftMs == null) ttftMs = Date.now() - started;
            if (delta && response.length < 150) response += delta;
            const u = evt?.usage;
            if (u?.completion_tokens) tokens = u.completion_tokens;
          }
        }
        const latencyMs = Date.now() - started;
        const toksPerSec = tokens > 0 && latencyMs > 0 ? Math.round((tokens / latencyMs) * 100000) / 100 : null;
        return { verdict: "ok", latencyMs, httpStatus: r.status, ttftMs, toksPerSec, detail: `${r.status}`, tokens, response: response.slice(0, 150), attempts: attempt + 1 };
      }
    } catch (e: any) {
      const timedOut = e?.name === "AbortError" || e?.name === "TimeoutError";
      lastErr = timedOut ? "timeout" : e?.name ?? "error";
      if (timedOut) {
        return noResult("slow", "timeout", attempt + 1);
      }
    } finally {
      clearTimeout(t);
    }
    if (attempt < RETRIES - 1) await new Promise((r) => setTimeout(r, 1500));
  }
  return noResult("fail", lastErr || "unknown", RETRIES);
}

// POST { ids?: string[] } — SSE stream: pushes each model result as it completes.
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const provider = await prisma.provider.findUnique({ where: { slug: params.slug } });
  if (!provider || !provider.apiKey) {
    return new Response(JSON.stringify({ error: "Save a provider API key first" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const def = getProvider(provider.slug);
  if (!def) return new Response(JSON.stringify({ error: "Unknown provider" }), { status: 404, headers: { "Content-Type": "application/json" } });

  const { ids } = (await req.json().catch(() => ({}))) as { ids?: string[] };
  const models = await prisma.model.findMany({
    where: {
      providerId: provider.id,
      enabled: true,
      ...(Array.isArray(ids) && ids.length > 0 ? { id: { in: ids } } : {}),
    },
    orderBy: { slug: "asc" },
  });
  if (models.length === 0) {
    return new Response(JSON.stringify({ error: "No enabled models to test" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const url =
    provider.slug === "azure" && provider.baseUrl
      ? `${provider.baseUrl}${def.chatPath}`
      : `${def.baseUrl || provider.baseUrl}${def.chatPath}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send("start", { total: models.length, concurrency: CONCURRENCY, retries: RETRIES });

      const allResults: (ProbeResult & { id: string; slug: string })[] = [];
      let done = 0;

      for (let i = 0; i < models.length; i += CONCURRENCY) {
        const batch = models.slice(i, i + CONCURRENCY);
        const promises = batch.map(async (m) => {
          const chatUrl = provider.slug === "azure" ? url.replace("{model}", m.slug) : url;
          const isAnthropic = provider.slug === "anthropic";
          const body = isAnthropic
            ? openAIToAnthropic({ model: m.slug, messages: [{ role: "user", content: PROMPT }], max_tokens: MAX_TOKENS, temperature: 0 })
            : { model: m.slug, messages: [{ role: "user", content: PROMPT }], max_tokens: MAX_TOKENS, temperature: 0, stream: true, stream_options: { include_usage: true } };
          const probeResult = await probe(chatUrl, def.authHeader(provider.apiKey), body, !isAnthropic);
          if (probeResult.verdict !== "slow") {
            await prisma.model.update({
              where: { id: m.id },
              data: {
                status: probeResult.verdict,
                latencyMs: probeResult.latencyMs,
                lastError: probeResult.verdict === "fail" ? probeResult.detail : "",
                ...(probeResult.toksPerSec != null ? { toksPerSec: probeResult.toksPerSec } : {}),
              },
            }).catch(() => {});
            // Raw SQL: works even before `prisma generate` picks up the new
            // columns (generated client lags until dev restarts).
            if (probeResult.ttftMs != null) {
              await prisma.$executeRaw`UPDATE "Model" SET "ttftMs" = ${probeResult.ttftMs} WHERE "id" = ${m.id}`.catch(() => {});
            }
            if (probeResult.httpStatus != null) {
              await prisma.$executeRaw`UPDATE "Model" SET "httpStatus" = ${probeResult.httpStatus} WHERE "id" = ${m.id}`.catch(() => {});
            }
          }
          done++;
          const result = { ...probeResult, id: m.id, slug: m.slug };
          allResults.push(result);
          send("result", { done, total: models.length, ...result });
        });
        await Promise.all(promises);
      }

      const working = allResults.filter((r) => r.verdict === "ok").length;
      const failing = allResults.filter((r) => r.verdict === "fail").length;
      const slow = allResults.filter((r) => r.verdict === "slow").length;
      send("done", { ok: true, tested: allResults.length, working, failing, slow });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
