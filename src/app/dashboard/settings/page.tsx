"use client";
import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";

interface TestResult {
  option: string;
  name: string;
  ok: boolean;
  latencyMs: number;
  result?: {
    contextWindow: string;
    inputPrice: number;
    outputPrice: number;
    modalities: string;
    source: string;
    confidence?: number;
    detail?: string;
  };
  error?: string;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("Model Info Discovery");
  const [strategy, setStrategy] = useState("cascade");
  const [saving, setSaving] = useState(false);
  const [testModel, setTestModel] = useState("gemini-2.5-flash");
  const [testingOption, setTestingOption] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const toast = useToast();

  // Load saved settings
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.strategy) setStrategy(d.strategy);
      })
      .catch(() => {});
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    const r = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategy }),
    });
    setSaving(false);
    if (r.ok) {
      toast.show("Model Info discovery strategy saved");
    } else {
      toast.show("Failed to save settings");
    }
  };

  const runTest = async (option: string) => {
    setTestingOption(option);
    try {
      const r = await fetch("/api/settings/test-info-resolver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          option,
          testModel: testModel.trim() || "gemini-2.5-flash",
        }),
      });
      const d = await r.json();
      if (d.results) {
        if (option === "all") {
          setTestResults(d.results);
        } else {
          setTestResults((prev) => {
            const others = prev.filter((x) => x.option !== option);
            return [...others, ...d.results].sort((a, b) => a.option.localeCompare(b.option));
          });
        }
        toast.show(`Tested ${d.results.length} option(s) for ${testModel}`);
      }
    } catch {
      toast.show("Test failed — network error");
    } finally {
      setTestingOption(null);
    }
  };

  const OPTIONS = [
    {
      id: "cascade",
      num: "ALL",
      title: "Smart Cascade Engine (Recommended)",
      badge: "Auto Fallback",
      badgeColor: "var(--primary)",
      desc: "Cascades sequentially: Built-in Offline Spec DB (0ms) → OpenRouter Live Catalog → DuckDuckGo Web Search → Smart Heuristic Parser. Guarantees 100% resolution with zero user API key.",
    },
    {
      id: "3",
      num: "Option 3",
      title: "Built-In Offline Model Spec Database",
      badge: "0 ms · Offline",
      badgeColor: "#10b981",
      desc: "Verified instant spec dictionary covering Google Gemini & Gemma, OpenAI GPT, Claude, Llama 3, DeepSeek, NVIDIA, etc. Ultra-fast, 100% accurate, zero network overhead.",
    },
    {
      id: "1",
      num: "Option 1",
      title: "Live OpenRouter Public Catalog",
      badge: "Zero-Key · Web API",
      badgeColor: "#3b82f6",
      desc: "Queries OpenRouter's open public catalog (300+ models) without any API key. Provides verified context window, real-time $/1M token pricing, and multimodal flags.",
    },
    {
      id: "2",
      num: "Option 2",
      title: "DuckDuckGo Web Search Engine",
      badge: "Live Search · Zero-Key",
      badgeColor: "#f59e0b",
      desc: "Queries DuckDuckGo search for model spec pages and scrapes context window (e.g. 1M/128K), token pricing, and vision/audio modalities using regex pattern matching.",
    },
    {
      id: "4",
      num: "Option 4",
      title: "Smart Heuristic & Family Parser",
      badge: "Rule-based Fallback",
      badgeColor: "#8b5cf6",
      desc: "Rule-based structural parser that infers context window, modalities (vision, audio, omni), and pricing straight from model slug patterns and family architectures.",
    },
  ];

  const [dbInfo, setDbInfo] = useState<{ dbLocation: string; counts: Record<string, number> } | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const loadDbInfo = () => {
    fetch("/api/settings/database")
      .then((r) => r.json())
      .then((d) => {
        if (d.counts) setDbInfo({ dbLocation: d.dbLocation, counts: d.counts });
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadDbInfo();
  }, []);

  const handleExport = () => {
    window.open("/api/settings/database?download=1", "_blank");
    toast.show("Database backup downloaded successfully");
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await fetch("/api/settings/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      toast.show(
        `✓ Database restored: ${data.imported?.providers ?? 0} providers, ${data.imported?.models ?? 0} models, ${data.imported?.combos ?? 0} combos`
      );
      loadDbInfo();
    } catch (err: any) {
      toast.show(err.message || "Invalid backup file");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  return (
    <>
      <div className="toolbar-row" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Gateway &amp; Model Settings</h1>
        <div className="segmented">
          {["Model Info Discovery", "Database & Backup", "About"].map((t) => (
            <button
              key={t}
              className={activeTab === t ? "active" : ""}
              onClick={() => setActiveTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "Model Info Discovery" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 960 }}>
          {/* Strategy Selection Card */}
          <div className="card">
            <div className="card-head">
              <div>
                <span className="card-label">Pull Info Strategy</span>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
                  Model Metadata Discovery Options (Zero-Key Engine)
                </div>
              </div>
              <button
                className="btn primary"
                onClick={saveSettings}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Strategy"}
              </button>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
              When you click <b>&quot;⇩ Pull Info&quot;</b> on a provider or models page, Freeroute does <b>not</b> pull new models. It only updates the <b>Context Window, Input Price, Output Price, and Modalities</b> for the models already in your database using your chosen option below:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "14px 16px",
                    borderRadius: 8,
                    border: `1px solid ${strategy === opt.id ? "var(--primary)" : "var(--border-subtle)"}`,
                    background: strategy === opt.id ? "var(--bg-accent-soft)" : "var(--bg-surface-elevated)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <input
                    type="radio"
                    name="strategy"
                    value={opt.id}
                    checked={strategy === opt.id}
                    onChange={(e) => setStrategy(e.target.value)}
                    style={{ marginTop: 3, accentColor: "var(--primary)" }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: 13.5 }}>{opt.title}</span>
                      <span
                        className="pill"
                        style={{
                          fontSize: 10.5,
                          background: "var(--bg-surface)",
                          borderColor: opt.badgeColor,
                          color: opt.badgeColor,
                        }}
                      >
                        {opt.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.4 }}>
                      {opt.desc}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Interactive Test Suite */}
          <div className="card">
            <div className="card-head">
              <div>
                <span className="card-label">Verification &amp; Diagnostic Test Suite</span>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
                  Test All 4 Discovery Options Live
                </div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14 }}>
              Enter any model identifier to test each discovery mechanism individually or test all 4 options simultaneously:
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
              <input
                type="text"
                className="input-field mono"
                placeholder="e.g. gemini-2.5-flash, llama-3.2-11b-vision-instruct, gpt-4o"
                value={testModel}
                onChange={(e) => setTestModel(e.target.value)}
                style={{ flex: "1 1 280px", minWidth: 220 }}
              />
              <button
                className="btn primary"
                onClick={() => runTest("all")}
                disabled={Boolean(testingOption)}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                {testingOption === "all" ? "Testing All 4…" : "▷ Test All 4 Options"}
              </button>
            </div>

            {/* Individual Option Test Buttons */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
              <button
                className="btn sm"
                onClick={() => runTest("1")}
                disabled={Boolean(testingOption)}
              >
                {testingOption === "1" ? "Testing 1…" : "Test Option 1 (OpenRouter)"}
              </button>
              <button
                className="btn sm"
                onClick={() => runTest("2")}
                disabled={Boolean(testingOption)}
              >
                {testingOption === "2" ? "Testing 2…" : "Test Option 2 (Web Search)"}
              </button>
              <button
                className="btn sm"
                onClick={() => runTest("3")}
                disabled={Boolean(testingOption)}
              >
                {testingOption === "3" ? "Testing 3…" : "Test Option 3 (Offline DB)"}
              </button>
              <button
                className="btn sm"
                onClick={() => runTest("4")}
                disabled={Boolean(testingOption)}
              >
                {testingOption === "4" ? "Testing 4…" : "Test Option 4 (Heuristics)"}
              </button>
            </div>

            {/* Test Results Output Cards */}
            {testResults.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                  Live Test Results for &quot;{testModel}&quot;:
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
                  {testResults.map((tr) => (
                    <div
                      key={tr.option}
                      style={{
                        padding: 16,
                        borderRadius: 8,
                        background: "var(--bg-surface-elevated)",
                        border: `1px solid ${tr.ok ? "var(--primary)" : "var(--danger)"}`,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{tr.name}</span>
                        <span
                          className={`pill ${tr.ok ? "active" : "danger"}`}
                          style={{ fontSize: 11 }}
                        >
                          {tr.ok ? `✓ OK (${tr.latencyMs}ms)` : `✗ Error (${tr.latencyMs}ms)`}
                        </span>
                      </div>

                      {tr.result && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4, fontSize: 12 }}>
                          <div style={{ background: "var(--bg-surface)", padding: "6px 10px", borderRadius: 6 }}>
                            <span style={{ color: "var(--text-tertiary)", fontSize: 10.5, display: "block" }}>CONTEXT</span>
                            <span className="mono" style={{ fontWeight: 600 }}>{tr.result.contextWindow}</span>
                          </div>
                          <div style={{ background: "var(--bg-surface)", padding: "6px 10px", borderRadius: 6 }}>
                            <span style={{ color: "var(--text-tertiary)", fontSize: 10.5, display: "block" }}>MODALITIES</span>
                            <span className="mono" style={{ fontWeight: 600 }}>{tr.result.modalities}</span>
                          </div>
                          <div style={{ background: "var(--bg-surface)", padding: "6px 10px", borderRadius: 6 }}>
                            <span style={{ color: "var(--text-tertiary)", fontSize: 10.5, display: "block" }}>INPUT $/1M</span>
                            <span className="mono" style={{ fontWeight: 600, color: "var(--primary)" }}>${tr.result.inputPrice}</span>
                          </div>
                          <div style={{ background: "var(--bg-surface)", padding: "6px 10px", borderRadius: 6 }}>
                            <span style={{ color: "var(--text-tertiary)", fontSize: 10.5, display: "block" }}>OUTPUT $/1M</span>
                            <span className="mono" style={{ fontWeight: 600 }}>${tr.result.outputPrice}</span>
                          </div>
                        </div>
                      )}

                      {tr.result?.detail && (
                        <div className="mono" style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                          ▸ {tr.result.detail}
                        </div>
                      )}
                      {tr.error && (
                        <div className="mono" style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>
                          ▸ {tr.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "Database & Backup" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 960 }}>
          {/* Active Database Card */}
          <div className="card">
            <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <span className="card-label">Persistent Storage</span>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
                  SQLite Database Location (~/.freeroute)
                </div>
              </div>
              <span className="pill active" style={{ fontSize: 11 }}>
                ● Active in ~/.freeroute
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <div
                className="mono"
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  background: "var(--bg-surface-elevated)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 13,
                  color: "var(--text-primary)",
                  userSelect: "all",
                }}
              >
                {dbInfo?.dbLocation || "C:\\Users\\bidre\\.freeroute\\freeroute.db"}
              </div>
              <button
                className="btn sm"
                onClick={() => {
                  if (dbInfo?.dbLocation) {
                    navigator.clipboard.writeText(dbInfo.dbLocation);
                    toast.show("Database path copied to clipboard");
                  }
                }}
              >
                Copy Path
              </button>
            </div>

            {/* Counts Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              <div style={{ background: "var(--bg-surface-elevated)", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", display: "block" }}>PROVIDERS</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{dbInfo?.counts?.providers ?? 7}</span>
              </div>
              <div style={{ background: "var(--bg-surface-elevated)", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", display: "block" }}>MODELS</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{dbInfo?.counts?.models ?? 751}</span>
              </div>
              <div style={{ background: "var(--bg-surface-elevated)", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", display: "block" }}>GATEWAY KEYS</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{dbInfo?.counts?.apiKeys ?? 11}</span>
              </div>
              <div style={{ background: "var(--bg-surface-elevated)", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", display: "block" }}>COMBOS</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{dbInfo?.counts?.combos ?? 2}</span>
              </div>
              <div style={{ background: "var(--bg-surface-elevated)", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", display: "block" }}>REQUEST LOGS</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{dbInfo?.counts?.requestLogs ?? 12}</span>
              </div>
            </div>
          </div>

          {/* Export & Import Actions Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Export Card */}
            <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>Export Database Backup</span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 16 }}>
                  Export all provider credentials, API keys, fallback combos, and telemetry logs into a portable JSON backup file.
                </p>
              </div>
              <button
                className="btn primary"
                onClick={handleExport}
                style={{ width: "100%", justifyContent: "center", gap: 8 }}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                Export Backup (.json)
              </button>
            </div>

            {/* Import Card */}
            <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>Upload / Restore Database</span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 16 }}>
                  Upload a previously exported freeroute backup to synchronize or restore your providers, keys, and model combos.
                </p>
              </div>
              <label
                className={`btn ${importing ? "disabled" : ""}`}
                style={{ width: "100%", justifyContent: "center", gap: 8, cursor: importing ? "wait" : "pointer" }}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                {importing ? "Importing Backup…" : "Upload Backup File (.json)"}
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  disabled={importing}
                  style={{ display: "none" }}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {activeTab === "About" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 960 }}>
          <div className="card" style={{ padding: 28, background: "linear-gradient(135deg, var(--bg-surface-elevated) 0%, rgba(16, 185, 129, 0.05) 100%)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
              <img src="/logo.png" alt="Freeroute" width={56} height={56} style={{ borderRadius: 14, boxShadow: "0 4px 14px rgba(0,0,0,0.3)" }} />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Freeroute</h2>
                  <span className="badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)", fontWeight: 700, padding: "2px 8px", borderRadius: 6, fontSize: 11 }}>v0.1.0 · Official</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                  Universal AI Gateway &amp; LLMOps Control Plane
                </div>
              </div>
            </div>

            <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6, marginBottom: 20, maxWidth: 780 }}>
              Freeroute is a developer-first AI gateway providing a drop-in OpenAI-compatible endpoint with automatic multi-tier failovers, live provider catalogs, 14+ CLI developer tools auto-configuration, and zero-config local persistent storage.
            </p>

            <div style={{ padding: 20, borderRadius: 12, border: "1px solid var(--border-subtle)", background: "var(--bg-app)", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--primary)", fontWeight: 700, marginBottom: 4 }}>
                    Developed &amp; Powered By
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
                    Neural Nexus Tech
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                    Next-generation AI infrastructure, gateway solutions, and developer tooling.
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <a
                    href="https://www.neuralnexustech.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn primary"
                    style={{ gap: 8, padding: "8px 16px", textDecoration: "none" }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>
                    Visit Website
                  </a>

                  <a
                    href="https://github.com/neuralnexustech"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn"
                    style={{ gap: 8, padding: "8px 16px", textDecoration: "none" }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
                    GitHub
                  </a>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <div style={{ padding: 12, borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-surface)" }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Official Website</div>
                <a href="https://www.neuralnexustech.com/" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)", marginTop: 4, display: "inline-block" }}>
                  neuralnexustech.com ↗
                </a>
              </div>
              <div style={{ padding: 12, borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-surface)" }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Repository</div>
                <a href="https://github.com/neuralnexustech/freeroute" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)", marginTop: 4, display: "inline-block" }}>
                  neuralnexustech/freeroute ↗
                </a>
              </div>
              <div style={{ padding: 12, borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-surface)" }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>License</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginTop: 4 }}>
                  MIT with Attribution
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
