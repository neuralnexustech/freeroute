"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { MITM_TOOLS, MitmToolCard } from "@/lib/cliTools";

interface ComboOption {
  id: string;
  name: string;
  strategy: string;
}

interface ModelOption {
  id: string;
  displayName?: string;
  provider?: { slug: string; name: string };
}

interface MitmStatusData {
  mappings: Record<string, Record<string, string>>;
  gatewayUrl: string;
  port: number;
  serverRunning: boolean;
  certExists: boolean;
  platform: string;
}

export default function MitmDashboardPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [combos, setCombos] = useState<ComboOption[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [mitmStatus, setMitmStatus] = useState<MitmStatusData | null>(null);
  const [mappings, setMappings] = useState<Record<string, Record<string, string>>>({});
  const [savingTool, setSavingTool] = useState<string | null>(null);

  const fetchAll = async () => {
    try {
      const [mitmRes, combosRes, modelsRes] = await Promise.all([
        fetch("/api/cli-tools/mitm-settings").then((r) => r.json()).catch(() => null),
        fetch("/api/combos").then((r) => r.json()).catch(() => ({ combos: [] })),
        fetch("/api/v1/models").then((r) => r.json()).catch(() => ({ data: [] })),
      ]);

      if (mitmRes) {
        setMitmStatus(mitmRes);
        if (mitmRes.mappings) {
          setMappings(mitmRes.mappings);
        }
      }

      setCombos(combosRes?.combos || []);
      const rawModels = modelsRes?.data || [];
      setModels(rawModels.filter((m: any) => m.provider?.slug !== "combo"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleSelectMapping = (toolId: string, alias: string, targetValue: string) => {
    setMappings((prev) => ({
      ...prev,
      [toolId]: {
        ...(prev[toolId] || {}),
        [alias]: targetValue,
      },
    }));
  };

  const handleSaveMappings = async (toolId: string) => {
    setSavingTool(toolId);
    try {
      const toolMappings = mappings[toolId] || {};
      const res = await fetch("/api/cli-tools/mitm-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: toolId, mappings: toolMappings }),
      });
      if (res.ok) {
        toast.show(`Mappings for ${toolId} saved successfully!`);
      } else {
        toast.show(`Failed to save mappings for ${toolId}`);
      }
    } catch (e: any) {
      toast.show(e.message || "Error saving mappings");
    } finally {
      setSavingTool(null);
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.show(`${label} copied to clipboard!`);
  };

  const allHostsLines = useMemo(() => {
    const lines: string[] = [];
    MITM_TOOLS.forEach((tool) => {
      lines.push(`127.0.0.1 ${tool.mitmDomain}`);
      if (tool.secondaryDomains) {
        tool.secondaryDomains.forEach((d) => lines.push(`127.0.0.1 ${d}`));
      }
    });
    return lines.join("\n");
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24, paddingBottom: 64 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(168, 85, 247, 0.12)",
                color: "#a855f7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              MITM Tools & Proxy
            </h1>
            <span
              style={{
                background: "rgba(168, 85, 247, 0.15)",
                color: "#c084fc",
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.04em",
              }}
            >
              HTTPS INTERCEPT
            </span>
          </div>
          <p style={{ fontSize: 13.5, color: "var(--text-tertiary)", margin: "6px 0 0 0" }}>
            Intercept and map native IDE HTTPS completions (Google Antigravity, GitHub Copilot, Kiro) to your gateway combos and models.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Link
            href="/dashboard/cli-tools"
            className="btn-secondary"
            style={{ fontSize: 12.5, padding: "7px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>terminal</span>
            Standard CLI Tools
          </Link>
          <button
            type="button"
            onClick={fetchAll}
            className="btn-secondary"
            style={{ fontSize: 12.5, padding: "7px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {/* Security Warning Banner */}
      <div
        style={{
          background: "rgba(239, 68, 68, 0.08)",
          border: "1px solid rgba(239, 68, 68, 0.25)",
          borderRadius: 10,
          padding: "14px 18px",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <span className="material-symbols-outlined" style={{ color: "#ef4444", fontSize: 20, marginTop: 1 }}>
          warning
        </span>
        <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--text-secondary)" }}>
          <strong style={{ color: "#f87171" }}>Security & ToS Notice: </strong>
          MITM proxy intercepts outgoing HTTPS traffic for specific IDE endpoints via local DNS redirection (hosts file) to route completions through your gateway. This allows using any model in tools that otherwise do not support custom base URLs. Use responsibly at your own discretion.
        </div>
      </div>

      {/* Infrastructure Card */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 12,
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="material-symbols-outlined" style={{ color: "var(--primary)", fontSize: 22 }}>
              dns
            </span>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                Local Redirection & Hosts Setup
              </h3>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "2px 0 0 0" }}>
                Add the target tool domains to your system hosts file pointing to 127.0.0.1
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => copyText(allHostsLines, "All hosts entries")}
            className="btn-secondary"
            style={{ fontSize: 12, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>content_copy</span>
            Copy All Hosts Entries
          </button>
        </div>

        {/* Code Snippet Box */}
        <div
          style={{
            background: "var(--bg-app)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            padding: "12px 14px",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            color: "var(--text-primary)",
            lineHeight: 1.7,
            position: "relative",
          }}
        >
          <div style={{ color: "var(--text-tertiary)", marginBottom: 4, fontSize: 11 }}>
            # Windows: C:\Windows\System32\drivers\etc\hosts | macOS / Linux: /etc/hosts
          </div>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{allHostsLines}</pre>
        </div>
      </div>

      {/* MITM Tools List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {MITM_TOOLS.map((tool) => {
          const toolMappings = mappings[tool.id] || {};
          const isSaving = savingTool === tool.id;

          return (
            <div
              key={tool.id}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 14,
                padding: "22px 26px",
                display: "flex",
                flexDirection: "column",
                gap: 18,
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
              }}
            >
              {/* Tool Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: "var(--bg-surface-elevated)",
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    {tool.icon ? (
                      <img
                        src={tool.icon}
                        alt={tool.name}
                        width={32}
                        height={32}
                        style={{ objectFit: "contain", borderRadius: 6 }}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <span style={{ fontWeight: 800, fontSize: 14, color: "#a855f7" }}>{tool.textIcon}</span>
                    )}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                        {tool.name}
                      </h2>
                      <span
                        style={{
                          background: "rgba(168, 85, 247, 0.15)",
                          color: "#c084fc",
                          padding: "1px 7px",
                          borderRadius: 6,
                          fontSize: 10.5,
                          fontWeight: 700,
                        }}
                      >
                        MITM
                      </span>
                    </div>
                    <p style={{ fontSize: 12.5, color: "var(--text-tertiary)", margin: "3px 0 0 0" }}>
                      {tool.description}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      background: "var(--bg-surface-elevated)",
                      border: "1px solid var(--border-subtle)",
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 11.5,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a855f7" }} />
                    {tool.mitmDomain}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText(`127.0.0.1 ${tool.mitmDomain}`, `${tool.name} DNS Host`)}
                    className="btn-secondary"
                    style={{ fontSize: 11.5, padding: "5px 9px", display: "inline-flex", alignItems: "center", gap: 4 }}
                    title="Copy 127.0.0.1 host entry"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>content_copy</span>
                    Copy Host
                  </button>
                </div>
              </div>

              {/* Wire Model Mapping Table */}
              <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    Intercepted Model Aliases & Route Mappings
                  </span>
                  <span style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>
                    Maps internal wire model IDs to your chosen Combo or Provider Model
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                    gap: 12,
                  }}
                >
                  {tool.defaultModels.map((item) => {
                    const currentTarget = toolMappings[item.alias] || "";

                    return (
                      <div
                        key={item.alias}
                        style={{
                          background: "var(--bg-surface-elevated)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: 8,
                          padding: "10px 14px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                            {item.name}
                          </span>
                          <span
                            className="mono"
                            style={{
                              fontSize: 10.5,
                              color: "var(--text-tertiary)",
                              background: "rgba(255,255,255,0.04)",
                              padding: "1px 5px",
                              borderRadius: 4,
                            }}
                          >
                            {item.alias}
                          </span>
                        </div>

                        <select
                          value={currentTarget}
                          onChange={(e) => handleSelectMapping(tool.id, item.alias, e.target.value)}
                          style={{
                            width: "100%",
                            padding: "6px 10px",
                            borderRadius: 6,
                            border: "1px solid var(--border-default)",
                            background: "var(--bg-surface)",
                            fontSize: 12,
                            color: "var(--text-primary)",
                            outline: "none",
                          }}
                        >
                          <option value="">-- Use Default / Smart Fallback --</option>
                          {combos.length > 0 && (
                            <optgroup label="Combos (Failover & Smart Routing)">
                              {combos.map((c) => (
                                <option key={`combo-${c.id}`} value={c.name}>
                                  ⚡ {c.name} ({c.strategy})
                                </option>
                              ))}
                            </optgroup>
                          )}
                          <optgroup label="Direct Provider Models">
                            {models.map((m) => (
                              <option key={`m-${m.id}`} value={m.id}>
                                {m.id}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={() => handleSaveMappings(tool.id)}
                    disabled={isSaving}
                    className="btn-primary"
                    style={{
                      fontSize: 12.5,
                      padding: "8px 18px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      {isSaving ? "hourglass_empty" : "save"}
                    </span>
                    {isSaving ? "Saving..." : `Save ${tool.name} Mappings`}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
