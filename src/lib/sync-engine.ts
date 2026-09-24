import { prisma } from "@/lib/db";
import { getProvider } from "@/lib/providers";
import { enrich, getCatalog } from "@/lib/openrouter-meta";
import { broadcastTelemetry } from "@/lib/telemetryEvents";

function fmtContext(tokens: number): string {
  if (tokens >= 1000000) return `${Math.round(tokens / 1000000)}M`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
  return `${tokens}`;
}

export interface SyncProviderResult {
  slug: string;
  name: string;
  ok: boolean;
  count: number;
  enriched: number;
  error?: string;
}

export interface TestModelResult {
  id: string;
  slug: string;
  provider: string;
  ok: boolean;
  latencyMs: number;
  status: "ok" | "fail";
  httpStatus?: number;
  error?: string;
}

export interface SyncDetailItem {
  text: string;
  time: string;
  type: "info" | "success" | "warning" | "error";
}

export interface SyncProgressState {
  active: boolean;
  stage: "idle" | "starting" | "pulling" | "testing" | "complete" | "error";
  provider?: string;
  current: number;
  total: number;
  message: string;
  pulledCount: number;
  testedCount: number;
  passedCount: number;
  failedCount: number;
  startedAt?: number;
  completedAt?: number;
  details: SyncDetailItem[];
}

let syncProgress: SyncProgressState = {
  active: false,
  stage: "idle",
  current: 0,
  total: 0,
  message: "Idle",
  pulledCount: 0,
  testedCount: 0,
  passedCount: 0,
  failedCount: 0,
  details: [],
};

export function getSyncProgress(): SyncProgressState {
  return syncProgress;
}

function notifyProgress(
  update: Partial<SyncProgressState>,
  logDetail?: { text: string; type: "info" | "success" | "warning" | "error" }
) {
  const details = logDetail
    ? [
        {
          text: logDetail.text,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          type: logDetail.type,
        },
        ...syncProgress.details.slice(0, 24),
      ]
    : syncProgress.details;

  syncProgress = {
    ...syncProgress,
    ...update,
    details,
  };

  broadcastTelemetry({
    type: "sync_progress",
    timestamp: Date.now(),
    sync: syncProgress,
  });
}

export interface SyncAllResult {
  ok: boolean;
  providersChecked: number;
  totalModelsPulled: number;
  modelsTested: number;
  passed: number;
  failed: number;
  providers: SyncProviderResult[];
  tests: TestModelResult[];
}

/**
 * Pull models for a specific connected provider and enrich with catalog specs
 */
export async function pullProviderModels(slug: string): Promise<SyncProviderResult> {
  const provider = await prisma.provider.findUnique({ where: { slug } });
  const def = getProvider(slug);
  if (!provider || !def) {
    return { slug, name: slug, ok: false, count: 0, enriched: 0, error: "Provider not found" };
  }

  const isNoAuth = def.authType === "none" || slug === "onerouter";
  if (!isNoAuth && (!provider.apiKey || provider.apiKey.trim().length === 0)) {
    return { slug, name: def.name, ok: false, count: 0, enriched: 0, error: "Missing API key" };
  }

  if (slug === "cloudflare-ai") {
    const rawBase = provider.baseUrl?.trim() || "";
    if (rawBase.includes("{account_id}") || !rawBase.includes("/accounts/")) {
      return { slug, name: def.name, ok: false, count: 0, enriched: 0, error: "Cloudflare Account ID not configured" };
    }
  }

  let list: any[] = [];
  let url = "";

  if (def.modelsPath) {
    const rawBase = (provider.baseUrl?.trim() || def.baseUrl || "").replace(/\/+$/, "");
    const modelsPath = def.modelsPath.startsWith("/") ? def.modelsPath : `/${def.modelsPath}`;
    url = `${rawBase}${modelsPath}`;

    if (slug === "google") {
      url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(provider.apiKey)}&pageSize=1000`;
    } else if (slug === "cloudflare-ai") {
      const match = rawBase.match(/accounts\/([a-f0-9]+)/i);
      const accId = match ? match[1] : "";
      if (accId) {
        url = `https://api.cloudflare.com/client/v4/accounts/${accId}/ai/models/search?per_page=1000`;
      } else {
        url = rawBase.replace(/\/ai\/v1\/?$/, "") + "/ai/models/search?per_page=1000";
      }
    }

    const reqHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FreeRoute/0.7.16",
      "Accept": "application/json, text/plain, */*",
      ...def.authHeader(provider.apiKey),
      ...(def.extraHeaders ?? {}),
    };

    try {
      let upstream = await fetch(url, { headers: reqHeaders, signal: AbortSignal.timeout(20_000) });
      if (!upstream.ok && slug === "google") {
        url = "https://generativelanguage.googleapis.com/v1beta/openai/models";
        upstream = await fetch(url, {
          headers: { ...reqHeaders, Authorization: `Bearer ${provider.apiKey}` },
          signal: AbortSignal.timeout(20_000),
        });
      }

      if (upstream.ok) {
        const data = await upstream.json().catch(() => null);
        list = data?.data ?? data?.result ?? data?.models ?? data ?? [];
      } else {
        const errJson = await upstream.json().catch(() => null);
        const errMsg =
          errJson?.error?.message ||
          errJson?.message ||
          (typeof errJson?.error === "string" ? errJson.error : "") ||
          `HTTP ${upstream.status} ${upstream.statusText}`;
        return { slug, name: def.name, ok: false, count: 0, enriched: 0, error: errMsg };
      }
    } catch (err: any) {
      return { slug, name: def.name, ok: false, count: 0, enriched: 0, error: err?.message || "Connection timeout" };
    }
  }

  if (!Array.isArray(list) || list.length === 0) {
    return { slug, name: def.name, ok: false, count: 0, enriched: 0, error: "No models returned by upstream" };
  }

  let count = 0;
  const slugs: string[] = [];

  for (const m of list.slice(0, 800)) {
    const rawId: string = slug === "cloudflare-ai"
      ? (m.name || m.id || "")
      : (m.id ?? m.name ?? m.slug ?? "");
    if (!rawId || typeof rawId !== "string") continue;
    const modelSlug = rawId.replace(/^models\//, "").trim();
    if (!modelSlug) continue;

    // Skip non-chat models for Google Gemini
    if (slug === "google" && Array.isArray(m.supportedGenerationMethods)) {
      const methods: string[] = m.supportedGenerationMethods;
      const isChat = methods.includes("generateContent") || methods.includes("generateAnswer");
      if (!isChat) continue;
    }

    // Skip non-text/chat tasks for Cloudflare
    if (slug === "cloudflare-ai" && m.task?.name) {
      const validTasks = ["Text Generation", "Image-to-Text", "Translation"];
      if (!validTasks.includes(m.task.name)) continue;
    }

    let displayName = m.displayName && typeof m.displayName === "string"
      ? m.displayName
      : (typeof m.name === "string" && m.name ? m.name : modelSlug);

    if (slug === "cloudflare-ai" && (!m.displayName || m.displayName === m.name)) {
      const parts = modelSlug.replace(/^@cf\//, "").split("/");
      if (parts.length >= 2) {
        const org = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        const namePart = parts.slice(1).join("/").replace(/-/g, " ");
        displayName = `${org}: ${namePart}`;
      }
    }

    let initialContext = "128K";
    if (typeof m.context_length === "number" && m.context_length > 0) {
      initialContext = fmtContext(m.context_length);
    } else if (m.inputTokenLimit && typeof m.inputTokenLimit === "number") {
      initialContext = fmtContext(m.inputTokenLimit);
    } else if (Array.isArray(m.properties)) {
      const cwProp = m.properties.find((p: any) => p?.property_id === "context_window")?.value;
      const cwNum = cwProp ? parseInt(cwProp, 10) : 0;
      if (cwNum > 0) initialContext = fmtContext(cwNum);
    }

    let inputPrice = 0;
    let outputPrice = 0;
    if (m.pricing) {
      const pIn = parseFloat(m.pricing.prompt);
      const pOut = parseFloat(m.pricing.completion);
      if (!isNaN(pIn) && pIn > 0) inputPrice = pIn >= 0.01 ? pIn : parseFloat((pIn * 1_000_000).toFixed(4));
      if (!isNaN(pOut) && pOut > 0) outputPrice = pOut >= 0.01 ? pOut : parseFloat((pOut * 1_000_000).toFixed(4));
    } else if (Array.isArray(m.properties)) {
      const priceProp = m.properties.find((p: any) => p?.property_id === "price")?.value;
      if (Array.isArray(priceProp)) {
        for (const p of priceProp) {
          if (typeof p?.unit === "string" && p.unit.includes("input") && typeof p?.price === "number") {
            inputPrice = p.price;
          }
          if (typeof p?.unit === "string" && p.unit.includes("output") && typeof p?.price === "number") {
            outputPrice = p.price;
          }
        }
      }
    }

    await prisma.model.upsert({
      where: { providerId_slug: { providerId: provider.id, slug: modelSlug } },
      update: {
        displayName,
        contextWindow: initialContext,
        enabled: true,
        ...(inputPrice > 0 ? { inputPrice } : {}),
        ...(outputPrice > 0 ? { outputPrice } : {}),
      },
      create: {
        providerId: provider.id,
        slug: modelSlug,
        displayName,
        contextWindow: initialContext,
        enabled: true,
        status: "pending",
        inputPrice,
        outputPrice,
      },
    });
    slugs.push(modelSlug);
    count++;
  }

  // Enrich with public metadata catalog (pricing, modalities, context)
  let enriched = 0;
  try {
    const catalog = await getCatalog();
    for (const s of slugs) {
      const meta = enrich(s, catalog);
      if (!meta) continue;
      await prisma.model.update({
        where: { providerId_slug: { providerId: provider.id, slug: s } },
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
  } catch {
    /* catalog optional */
  }

  return { slug, name: def.name, ok: true, count, enriched };
}

/**
 * Test a single model with a minimal 1-token ping to measure real-time latency and status
 */
export async function testSingleModel(modelId: string): Promise<TestModelResult> {
  const model = await prisma.model.findUnique({
    where: { id: modelId },
    include: {
      provider: {
        select: { slug: true, name: true, apiKey: true, baseUrl: true, connected: true },
      },
    },
  });

  if (!model) {
    return { id: modelId, slug: "unknown", provider: "unknown", ok: false, latencyMs: 0, status: "fail", error: "Model not found" };
  }

  const def = getProvider(model.provider.slug);
  if (!def) {
    return { id: model.id, slug: model.slug, provider: model.provider.name, ok: false, latencyMs: 0, status: "fail", error: "Provider definition missing" };
  }

  const rawBase = (model.provider.baseUrl || def.baseUrl || "").replace(/\/+$/, "");
  const chatPath = def.chatPath.startsWith("/") ? def.chatPath : `/${def.chatPath}`;
  const url =
    model.provider.slug === "azure" && model.provider.baseUrl
      ? `${rawBase}${chatPath.replace("{model}", model.slug)}`
      : `${rawBase}${chatPath}`;

  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...def.authHeader(model.provider.apiKey || ""),
        ...(def.extraHeaders ?? {}),
      },
      body: JSON.stringify({
        model: model.slug,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        stream: false,
      }),
      signal: AbortSignal.timeout(12_000),
    });

    const latencyMs = Date.now() - started;
    const ok = res.ok;
    const newStatus = ok ? "ok" : "fail";
    let lastError = "";

    if (!ok) {
      const errText = await res.text().catch(() => "");
      lastError = `HTTP ${res.status}: ${errText.slice(0, 120)}`;
    }

    await prisma.model.update({
      where: { id: model.id },
      data: {
        status: newStatus,
        latencyMs,
        httpStatus: res.status,
        lastError,
      },
    });

    broadcastTelemetry({
      type: "model",
      modelSlug: model.slug,
      timestamp: Date.now(),
      status: res.status,
    });

    return {
      id: model.id,
      slug: model.slug,
      provider: model.provider.name,
      ok,
      latencyMs,
      status: newStatus,
      httpStatus: res.status,
      error: ok ? undefined : lastError,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - started;
    const errorMsg = err?.message || "Connection timeout (12s)";

    await prisma.model.update({
      where: { id: model.id },
      data: {
        status: "fail",
        httpStatus: 0,
        lastError: errorMsg,
      },
    });

    return {
      id: model.id,
      slug: model.slug,
      provider: model.provider.name,
      ok: false,
      latencyMs,
      status: "fail",
      httpStatus: 0,
      error: errorMsg,
    };
  }
}

/**
 * Sync all connected providers (pull latest models) and optionally test health
 */
export async function syncAllProviders(opts?: {
  testHealth?: boolean;
  isStartup?: boolean;
  maxTestPerProvider?: number;
}): Promise<SyncAllResult> {
  const { testHealth = true, maxTestPerProvider = 3 } = opts ?? {};

  // Find all providers marked connected
  const connectedProviders = await prisma.provider.findMany({
    where: { connected: true },
  });

  const validProviders = connectedProviders.filter((p) => {
    const def = getProvider(p.slug);
    const isNoAuth = def?.authType === "none" || p.slug === "onerouter";
    return Boolean(p.apiKey && p.apiKey.trim().length > 0) || isNoAuth;
  });

  const providerResults: SyncProviderResult[] = [];
  let totalModelsPulled = 0;

  notifyProgress(
    {
      active: true,
      stage: "starting",
      current: 0,
      total: validProviders.length,
      message: `Connecting to ${validProviders.length} active providers…`,
      pulledCount: 0,
      testedCount: 0,
      passedCount: 0,
      failedCount: 0,
      startedAt: Date.now(),
      completedAt: undefined,
    },
    { text: `Discovered ${validProviders.length} active connected providers`, type: "info" }
  );

  // Pull models for each connected provider
  for (let i = 0; i < validProviders.length; i++) {
    const prov = validProviders[i];
    notifyProgress(
      {
        stage: "pulling",
        provider: prov.name,
        current: i + 1,
        message: `Pulling models from ${prov.name} (${i + 1}/${validProviders.length})…`,
      },
      { text: `Querying ${prov.name} registry…`, type: "info" }
    );

    try {
      const res = await pullProviderModels(prov.slug);
      providerResults.push(res);
      if (res.ok) {
        totalModelsPulled += res.count;
        notifyProgress(
          { pulledCount: totalModelsPulled },
          { text: `✓ ${prov.name}: ${res.count} models synced (${res.enriched} enriched)`, type: "success" }
        );
      } else {
        notifyProgress(
          {},
          { text: `⚠️ ${prov.name}: ${res.error || "Failed to pull"}`, type: "warning" }
        );
      }
    } catch (err: any) {
      providerResults.push({
        slug: prov.slug,
        name: prov.name,
        ok: false,
        count: 0,
        enriched: 0,
        error: err?.message,
      });
      notifyProgress(
        {},
        { text: `⚠️ ${prov.name}: ${err?.message || "Connection failed"}`, type: "warning" }
      );
    }
  }

  const testResults: TestModelResult[] = [];

  if (testHealth && validProviders.length > 0) {
    notifyProgress(
      {
        stage: "testing",
        message: `Testing live connectivity & response latency across models…`,
      },
      { text: `Running live health checks…`, type: "info" }
    );

    // Pick top enabled models per provider to test connectivity without exceeding rate limits
    for (const prov of validProviders) {
      const modelsToTest = await prisma.model.findMany({
        where: {
          providerId: prov.id,
          enabled: true,
        },
        take: maxTestPerProvider,
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      });

      for (const m of modelsToTest) {
        notifyProgress(
          {
            stage: "testing",
            provider: prov.name,
            message: `Pinging ${m.slug} (${prov.name})…`,
          },
          { text: `⚡ Pinging ${m.slug}…`, type: "info" }
        );

        try {
          const t = await testSingleModel(m.id);
          testResults.push(t);
          const currentPassed = testResults.filter((r) => r.ok).length;
          const currentFailed = testResults.filter((r) => !r.ok).length;

          if (t.ok) {
            notifyProgress(
              { testedCount: testResults.length, passedCount: currentPassed },
              { text: `🟢 ${m.slug}: ${t.latencyMs}ms OK`, type: "success" }
            );
          } else {
            notifyProgress(
              { testedCount: testResults.length, failedCount: currentFailed },
              { text: `🔴 ${m.slug}: ${t.error || "Failed"}`, type: "error" }
            );
          }
          // 250ms subtle delay between model tests to avoid aggressive provider bursts
          await new Promise((resolve) => setTimeout(resolve, 250));
        } catch {}
      }
    }
  }

  const passed = testResults.filter((t) => t.ok).length;
  const failed = testResults.filter((t) => !t.ok).length;

  notifyProgress(
    {
      active: false,
      stage: "complete",
      message: `Auto-sync complete: ${totalModelsPulled} models pulled, ${testResults.length} tested (${passed} healthy).`,
      pulledCount: totalModelsPulled,
      testedCount: testResults.length,
      passedCount: passed,
      failedCount: failed,
      completedAt: Date.now(),
    },
    { text: `Auto-sync finished successfully`, type: "success" }
  );

  setTimeout(() => {
    if (!syncProgress.active) {
      notifyProgress({ stage: "idle" });
    }
  }, 6000);

  // Broadcast overall refresh to dashboard
  broadcastTelemetry({
    type: "refresh",
    timestamp: Date.now(),
  });

  return {
    ok: true,
    providersChecked: validProviders.length,
    totalModelsPulled,
    modelsTested: testResults.length,
    passed,
    failed,
    providers: providerResults,
    tests: testResults,
  };
}
