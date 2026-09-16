"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";

interface ModelRow {
  id: string;
  slug: string;
  displayName: string;
  enabled: boolean;
  status: string;
  lastError: string;
  latencyMs: number | null;
  httpStatus: number | null;
  ttftMs: number | null;
  toksPerSec: number | null;
  inputPrice: number;
  outputPrice: number;
}

interface BenchResult {
  ttftMs: number | null;
  toksPerSec: number | null;
  totalTokens: number;
  latencyMs: number;
  text: string;
}

type BenchPhase = "idle" | "connecting" | "waiting" | "streaming" | "done" | "error";

function fmtTtft(ms: number | null): string {
  if (ms == null) return "–";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

// Human reason for a diagnostic code — shown in the click popup.
function reasonFor(m: ModelRow): { title: string; body: string } {
  const code = m.httpStatus;
  if (m.status === "ok") return { title: `HTTP ${code ?? 200} — Working`, body: "The model answered the probe with a valid completion. It stays enabled for routing." };
  if (m.status === "slow") return { title: "Timed out (30s)", body: "No response within the probe timeout. The model may be overloaded or still loading — it was auto-disabled but can be re-enabled." };
  if (code === 401) return { title: "401 — Invalid API key", body: "The provider rejected the saved API key. Re-check the key on this page and save it again." };
  if (code === 402 || code === 403) return { title: `HTTP ${code} — Forbidden`, body: "The key is valid but has no access to this model (plan, permissions, or region restriction)." };
  if (code === 404 || code === 410) return { title: `HTTP ${code} — Model not found`, body: "The provider has no such model id (renamed, retired, or wrong slug). It can never route — keep disabled." };
  if (code === 429) return { title: "429 — Rate limited", body: "Too many requests — the provider throttled the probe. It may work when retried later; re-test before re-enabling." };
  if (code === 400) return { title: "400 — Rejected", body: "The provider refused the request parameters. Usually a modality or context mismatch for this model." };
  if (code === 500 || code === 502 || code === 503 || code === 504) return { title: `HTTP ${code} — Upstream error`, body: "The provider's own servers errored. Temporary — re-test later before re-enabling." };
  if (code != null) return { title: `HTTP ${code}`, body: m.lastError || "Probe failed." };
  return { title: "Network error", body: m.lastError || "The probe never got an HTTP response (DNS, blocked, or connection reset)." };
}

type Filter = "all" | "enabled" | "disabled" | "free";

// Free = $0 in + $0 out, or a "-free" suffixed test-mode alias.
const isFree = (m: { slug: string; inputPrice: number; outputPrice: number }) =>
  m.slug.toLowerCase().includes("free") || (m.inputPrice === 0 && m.outputPrice === 0);

export default function ProviderDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [key, setKey] = useState("");
  const [rawApiKey, setRawApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [editingKey, setEditingKey] = useState(false);
  const [deletingKey, setDeletingKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [connected, setConnected] = useState(false);
  const [name, setName] = useState(slug);
  const [icon, setIcon] = useState("⏣");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoInput, setLogoInput] = useState("");
  const [logoSaved, setLogoSaved] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [baseUrlInput, setBaseUrlInput] = useState("");
  const [baseUrlSaved, setBaseUrlSaved] = useState(false);
  const [website, setWebsite] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [apiKeyUrl, setApiKeyUrl] = useState("");
  const [category, setCategory] = useState("apikey");
  const [authType, setAuthType] = useState("bearer");
  const [serviceKinds, setServiceKinds] = useState<string[]>(["llm"]);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullStep, setPullStep] = useState<string>("Connecting to provider API…");
  const [pullError, setPullError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [testing, setTesting] = useState(false);
  const [testDone, setTestDone] = useState(0);
  const [testTotal, setTestTotal] = useState(0);
  const [testLog, setTestLog] = useState<{ done: number; id: string; slug: string; verdict: string; latencyMs: number | null; httpStatus: number | null; ttftMs: number | null; toksPerSec: number | null; detail: string; attempts: number }[]>([]);
  const [testingSlug, setTestingSlug] = useState("");
  const [inspect, setInspect] = useState<ModelRow | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // ── Live Benchmark (TTFT / Tok/s calculator) ──────────────────────────────
  const [benchModel, setBenchModel] = useState("");
  const [benchPrompt, setBenchPrompt] = useState("Say hello in exactly 5 words.");
  const [benchPhase, setBenchPhase] = useState<BenchPhase>("idle");
  const [benchTtftMs, setBenchTtftMs] = useState<number | null>(null);
  const [benchToksPerSec, setBenchToksPerSec] = useState<number | null>(null);
  const [benchTokens, setBenchTokens] = useState(0);
  const [benchElapsed, setBenchElapsed] = useState(0);
  const [benchPartial, setBenchPartial] = useState("");
  const [benchResult, setBenchResult] = useState<BenchResult | null>(null);
  const [benchError, setBenchError] = useState("");
  // Client-side elapsed ticker (for the "waiting for first token" animation)
  const benchTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const benchT0Ref = useRef<number>(0);

  // Auto-scroll the test log box to bottom whenever a new model result arrives
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [testLog]);

  const load = async () => {
    const r = await fetch(`/api/providers/${slug}`);
    if (!r.ok) return;
    const d = await r.json();
    setConnected(d.provider.connected);
    setHasKey(Boolean(d.provider.hasKey));
    setMaskedKey(d.provider.maskedKey ?? "");
    setRawApiKey(d.provider.apiKey ?? "");
    setName(d.provider.name);
    setIcon(d.provider.icon ?? "⏣");
    setLogoUrl(d.provider.logoUrl ?? "");
    if (!logoInput) setLogoInput(d.provider.logoUrl ?? "");
    setBaseUrl(d.provider.baseUrl ?? "");
    setBaseUrlInput(d.provider.baseUrl ?? "");
    setWebsite(d.provider.website ?? "");
    setDocUrl(d.provider.docUrl ?? "");
    setApiKeyUrl(d.provider.apiKeyUrl ?? "");
    setCategory(d.provider.category ?? "apikey");
    setAuthType(d.provider.authType ?? "bearer");
    setServiceKinds(d.provider.serviceKinds ?? ["llm"]);

    setModels(
      (d.models ?? []).map((m: any) => {
        const status = m.status === "disabled" ? (m.lastError ? "fail" : "pending") : m.status;
        const codeMatch = typeof m.lastError === "string" ? m.lastError.match(/HTTP (\d{3})/) : null;
        return { ...m, status, ttftMs: m.ttftMs ?? null, httpStatus: m.httpStatus ?? (codeMatch ? parseInt(codeMatch[1]) : null) };
      }),
    );
  };
  useEffect(() => { load(); }, [slug]);

  const saveKey = async () => {
    if (!key.trim()) return toast.show("Please enter an API key");
    const r = await fetch(`/api/providers/${slug}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: key.trim() }) });
    if (!r.ok) return toast.show("Failed to save key");
    const d = await r.json().catch(() => ({}));
    setRawApiKey(d.apiKey || key.trim());
    setKey("");
    setSaved(true);
    setHasKey(true);
    setEditingKey(false);
    if (d.maskedKey) setMaskedKey(d.maskedKey);
    setTimeout(() => setSaved(false), 2800);
    toast.show("Provider credentials encrypted and saved");
    load();
  };

  const saveBaseUrl = async () => {
    const r = await fetch(`/api/providers/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl: baseUrlInput.trim() }),
    });
    if (!r.ok) return toast.show("Failed to update base URL");
    setBaseUrl(baseUrlInput.trim());
    setBaseUrlSaved(true);
    setTimeout(() => setBaseUrlSaved(false), 2800);
    toast.show("Provider endpoint URL updated");
    load();
  };

  const pullModels = async () => {
    setPulling(true);
    setPullError(null);
    setPullStep("Connecting to provider endpoint…");

    const t1 = setTimeout(() => {
      setPullStep("Fetching model registry & capabilities…");
    }, 1200);

    const t2 = setTimeout(() => {
      setPullStep("Enriching context windows, modalities & pricing metadata…");
    }, 3200);

    const t3 = setTimeout(() => {
      setPullStep("Upserting models into database & synchronizing catalog…");
    }, 6000);

    try {
      const r = await fetch(`/api/providers/${slug}/pull`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setPulling(false);
      if (!r.ok) {
        const msg = d.error ?? "Pull models failed";
        setPullError(msg);
        return toast.show(msg);
      }
      setPullError(null);
      toast.show(`Pulled and synced ${d.count ?? 0} models (${d.enriched ?? 0} enriched)`);
      load();
    } catch (err: any) {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setPulling(false);
      const msg = err?.message || "Failed to pull models";
      setPullError(msg);
      toast.show(msg);
    }
  };

  const deleteKey = async () => {
    setDeletingKey(true);
    const r = await fetch(`/api/providers/${slug}`, { method: "DELETE" });
    setDeletingKey(false);
    if (!r.ok) return toast.show("Failed to delete key");
    setHasKey(false);
    setRawApiKey("");
    setMaskedKey("");
    setEditingKey(false);
    setConnected(false);
    toast.show("API key removed");
    load();
  };

  const saveLogo = async () => {
    const r = await fetch(`/api/providers/${slug}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logoUrl: logoInput.trim() }) });
    if (!r.ok) return toast.show("Failed to save logo");
    setLogoUrl(logoInput.trim());
    setLogoSaved(true);
    setTimeout(() => setLogoSaved(false), 2800);
    toast.show("Provider logo updated");
  };


  // Test ALL enabled models via SSE — shows each result live as it completes.
  const test = async () => {
    const targets = models.filter((m) => m.enabled);
    if (targets.length === 0) return toast.show("Please pull models before running diagnostics");
    setTesting(true);
    setTestDone(0);
    setTestTotal(targets.length);
    setTestLog([]);
    setTestingSlug("");
    const collected: { id: string; verdict: string }[] = [];
    try {
      const r = await fetch(`/api/providers/${slug}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: targets.map((m) => m.id) }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setTesting(false);
        return toast.show(d.error ?? "Diagnostics failed");
      }
      const reader = r.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop()!;
        for (const part of parts) {
          const lines = part.split("\n");
          let event = "";
          let data = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) event = line.slice(7);
            if (line.startsWith("data: ")) data = line.slice(6);
          }
          if (!event || !data) continue;
          try {
            const parsed = JSON.parse(data);
            if (event === "start") {
              setTestTotal(parsed.total);
            } else if (event === "result") {
              setTestDone(parsed.done);
              setTestLog((prev) => [...prev, parsed]);
              setTestingSlug(parsed.slug);
              collected.push({ id: parsed.id, verdict: parsed.verdict });
              // Live table update: patch the row the moment its verdict lands.
              setModels((prev) =>
                prev.map((m) =>
                  m.id === parsed.id
                    ? {
                        ...m,
                        status: parsed.verdict,
                        latencyMs: parsed.latencyMs,
                        ttftMs: parsed.ttftMs,
                        toksPerSec: parsed.toksPerSec,
                        httpStatus: parsed.httpStatus ?? null,
                        lastError: parsed.verdict === "fail" ? parsed.detail : "",
                      }
                    : m,
                ),
              );
            } else if (event === "done") {
              // Auto-disable non-working models
              const autoOff = collected.filter((x) => x.verdict !== "ok");
              if (autoOff.length > 0) {
                await Promise.all(
                  autoOff.map((x) =>
                    fetch(`/api/providers/${slug}/models`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: x.id, enabled: false }),
                    }),
                  ),
                );
              }
              toast.show(`Tested ${parsed.tested}: ${parsed.working} working, ${parsed.failing} failing${parsed.slow ? `, ${parsed.slow} slow` : ""} · auto-disabled ${autoOff.length}`);
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch {
      toast.show("Diagnostics failed — network error");
    }
    setTesting(false);
    setTestingSlug("");
    load();
  };

  const disableFailing = async () => {
    const failing = models.filter((m) => m.status === "fail" && m.enabled);
    if (failing.length === 0) return toast.show("Disabled 0 failing endpoints");
    await Promise.all(
      failing.map((m) =>
        fetch(`/api/providers/${slug}/models`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: m.id, enabled: false }),
        }),
      ),
    );
    toast.show(`Disabled ${failing.length} failing endpoint${failing.length === 1 ? "" : "s"}`);
    load();
  };

  const toggle = async (id: string, enabled: boolean) => {
    await fetch(`/api/providers/${slug}/models`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, enabled: !enabled }) });
    load();
  };

  const cycleFilter = () =>
    setFilter(filter === "all" ? "enabled" : filter === "enabled" ? "disabled" : filter === "disabled" ? "free" : "all");
  const filterLabel = filter === "all" ? "All Models" : filter === "enabled" ? "Enabled Only" : filter === "disabled" ? "Disabled Only" : "Free Only";

  const statusRank = (s: string) => (s === "ok" ? 0 : s === "pending" ? 1 : s === "slow" ? 2 : s === "fail" ? 3 : 4);

  let rows = models
    .filter((m) => (m.slug + m.displayName).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => statusRank(a.status) - statusRank(b.status));
  if (filter === "enabled") rows = rows.filter((m) => m.enabled);
  if (filter === "disabled") rows = rows.filter((m) => !m.enabled);
  if (filter === "free") rows = rows.filter(isFree);

  const disableAll = async () => {
    const targets = models.filter((m) => m.enabled);
    if (targets.length === 0) return toast.show("All models already disabled");
    await Promise.all(
      targets.map((m) =>
        fetch(`/api/providers/${slug}/models`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: m.id, enabled: false }),
        }),
      ),
    );
    toast.show(`Disabled all ${targets.length} models`);
    load();
  };

  // ── Bench runner ──────────────────────────────────────────────────────────
  const runBench = async () => {
    const target = benchModel || models.find((m) => m.enabled)?.slug || "";
    if (!target) return toast.show("Pull and enable at least one model first");

    setBenchPhase("connecting");
    setBenchTtftMs(null);
    setBenchToksPerSec(null);
    setBenchTokens(0);
    setBenchElapsed(0);
    setBenchPartial("");
    setBenchResult(null);
    setBenchError("");

    // Start a client-side elapsed ticker for the "waiting" phase animation
    benchT0Ref.current = Date.now();
    if (benchTickRef.current) clearInterval(benchTickRef.current);
    benchTickRef.current = setInterval(() => {
      setBenchElapsed(Date.now() - benchT0Ref.current);
    }, 50);

    try {
      const r = await fetch(`/api/providers/${slug}/bench`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelSlug: target, prompt: benchPrompt }),
      });

      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        if (benchTickRef.current) clearInterval(benchTickRef.current);
        setBenchPhase("error");
        setBenchError(d.error ?? `HTTP ${r.status}`);
        return;
      }

      const reader = r.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop()!;
        for (const part of parts) {
          const lines = part.split("\n");
          let event = "";
          let data = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) event = line.slice(7).trim();
            if (line.startsWith("data: ")) data = line.slice(6).trim();
          }
          if (!event || !data) continue;
          try {
            const p = JSON.parse(data);
            if (event === "progress") {
              setBenchPhase(p.phase as BenchPhase);
              if (p.ttftMs != null) setBenchTtftMs(p.ttftMs);
            } else if (event === "chunk") {
              if (p.ttftMs != null) setBenchTtftMs(p.ttftMs);
              setBenchToksPerSec(p.toksPerSec);
              setBenchTokens(p.tokensReceived);
              setBenchElapsed(p.elapsedMs);
              setBenchPartial(p.partialText ?? "");
            } else if (event === "result") {
              if (benchTickRef.current) clearInterval(benchTickRef.current);
              setBenchResult(p as BenchResult);
              setBenchTtftMs(p.ttftMs);
              setBenchToksPerSec(p.toksPerSec);
              setBenchTokens(p.totalTokens);
              setBenchElapsed(p.latencyMs);
              setBenchPartial(p.text ?? "");
              setBenchPhase("done");
            } else if (event === "error") {
              if (benchTickRef.current) clearInterval(benchTickRef.current);
              setBenchPhase("error");
              setBenchError(p.message ?? "Unknown error");
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (e: any) {
      if (benchTickRef.current) clearInterval(benchTickRef.current);
      setBenchPhase("error");
      setBenchError(e?.message ?? "Network error");
    }
  };

  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <Link href="/dashboard/providers" className="btn sm">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Back to Providers
        </Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, flexWrap: "wrap", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {logoUrl ? (
            <img src={logoUrl} alt={`${name} logo`} style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 10, background: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)", padding: 4 }} />
          ) : (
            <div className="provider-icon-badge" style={{ width: 44, height: 44, fontSize: 18 }}>
              {icon && /^[a-z0-9_]+$/.test(icon) ? (
                <span className="material-symbols-outlined" style={{ fontSize: 24 }}>{icon}</span>
              ) : (
                icon
              )}
            </div>
          )}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 700 }}>{name}</span>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "rgba(255,255,255,0.06)", color: "var(--text-muted, #94a3b8)" }}>
                {category === "freeTier" ? "Free Tier" : category === "free" ? "Free / Local" : category === "oauth" ? "CLI / OAuth" : "API Key"}
              </span>
            </div>
            <div style={{ fontSize: 12, color: connected ? "var(--primary)" : "var(--text-tertiary)", marginTop: 2 }}>
              {connected ? "● Connected & Ready" : "Not connected"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {(docUrl || website) && (
            <a href={docUrl || website} target="_blank" rel="noopener noreferrer" className="btn sm" style={{ textDecoration: "none" }}>
              Documentation ↗
            </a>
          )}
          {website && website !== docUrl && (
            <a href={website} target="_blank" rel="noopener noreferrer" className="btn sm" style={{ textDecoration: "none" }}>
              Website ↗
            </a>
          )}
          {apiKeyUrl && (
            <a href={apiKeyUrl} target="_blank" rel="noopener noreferrer" className="btn sm primary" style={{ textDecoration: "none" }}>
              Get API Key ↗
            </a>
          )}
          <button
            className="btn sm"
            onClick={() => pullModels()}
            disabled={pulling}
            style={{ display: "flex", alignItems: "center", gap: 7 }}
          >
            {pulling ? (
              <>
                <svg className="animate-spin" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" />
                  <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeLinecap="round" />
                </svg>
                <span>Pulling Models…</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                <span>Pull Models</span>
              </>
            )}
          </button>
        </div>
      </div>

      {slug === "kiosapi" && (
        <div style={{
          marginBottom: 16,
          padding: "14px 18px",
          background: "rgba(59, 130, 246, 0.08)",
          border: "1px solid rgba(59, 130, 246, 0.22)",
          borderRadius: 10,
          fontSize: 13,
          color: "var(--text-secondary)",
          lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 700, color: "#60a5fa", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <span>ℹ️</span> KiosAPI Endpoint &amp; Verification Guide
          </div>
          <div>
            • <strong>Base URL:</strong> The official endpoint is <code style={{ color: "#93c5fd", background: "rgba(59, 130, 246, 0.15)", padding: "2px 6px", borderRadius: 4 }}>https://router.kiosapi.com/v1</code> (do not use <code>kiosapi.com/v1</code>).
            <br />
            • <strong>Telegram Verification:</strong> If Pull Models returns <code style={{ color: "#fca5a5" }}>telegram_verification_required</code>, log in to your <a href="https://kiosapi.com" target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", textDecoration: "underline" }}>KiosAPI Dashboard</a>, link your Telegram account, and join the required chat group to activate your free API key.
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 20, maxWidth: 900 }}>
        {/* API Key Card */}
        <div className="card">
          <div className="card-label" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{authType === "cookie" ? "Session Cookie" : "Provider API Key"}</span>
            {hasKey && <span className="pill active" style={{ fontSize: 11 }}>● Active &amp; Stored</span>}
          </div>
          {authType === "none" ? (
            <div style={{ padding: "10px 14px", background: "rgba(34, 197, 94, 0.1)", borderRadius: "6px", color: "#22c55e", fontSize: 13 }}>
              ✓ No API Key required. This endpoint is free or locally hosted.
            </div>
          ) : hasKey && !editingKey ? (
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    background: "var(--bg-surface-elevated)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-sm)",
                    padding: "0 8px 0 12px",
                    overflow: "hidden",
                    minHeight: 38,
                  }}
                >
                  <input
                    type={showKey ? "text" : "password"}
                    readOnly
                    value={showKey ? (rawApiKey || maskedKey) : (maskedKey || rawApiKey)}
                    className="mono"
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      padding: "6px 0",
                      fontSize: 13,
                      color: "var(--text-primary)",
                      fontFamily: "monospace",
                      width: "100%",
                      letterSpacing: showKey ? "normal" : "1.5px",
                    }}
                    title={showKey ? "Saved API Key" : "Saved API Key (Masked)"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    title={showKey ? "Hide API key" : "Show API key"}
                    className="btn sm"
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px 6px",
                      color: "var(--text-secondary)",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                    }}
                  >
                    {showKey ? (
                      <>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                        <span>Hide</span>
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        <span>Show</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const toCopy = rawApiKey || maskedKey;
                      if (toCopy) {
                        navigator.clipboard.writeText(toCopy);
                        toast.show("API key copied to clipboard");
                      }
                    }}
                    title="Copy API key"
                    className="btn sm"
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px 6px",
                      color: "var(--text-secondary)",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                    <span>Copy</span>
                  </button>
                </div>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => {
                    setEditingKey(true);
                    setKey(rawApiKey);
                  }}
                  title="Change API key"
                  style={{ whiteSpace: "nowrap" }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn sm danger"
                  onClick={deleteKey}
                  disabled={deletingKey}
                  style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
                >
                  {deletingKey ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type={showKey ? "text" : "password"}
                  className="input-field mono"
                  placeholder={authType === "cookie" ? "Paste cookie value..." : "sk-••••••••••••••••••••••••••••"}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  style={{ flex: 1 }}
                  autoFocus={editingKey}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="btn sm"
                  title={showKey ? "Hide key" : "Show key"}
                  style={{ padding: "8px 10px" }}
                >
                  {showKey ? "Hide" : "Show"}
                </button>
                <button className="btn primary sm" onClick={saveKey} style={{ whiteSpace: "nowrap" }}>
                  Save Key
                </button>
                {editingKey && (
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => {
                      setEditingKey(false);
                      setKey("");
                    }}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
          {saved && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--primary)", fontSize: 12, fontWeight: 600, marginTop: 8 }}>
              ✓ API Key saved securely
            </div>
          )}
        </div>

        {/* Base URL / Endpoint Card */}
        <div className="card">
          <div className="card-label" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>API Base URL / Endpoint Override</span>
            {baseUrl && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Configured</span>}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="text"
              className="input-field mono"
              placeholder="https://api.example.com/v1"
              value={baseUrlInput}
              onChange={(e) => setBaseUrlInput(e.target.value)}
              style={{ flex: 1, fontSize: 12 }}
            />
            <button className="btn" onClick={saveBaseUrl}>Save</button>
          </div>
          {baseUrlSaved && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--primary)", fontSize: 12, fontWeight: 600, marginTop: 8 }}>
              ✓ Endpoint updated successfully
            </div>
          )}
        </div>
      </div>

      {pullError && (
        <div style={{
          marginBottom: 16,
          padding: "12px 16px",
          background: "rgba(239, 68, 68, 0.08)",
          border: "1px solid rgba(239, 68, 68, 0.25)",
          borderRadius: 8,
          fontSize: 13,
          color: "#f87171",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}>
          <div>
            <strong>Pull Models Error:</strong> {pullError}
          </div>
          <button
            type="button"
            onClick={() => setPullError(null)}
            style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: 14 }}
          >
            ✕
          </button>
        </div>
      )}

      <div className="toolbar-row" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn sm primary" onClick={test} disabled={testing}>{testing ? `Testing ${testDone}/${testTotal}…` : "▷ Test Models"}</button>
          <button className="btn sm danger" onClick={disableFailing} disabled={testing}>⦸ Disable Non-working Models</button>
          <button className="btn sm danger" onClick={disableAll} disabled={testing}>⦸ Disable All</button>
          <button className="btn sm" onClick={cycleFilter} disabled={testing}>{filterLabel} ▾</button>
        </div>
        <div className="search-bar-wrap" style={{ maxWidth: 260 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" className="input-field" placeholder="Filter models…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {testing && testTotal > 0 && (
        <div className="card" style={{ marginBottom: 14, borderColor: "var(--primary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
            <span><span className="live-indicator" /> Testing {testDone}/{testTotal} models…</span>
            <span className="mono">{Math.round((testDone / testTotal) * 100)}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(testDone / testTotal) * 100}%`, background: "var(--primary)", borderRadius: 3, transition: "width 0.2s" }} />
          </div>
          {testingSlug && <div className="mono" style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 6 }}>▸ {testingSlug}</div>}
          {testLog.length > 0 && (
            <div
              ref={logContainerRef}
              style={{
                marginTop: 10,
                maxHeight: 260,
                overflowY: "auto",
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                lineHeight: 1.8,
                borderTop: "1px solid var(--border-subtle)",
                paddingTop: 10,
                scrollBehavior: "smooth",
              }}
            >
              {testLog.map((r, i) => {
                const icon = r.verdict === "ok" ? "+" : r.verdict === "slow" ? "~" : "×";
                const color = r.verdict === "ok" ? "var(--primary)" : r.verdict === "slow" ? "var(--warning)" : "var(--danger)";
                const pad = String(testTotal).length;
                const head = `[${String(r.done).padStart(pad, " ")}/${testTotal}] ${icon} ${r.slug}`;
                const info = r.verdict === "ok"
                  ? `${r.toksPerSec != null ? r.toksPerSec.toFixed(1) : "–"} tok/s`
                  : r.verdict === "slow"
                    ? "timeout"
                    : `HTTP ${r.httpStatus ?? (r.detail || "error").slice(0, 12)}`;
                return (
                  <div key={i} style={{ color }}>
                    <span>{head} </span>
                    <span style={{ opacity: 0.85 }}>{info}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="table-wrapper">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Model Identifier</th>
                <th>Diagnostic Status</th>
                <th className="num">Ping Latency</th>
                <th className="num">TTFT</th>
                <th className="num">Tok/s</th>
                <th style={{ textAlign: "right" }}>Routing Enabled</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const isFail = m.status === "fail";
                const rowStyle: React.CSSProperties = isFail
                  ? { borderLeft: "3px solid var(--danger)", background: "var(--danger-bg)" }
                  : !m.enabled
                    ? { opacity: 0.45 }
                    : {};
                return (
                <tr key={m.id} style={rowStyle}>
                  <td className="mono"><b>{m.slug}</b></td>
                  <td>
                    {m.status === "ok" ? (
                      <button className="pill active" title="Click for details" style={{ cursor: "pointer" }} onClick={() => setInspect(m)}>{m.httpStatus ?? 200}</button>
                    ) : isFail ? (
                      <button className="pill danger" title="Click for reason" style={{ cursor: "pointer" }} onClick={() => setInspect(m)}>{m.httpStatus ?? "ERR"}</button>
                    ) : m.status === "slow" ? (
                      <button className="pill" title="Click for reason" style={{ cursor: "pointer", borderColor: "var(--warning)", color: "var(--warning)" }} onClick={() => setInspect(m)}>SLOW</button>
                    ) : m.status === "disabled" ? <><span className="status-dot disabled" />Disabled</>
                    : !m.enabled ? <><span className="status-dot disabled" />Skipped (disabled)</>
                    : <><span className="status-dot pending" />Not tested</>}
                    {isFail && m.lastError && (
                      <div className="mono" title={m.lastError} style={{ fontSize: 10.5, color: "var(--danger)", marginTop: 3, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.lastError}
                      </div>
                    )}
                  </td>
                  <td className="num mono">{m.latencyMs ?? "–"}</td>
                  <td className="num mono">{fmtTtft(m.ttftMs)}</td>
                  <td className="num mono" style={{ color: "var(--text-secondary)" }}>{m.toksPerSec != null ? `${m.toksPerSec.toFixed(1)} tok/s` : "–"}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className={`toggle-switch ${m.enabled ? "on" : ""}`} onClick={() => toggle(m.id, m.enabled)} aria-label={`Toggle model ${m.slug}`} />
                  </td>
                </tr>
                );
              })}
              {rows.length === 0 && !loading && (
                <tr><td colSpan={5}><div className="empty-state-box">Click &quot;Pull models&quot; to fetch the live model registry for this provider.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
        {loading && <div style={{ padding: 16 }}><div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" /></div>}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          LIVE BENCHMARK — TTFT & TOK/S CALCULATOR
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ marginTop: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>⚡ Live Benchmark</span>
          <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontStyle: "italic" }}>Measures real TTFT & tokens/sec from a live streaming request</span>
        </div>

        <div className="card" style={{ padding: "20px 22px" }}>
          {/* Controls row */}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 18 }}>
            {/* Model selector */}
            <div style={{ flex: "0 0 auto", minWidth: 220 }}>
              <div className="card-label" style={{ marginBottom: 5 }}>Model</div>
              <select
                className="input-field"
                value={benchModel || models.find((m) => m.enabled)?.slug || ""}
                onChange={(e) => setBenchModel(e.target.value)}
                style={{ fontSize: 12.5 }}
                disabled={benchPhase !== "idle" && benchPhase !== "done" && benchPhase !== "error"}
              >
                {models.filter((m) => m.enabled).map((m) => (
                  <option key={m.id} value={m.slug}>{m.slug}</option>
                ))}
                {models.filter((m) => m.enabled).length === 0 && (
                  <option value="">— Pull & enable models first —</option>
                )}
              </select>
            </div>

            {/* Prompt input */}
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="card-label" style={{ marginBottom: 5 }}>Prompt</div>
              <input
                type="text"
                className="input-field"
                value={benchPrompt}
                onChange={(e) => setBenchPrompt(e.target.value)}
                placeholder="Say hello in exactly 5 words."
                style={{ fontSize: 12.5 }}
                disabled={benchPhase !== "idle" && benchPhase !== "done" && benchPhase !== "error"}
              />
            </div>

            {/* Run / Stop button */}
            <button
              className="btn primary sm"
              onClick={runBench}
              disabled={benchPhase !== "idle" && benchPhase !== "done" && benchPhase !== "error"}
              style={{ display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}
            >
              {benchPhase === "connecting" || benchPhase === "waiting" || benchPhase === "streaming" ? (
                <>
                  <svg className="animate-spin" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" />
                    <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeLinecap="round" />
                  </svg>
                  Running…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                  {benchPhase === "done" || benchPhase === "error" ? "Run Again" : "Run Benchmark"}
                </>
              )}
            </button>
          </div>

          {/* ── Live metrics display ── */}
          {(benchPhase !== "idle") && (
            <div>
              {/* Phase indicator */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, fontSize: 12 }}>
                {["connecting", "waiting", "streaming", "done"].map((phase, i) => {
                  const phaseOrder = { connecting: 0, waiting: 1, streaming: 2, done: 3, error: 4, idle: -1 } as any;
                  const currentOrder = phaseOrder[benchPhase] ?? -1;
                  const thisOrder = i;
                  const isActive = benchPhase !== "done" && benchPhase !== "error" && phaseOrder[benchPhase] === thisOrder;
                  const isDone = currentOrder > thisOrder || benchPhase === "done";
                  const isError = benchPhase === "error";
                  return (
                    <>
                      <span
                        key={phase}
                        style={{
                          padding: "3px 10px",
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 600,
                          background: isError && i < 2 ? "rgba(239,68,68,0.12)" : isDone ? "rgba(16,185,129,0.12)" : isActive ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.04)",
                          color: isError && i < 2 ? "var(--danger)" : isDone ? "#10b981" : isActive ? "var(--primary)" : "var(--text-muted)",
                          border: `1px solid ${isError && i < 2 ? "rgba(239,68,68,0.3)" : isDone ? "rgba(16,185,129,0.3)" : isActive ? "rgba(14,165,233,0.35)" : "var(--border-subtle)"}`,
                          transition: "all 0.25s",
                        }}
                      >
                        {isDone ? "✓ " : isActive ? "● " : ""}{phase}
                      </span>
                      {i < 3 && <span style={{ color: "var(--border)", fontSize: 10 }}>›</span>}
                    </>
                  );
                })}
                {benchPhase === "error" && (
                  <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: "rgba(239,68,68,0.12)", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.3)" }}>✕ error</span>
                )}
              </div>

              {benchPhase === "error" ? (
                <div style={{ padding: "12px 14px", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, fontSize: 12.5, color: "#f87171" }}>
                  {benchError}
                </div>
              ) : (
                <>
                  {/* Live metrics grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
                    {/* TTFT */}
                    <div style={{
                      padding: "14px 16px",
                      background: "var(--bg-surface-elevated)",
                      border: `1px solid ${benchTtftMs != null ? "rgba(16,185,129,0.35)" : "var(--border-subtle)"}`,
                      borderRadius: 10,
                      textAlign: "center",
                    }}>
                      <div style={{ fontSize: 10.5, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>TTFT</div>
                      <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color: benchTtftMs != null ? "#10b981" : benchPhase === "waiting" ? "var(--primary)" : "var(--text-secondary)", letterSpacing: "-0.02em", transition: "color 0.3s" }}>
                        {benchTtftMs != null
                          ? (benchTtftMs < 1000 ? `${benchTtftMs}` : `${(benchTtftMs / 1000).toFixed(2)}k`)
                          : (benchPhase === "waiting" || benchPhase === "streaming" ? `${benchElapsed}` : "—")
                        }
                      </div>
                      <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                        {benchTtftMs != null ? (benchTtftMs < 1000 ? "ms (locked)" : "s (locked)") : (benchPhase === "done" ? "ms (none)" : "ms (ticking…)")}
                      </div>
                    </div>

                    {/* Tok/s */}
                    <div style={{
                      padding: "14px 16px",
                      background: "var(--bg-surface-elevated)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 10,
                      textAlign: "center",
                    }}>
                      <div style={{ fontSize: 10.5, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Tok / s</div>
                      <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color: benchToksPerSec != null ? "var(--primary)" : "var(--text-secondary)", letterSpacing: "-0.02em" }}>
                        {benchToksPerSec != null ? benchToksPerSec.toFixed(1) : "—"}
                      </div>
                      <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>tokens / sec</div>
                    </div>

                    {/* Tokens */}
                    <div style={{
                      padding: "14px 16px",
                      background: "var(--bg-surface-elevated)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 10,
                      textAlign: "center",
                    }}>
                      <div style={{ fontSize: 10.5, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Tokens</div>
                      <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                        {benchTokens > 0 ? benchTokens : "—"}
                      </div>
                      <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>generated</div>
                    </div>

                    {/* Total latency */}
                    <div style={{
                      padding: "14px 16px",
                      background: "var(--bg-surface-elevated)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 10,
                      textAlign: "center",
                    }}>
                      <div style={{ fontSize: 10.5, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Total Time</div>
                      <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color: "var(--text-secondary)", letterSpacing: "-0.02em" }}>
                        {benchElapsed >= 1000 ? `${(benchElapsed / 1000).toFixed(2)}` : benchElapsed > 0 ? `${benchElapsed}` : "—"}
                      </div>
                      <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                        {benchElapsed >= 1000 ? "s" : "ms"}
                      </div>
                    </div>
                  </div>

                  {/* Streaming text preview */}
                  {benchPartial && (
                    <div style={{
                      padding: "10px 14px",
                      background: "var(--bg-surface-elevated)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 8,
                      fontSize: 12.5,
                      color: benchPhase === "done" ? "var(--text-primary)" : "var(--text-secondary)",
                      fontFamily: "var(--font-mono, monospace)",
                      lineHeight: 1.7,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}>
                      {benchPartial}
                      {benchPhase === "streaming" && <span style={{ opacity: 0.5, animation: "blink 1s step-end infinite" }}>▊</span>}
                    </div>
                  )}

                  {/* Final result summary */}
                  {benchPhase === "done" && benchResult && (
                    <div style={{ marginTop: 14, padding: "12px 16px", background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 9, fontSize: 12.5 }}>
                      <div style={{ fontWeight: 700, color: "#10b981", marginBottom: 6 }}>✓ Benchmark complete</div>
                      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", color: "var(--text-secondary)", fontFamily: "var(--font-mono, monospace)" }}>
                        <span>TTFT: <strong style={{ color: "#10b981" }}>{benchResult.ttftMs != null ? (benchResult.ttftMs < 1000 ? `${benchResult.ttftMs}ms` : `${(benchResult.ttftMs / 1000).toFixed(2)}s`) : "–"}</strong></span>
                        <span>Speed: <strong style={{ color: "var(--primary)" }}>{benchResult.toksPerSec != null ? `${benchResult.toksPerSec.toFixed(1)} tok/s` : "–"}</strong></span>
                        <span>Tokens: <strong>{benchResult.totalTokens}</strong></span>
                        <span>Latency: <strong>{benchResult.latencyMs >= 1000 ? `${(benchResult.latencyMs / 1000).toFixed(2)}s` : `${benchResult.latencyMs}ms`}</strong></span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reason popup */}
      {inspect && (() => {
        const reason = reasonFor(inspect);
        const tone = inspect.status === "ok" ? "active" : inspect.status === "slow" ? "" : "danger";
        return (
          <div
            onClick={() => setInspect(null)}
            style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          >
            <div
              className="card"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 520, width: "100%", margin: 0 }}
            >
              <div className="card-head">
                <span className="card-label mono" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{inspect.slug}</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className={`pill ${tone}`}>{inspect.status === "slow" ? "SLOW" : inspect.httpStatus ?? "ERR"}</span>
                  <button className="btn sm" onClick={() => setInspect(null)}>✕</button>
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{reason.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 12 }}>{reason.body}</div>
              {inspect.lastError && (
                <div className="mono" style={{ fontSize: 11.5, background: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "8px 10px", marginBottom: 12, overflowX: "auto" }}>
                  {inspect.lastError}
                </div>
              )}
              <div className="mono" style={{ fontSize: 12, color: "var(--text-tertiary)", display: "flex", gap: 16, flexWrap: "wrap" }}>
                <span>Latency {inspect.latencyMs ?? "–"}ms</span>
                <span>TTFT {fmtTtft(inspect.ttftMs)}</span>
                <span>Tok/s {inspect.toksPerSec != null ? inspect.toksPerSec.toFixed(1) : "–"}</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Pulling Models Animation Popup Modal */}
      {pulling && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            className="card animate-modal-in"
            style={{
              maxWidth: 460,
              width: "100%",
              margin: 0,
              padding: "28px 24px",
              textAlign: "center",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: "16px",
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)",
            }}
          >
            {/* Animated Logo / Icon Glow Ring */}
            <div style={{ position: "relative", width: 84, height: 84, margin: "0 auto 18px" }}>
              {/* Outer Rotating Conic Spinner */}
              <div
                className="animate-spin"
                style={{
                  position: "absolute",
                  inset: -6,
                  borderRadius: "50%",
                  border: "3px solid transparent",
                  borderTopColor: "var(--primary)",
                  borderRightColor: "rgba(14, 165, 233, 0.35)",
                }}
              />
              {/* Pulsing Soft Glow */}
              <div
                className="animate-pulse-soft"
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(14, 165, 233, 0.25) 0%, transparent 70%)",
                }}
              />
              {/* Center Logo/Icon Badge */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: "var(--bg-surface-elevated)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`${name} logo`}
                    style={{ width: 46, height: 46, objectFit: "contain" }}
                  />
                ) : (
                  <span className="material-symbols-outlined" style={{ fontSize: 36, color: "var(--primary)" }}>
                    {icon && /^[a-z0-9_]+$/.test(icon) ? icon : "hub"}
                  </span>
                )}
              </div>
            </div>

            {/* Title & Status */}
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 6px", color: "var(--text-primary)" }}>
              Pulling Models from {name}
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 20px", minHeight: 20 }}>
              {pullStep}
            </p>

            {/* Animated Loading Bar with Gradient */}
            <div
              style={{
                height: 6,
                borderRadius: 999,
                background: "var(--border-subtle)",
                overflow: "hidden",
                position: "relative",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  width: "45%",
                  borderRadius: 999,
                  background: "linear-gradient(90deg, transparent, var(--primary), #38bdf8, transparent)",
                  animation: "shimmer-sweep 1.6s infinite ease-in-out",
                }}
              />
            </div>

            {/* Hint & Endpoint Details */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 8,
                background: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-subtle)",
                fontSize: 11.5,
                color: "var(--text-tertiary)",
              }}
            >
              <span className="live-indicator" />
              <span>Fetching live catalog and enriching tokens &amp; modalities</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
