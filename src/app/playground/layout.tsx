"use client";

// The root layout wraps all pages with Sidebar + Topbar.
// We use position:fixed to break out and take the full viewport.
export default function PlaygroundLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "var(--bg-app)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </div>
  );
}
