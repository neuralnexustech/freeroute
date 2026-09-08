"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useToast } from "./Toast";

const MAIN_NAV = [
  { href: "/dashboard", label: "Overview", svg: <><path d="M3 11l9-7 9 7" /><path d="M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9" /></> },
  { href: "/dashboard/providers", label: "Providers", svg: <><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M4.2 4.2l2.9 2.9M16.9 16.9l2.9 2.9M2 12h4M18 12h4M4.2 19.8l2.9-2.9M16.9 7.1l2.9-2.9" /></> },
  { href: "/dashboard/models", label: "Models", svg: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 4v16M15 4v16M4 9h16M4 15h16" /></> },
  { href: "/dashboard/combos", label: "Combos", svg: <><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></> },
  { href: "/dashboard/cli-tools", label: "CLI Tools", svg: <><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" strokeWidth="2.2" /></> },
  { href: "/dashboard/mitm", label: "MITM Tools", svg: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /> },
  { href: "/dashboard/logs", label: "Logs", svg: <path d="M3 12h4l2 6 4-14 2 6h6" /> },
  { href: "/dashboard/activitys", label: "Activitys", svg: <path d="M18 20V10M12 20V4M6 20v-6" /> },
];

export function Sidebar() {
  const path = usePathname();
  const toast = useToast();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        document.getElementById("app-sidebar")?.classList.toggle("collapsed");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (href: string) =>
    href === "/dashboard" ? path === "/dashboard" : path === href || path?.startsWith(href + "/");

  return (
    <aside className="sidebar" id="app-sidebar" aria-label="Main Navigation">
      <div className="sidebar-header">
        <Link href="/dashboard" className="org-brand" style={{ textDecoration: "none", color: "inherit" }}>
          <img
            src="/logo.png"
            alt="freeroute logo"
            style={{
              width: 28,
              height: 28,
              objectFit: "contain",
              borderRadius: "var(--radius-sm, 6px)",
              flexShrink: 0,
            }}
          />
          <span className="org-name" style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>
            freeroute
          </span>
        </Link>
        <button
          className="collapse-btn"
          title="Toggle Sidebar [Ctrl+B]"
          aria-label="Toggle sidebar width"
          onClick={() => document.getElementById("app-sidebar")?.classList.toggle("collapsed")}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
        </button>
      </div>

      <nav className="sidebar-nav">
        {MAIN_NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`nav-item ${isActive(n.href) ? "active" : ""}`}
            onClick={() => document.getElementById("app-sidebar")?.classList.remove("open")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{n.svg}</svg>
            <span className="nav-text">{n.label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <Link href="/dashboard/api-keys" className={`nav-item ${isActive("/dashboard/api-keys") ? "active" : ""}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="8" r="4" /><path d="M10.5 10.5L21 21M17 17l3 3M14 14l2.5 2.5" /></svg>
          <span className="nav-text">API Keys</span>
        </Link>
        <a href="#docs" className="nav-item" onClick={(e) => { e.preventDefault(); toast.show("Documentation portal loading..."); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
          <span className="nav-text">Documentation</span>
        </a>
        <Link href="/dashboard/settings" className={`nav-item ${isActive("/dashboard/settings") ? "active" : ""}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.9 2.9l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.9-2.9l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.9-2.9l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.9 2.9l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1h.1a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>
          <span className="nav-text">Settings</span>
        </Link>
        <a href="https://www.neuralnexustech.com/" target="_blank" rel="noopener noreferrer" className="nav-item" title="Visit Neural Nexus Tech">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>
          <span className="nav-text" style={{ fontWeight: 600, color: "var(--primary)" }}>About Neural Nexus</span>
        </a>
      </div>
    </aside>
  );
}
