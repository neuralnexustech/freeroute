"use client";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { useLiveTelemetry } from "@/hooks/useLiveTelemetry";
import { inferModelParams, inferModelScore } from "@/lib/model-info";

interface ModelRow {
  id: string;
  slug: string;
  displayName: string;
  provider: { slug: string; name: string };
  contextWindow: string;
  params?: string;
  score?: number;
  inputPrice: number;
  outputPrice: number;
  modalities: string;
  enabled: boolean;
  status: string;
  toksPerSec: number | null;
  latencyMs: number | null;
  ttftMs: number | null;
  spend?: number;
  requests?: number;
  tokens?: number;
}

function fmtTtft(ms: number | null): string {
  if (ms == null) return "–";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function fmtTps(v: number | null): string {
  if (v == null) return "–";
  return `${v.toFixed(1)} tok/s`;
}

const MOD_ICONS: Record<string, { label: string; svg: React.ReactNode }> = {
  T: { label: "Text", svg: <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3M9 20h6M12 4v16" /></svg> },
  IMG: { label: "Vision / Image", svg: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="1.8" fill="currentColor" stroke="none" /><path d="M21 15l-4.5-4.5L6 21" /></svg> },
  DOC: { label: "Document / PDF", svg: <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg> },
  VID: { label: "Video", svg: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M7 4v16M17 4v16M2 9h5M2 15h5M17 9h5M17 15h5" /><path d="M10.5 9.5l4.5 2.5-4.5 2.5z" fill="currentColor" stroke="none" /></svg> },
  AUD: { label: "Audio / Voice", svg: <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2" /></svg> },
};

function ModalityIcons({ mods }: { mods: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
      {mods.split(",").map((m) => {
        const item = MOD_ICONS[m.trim()];
        if (!item) return <span key={m} style={{ fontSize: 10 }}>{m}</span>;
        return (
          <span key={m} title={item.label} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 6, background: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", cursor: "help" }}>
            {item.svg}
          </span>
        );
      })}
    </div>
  );
}

function Dropdown({ label, value, options, onPick }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onPick: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const active = value !== "All";
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className="btn sm"
        onClick={() => setOpen((o) => !o)}
        style={active ? { borderColor: "var(--primary)", color: "var(--primary)" } : {}}
      >
        {active ? value : label} ▾
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50,
          minWidth: 168, maxHeight: 280, overflowY: "auto",
          background: "var(--bg-surface-elevated)", border: "1px solid var(--border-default)",
          borderRadius: 10, boxShadow: "var(--shadow-lg)", padding: 4,
        }}>
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => { onPick(o.value); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                width: "100%", textAlign: "left", padding: "7px 10px", fontSize: 12.5,
                border: 0, borderRadius: 7, cursor: "pointer",
                background: o.value === value ? "var(--bg-accent-soft)" : "transparent",
                color: o.value === value ? "var(--primary)" : "var(--text-primary)",
                fontWeight: o.value === value ? 600 : 400,
              }}
              onMouseEnter={(e) => { if (o.value !== value) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-surface-hover)"; }}
              onMouseLeave={(e) => { if (o.value !== value) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              {o.label}{o.value === value ? " ✓" : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Best-effort param size parsed from the slug or params string, e.g. "llama-3.3-70b" → 70.
function paramSize(slug: string, paramStr?: string): number | null {
  const target = `${slug} ${paramStr || ""}`.toLowerCase();
  const mB = target.match(/(\d+(?:\.\d+)?)\s*b\b/i);
  if (mB) return parseFloat(mB[1]);
  const mM = target.match(/(\d+(?:\.\d+)?)\s*m\b/i);
  if (mM) return parseFloat(mM[1]) / 1000; // normalized in billions
  return null;
}
function paramBucket(slug: string, paramStr?: string): string {
  const p = paramSize(slug, paramStr);
  if (p == null) return "Unknown";
  if (p < 0.1) return "Tiny (<100M)";
  if (p < 10) return "Small (<10B)";
  if (p <= 70) return "Medium (10–70B)";
  return "Large (>70B)";
}

// Context window strings like "128K", "1.05M" → token count.
function contextTokens(ctx: string): number | null {
  const m = String(ctx).trim().match(/^([\d.]+)\s*([kKmM])$/);
  if (!m) return null;
  const mult = m[2].toLowerCase() === "m" ? 1_000_000 : 1_000;
  return parseFloat(m[1]) * mult;
}
function contextBucket(ctx: string): string {
  const t = contextTokens(ctx);
  if (t == null) return "Unknown";
  if (t <= 32_000) return "≤ 32K";
  if (t <= 128_000) return "≤ 128K";
  return "> 128K";
}

function fmtModelPrice(price: number) {
  if (price === 0) {
    return (
      <span className="pill active" style={{ fontSize: 10.5, padding: "1px 6px", fontWeight: 700 }}>
        Free
      </span>
    );
  }
  const formatted =
    price < 0.01
      ? price.toFixed(4)
      : price < 1 && (price * 100) % 1 !== 0
      ? price.toFixed(3)
      : price.toFixed(2);
  return `$${formatted}`;
}

export default function ModelsPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ModelRow[]>([]);
  const [provFilter, setProvFilter] = useState("All");
  const [modFilter, setModFilter] = useState("All");
  const [paramFilter, setParamFilter] = useState("All");
  const [ctxFilter, setCtxFilter] = useState("All");
  const [priceFilter, setPriceFilter] = useState("All");
  const [pulling, setPulling] = useState(false);
  const [phase, setPhase] = useState("");
  const toast = useToast();

  const [sortCol, setSortCol] = useState<"name" | "spend" | "inputPrice" | "outputPrice" | "toks" | "ttft" | "score" | "params">("name");
  const [sortAsc, setSortAsc] = useState(true);

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(col === "name");
    }
  };

  const load = () => {
    fetch("/api/v1/models").then((r) => r.json()).then((d) => setRows(d.data ?? [])).catch(() => toast.show("Failed to load models"));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Exact real-time updates for tok/s, ttft and active status via SSE & BroadcastChannel
  const { isLive } = useLiveTelemetry(load);

  const providers = [...new Set(rows.map((m) => m.provider.name))].sort();
  const modalities = [...new Set(rows.flatMap((m) => m.modalities.split(",").map((s) => s.trim())))].sort();
  const filtered = rows.filter(
    (m) =>
      (m.slug + m.displayName).toLowerCase().includes(q.toLowerCase()) &&
      (provFilter === "All" || m.provider.name === provFilter) &&
      (modFilter === "All" || m.modalities.split(",").map((s) => s.trim()).includes(modFilter)) &&
      (paramFilter === "All" || paramBucket(m.slug, m.params) === paramFilter) &&
      (ctxFilter === "All" || contextBucket(m.contextWindow) === ctxFilter) &&
      (priceFilter === "All" ||
        (priceFilter === "Free"
          ? m.inputPrice === 0 && m.outputPrice === 0
          : priceFilter === "Spent"
          ? (m.spend ?? 0) > 0
          : m.inputPrice > 0 || m.outputPrice > 0)),
  );

  const sorted = [...filtered].sort((a, b) => {
    let diff = 0;
    if (sortCol === "name") diff = a.displayName.localeCompare(b.displayName);
    else if (sortCol === "spend") diff = (a.spend ?? 0) - (b.spend ?? 0);
    else if (sortCol === "inputPrice") diff = a.inputPrice - b.inputPrice;
    else if (sortCol === "outputPrice") diff = a.outputPrice - b.outputPrice;
    else if (sortCol === "toks") diff = (a.toksPerSec ?? 0) - (b.toksPerSec ?? 0);
    else if (sortCol === "ttft") diff = (a.ttftMs ?? 999999) - (b.ttftMs ?? 999999);
    else if (sortCol === "score") diff = (a.score ?? inferModelScore(a.slug, a.params)) - (b.score ?? inferModelScore(b.slug, b.params));
    else if (sortCol === "params") diff = (paramSize(a.slug, a.params) ?? 0) - (paramSize(b.slug, b.params) ?? 0);
    return sortAsc ? diff : -diff;
  });

  // Pull info (Context, Input/Output pricing, Modalities) for all models already in database
  const pullInfo = async () => {
    setPulling(true);
    setPhase("Discovering specs for available models…");
    try {
      const r = await fetch("/api/models/pull-info", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        toast.show(`Updated info for ${d.updated ?? 0} models (Context, Pricing, Modalities)`);
        load();
      } else {
        toast.show(d.error ?? "Pull info failed");
      }
    } catch {
      toast.show("Pull info failed — check connection");
    }
    setPhase("");
    setPulling(false);
  };

  const totalSpend = rows.reduce((acc, m) => acc + (m.spend || 0), 0);

  return (
    <>
      <div className="toolbar-row">
        <div className="tab-group" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="active">Models</button>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              color: isLive ? "#10b981" : "var(--text-tertiary)",
              fontWeight: 600,
              background: isLive ? "rgba(16, 185, 129, 0.08)" : "rgba(255, 255, 255, 0.04)",
              border: isLive ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid var(--border-subtle)",
              padding: "2px 7px",
              borderRadius: 12,
              userSelect: "none",
            }}
            title={isLive ? "Exact Live Benchmarks Stream Connected" : "Connecting to live stream..."}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: isLive ? "#10b981" : "var(--text-tertiary)",
                boxShadow: isLive ? "0 0 5px #10b981" : "none",
              }}
            />
            {isLive ? "Live" : "Connecting..."}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 8,
              background: "var(--bg-surface-elevated)",
              border: "1px solid var(--border-subtle)",
              fontSize: 12,
            }}
            title="Total accumulated spend across all model requests"
          >
            <span style={{ color: "var(--text-secondary)" }}>Total Spent:</span>
            <span className="mono" style={{ fontWeight: 700, color: totalSpend > 0 ? "var(--warning)" : "var(--text-primary)" }}>
              ${totalSpend < 0.01 && totalSpend > 0 ? totalSpend.toFixed(5) : totalSpend.toFixed(4)}
            </span>
          </div>
          <button className="btn primary" onClick={pullInfo} disabled={pulling}>{pulling ? "Updating Info…" : "⇩ Pull Info"}</button>
          {pulling && phase ? (
            <span className="mono" style={{ fontSize: 12, color: "var(--primary)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span className="live-indicator" />{phase}
            </span>
          ) : (
            <span style={{ fontSize: 11.5, color: "var(--text-tertiary)" }} title="Finds and sets Context window, Input/Output pricing, and Modalities for all models in the gateway without pulling new models.">
              ⓘ Discovers and sets Context, Pricing, and Modalities for all existing models
            </span>
          )}
        </div>
      </div>

      <div className="toolbar-row" style={{ marginBottom: 12 }}>
        <div className="search-bar-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" className="input-field" placeholder="Search models, modalities, providers…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{filtered.length} of {rows.length} models available</span>
      </div>

      <div className="toolbar-row" style={{ gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        <Dropdown label="Provider" value={provFilter} onPick={setProvFilter}
          options={[{ value: "All", label: "All providers" }, ...providers.map((p) => ({ value: p, label: p }))]} />
        <Dropdown label="Modality" value={modFilter} onPick={setModFilter}
          options={[{ value: "All", label: "All modalities" }, ...modalities.map((x) => ({ value: x, label: x }))]} />
        <Dropdown label="Params" value={paramFilter} onPick={setParamFilter}
          options={["All", "Tiny (<100M)", "Small (<10B)", "Medium (10–70B)", "Large (>70B)", "Unknown"].map((x) => ({ value: x, label: x === "All" ? "Any size" : x }))} />
        <Dropdown label="Context" value={ctxFilter} onPick={setCtxFilter}
          options={["All", "≤ 32K", "≤ 128K", "> 128K", "Unknown"].map((x) => ({ value: x, label: x === "All" ? "Any context" : x }))} />
        <Dropdown label="Price" value={priceFilter} onPick={setPriceFilter}
          options={[{ value: "All", label: "Any price" }, { value: "Free", label: "Free" }, { value: "Paid", label: "Paid" }, { value: "Spent", label: "Has Spend" }]} />
        {["Cache discount", "No BYOK"].map((f) => (
          <button key={f} className="btn sm" onClick={() => toast.show(`Filter: ${f} — no data yet`)}>{f}</button>
        ))}
      </div>

      <div className="table-wrapper">
        <div className="table-scroll">
          <table className="table-center">
            <thead>
              <tr>
                <th onClick={() => toggleSort("name")} style={{ cursor: "pointer", userSelect: "none" }}>
                  Model {sortCol === "name" ? (sortAsc ? "▲" : "▼") : ""}
                </th>
                <th>Providers</th>
                <th className="num" onClick={() => toggleSort("params")} style={{ cursor: "pointer", userSelect: "none" }}>
                  Params {sortCol === "params" ? (sortAsc ? "▲" : "▼") : ""}
                </th>
                <th className="num" onClick={() => toggleSort("score")} style={{ cursor: "pointer", userSelect: "none" }}>
                  Score {sortCol === "score" ? (sortAsc ? "▲" : "▼") : ""}
                </th>
                <th className="num">Context</th>
                <th className="num" onClick={() => toggleSort("inputPrice")} style={{ cursor: "pointer", userSelect: "none" }}>
                  Input $/M {sortCol === "inputPrice" ? (sortAsc ? "▲" : "▼") : ""}
                </th>
                <th className="num" onClick={() => toggleSort("outputPrice")} style={{ cursor: "pointer", userSelect: "none" }}>
                  Output $/M {sortCol === "outputPrice" ? (sortAsc ? "▲" : "▼") : ""}
                </th>
                <th className="num" onClick={() => toggleSort("spend")} style={{ cursor: "pointer", userSelect: "none", color: "var(--warning)" }}>
                  Spent {sortCol === "spend" ? (sortAsc ? "▲" : "▼") : ""}
                </th>
                <th>Modalities</th>
                <th>Capabilities</th>
                <th className="num" onClick={() => toggleSort("toks")} style={{ cursor: "pointer", userSelect: "none" }}>
                  Tok/s {sortCol === "toks" ? (sortAsc ? "▲" : "▼") : ""}
                </th>
                <th className="num" onClick={() => toggleSort("ttft")} style={{ cursor: "pointer", userSelect: "none" }}>
                  TTFT {sortCol === "ttft" ? (sortAsc ? "▲" : "▼") : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{m.displayName}</div>
                    <div className="mono" style={{ color: "var(--text-tertiary)", fontSize: 11.5, marginTop: 2 }}>{m.slug}</div>
                  </td>
                  <td><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}><span className="pill subtle">{m.provider.name.toUpperCase()}</span></div></td>
                  <td className="num">
                    <span
                      className="mono pill subtle"
                      style={{
                        fontWeight: 600,
                        fontSize: 11,
                        padding: "2px 7px",
                        background: "var(--bg-surface-elevated)",
                      }}
                    >
                      {m.params || inferModelParams(m.slug)}
                    </span>
                  </td>
                  <td className="num">
                    {(() => {
                      const s = m.score ?? inferModelScore(m.slug, m.params);
                      const color = s >= 90 ? "#10b981" : s >= 80 ? "var(--primary)" : "var(--warning)";
                      return (
                        <span
                          className="mono"
                          style={{
                            fontWeight: 700,
                            fontSize: 12,
                            color,
                            display: "inline-flex",
                            alignItems: "baseline",
                            gap: 2,
                          }}
                        >
                          <span>{s}</span>
                          <span style={{ fontSize: 9.5, color: "var(--text-tertiary)", fontWeight: 400 }}>/100</span>
                        </span>
                      );
                    })()}
                  </td>
                  <td className="num mono">{m.contextWindow}</td>
                  <td className="num mono" style={{ color: m.inputPrice === 0 ? "inherit" : "var(--primary)" }}>{fmtModelPrice(m.inputPrice)}</td>
                  <td className="num mono">{fmtModelPrice(m.outputPrice)}</td>
                  <td className="num mono" style={{ color: (m.spend ?? 0) > 0 ? "var(--warning)" : "var(--text-tertiary)", fontWeight: (m.spend ?? 0) > 0 ? 600 : 400 }}>
                    ${(m.spend ?? 0) < 0.0001 && (m.spend ?? 0) > 0 ? (m.spend ?? 0).toFixed(6) : (m.spend ?? 0).toFixed(4)}
                  </td>
                  <td><ModalityIcons mods={m.modalities} /></td>
                  <td><span className="pill subtle">{m.status}</span></td>
                  <td className="num mono">{fmtTps(m.toksPerSec)}</td>
                  <td className="num mono">{fmtTtft(m.ttftMs)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={12}><div className="empty-state-box">No models yet — connect a provider and pull its live registry.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p style={{ color: "var(--text-tertiary)", fontSize: 11.5 }}>
        Prices reflect cost per 1 Million (1M) prompt &amp; completion tokens on the cheapest verified route. Models marked <strong style={{ color: "#10b981" }}>Free</strong> incur zero token charges. Throughput (tok/s) and Time to First Token (TTFT) are updated continuously via real-time trace telemetry.
      </p>
    </>
  );
}
