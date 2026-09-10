"use client";

import React from "react";
import { Eye, Code2, RefreshCw, ExternalLink, Download, X, FileCode2 } from "lucide-react";
import { buildSrcdoc } from "@/lib/srcdoc";

interface Props {
  html: string;
  title: string;
  streaming: boolean;
  /** Increments when a new artifact is detected — auto-switches to the Code tab. */
  artifactVersion?: number;
  onClose: () => void;
}

export function ArtifactPanel({ html, title, streaming, artifactVersion = 0, onClose }: Props) {
  const [tab, setTab] = React.useState<"preview" | "code">("preview");
  const [reloadKey, setReloadKey] = React.useState(0);
  const lastVersionRef = React.useRef(0);

  // Auto-detection: when a new artifact starts streaming in, jump to the Code
  // tab so all code lives on the side panel while chat stays summary-only.
  React.useEffect(() => {
    if (artifactVersion > lastVersionRef.current) {
      lastVersionRef.current = artifactVersion;
      setTab("code");
    }
  }, [artifactVersion]);

  // Auto-refresh the preview as the artifact streams in (throttled).
  const lastLen = React.useRef(0);
  React.useEffect(() => {
    if (tab !== "preview") return;
    if (html.length - lastLen.current > 400 || (!streaming && html.length !== lastLen.current)) {
      lastLen.current = html.length;
      setReloadKey((k) => k + 1);
    }
  }, [html, streaming, tab]);

  const openInTab = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const download = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "design").replace(/[^a-z0-9\-_]+/gi, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Preview builds from the streamed HTML via the repo's sandboxed srcdoc builder.
  const srcdoc = React.useMemo(() => {
    if (!html) return "";
    try {
      return buildSrcdoc(html, { title: title || "Prototype Preview" });
    } catch {
      return html;
    }
  }, [html, title, reloadKey === 0 ? 0 : 1]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--ds-bg-subtle)",
        borderLeft: "1px solid var(--ds-border-soft)",
        minHeight: 0,
      }}
    >
      {/* Panel header */}
      <div
        style={{
          height: 42,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 10px",
          borderBottom: "1px solid var(--ds-border-soft)",
          background: "var(--ds-bg)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button
            onClick={() => setTab("preview")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 10px",
              borderRadius: 8,
              border: "none",
              background: tab === "preview" ? "var(--ds-accent-softer)" : "transparent",
              color: tab === "preview" ? "var(--ds-accent-strong)" : "var(--ds-text-secondary)",
              fontSize: 12.5,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <Eye size={13} /> Preview
          </button>
          <button
            onClick={() => setTab("code")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 10px",
              borderRadius: 8,
              border: "none",
              background: tab === "code" ? "var(--ds-accent-softer)" : "transparent",
              color: tab === "code" ? "var(--ds-accent-strong)" : "var(--ds-text-secondary)",
              fontSize: 12.5,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <Code2 size={13} /> Code
          </button>
          {streaming && (
            <span style={{ marginLeft: 8, fontSize: 11.5, color: "var(--ds-accent-strong)", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span className="ds-dot" style={{ background: "var(--ds-accent)" }} />
              streaming…
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button title="Refresh preview" onClick={() => setReloadKey((k) => k + 1)} style={btn}>
            <RefreshCw size={13} />
          </button>
          <button title="Open in new tab" onClick={openInTab} style={btn} disabled={!html}>
            <ExternalLink size={13} />
          </button>
          <button title="Download HTML" onClick={download} style={btn} disabled={!html}>
            <Download size={13} />
          </button>
          <button title="Close panel" onClick={onClose} style={btn}>
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {tab === "preview" ? (
          srcdoc ? (
            <iframe
              key={reloadKey}
              title="Artifact preview"
              srcDoc={srcdoc}
              sandbox="allow-scripts allow-popups allow-forms allow-modals"
              style={{ width: "100%", height: "100%", border: "none", background: "#fff", display: "block" }}
            />
          ) : (
            <EmptyHint />
          )
        ) : (
          <pre
            style={{
              margin: 0,
              padding: 14,
              height: "100%",
              overflow: "auto",
              fontFamily: "var(--ds-font-mono)",
              fontSize: 12,
              lineHeight: 1.6,
              color: "var(--ds-text)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {html || "No artifact yet."}
          </pre>
        )}
      </div>
    </div>
  );
}

function EmptyHint() {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        color: "var(--ds-text-tertiary)",
        fontSize: 13,
      }}
    >
      <FileCode2 size={26} strokeWidth={1.5} />
      Ask the designer to build something —
      <br />
      the live preview appears here.
    </div>
  );
}

const btn: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--ds-text-tertiary)",
  padding: 6,
  borderRadius: 7,
  display: "inline-flex",
  alignItems: "center",
};
