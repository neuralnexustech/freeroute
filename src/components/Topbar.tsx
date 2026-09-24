"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "./ThemeProvider";
import { useToast } from "./Toast";
import { useLiveTelemetry } from "@/hooks/useLiveTelemetry";
import { useAutoSync } from "@/hooks/useAutoSync";

export function Topbar() {
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const { syncState, openPopup } = useAutoSync();
  const [stats, setStats] = useState<{ spend: number; tokens: number; rtkTokensSaved: number } | null>(null);

  const fetchStats = () => {
    fetch("/api/overview")
      .then((r) => r.json())
      .then((d) =>
        setStats({
          spend: d.spend ?? 0,
          tokens: d.tokens ?? 0,
          rtkTokensSaved: d.rtkTokensSaved ?? 0,
        })
      )
      .catch(() => {});
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useLiveTelemetry(fetchStats);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="mobile-menu-btn"
          aria-label="Open mobile menu"
          onClick={() => document.getElementById("app-sidebar")?.classList.toggle("open")}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
        </button>
        <div className="workspace-badge" style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <img
            src="/logo.png"
            alt="freeroute"
            style={{ width: 16, height: 16, objectFit: "contain", borderRadius: 3, flexShrink: 0 }}
          />
          <span className="live-indicator"></span>
          <span><b>freeroute</b> / production-gateway</span>
        </div>
      </div>

      <div className="topbar-right">
        <div className="stats-ticker">
          <div className="ticker-item">Spend (30d): <span>${(stats?.spend ?? 0).toFixed(2)}</span></div>
          <div className="ticker-item">Tokens: <span>{stats?.tokens ?? 0}</span></div>
          <div className="ticker-item" title="RTK: Real-Time Context Token Compression active">
            <span style={{ color: "#10b981", fontWeight: 600 }}>⚡ RTK Saved:</span>{" "}
            <span style={{ color: "#10b981", fontWeight: 700 }}>
              {(stats?.rtkTokensSaved ?? 0).toLocaleString()} tok
            </span>
          </div>
          <div className="ticker-item">Health: <span style={{ color: "var(--primary)" }}>99.98%</span></div>
          {syncState.active ? (
            <div
              className="ticker-item"
              onClick={openPopup}
              style={{
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(99, 102, 241, 0.12)",
                border: "1px solid rgba(99, 102, 241, 0.35)",
                padding: "2px 8px",
                borderRadius: 12,
                color: "var(--primary, #6366f1)",
                fontWeight: 600,
                fontSize: 11,
                transition: "all 0.2s ease",
                userSelect: "none",
              }}
              title="Auto-Sync in progress — click to view live details"
            >
              <svg
                style={{ animation: "topbar-spin 1.4s linear infinite", flexShrink: 0 }}
                viewBox="0 0 24 24"
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <span>
                Auto-Syncing{syncState.total > 0 ? ` (${syncState.current}/${syncState.total})` : "…"}
              </span>
            </div>
          ) : syncState.stage === "complete" ? (
            <div
              className="ticker-item"
              onClick={openPopup}
              style={{
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: "rgba(16, 185, 129, 0.12)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                padding: "2px 8px",
                borderRadius: 12,
                color: "#10b981",
                fontWeight: 600,
                fontSize: 11,
                transition: "all 0.2s ease",
                userSelect: "none",
              }}
              title="Auto-Sync finished — click to view summary"
            >
              <span style={{ fontSize: 11 }}>✓</span>
              <span>Synced</span>
            </div>
          ) : null}
        </div>



        <button className="theme-toggle-btn" title="Toggle Light/Dark Theme" aria-label="Toggle dark/light theme" onClick={() => { toggle(); toast.show(`Switched to ${theme === "dark" ? "light" : "dark"} theme`); }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: theme === "light" ? "block" : "none" }}><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: theme === "dark" ? "block" : "none" }}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
        </button>

        <button className="btn sm" onClick={() => toast.show("Quick Command menu opened [⌘K]")}>
          <span className="mono" style={{ opacity: 0.7 }}>⌘K</span> Search
        </button>
      </div>

      <style jsx>{`
        @keyframes topbar-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </header>
  );
}
