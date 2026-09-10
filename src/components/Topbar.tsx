"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "./ThemeProvider";
import { useToast } from "./Toast";

export function Topbar() {
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const [stats, setStats] = useState<{ spend: number; tokens: number } | null>(null);

  useEffect(() => {
    fetch("/api/overview").then((r) => r.json()).then((d) => setStats({ spend: d.spend ?? 0, tokens: d.tokens ?? 0 })).catch(() => {});
  }, []);

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
          <div className="ticker-item">Health: <span style={{ color: "var(--primary)" }}>99.98%</span></div>
        </div>

        <Link
          href="/designer"
          className="btn sm"
          style={{
            gap: 6,
            fontWeight: 600,
            color: "var(--primary)",
            borderColor: "rgba(139,124,248,0.35)",
            background: "var(--bg-accent-soft)",
          }}
          title="Open Web Designer"
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 19l7-7 3 3-7 7-3-3z" />
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            <path d="M2 2l7.586 7.586" />
            <circle cx="11" cy="11" r="2" />
          </svg>
          Designer
        </Link>

        <button className="theme-toggle-btn" title="Toggle Light/Dark Theme" aria-label="Toggle dark/light theme" onClick={() => { toggle(); toast.show(`Switched to ${theme === "dark" ? "light" : "dark"} theme`); }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: theme === "light" ? "block" : "none" }}><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: theme === "dark" ? "block" : "none" }}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
        </button>

        <button className="btn sm" onClick={() => toast.show("Quick Command menu opened [⌘K]")}>
          <span className="mono" style={{ opacity: 0.7 }}>⌘K</span> Search
        </button>
      </div>
    </header>
  );
}
