"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

interface Provider {
  slug: string;
  name: string;
  icon: string;
  color?: string;
  category: "apikey" | "freeTier" | "free" | "oauth" | "webCookie";
  website?: string;
  apiKeyUrl?: string;
  logoUrl: string;
  connected: boolean;
  modelCount: number;
  serviceKinds?: string[];
}

type TabKey = "all" | "connected" | "apikey" | "freeTier" | "free" | "oauth";

export default function ProvidersPage() {
  const [rows, setRows] = useState<Provider[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => r.json())
      .then((d) => setRows(d.providers ?? []))
      .catch(() => {});
  }, []);

  const counts = useMemo(() => {
    return {
      all: rows.length,
      connected: rows.filter((p) => p.connected).length,
      apikey: rows.filter((p) => p.category === "apikey").length,
      freeTier: rows.filter((p) => p.category === "freeTier").length,
      free: rows.filter((p) => p.category === "free").length,
      oauth: rows.filter((p) => p.category === "oauth" || p.category === "webCookie").length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((p) => {
      // Tab filter
      if (activeTab === "connected" && !p.connected) return false;
      if (activeTab === "apikey" && p.category !== "apikey") return false;
      if (activeTab === "freeTier" && p.category !== "freeTier") return false;
      if (activeTab === "free" && p.category !== "free") return false;
      if (activeTab === "oauth" && p.category !== "oauth" && p.category !== "webCookie") return false;

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
      }
      return true;
    });
  }, [rows, activeTab, search]);

  const categoryLabel = (cat: string) => {
    switch (cat) {
      case "freeTier": return "Free Tier";
      case "free": return "Free / Local";
      case "oauth": return "OAuth / CLI";
      case "webCookie": return "Web Cookie";
      case "apikey":
      default: return "API Key";
    }
  };

  return (
    <>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 className="page-title">Provider Connections ({rows.length})</h1>
          <p className="page-sub">
            Connect your custom provider keys to route model calls directly across your core AI providers with zero markup.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="text"
            placeholder="Search providers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid var(--border-color, rgba(255,255,255,0.12))",
              background: "var(--bg-surface, rgba(255,255,255,0.05))",
              color: "inherit",
              fontSize: "13px",
              minWidth: "220px",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { key: "all", label: `All (${counts.all})` },
          { key: "connected", label: `Connected (${counts.connected})` },
          { key: "apikey", label: `API Key (${counts.apikey})` },
          { key: "freeTier", label: `Free Tier (${counts.freeTier})` },
          { key: "free", label: `Local & Free (${counts.free})` },
          { key: "oauth", label: `CLI & OAuth (${counts.oauth})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabKey)}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              border: "1px solid",
              borderColor: activeTab === tab.key ? "var(--primary, #0ea5e9)" : "transparent",
              background: activeTab === tab.key ? "rgba(14, 165, 233, 0.15)" : "var(--bg-surface, rgba(255,255,255,0.04))",
              color: activeTab === tab.key ? "var(--primary, #0ea5e9)" : "var(--text-muted, #94a3b8)",
              transition: "all 0.15s ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="provider-grid">
        {filtered.map((p) => (
          <Link key={p.slug} href={`/dashboard/providers/${p.slug}`} className="provider-card" style={{ position: "relative" }}>
            <div className="provider-card-head">
              {p.logoUrl ? (
                <img src={p.logoUrl} alt={`${p.name} logo`} style={{ width: 34, height: 34, objectFit: "contain", borderRadius: 8 }} />
              ) : (
                  <div
                    className="provider-icon-badge"
                    style={{
                      color: p.color || "var(--primary)",
                      borderColor: p.color ? `${p.color}44` : undefined,
                    }}
                  >
                    {p.icon && /^[a-z0-9_]+$/.test(p.icon) ? (
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{p.icon}</span>
                    ) : (
                      p.icon || "⏣"
                    )}
                  </div>
              )}
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {p.connected ? (
                  <span className="pill active">● Connected</span>
                ) : (
                  <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", color: "var(--text-muted, #94a3b8)" }}>
                    {categoryLabel(p.category)}
                  </span>
                )}
                <span className="provider-connect-link">›</span>
              </div>
            </div>
            <div>
              <div className="provider-name">{p.name}</div>
              <div className="provider-status-text" style={p.connected ? { color: "var(--primary)" } : {}}>
                {p.connected
                  ? `Connected · ${p.modelCount} models`
                  : p.modelCount > 0
                  ? `${p.modelCount} models available`
                  : "Click to configure"}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted, #94a3b8)" }}>
          No providers found matching "{search}".
        </div>
      )}
    </>
  );
}

