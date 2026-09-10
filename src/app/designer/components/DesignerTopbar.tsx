"use client";

import React from "react";
import { useTheme } from "@/components/ThemeProvider";
import { ChevronDown, Sun, Moon, Search, PanelRight, PanelRightClose } from "lucide-react";

export interface ModelOption {
  id: string;
  name: string;
}

interface Props {
  models: ModelOption[];
  selectedModel: string;
  onSelectModel: (id: string) => void;
  previewOpen: boolean;
  onTogglePreview: () => void;
  onGoDashboard: () => void;
}

export function DesignerTopbar({
  models,
  selectedModel,
  onSelectModel,
  previewOpen,
  onTogglePreview,
  onGoDashboard,
}: Props) {
  const { theme, toggle } = useTheme();
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [modelQuery, setModelQuery] = React.useState("");
  const pickerRef = React.useRef<HTMLDivElement>(null);

  const selected = models.find((m) => m.id === selectedModel);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setPickerOpen((v) => !v);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const filtered = models.filter(
    (m) =>
      m.id.toLowerCase().includes(modelQuery.toLowerCase()) ||
      m.name.toLowerCase().includes(modelQuery.toLowerCase()),
  );

  return (
    <header
      style={{
        height: 52,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 14px",
        borderBottom: "1px solid var(--ds-border-soft)",
        background: "var(--ds-bg)",
        flexShrink: 0,
      }}
    >
      {/* Left: model picker pill */}
      <div ref={pickerRef} style={{ position: "relative" }}>
        <button
          onClick={() => setPickerOpen((v) => !v)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            borderRadius: 10,
            border: "1px solid var(--ds-border)",
            background: "var(--ds-bg)",
            color: "var(--ds-text)",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <span style={{ color: selected ? "var(--ds-text)" : "var(--ds-text-tertiary)" }}>
            {selected ? selected.name : "Add Model"}
          </span>
          <span style={{ fontFamily: "var(--ds-font-mono)", fontSize: 11.5, color: "var(--ds-text-tertiary)", background: "var(--ds-bg-subtle)", border: "1px solid var(--ds-border-soft)", borderRadius: 5, padding: "1px 5px" }}>
            ⌘J
          </span>
          <ChevronDown size={14} color="var(--ds-text-tertiary)" />
        </button>

        {pickerOpen && (
          <div
            className="ds-fade-up"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              width: 340,
              maxHeight: 420,
              overflowY: "auto",
              background: "var(--ds-bg)",
              border: "1px solid var(--ds-border)",
              borderRadius: 12,
              boxShadow: "var(--ds-shadow-pop)",
              zIndex: 60,
              padding: 6,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderBottom: "1px solid var(--ds-border-soft)", marginBottom: 4 }}>
              <Search size={13} color="var(--ds-text-tertiary)" />
              <input
                autoFocus
                value={modelQuery}
                onChange={(e) => setModelQuery(e.target.value)}
                placeholder="Search models..."
                style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--ds-text)", fontSize: 13, fontFamily: "inherit" }}
              />
            </div>
            {filtered.length === 0 && (
              <div style={{ padding: "12px 10px", fontSize: 12.5, color: "var(--ds-text-tertiary)" }}>
                No models found. Connect providers in the dashboard.
              </div>
            )}
            {filtered.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  onSelectModel(m.id);
                  setPickerOpen(false);
                  setModelQuery("");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "7px 9px",
                  borderRadius: 8,
                  border: "none",
                  background: m.id === selectedModel ? "var(--ds-accent-softer)" : "transparent",
                  color: "var(--ds-text)",
                  fontSize: 13,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                {m.id === selectedModel && <span style={{ color: "var(--ds-accent-strong)", fontSize: 12 }}>✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Center: context */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12.5,
          color: "var(--ds-text-tertiary)",
          cursor: "pointer",
        }}
        onClick={onGoDashboard}
        title="Back to freeroute dashboard"
      >
        <img src="/logo.png" alt="" style={{ width: 15, height: 15, borderRadius: 4 }} />
        <span style={{ color: "var(--ds-text-secondary)" }}>freeroute</span>
        <span>/</span>
        <span>designer</span>
      </div>

      {/* Right: actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          onClick={onTogglePreview}
          title={previewOpen ? "Hide live preview" : "Show live preview"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 11px",
            borderRadius: 10,
            border: previewOpen ? "1px solid var(--ds-accent)" : "1px solid var(--ds-border)",
            background: previewOpen ? "var(--ds-accent-softer)" : "var(--ds-bg)",
            color: previewOpen ? "var(--ds-accent-strong)" : "var(--ds-text-secondary)",
            fontSize: 12.5,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {previewOpen ? <PanelRightClose size={14} /> : <PanelRight size={14} />}
          Side by side
        </button>
        <button
          onClick={toggle}
          title="Toggle theme"
          style={{
            width: 30,
            height: 30,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 9,
            border: "1px solid var(--ds-border)",
            background: "var(--ds-bg)",
            color: "var(--ds-text-secondary)",
            cursor: "pointer",
          }}
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </header>
  );
}
