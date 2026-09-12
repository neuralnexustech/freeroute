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
  const [defaultModels, setDefaultModels] = useState<{ id: string; name: string }[]>([]);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pulling, setPulling] = useState(false);
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
    setDefaultModels(d.provider.defaultModels ?? []);

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

  const pullModels = async (forceDefaults = false) => {
    setPulling(true);
    const r = await fetch(`/api/providers/${slug}/pull${forceDefaults ? "?defaults=1" : ""}`, { method: "POST" });
    const d = await r.json().catch(() => ({}));
    setPulling(false);
    if (!r.ok) return toast.show(d.error ?? "Pull models failed");
    toast.show(forceDefaults ? `Seeded ${d.count ?? 0} catalog models` : `Pulled and synced ${d.count ?? 0} models (${d.enriched ?? 0} enriched)`);
    load();
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

  const pullInfo = async () => {
    setLoading(true);
    const r = await fetch(`/api/providers/${slug}/pull-info`, { method: "POST" });
    const d = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) return toast.show(d.error ?? "Pull info failed");
    toast.show(`Updated info for ${d.updated ?? d.count ?? 0} existing models`);
    load();
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
          <button className="btn sm" onClick={() => pullModels(false)} disabled={pulling}>
            {pulling ? "Pulling Models…" : "Pull Models"}
          </button>
          {defaultModels.length > 0 && (
            <button className="btn sm" onClick={() => pullModels(true)} disabled={pulling} title="Populate curated models from catalog">
              Seed Catalog Models
            </button>
          )}
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
            <br />
            • Alternatively, click <strong>Seed Catalog Models</strong> to immediately populate all 12 verified KiosAPI models into freeroute.
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

      <div className="toolbar-row" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn sm primary" onClick={pullInfo} disabled={loading || testing}>{loading ? "Updating Info…" : "⇩ Pull Info"}</button>
          <button className="btn sm" onClick={test} disabled={testing}>{testing ? `Testing ${testDone}/${testTotal}…` : "▷ Test Models"}</button>
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
    </>
  );
}
