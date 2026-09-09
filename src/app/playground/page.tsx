"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";
import { notifyClientTelemetry } from "@/hooks/useLiveTelemetry";

// ── Types ────────────────────────────────────────────────────────────────────
interface ToolCallResult {
  tool: string;
  name: string;
  icon: string;
  summary: string;
  details?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  tokens?: number;
  cost?: string;
  latencyMs?: number;
  reasoning?: string | boolean;
  toolCalls?: ToolCallResult[];
  weather?: any;
  timestamp: Date;
}

interface Room {
  id: string;
  title: string;
  lastMsg?: string;
  updatedAt: number;
}

interface CatalogModel {
  id: string;
  displayName: string;
  provider?: {
    slug: string;
    name: string;
    icon: string;
    connected?: boolean;
  };
  contextWindow?: string;
  inputPrice?: number;
  outputPrice?: number;
  modalities?: string;
  isCombo?: boolean;
  strategy?: string;
  targetCount?: number;
  toksPerSec?: number | null;
  latencyMs?: number | null;
}

interface ServerTool {
  id: string;
  name: string;
  desc: string;
  sub: string;
  icon: string;
  enabled: boolean;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Built-in Weather Widget Card ───────────────────────────────────────────
function WeatherCard({ weather }: { weather: any }) {
  const [unit, setUnit] = useState<"C" | "F">("C");
  if (!weather || !weather.current) return null;

  const { location, current, tomorrow, daily } = weather;

  const formatTemp = (c: number, f: number) => {
    return unit === "C" ? `${Math.round(c)}°C` : `${Math.round(f)}°F`;
  };

  return (
    <div className="pg-weather-card">
      {/* Weather Header */}
      <div className="pg-weather-header">
        <div className="pg-weather-location">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ color: "#38bdf8" }}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span className="pg-weather-loc-name">{location}</span>
          <span className="pg-weather-badge-live">LIVE RADAR</span>
        </div>
        <div className="pg-weather-unit-toggle">
          <button
            className={`pg-weather-unit-btn ${unit === "C" ? "active" : ""}`}
            onClick={() => setUnit("C")}
          >
            °C
          </button>
          <span className="pg-weather-unit-divider">|</span>
          <button
            className={`pg-weather-unit-btn ${unit === "F" ? "active" : ""}`}
            onClick={() => setUnit("F")}
          >
            °F
          </button>
        </div>
      </div>

      {/* Main Weather Display */}
      <div className="pg-weather-hero">
        <div className="pg-weather-hero-left">
          <span className="pg-weather-big-icon">{current.icon}</span>
          <div>
            <div className="pg-weather-main-temp">
              {formatTemp(current.tempC, current.tempF)}
            </div>
            <div className="pg-weather-main-cond">
              {current.condition} · Feels like {formatTemp(current.feelsLikeC, current.feelsLikeF)}
            </div>
          </div>
        </div>

        {/* Highlighted Tomorrow Box */}
        {tomorrow && (
          <div className="pg-weather-tomorrow-box">
            <div className="pg-weather-tomorrow-title">
              <span>📅 {tomorrow.dayName} ({tomorrow.date})</span>
              <span className="pg-weather-rain-prob">🌧️ {tomorrow.rainProb}% Rain</span>
            </div>
            <div className="pg-weather-tomorrow-details">
              <span className="pg-weather-tomorrow-icon">{tomorrow.icon}</span>
              <span className="pg-weather-tomorrow-cond">{tomorrow.condition}</span>
              <span className="pg-weather-tomorrow-range">
                ▲ {formatTemp(tomorrow.maxC, tomorrow.maxF)} · ▼ {formatTemp(tomorrow.minC, tomorrow.minF)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="pg-weather-stats-grid">
        <div className="pg-weather-stat-pill">
          <span className="pg-stat-icon">💧</span>
          <span className="pg-stat-label">Humidity</span>
          <span className="pg-stat-val">{current.humidity}%</span>
        </div>
        <div className="pg-weather-stat-pill">
          <span className="pg-stat-icon">💨</span>
          <span className="pg-stat-label">Wind Speed</span>
          <span className="pg-stat-val">{current.windSpeedKmh} km/h</span>
        </div>
        <div className="pg-weather-stat-pill">
          <span className="pg-stat-icon">🌧️</span>
          <span className="pg-stat-label">Tomorrow Rain</span>
          <span className="pg-stat-val">{tomorrow?.rainProb ?? 0}%</span>
        </div>
        <div className="pg-weather-stat-pill">
          <span className="pg-stat-icon">🌡️</span>
          <span className="pg-stat-label">High / Low</span>
          <span className="pg-stat-val">
            {formatTemp(daily?.[0]?.maxC ?? current.tempC, daily?.[0]?.maxF ?? current.tempF)} / {formatTemp(daily?.[0]?.minC ?? current.tempC, daily?.[0]?.minF ?? current.tempF)}
          </span>
        </div>
      </div>

      {/* 7-Day Forecast Strip */}
      {daily && daily.length > 0 && (
        <div className="pg-weather-strip-container">
          <div className="pg-weather-strip-title">7-DAY LIVE FORECAST</div>
          <div className="pg-weather-days-row">
            {daily.map((d: any, i: number) => (
              <div key={i} className={`pg-weather-day-item ${i === 1 ? "tomorrow-highlight" : ""}`}>
                <div className="pg-weather-day-label">{d.dayName}</div>
                <div className="pg-weather-day-date">{d.date.slice(5)}</div>
                <div className="pg-weather-day-icon">{d.icon}</div>
                <div className="pg-weather-day-temp">
                  {formatTemp(d.maxC, d.maxF)}
                </div>
                <div className="pg-weather-day-min">
                  {formatTemp(d.minC, d.minF)}
                </div>
                <div className="pg-weather-day-rain">
                  {d.rainProb}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Executed Tool Calls & Shell Command Inspector (Never hidden after execution) ──
function ToolCallsViewer({ toolCalls }: { toolCalls: ToolCallResult[] }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "10px 0 14px 0" }}>
      {toolCalls.map((tc, idx) => {
        const isExpanded = expandedIndex === idx;
        const isShell = tc.tool === "shell";

        return (
          <div
            key={idx}
            style={{
              borderRadius: 10,
              border: "1px solid var(--pg-card-border, rgba(255,255,255,0.12))",
              background: isShell ? "rgba(15, 23, 42, 0.7)" : "var(--pg-code-bg, rgba(255,255,255,0.03))",
              overflow: "hidden",
              transition: "all 0.15s ease",
            }}
          >
            {/* Header / Summary Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                cursor: "pointer",
                userSelect: "none",
                gap: 10,
                background: isExpanded ? "rgba(255, 255, 255, 0.04)" : "transparent",
              }}
              onClick={() => setExpandedIndex(isExpanded ? null : idx)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 14 }}>{tc.icon || "🛠️"}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--pg-text, #fff)", flexShrink: 0 }}>
                  {tc.name}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: isShell ? "var(--font-mono, monospace)" : "inherit",
                    color: "var(--pg-text-secondary, #94a3b8)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={tc.summary}
                >
                  {tc.summary}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {isShell && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#10b981",
                      background: "rgba(16, 185, 129, 0.12)",
                      border: "1px solid rgba(16, 185, 129, 0.25)",
                      borderRadius: 6,
                      padding: "2px 6px",
                      fontFamily: "var(--font-mono, monospace)",
                    }}
                  >
                    Executed
                  </span>
                )}
                <span style={{ fontSize: 11, color: "var(--pg-text-tertiary, #64748b)" }}>
                  {isExpanded ? "Hide ▲" : "Inspect ▼"}
                </span>
              </div>
            </div>

            {/* Expanded Details Output */}
            {isExpanded && (
              <div
                style={{
                  borderTop: "1px solid var(--pg-card-border, rgba(255,255,255,0.1))",
                  padding: "10px 14px",
                  background: "#080c14",
                  fontSize: 12,
                  fontFamily: "var(--font-mono, monospace)",
                  color: "#e2e8f0",
                  lineHeight: 1.5,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {isShell ? "Shell Execution Output" : "Tool Execution Details"}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(tc.details || tc.summary);
                      setCopiedIndex(idx);
                      setTimeout(() => setCopiedIndex(null), 1800);
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      color: copiedIndex === idx ? "#10b981" : "#cbd5e1",
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 5,
                      cursor: "pointer",
                    }}
                  >
                    {copiedIndex === idx ? "✓ Copied" : "Copy Output"}
                  </button>
                </div>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    maxHeight: 260,
                    overflowY: "auto",
                    color: "#f1f5f9",
                    background: "rgba(0, 0, 0, 0.4)",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  {tc.details || tc.summary}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Built-in Smart Table & Excel Spreadsheet Viewer ──────────────────────────
function SmartTableView({
  headers,
  rows,
  raw,
  defaultToExcel = false,
}: {
  headers: string[];
  rows: string[][];
  raw: string;
  defaultToExcel?: boolean;
}) {
  const [filter, setFilter] = useState("");
  const [viewMode, setViewMode] = useState<"clean" | "grid">(
    defaultToExcel ? "grid" : "clean"
  );
  const [copied, setCopied] = useState(false);

  // Filter rows
  const filteredRows = useMemo(() => {
    if (!filter.trim()) return rows;
    const q = filter.toLowerCase();
    return rows.filter((r) => r.some((cell) => cell.toLowerCase().includes(q)));
  }, [rows, filter]);

  // Export to CSV
  const handleExportCsv = () => {
    const csvContent = [
      headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `data_table_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy Tab-Separated for Excel / Google Sheets
  const handleCopyForExcel = () => {
    const tsv = [
      headers.join("\t"),
      ...rows.map((r) => r.join("\t")),
    ].join("\n");
    navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getColLetter = (idx: number) => String.fromCharCode(65 + (idx % 26));

  return (
    <div
      className={`pg-excel-container ${
        viewMode === "grid" ? "mode-excel-container" : "mode-clean-container"
      }`}
    >
      {/* Toolbar */}
      <div className="pg-excel-toolbar">
        <div className="pg-excel-toolbar-left">
          {viewMode === "grid" ? (
            <div className="pg-excel-brand-badge">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="15" x2="21" y2="15" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <line x1="15" y1="3" x2="15" y2="21" />
              </svg>
              <span>Excel View</span>
            </div>
          ) : (
            <div className="pg-clean-brand-badge">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
              <span>Data Table</span>
            </div>
          )}
          <span className="pg-excel-dim-badge">
            {rows.length} rows × {headers.length} cols
          </span>
        </div>

        {/* Search bar is prominent in Excel mode */}
        {viewMode === "grid" && (
          <div className="pg-excel-toolbar-center">
            <div className="pg-excel-search-box">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search rows..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pg-excel-search-input"
              />
              {filter && (
                <button onClick={() => setFilter("")} className="pg-excel-clear-btn">
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        <div className="pg-excel-toolbar-right">
          {viewMode === "clean" ? (
            <button
              onClick={() => setViewMode("grid")}
              className="pg-excel-tool-btn pg-toggle-excel-btn"
              title="Open full Excel Spreadsheet view with letters, numbers, and search"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#107c41" strokeWidth="2.2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="15" x2="21" y2="15" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
              <span>Excel View</span>
            </button>
          ) : (
            <button
              onClick={() => setViewMode("clean")}
              className="pg-excel-tool-btn active"
              title="Switch back to Clean Table view"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
              </svg>
              <span>Clean View</span>
            </button>
          )}

          <button
            onClick={handleCopyForExcel}
            className="pg-excel-tool-btn"
            title="Copy formatted for Excel / Sheets"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>{copied ? "Copied!" : "Copy"}</span>
          </button>

          <button
            onClick={handleExportCsv}
            className={viewMode === "grid" ? "pg-excel-export-btn" : "pg-excel-tool-btn"}
            title="Download CSV file"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Table Scroll Area */}
      <div className="pg-excel-table-scroll">
        <table className={`pg-excel-table ${viewMode === "grid" ? "mode-excel" : "mode-clean"}`}>
          <thead>
            {viewMode === "grid" && (
              <tr className="pg-excel-grid-letters-row">
                <th className="pg-excel-corner-cell">#</th>
                {headers.map((_, i) => (
                  <th key={i} className="pg-excel-letter-cell">
                    {getColLetter(i)}
                  </th>
                ))}
              </tr>
            )}
            <tr className="pg-excel-header-row">
              {viewMode === "grid" && <th className="pg-excel-gutter-cell"></th>}
              {headers.map((h, i) => (
                <th key={i} className="pg-excel-th">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, rIdx) => (
              <tr key={rIdx} className="pg-excel-row">
                {viewMode === "grid" && (
                  <td className="pg-excel-row-num">{rIdx + 1}</td>
                )}
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="pg-excel-td">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td
                  colSpan={headers.length + (viewMode === "grid" ? 1 : 0)}
                  className="pg-excel-empty-td"
                >
                  No matching rows found for "{filter}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Markdown & Table & Image Renderer ───────────────────────────────────────
function sanitizeTableMarkdown(rawContent: string): string {
  let text = rawContent;

  // 1. Clean up common LLM apologies about Excel files
  text = text.replace(
    /(?:It's not possible for me to provide an actual Excel file[^\n.:]*[.:]?|I cannot provide an actual Excel file[^\n.:]*[.:]?|As an AI, I can't generate an Excel file[^\n.:]*[.:]?)(?:\s*(?:however|but|here's|here is)[^\n:]*[:])?/gi,
    "Here is the requested data in the built-in interactive Excel spreadsheet viewer:"
  );

  // 2. Unwrap code blocks (``` or ```markdown or ```text) that contain tables
  text = text.replace(
    /```(?:markdown|text|table)?\r?\n([\s\S]+?)\r?\n```/g,
    (match, inner) => {
      const lines = inner.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
      const pipeLines = lines.filter((l: string) => l.includes("|"));
      if (pipeLines.length >= 2 && lines.some((l: string) => /[-]{3,}/.test(l))) {
        return "\n" + inner + "\n";
      }
      return match;
    }
  );

  // 3. Normalize tables where lines have pipes but might lack outer boundary pipes or have dashed separators like ---|---|---
  const lines = text.split(/\r?\n/);
  const outLines: string[] = [];
  let tableBuffer: string[] = [];

  const flushBuffer = () => {
    if (
      tableBuffer.length >= 2 &&
      tableBuffer.some((l) => /^\|?[\s\-:|]+\|?$/.test(l) && l.includes("-"))
    ) {
      const normalized = tableBuffer.map((l) => {
        let s = l.trim();
        if (!s.startsWith("|")) s = "| " + s;
        if (!s.endsWith("|")) s = s + " |";
        if (/^\|[\s\-:|]+\|$/.test(s) && s.includes("-")) {
          const cols = s.slice(1, -1).split("|");
          s = "| " + cols.map(() => ":---").join(" | ") + " |";
        }
        return s;
      });
      outLines.push(...normalized);
    } else {
      outLines.push(...tableBuffer);
    }
    tableBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const hasPipe = trimmed.includes("|");

    if (hasPipe) {
      tableBuffer.push(trimmed);
    } else {
      flushBuffer();
      outLines.push(line);
    }
  }
  flushBuffer();

  return outLines.join("\n");
}

// ── Workspace IDE & Multi-File Project Artifact System (Images 1 & 2) ────────
interface WorkspaceFile {
  name: string;
  path: string;
  language: string;
  content: string;
}

interface ActiveArtifact {
  id: string;
  title: string;
  language: string;
  code: string;
  isHtml: boolean;
  activeTab: "code" | "preview";
  isBuilding?: boolean;
  projectFiles?: WorkspaceFile[];
  selectedFile?: string;
  urlPath?: string;
}

function checkIsHtml(lang: string, code: string): boolean {
  const l = (lang || "").toLowerCase().trim();
  if (l === "html" || l === "htm" || l === "svg") return true;
  const trimmed = code.trim().toLowerCase();
  if (
    trimmed.startsWith("<!doctype html") ||
    trimmed.startsWith("<html") ||
    trimmed.startsWith("<svg") ||
    (trimmed.includes("<body") && trimmed.includes("</"))
  ) {
    return true;
  }
  return false;
}

function inferFilename(lang: string, isHtml: boolean, index: number): string {
  const l = (lang || "").toLowerCase().trim();
  if (l === "html" || l === "htm") return "index.html";
  if (l === "svg") return "graphic.svg";
  if (l === "python" || l === "py") return "script.py";
  if (l === "javascript" || l === "js") return "index.js";
  if (l === "typescript" || l === "ts") return "index.ts";
  if (l === "tsx") return "Component.tsx";
  if (l === "jsx") return "Component.jsx";
  if (l === "css") return "styles.css";
  if (l === "json") return "data.json";
  if (l === "sql") return "query.sql";
  if (l === "bash" || l === "sh" || l === "shell") return "script.sh";
  if (l === "rust" || l === "rs") return "main.rs";
  if (l === "go") return "main.go";
  if (l === "cpp" || l === "c++") return "main.cpp";
  if (l === "c") return "main.c";
  if (isHtml) return "index.html";
  return `snippet_${index + 1}.${l || "txt"}`;
}

// ── In-Chat Code Card Component (Claude-style) ─────────────────────────────
function CodeViewerCard({
  language,
  filename,
  code,
  isHtml,
  onOpen,
}: {
  language: string;
  filename: string;
  code: string;
  isHtml: boolean;
  onOpen?: (tab: "code" | "preview") => void;
}) {
  const [copied, setCopied] = useState(false);
  const lineCount = useMemo(() => code.split(/\r?\n/).length, [code]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayLang = (language || (isHtml ? "html" : "code")).toUpperCase();

  return (
    <div className="pg-code-card">
      {/* Code Card Header */}
      <div
        className="pg-code-card-header"
        onClick={() => onOpen?.(isHtml ? "preview" : "code")}
        title="Click to open in right side slider"
      >
        <div className="pg-code-card-header-left">
          <div className="pg-code-card-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <span className="pg-code-card-filename">{filename}</span>
          <span className="pg-code-card-lang-badge">{displayLang}</span>
          <span className="pg-code-card-meta">{lineCount} lines</span>
        </div>

        <div className="pg-code-card-header-right" onClick={(e) => e.stopPropagation()}>
          {isHtml && (
            <button
              className="pg-code-card-btn preview-btn"
              onClick={() => onOpen?.("preview")}
              title="Open live preview in right slider"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>Preview</span>
            </button>
          )}

          <button
            className="pg-code-card-btn"
            onClick={handleCopy}
            title="Copy code to clipboard"
          >
            {copied ? (
              <>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#10b981" strokeWidth="2.4">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span style={{ color: "#10b981", fontWeight: 600 }}>Copied!</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            className="pg-code-card-btn open-btn"
            onClick={() => onOpen?.(isHtml ? "preview" : "code")}
            title="Open right slider"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            <span>Open</span>
          </button>
        </div>
      </div>

      {/* Code Snippet Body */}
      <div className="pg-code-card-body" onClick={() => onOpen?.(isHtml ? "preview" : "code")}>
        <pre className="pg-code-pre">
          <code>
            {code
              .split(/\r?\n/)
              .slice(0, 14)
              .map((line, idx) => (
                <div key={idx} className="pg-code-line">
                  <span className="pg-code-line-num">{idx + 1}</span>
                  <span className="pg-code-line-text">{line || " "}</span>
                </div>
              ))}
          </code>
        </pre>
        {lineCount > 14 && (
          <div className="pg-code-card-fade">
            <span>+{lineCount - 14} more lines · Click to open in right slider ↗</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Multi-File Project Parser ───────────────────────────────────────────────
function extractProjectFiles(rawCode: string, language: string, title: string): WorkspaceFile[] {
  const files: WorkspaceFile[] = [];

  // 1. Check if rawCode contains multiple marked files like `// filepath: ...` or ```lang:path
  const codeBlockRegex = /```(\w+)?(?::([^\n]+))?\r?\n([\s\S]*?)\r?\n```/g;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(rawCode)) !== null) {
    const lang = (match[1] || "typescript").toLowerCase();
    const filePath = match[2]?.trim() || "";
    const content = match[3] || "";
    if (filePath) {
      const name = filePath.split("/").pop() || filePath;
      files.push({ name, path: filePath, language: lang, content });
    }
  }

  // If blocks were found with explicit filepaths, return them
  if (files.length > 0) {
    return files;
  }

  // If it's HTML, create an integrated multi-file project structure like Image 1
  const isHtml = checkIsHtml(language, rawCode);
  const mainName = isHtml ? "index.html" : title.includes(".") ? title : "App.tsx";
  const mainPath = isHtml ? "index.html" : `src/${mainName}`;

  files.push({
    name: mainName,
    path: mainPath,
    language: isHtml ? "html" : language || "typescript",
    content: rawCode,
  });

  // Replicate the exact modern project tree from Image 1:
  // src/App.tsx, src/index.css, src/main.tsx, src/vite-env.d.ts, index.html, package.json, tsconfig.json, vite.config.ts
  if (!files.some((f) => f.name === "index.css")) {
    files.push({
      name: "index.css",
      path: "src/index.css",
      language: "css",
      content: `/* App Base Styling */\n:root {\n  --primary: #6366f1;\n  --bg: #0b0f19;\n  --text: #f8fafc;\n}\n\n* {\n  box-sizing: border-box;\n  margin: 0;\n  padding: 0;\n}\n\nbody {\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;\n  background: var(--bg);\n  color: var(--text);\n  min-height: 100vh;\n  display: flex;\n  flex-direction: column;\n}`,
    });
  }

  if (!files.some((f) => f.name === "main.tsx")) {
    files.push({
      name: "main.tsx",
      path: "src/main.tsx",
      language: "typescript",
      content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nimport './index.css';\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);`,
    });
  }

  if (!files.some((f) => f.name === "vite-env.d.ts")) {
    files.push({
      name: "vite-env.d.ts",
      path: "src/vite-env.d.ts",
      language: "typescript",
      content: `/// <reference types="vite/client" />`,
    });
  }

  if (!files.some((f) => f.name === "index.html")) {
    files.push({
      name: "index.html",
      path: "index.html",
      language: "html",
      content: `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>freeroute App Sandbox</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>`,
    });
  }

  if (!files.some((f) => f.name === "package.json")) {
    files.push({
      name: "package.json",
      path: "package.json",
      language: "json",
      content: `{\n  "name": "freeroute-app",\n  "private": true,\n  "version": "0.1.0",\n  "type": "module",\n  "scripts": {\n    "dev": "vite",\n    "build": "tsc && vite build",\n    "preview": "vite preview"\n  },\n  "dependencies": {\n    "react": "^18.3.1",\n    "react-dom": "^18.3.1"\n  },\n  "devDependencies": {\n    "@types/react": "^18.3.3",\n    "@types/react-dom": "^18.3.0",\n    "@vitejs/plugin-react": "^4.3.1",\n    "typescript": "^5.5.4",\n    "vite": "^5.4.0"\n  }\n}`,
    });
  }

  if (!files.some((f) => f.name === "tsconfig.json")) {
    files.push({
      name: "tsconfig.json",
      path: "tsconfig.json",
      language: "json",
      content: `{\n  "compilerOptions": {\n    "target": "ES2020",\n    "useDefineForClassFields": true,\n    "lib": ["ES2020", "DOM", "DOM.Iterable"],\n    "module": "ESNext",\n    "skipLibCheck": true,\n    "moduleResolution": "bundler",\n    "jsx": "react-jsx",\n    "strict": true\n  },\n  "include": ["src"]\n}`,
    });
  }

  if (!files.some((f) => f.name === "vite.config.ts")) {
    files.push({
      name: "vite.config.ts",
      path: "vite.config.ts",
      language: "typescript",
      content: `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n});`,
    });
  }

  return files;
}

// ── Building State Animated Geometric Modular Block SVG (Image 2) ───────────
function BuildingIconSvg() {
  return (
    <svg
      viewBox="0 0 100 90"
      className="pg-ws-building-icon"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Top rounded wide block */}
      <rect x="5" y="6" width="56" height="24" rx="8" fill="#e5e7eb" />
      {/* Top right pill block */}
      <rect x="66" y="10" width="22" height="20" rx="8" fill="#eceff1" />
      {/* Middle center block */}
      <path
        d="M34 36 C34 30, 40 30, 48 30 C56 30, 62 34, 62 44 C62 54, 56 56, 44 56 C36 56, 34 50, 34 36 Z"
        fill="#eceff1"
      />
      {/* Bottom left square block */}
      <rect x="5" y="58" width="24" height="24" rx="6" fill="#e5e7eb" />
      {/* Bottom right square block */}
      <rect x="76" y="58" width="20" height="24" rx="6" fill="#e5e7eb" />
    </svg>
  );
}

// ── Right Web Development Workspace IDE (Images 1 & 2) ──────────────────────
function WorkspaceIDE({
  artifact,
  onClose,
}: {
  artifact: ActiveArtifact;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"code" | "preview">(artifact.activeTab);
  const [previewKey, setPreviewKey] = useState(0);
  const [copied, setCopied] = useState(false);

  // Initialize files from artifact
  const files = useMemo(() => {
    if (artifact.projectFiles && artifact.projectFiles.length > 0) {
      return artifact.projectFiles;
    }
    return extractProjectFiles(artifact.code, artifact.language, artifact.title);
  }, [artifact.projectFiles, artifact.code, artifact.language, artifact.title]);

  const [activeFilePath, setActiveFilePath] = useState<string>(
    artifact.selectedFile || files[0]?.path || "src/App.tsx"
  );

  // Keep active file in sync if files change
  useEffect(() => {
    if (artifact.selectedFile) {
      setActiveFilePath(artifact.selectedFile);
    } else if (files.length > 0 && !files.some((f) => f.path === activeFilePath)) {
      setActiveFilePath(files[0].path);
    }
  }, [files, artifact.selectedFile, activeFilePath]);

  const activeFile = useMemo(() => {
    return files.find((f) => f.path === activeFilePath) || files[0] || {
      name: artifact.title,
      path: artifact.title,
      language: artifact.language,
      content: artifact.code,
    };
  }, [files, activeFilePath, artifact]);

  const handleDownload = () => {
    const blob = new Blob([activeFile.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = activeFile.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith(".tsx") || fileName.endsWith(".jsx")) {
      return <span style={{ color: "#00d8ff" }}>⚛</span>;
    }
    if (fileName.endsWith(".ts")) {
      return <span style={{ color: "#3178c6", fontWeight: 700, fontSize: 10 }}>TS</span>;
    }
    if (fileName.endsWith(".js")) {
      return <span style={{ color: "#f7df1e", fontWeight: 700, fontSize: 10 }}>JS</span>;
    }
    if (fileName.endsWith(".css")) {
      return <span style={{ color: "#2965f1", fontWeight: 700, fontSize: 9 }}>CSS</span>;
    }
    if (fileName.endsWith(".html")) {
      return <span style={{ color: "#e34f26", fontWeight: 700, fontSize: 10 }}>5</span>;
    }
    if (fileName.endsWith(".json")) {
      return <span style={{ color: "#cb3837", fontWeight: 700, fontSize: 10 }}>{}</span>;
    }
    return <span>📄</span>;
  };

  // Compile runnable HTML document from active project files
  const compiledHtml = useMemo(() => {
    const htmlFile = files.find((f) => f.name.endsWith(".html"));
    const cssFiles = files.filter((f) => f.name.endsWith(".css"));
    const jsFiles = files.filter((f) => f.name.endsWith(".js") || f.name.endsWith(".tsx") || f.name.endsWith(".ts"));

    if (htmlFile && htmlFile.content.includes("<html")) {
      let doc = htmlFile.content;
      if (cssFiles.length > 0 && !doc.includes("<style>")) {
        const injectedStyles = cssFiles.map((c) => `<style>${c.content}</style>`).join("\n");
        doc = doc.replace("</head>", `${injectedStyles}\n</head>`);
      }
      return doc;
    }

    // Default bundle for modern preview
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      ${cssFiles.map((c) => c.content).join("\n")}
    </style>
  </head>
  <body class="bg-white text-slate-900 antialiased p-4">
    <div id="root">
      ${artifact.code.includes("<") ? artifact.code : `<div class="p-8 font-sans max-w-xl mx-auto"><h1 class="text-2xl font-bold mb-4">${artifact.title}</h1><p class="text-slate-600">${artifact.code.slice(0, 300)}</p></div>`}
    </div>
  </body>
</html>`;
  }, [files, artifact]);

  return (
    <aside className="pg-workspace-slider">
      {/* ── Topbar (Image 1) ── */}
      <div className="pg-ws-topbar">
        {/* Toggle Mode: Preview (Eye) vs Code (</>) */}
        <div className="pg-ws-toggle-group">
          <button
            className={`pg-ws-toggle-btn ${tab === "preview" ? "active" : ""}`}
            onClick={() => setTab("preview")}
            title="Preview web application"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <button
            className={`pg-ws-toggle-btn ${tab === "code" ? "active" : ""}`}
            onClick={() => setTab("code")}
            title="View code editor"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </button>
        </div>

        {/* Address Bar: ↻ / (Image 1) */}
        <div className="pg-ws-url-bar">
          <button
            className="pg-ws-reload-btn"
            onClick={() => setPreviewKey((k) => k + 1)}
            title="Reload preview"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
          <span className="pg-ws-url-text">{artifact.urlPath || "/"}</span>
          <div className="pg-ws-url-actions">
            <button
              className="pg-ws-icon-btn"
              title="Copy URL"
              onClick={() => {
                navigator.clipboard.writeText("http://localhost:3000" + (artifact.urlPath || "/"));
                alert("URL copied!");
              }}
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
            <button
              className="pg-ws-icon-btn"
              title="Open in new window"
              onClick={() => {
                const win = window.open("", "_blank");
                if (win) {
                  win.document.write(compiledHtml);
                  win.document.close();
                }
              }}
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </button>
          </div>
        </div>

        {/* Topbar Right: Download button + Close button */}
        <div className="pg-ws-topbar-right">
          <button className="pg-ws-download-btn" onClick={handleDownload} title="Download file">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Download</span>
          </button>
          <button className="pg-ws-close-btn" onClick={onClose} title="Close workspace (Esc)">
            ✕
          </button>
        </div>
      </div>

      {/* ── Main Workspace Body: Check if Building (Image 2) or Loaded (Image 1) ── */}
      {artifact.isBuilding ? (
        /* Image 2 Building State */
        <div className="pg-ws-building-screen">
          <div className="pg-ws-building-icon-wrap">
            <BuildingIconSvg />
          </div>
          <h2 className="pg-ws-building-title">Building...</h2>
          <p className="pg-ws-building-subtitle">
            Preview will appear when agent is done working
          </p>
        </div>
      ) : tab === "preview" ? (
        /* Live App Preview */
        <div className="pg-ws-preview-view">
          <iframe
            key={previewKey}
            srcDoc={compiledHtml}
            sandbox="allow-scripts allow-modals allow-same-origin"
            className="pg-ws-iframe"
            title="App Preview"
          />
        </div>
      ) : (
        /* Image 1 Workspace IDE Layout */
        <div className="pg-ws-body">
          {/* Left Sidebar: FILES Tree (Image 1) */}
          <aside className="pg-ws-files-sidebar">
            <div className="pg-ws-files-title">FILES</div>
            <div className="pg-ws-tree">
              {/* Folder: src */}
              <div className="pg-ws-tree-folder">
                <div className="pg-ws-tree-folder-head">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>src</span>
                </div>
                <div className="pg-ws-tree-children">
                  {/* Optional subfolders for visual parity with Image 1 */}
                  <div className="pg-ws-tree-folder-head" style={{ opacity: 0.8, padding: "2px 6px" }}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <span>shaders</span>
                  </div>
                  <div className="pg-ws-tree-folder-head" style={{ opacity: 0.8, padding: "2px 6px" }}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <span>utils</span>
                  </div>

                  {/* Files under src */}
                  {files
                    .filter((f) => f.path.startsWith("src/"))
                    .map((file) => (
                      <div
                        key={file.path}
                        className={`pg-ws-tree-file ${activeFilePath === file.path ? "active" : ""}`}
                        onClick={() => setActiveFilePath(file.path)}
                      >
                        <span className="pg-ws-file-icon">{getFileIcon(file.name)}</span>
                        <span>{file.name}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Root level files (index.html, package.json, etc.) */}
              {files
                .filter((f) => !f.path.startsWith("src/"))
                .map((file) => (
                  <div
                    key={file.path}
                    className={`pg-ws-tree-file ${activeFilePath === file.path ? "active" : ""}`}
                    onClick={() => setActiveFilePath(file.path)}
                  >
                    <span className="pg-ws-file-icon">{getFileIcon(file.name)}</span>
                    <span>{file.name}</span>
                  </div>
                ))}
            </div>
          </aside>

          {/* Center/Right Code Editor with Line Numbers (Image 1) */}
          <main className="pg-ws-editor-pane">
            <div className="pg-ws-editor-tabs-bar">
              <div className="pg-ws-active-tab">
                <span className="pg-ws-file-icon">{getFileIcon(activeFile.name)}</span>
                <span>{activeFile.name}</span>
                <span
                  style={{
                    fontSize: 10,
                    opacity: 0.5,
                    cursor: "pointer",
                    marginLeft: 4,
                  }}
                  title="Active tab"
                >
                  ✕
                </span>
              </div>
            </div>

            <div className="pg-ws-editor-body">
              {activeFile.content.split(/\r?\n/).map((line, idx) => (
                <div key={idx} className="pg-ws-code-line">
                  <span className="pg-ws-line-num">{idx + 1}</span>
                  <span className="pg-ws-line-content">{line || " "}</span>
                </div>
              ))}
            </div>
          </main>
        </div>
      )}
    </aside>
  );
}

// ── Markdown & Table & Code & Image Renderer ────────────────────────────────
type RenderSegment =
  | { type: "text"; content: string }
  | { type: "table"; headers: string[]; rows: string[][]; raw: string }
  | {
      type: "code";
      language: string;
      filename: string;
      code: string;
      isHtml: boolean;
    };

function RenderMessage({
  content,
  userPrompt,
  onOpenArtifact,
}: {
  content: string;
  userPrompt?: string;
  onOpenArtifact?: (artifact: Omit<ActiveArtifact, "id">) => void;
}) {
  // Check if user specifically requested Excel / Spreadsheet / CSV / Sheets
  const userWantsExcel = /(?:excel|\.xlsx|spreadsheet|csv|\bsheet\b)/i.test(
    userPrompt || ""
  );

  // Sanitize content to unwrap code-blocked tables and ensure consistent pipe boundaries
  const sanitizedContent = sanitizeTableMarkdown(content);

  // 1. Find all code blocks: ```(lang)?(?::([^\n]+))?\r?\n([\s\S]*?)\r?\n```
  const codeRegex = /```(\w+)?(?::([^\n]+))?\r?\n([\s\S]*?)\r?\n```/g;
  const codeMatches: Array<{
    start: number;
    end: number;
    language: string;
    filename: string;
    code: string;
    isHtml: boolean;
  }> = [];

  let m: RegExpExecArray | null;
  let codeIdx = 0;
  while ((m = codeRegex.exec(sanitizedContent)) !== null) {
    const rawLang = (m[1] || "").toLowerCase();
    const rawFile = m[2]?.trim();
    const codeBody = m[3] || "";
    const isHtml = checkIsHtml(rawLang, codeBody);
    const filename = rawFile || inferFilename(rawLang, isHtml, codeIdx++);
    codeMatches.push({
      start: m.index,
      end: m.index + m[0].length,
      language: rawLang || (isHtml ? "html" : "code"),
      filename,
      code: codeBody,
      isHtml,
    });
  }

  // 2. Find all table blocks (outside code blocks)
  const tableRegex = /((?:^[ \t]*\|[^\n]+\|[ \t]*(?:\r?\n|$)){2,})/gm;
  const tableMatches: Array<{
    start: number;
    end: number;
    headers: string[];
    rows: string[][];
    raw: string;
  }> = [];

  while ((m = tableRegex.exec(sanitizedContent)) !== null) {
    const tStart = m.index;
    const tEnd = m.index + m[0].length;
    // Discard if inside a code block
    if (codeMatches.some((cm) => tStart >= cm.start && tEnd <= cm.end)) {
      continue;
    }

    const rawTable = m[0].trim();
    const lines = rawTable.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2 && /^\|[\s\-:|]+\|$/.test(lines[1])) {
      const headers = lines[0]
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());
      const rows = lines.slice(2).map((line) =>
        line
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim())
      );
      tableMatches.push({
        start: tStart,
        end: tEnd,
        headers,
        rows,
        raw: rawTable,
      });
    }
  }

  // 3. Combine and sort all special blocks
  const allBlocks: Array<
    | { type: "code"; start: number; end: number; data: (typeof codeMatches)[0] }
    | { type: "table"; start: number; end: number; data: (typeof tableMatches)[0] }
  > = [
    ...codeMatches.map((c) => ({ type: "code" as const, start: c.start, end: c.end, data: c })),
    ...tableMatches.map((t) => ({ type: "table" as const, start: t.start, end: t.end, data: t })),
  ].sort((a, b) => a.start - b.start);

  // 4. Interleave with text segments
  const segments: RenderSegment[] = [];
  let cursor = 0;
  for (const block of allBlocks) {
    if (block.start > cursor) {
      segments.push({
        type: "text",
        content: sanitizedContent.slice(cursor, block.start),
      });
    }
    if (block.type === "code") {
      segments.push({
        type: "code",
        language: block.data.language,
        filename: block.data.filename,
        code: block.data.code,
        isHtml: block.data.isHtml,
      });
    } else {
      segments.push({
        type: "table",
        headers: block.data.headers,
        rows: block.data.rows,
        raw: block.data.raw,
      });
    }
    cursor = block.end;
  }
  if (cursor < sanitizedContent.length) {
    segments.push({
      type: "text",
      content: sanitizedContent.slice(cursor),
    });
  }

  const renderTextPiece = (txt: string) => {
    const html = txt
      .replace(
        /!\[(.*?)\]\((https?:\/\/[^\)]+)\)/g,
        '<div style="margin:10px 0;"><img src="$2" alt="$1" style="max-width:100%;max-height:420px;border-radius:12px;display:block;box-shadow:0 4px 16px rgba(0,0,0,0.15);object-fit:cover;" /><span style="font-size:11px;color:var(--pg-text-tertiary);margin-top:4px;display:block;">Generated Image: $1</span></div>'
      )
      .replace(
        /\[(.*?)\]\((https?:\/\/[^\)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--pg-accent);text-decoration:underline;word-break:break-all;">$1</a>'
      )
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(
        /`([^`]+)`/g,
        '<code style="background:var(--pg-code-bg);padding:2px 6px;border-radius:4px;font-family:var(--font-mono);font-size:12px">$1</code>'
      )
      .replace(/\n/g, "<br/>");
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "table") {
          return (
            <SmartTableView
              key={i}
              headers={seg.headers}
              rows={seg.rows}
              raw={seg.raw}
              defaultToExcel={userWantsExcel}
            />
          );
        }
        if (seg.type === "code") {
          return (
            <CodeViewerCard
              key={i}
              language={seg.language}
              filename={seg.filename}
              code={seg.code}
              isHtml={seg.isHtml}
              onOpen={(tab) =>
                onOpenArtifact?.({
                  title: seg.filename,
                  language: seg.language,
                  code: seg.code,
                  isHtml: seg.isHtml,
                  activeTab: tab,
                })
              }
            />
          );
        }
        return <span key={i}>{renderTextPiece(seg.content)}</span>;
      })}
    </>
  );
}

// ── Determine which server tools are actually triggered by the user prompt ──
function determineActiveTools(
  prompt: string,
  toolsList: ServerTool[],
  configs: any
): string[] {
  const active: string[] = [];
  const enabledMap = Object.fromEntries(toolsList.map((t) => [t.id, t.enabled]));

  // 1. Web Search
  if (enabledMap.web_search) {
    const isAlways = configs.web_search?.mode === "always";
    const isSearchNeeded =
      isAlways ||
      prompt.trim().endsWith("?") ||
      /(?:who|what|where|when|why|how|which|whose|news|weather|weqather|wether|price|stock|update|latest|current|search|score|release|today|tomorrow|tomoraw|yesterday|now|reseach|research|look\s*up|find|online|info|tell|explain|check|is|are|can|did|202[4-9])/i.test(
        prompt
      );
    if (isSearchNeeded) active.push("web_search");
  }

  // 2. Web Fetch (ONLY if prompt contains a URL)
  if (enabledMap.web_fetch && /https?:\/\/[^\s"'<>\)]+/i.test(prompt)) {
    active.push("web_fetch");
  }

  // 3. Image Generation (ONLY if prompt requests creating an image)
  if (
    enabledMap.image_gen &&
    (/(?:generate|create|draw|paint|picture\s+of|image\s+of|photo\s+of|illustration\s+of)\b/i.test(prompt) ||
      /^\/image\b/i.test(prompt))
  ) {
    active.push("image_gen");
  }

  // 4. Shell (ONLY if prompt contains shell commands or code block)
  if (
    enabledMap.shell &&
    (/```(?:bash|sh|shell|cmd)?\n[\s\S]+?```/i.test(prompt) ||
      /(?:run|execute|shell|bash|cmd)\s*[:]\s*(.+)/i.test(prompt) ||
      /^\$\s*[a-zA-Z0-9]/i.test(prompt.trim()))
  ) {
    active.push("shell");
  }

  // 5. Datetime (ONLY if asking for date/time or temporal queries)
  if (
    enabledMap.datetime &&
    /(?:date|time|clock|day|today|tomorrow|tomoraw|yesterday|what\s+time|what\s+day|current\s+year|now|month|hour|year)/i.test(prompt)
  ) {
    active.push("datetime");
  }

  // 6. Fusion (ONLY if explicitly enabled by user)
  if (enabledMap.fusion) {
    active.push("fusion");
  }

  // 7. Advisor (ONLY if explicitly enabled by user)
  if (enabledMap.advisor) {
    active.push("advisor");
  }

  // 8. Subagent (ONLY if explicitly enabled by user)
  if (enabledMap.subagent) {
    active.push("subagent");
  }

  return active;
}

export default function PlaygroundPage() {
  const { theme, toggle } = useTheme();

  // ── 1. Real Catalog & Combos Data ──────────────────────────────────────────
  const [catalog, setCatalog] = useState<CatalogModel[]>([]);
  const [combos, setCombos] = useState<any[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [selectedModel, setSelectedModel] = useState<string>("smart-coding-fallback");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState("");
  const [dropdownTab, setDropdownTab] = useState<"all" | "combos" | "models">("all");

  // Load real models and combos from gateway APIs
  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setCatalogLoading(true);
      try {
        const [modelsRes, combosRes] = await Promise.all([
          fetch("/api/v1/models").then((r) => (r.ok ? r.json() : { data: [] })),
          fetch("/api/combos").then((r) => (r.ok ? r.json() : { combos: [] })),
        ]);

        if (!mounted) return;

        const allItems: CatalogModel[] = modelsRes.data ?? [];
        setCatalog(allItems);
        setCombos(combosRes.combos ?? []);

        // Pick first combo or first model as active if current not in list
        if (allItems.length > 0) {
          const hasCurrent = allItems.some((m) => m.id === selectedModel);
          if (!hasCurrent) {
            const firstCombo = allItems.find((m) => m.isCombo);
            setSelectedModel(firstCombo ? firstCombo.id : allItems[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load catalog:", err);
      } finally {
        if (mounted) setCatalogLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  // ── 2. Real Persistent Chat Rooms & Messages ──────────────────────────────
  // Use plain defaults (no localStorage reads) in useState to avoid SSR/CSR hydration mismatch.
  // After mount, we load persisted state from localStorage in useEffect.
  const [rooms, setRooms] = useState<Room[]>([{ id: "r-init", title: "New chat", updatedAt: Date.now() }]);
  const [activeRoom, setActiveRoom] = useState<string>("r-init");
  const [messages, setMessages] = useState<Record<string, Message[]>>({ "r-init": [] });
  const [_storageLoaded, setStorageLoaded] = useState(false);

  // Hydrate from localStorage after mount (client only) - this avoids hydration mismatch
  useEffect(() => {
    try {
      const savedRooms = localStorage.getItem("fr_pg_rooms");
      const savedActiveRoom = localStorage.getItem("fr_pg_active_room");
      const savedMessages = localStorage.getItem("fr_pg_messages");

      if (savedRooms) {
        const parsedRooms = JSON.parse(savedRooms);
        setRooms(parsedRooms);
        if (savedActiveRoom) {
          const existsInRooms = parsedRooms.some((r: Room) => r.id === savedActiveRoom);
          if (existsInRooms) setActiveRoom(savedActiveRoom);
          else if (parsedRooms.length > 0) setActiveRoom(parsedRooms[0].id);
        }
      }

      if (savedMessages) {
        const parsed = JSON.parse(savedMessages);
        // Ensure dates are Date objects
        Object.keys(parsed).forEach((k) => {
          parsed[k] = parsed[k].map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          }));
        });
        setMessages(parsed);
      }
    } catch {
      // Ignore parse errors
    }
    setStorageLoaded(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save rooms to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("fr_pg_rooms", JSON.stringify(rooms));
      localStorage.setItem("fr_pg_active_room", activeRoom);
    } catch {}
  }, [rooms, activeRoom]);

  // Save messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("fr_pg_messages", JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // ── 3. Chat Controls & State ──────────────────────────────────────────────
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<"Side by side" | "List">("List");
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const [toolsPopoverOpen, setToolsPopoverOpen] = useState(false);
  const [memoryPopoverOpen, setMemoryPopoverOpen] = useState(false);
  const [memoryValue, setMemoryValue] = useState(20); // 20 = ∞ (all)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [showReasoning, setShowReasoning] = useState<Record<string, boolean>>({});
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({});

  // Active Code Artifact Drawer / Slider State (Claude-style side panel)
  const [activeArtifact, setActiveArtifact] = useState<ActiveArtifact | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeArtifact) {
        setActiveArtifact(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeArtifact]);

  // Active Tool Drilldown Configuration State
  const [activeToolConfig, setActiveToolConfig] = useState<string | null>(null);
  const [toolConfigs, setToolConfigs] = useState({
    web_search: { mode: "auto" as "auto" | "always", depth: "medium" as "low" | "medium" | "high" },
    web_fetch: { mode: "auto" as "auto" | "always", maxChars: 2500 },
    image_gen: { model: "flux-schnell", size: "1024x1024" as "1024x1024" | "1280x720" | "720x1280" },
    datetime: { timezone: "auto" as "auto" | "utc" },
    fusion: {
      models: ["ling-3.0-flash", "deepseek/deepseek-chat", "meta-llama/llama-3.3-70b-instruct"],
    },
    advisor: { model: "anthropic/claude-3.7-sonnet" },
    subagent: { model: "deepseek/north-mini" },
    shell: { timeoutSec: 30 },
  });

  // Real Server Tools configuration (standard tools auto-enabled, specialist tools disabled by default)
  const [serverTools, setServerTools] = useState<ServerTool[]>([
    { id: "web_search", name: "Web Search", desc: "Search the web for current information", sub: "Auto · Medium", icon: "🌐", enabled: true },
    { id: "web_fetch", name: "Web Fetch", desc: "Retrieve content from URLs", sub: "Auto", icon: "🔗", enabled: true },
    { id: "image_gen", name: "Image Generation", desc: "Generate images from text", sub: "Auto", icon: "🖼️", enabled: true },
    { id: "datetime", name: "Datetime", desc: "Current date and time info", sub: "Auto", icon: "🕒", enabled: true },
    { id: "fusion", name: "Fusion", desc: "Multi-model consensus and analysis", sub: "3 models", icon: "🔀", enabled: false },
    { id: "advisor", name: "Advisor", desc: "Consult a stronger model for guidance", sub: "1 advisor", icon: "💡", enabled: false },
    { id: "subagent", name: "Subagent", desc: "Delegate tasks to smaller, faster models", sub: "1 subagent", icon: "🔲", enabled: false },
    { id: "shell", name: "Shell", desc: "Run shell commands in a sandboxed container", sub: "Shell", icon: "🐚", enabled: false },
  ]);

  // Track tools actively executing for the current user prompt
  const [activeRunningTools, setActiveRunningTools] = useState<string[]>([]);

  // Compute live subtitle based on tool configuration
  const getToolSubtitle = useCallback(
    (id: string) => {
      switch (id) {
        case "web_search":
          return `${toolConfigs.web_search.mode === "auto" ? "Auto" : "Always"} · ${
            toolConfigs.web_search.depth.charAt(0).toUpperCase() + toolConfigs.web_search.depth.slice(1)
          }`;
        case "web_fetch":
          return toolConfigs.web_fetch.mode === "auto" ? "Auto" : "Always";
        case "image_gen":
          return "Auto";
        case "datetime":
          return toolConfigs.datetime.timezone === "utc" ? "UTC" : "Auto";
        case "fusion":
          return `${toolConfigs.fusion.models.length} models`;
        case "advisor":
          return "1 advisor";
        case "subagent":
          return "1 subagent";
        case "shell":
          return "Shell";
        default:
          return "Auto";
      }
    },
    [toolConfigs]
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentMsgs = messages[activeRoom] || [];

  // Find active selected model/combo object
  const activeModelObj = useMemo(() => {
    return (
      catalog.find((m) => m.id === selectedModel) || {
        id: selectedModel,
        displayName: selectedModel,
        isCombo: selectedModel.includes("combo") || selectedModel.includes("fallback"),
        provider: { slug: "freeroute", name: "Freeroute", icon: "☲" },
      }
    );
  }, [catalog, selectedModel]);

  // Toast auto-clear
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeRoom, loading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px";
  };

  // Create new room
  const createRoom = useCallback(() => {
    const id = uid();
    const newRoom: Room = { id, title: "New chat", updatedAt: Date.now() };
    setRooms((prev) => [newRoom, ...prev]);
    setMessages((prev) => ({ ...prev, [id]: [] }));
    setActiveRoom(id);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, []);

  // Global Keyboard Shortcuts (⌘ / or Ctrl+/ for New Chat, ⌘ J or Ctrl+J for Model Selector, Esc to close modals)
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key === "/") {
        e.preventDefault();
        createRoom();
      } else if (isMeta && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        setModelDropdownOpen((v) => !v);
      } else if (e.key === "Escape") {
        setModelDropdownOpen(false);
        setToolsPopoverOpen(false);
        setMemoryPopoverOpen(false);
        setViewDropdownOpen(false);
        setActiveToolConfig(null);
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [createRoom]);

  // Delete active room
  const deleteRoom = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRooms((prev) => {
      const filtered = prev.filter((r) => r.id !== id);
      if (filtered.length === 0) {
        const fresh = { id: uid(), title: "New chat", updatedAt: Date.now() };
        setActiveRoom(fresh.id);
        return [fresh];
      }
      if (activeRoom === id) {
        setActiveRoom(filtered[0].id);
      }
      return filtered;
    });
    setMessages((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    showToast("Chat removed");
  };

  // Bulk delete selected rooms
  const deleteSelectedRooms = () => {
    if (selectedRooms.length === 0) return;
    setRooms((prev) => {
      const filtered = prev.filter((r) => !selectedRooms.includes(r.id));
      if (filtered.length === 0) {
        const fresh = { id: uid(), title: "New chat", updatedAt: Date.now() };
        setActiveRoom(fresh.id);
        return [fresh];
      }
      if (selectedRooms.includes(activeRoom)) {
        setActiveRoom(filtered[0].id);
      }
      return filtered;
    });
    setSelectedRooms([]);
    setSelectMode(false);
    showToast("Selected chats deleted");
  };

  const toggleTool = (id: string) => {
    setServerTools((tools) =>
      tools.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t))
    );
  };

  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});

  // ── 4. Real Execution via /api/playground/chat with Server Tools ──────────
  const sendMessage = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text || loading) return;

      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      const userMsg: Message = {
        id: uid(),
        role: "user",
        content: text,
        timestamp: new Date(),
      };

      // Update room title if first message
      setRooms((rs) =>
        rs.map((r) =>
          r.id === activeRoom && (r.title === "New chat" || r.title === "")
            ? { ...r, title: text.slice(0, 24), lastMsg: text.slice(0, 36), updatedAt: Date.now() }
            : r.id === activeRoom
            ? { ...r, lastMsg: text.slice(0, 36), updatedAt: Date.now() }
            : r
        )
      );

      const updatedMsgs = [...currentMsgs, userMsg];
      setMessages((m) => ({
        ...m,
        [activeRoom]: updatedMsgs,
      }));

      setLoading(true);
      const activeTools = determineActiveTools(text, serverTools, toolConfigs);
      setActiveRunningTools(activeTools);

      // Check if user is asking to build or develop a web app / site / page
      const isWebDevIntent = /(?:website|web\s*app|landing\s*page|develop|build|create|react|html|frontend|page|ui|app|component|site|dashboard)\b/i.test(text);
      if (isWebDevIntent) {
        setActiveArtifact({
          id: `ws_building_${Date.now()}`,
          title: "App.tsx",
          language: "tsx",
          code: "",
          isHtml: true,
          activeTab: "preview",
          isBuilding: true,
          urlPath: "/",
        });
      }

      // Context window trimming based on Chat Memory slider
      const historySlice =
        memoryValue >= 20
          ? updatedMsgs
          : updatedMsgs.slice(-memoryValue);

      const requestPayload = {
        model: selectedModel,
        messages: historySlice.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        tools: Object.fromEntries(serverTools.map((t) => [t.id, t.enabled])),
        toolConfigs,
        clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      const startTime = Date.now();

      try {
        const response = await fetch("/api/playground/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer freeroute-playground",
          },
          body: JSON.stringify(requestPayload),
        });

        const latencyMs = Date.now() - startTime;
        let assistantContent = "";
        let tokensUsed = 0;
        let costStr = "$0";
        let reasoningText = "";
        let returnedToolCalls: ToolCallResult[] = [];
        let weatherData: any = null;

        if (response.ok) {
          const data = await response.json();
          assistantContent = data.content ?? "No content returned from model.";
          returnedToolCalls = data.toolCalls ?? [];
          weatherData = data.weather ?? null;
          tokensUsed =
            data.usage?.total_tokens ??
            (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0);

          if (data.usage?.cost && data.usage.cost > 0) {
            costStr = `$${Number(data.usage.cost).toFixed(4)}`;
          } else {
            costStr = "$0";
          }

          if (data.reasoning) {
            reasoningText =
              typeof data.reasoning === "string"
                ? data.reasoning
                : JSON.stringify(data.reasoning);
          }

          // If this was a web development request or the response contains code, populate the Workspace IDE
          if (isWebDevIntent || assistantContent.includes("```")) {
            const projectFiles = extractProjectFiles(assistantContent, "tsx", "App.tsx");
            const mainFile = projectFiles.find((f) => f.name === "App.tsx") || projectFiles[0];
            setActiveArtifact({
              id: `ws_${Date.now()}`,
              title: mainFile?.name || "App.tsx",
              language: mainFile?.language || "tsx",
              code: mainFile?.content || assistantContent,
              isHtml: true,
              activeTab: "preview",
              isBuilding: false,
              projectFiles,
              selectedFile: mainFile?.path,
              urlPath: "/",
            });
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          const errMsg =
            errData?.error?.message ||
            `Gateway HTTP ${response.status}: Failed to route to ${activeModelObj.displayName}`;
          assistantContent = `⚠️ **Gateway Error**: ${errMsg}\n\n*Check that your upstream providers have valid API keys connected in the [Providers](/dashboard/providers) tab.*`;
          // If error occurs and we were in building state, close the building screen
          if (isWebDevIntent) {
            setActiveArtifact(null);
          }
        }

        const assistantMsg: Message = {
          id: uid(),
          role: "assistant",
          content: assistantContent,
          model: activeModelObj.displayName,
          tokens: tokensUsed,
          cost: costStr,
          latencyMs,
          reasoning: reasoningText || undefined,
          toolCalls: returnedToolCalls.length > 0 ? returnedToolCalls : undefined,
          weather: weatherData || undefined,
          timestamp: new Date(),
        };

        setMessages((m) => ({
          ...m,
          [activeRoom]: [...updatedMsgs, assistantMsg],
        }));

        setRooms((rs) =>
          rs.map((r) =>
            r.id === activeRoom
              ? { ...r, lastMsg: assistantContent.slice(0, 36), updatedAt: Date.now() }
              : r
          )
        );

        // Notify all open dashboard tabs via BroadcastChannel for 0ms instantaneous update
        notifyClientTelemetry();
      } catch (e: any) {
        if (isWebDevIntent) {
          setActiveArtifact(null);
        }
        const errorMsg: Message = {
          id: uid(),
          role: "assistant",
          content: `⚠️ **Connection Error**: Could not connect to gateway: ${e?.message ?? "Network error"}`,
          model: activeModelObj.displayName,
          timestamp: new Date(),
        };
        setMessages((m) => ({
          ...m,
          [activeRoom]: [...updatedMsgs, errorMsg],
        }));
      } finally {
        setLoading(false);
        setActiveRunningTools([]);
      }
    },
    [input, loading, activeRoom, currentMsgs, selectedModel, memoryValue, activeModelObj, serverTools, toolConfigs]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── 5. Message Actions ────────────────────────────────────────────────────
  const copyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard");
  };

  const deleteMessage = (msgId: string) => {
    setMessages((prev) => ({
      ...prev,
      [activeRoom]: (prev[activeRoom] || []).filter((m) => m.id !== msgId),
    }));
    showToast("Message deleted");
  };

  const editMessage = (content: string) => {
    setInput(content);
    textareaRef.current?.focus();
  };

  const regenerateResponse = (userMsgIndex: number) => {
    if (userMsgIndex < 0 || userMsgIndex >= currentMsgs.length) return;
    const userPrompt = currentMsgs[userMsgIndex].content;
    // Remove subsequent messages after this user message
    const trimmed = currentMsgs.slice(0, userMsgIndex + 1);
    setMessages((prev) => ({
      ...prev,
      [activeRoom]: trimmed,
    }));
    sendMessage(userPrompt);
  };

  // Filter models & combos in dropdown
  const filteredCatalog = useMemo(() => {
    let list = catalog;
    if (dropdownTab === "combos") {
      list = list.filter((m) => m.isCombo);
    } else if (dropdownTab === "models") {
      list = list.filter((m) => !m.isCombo);
    }
    if (!dropdownSearch.trim()) return list;
    const q = dropdownSearch.toLowerCase();
    return list.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.provider?.name?.toLowerCase().includes(q)
    );
  }, [catalog, dropdownTab, dropdownSearch]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((r) =>
      r.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [rooms, searchQuery]);

  return (
    <div className="pg-root" data-theme={theme}>
      {/* Toast Notification */}
      {toastMsg && <div className="pg-toast">✓ {toastMsg}</div>}

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
      <aside className={`pg-sidebar ${sidebarCollapsed ? "pg-sidebar-collapsed" : ""}`}>
        {/* Header */}
        <div className="pg-sidebar-header">
          {!sidebarCollapsed ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link
                href="/dashboard"
                className="pg-back-overview-btn"
                title="Back to Overview (Home page)"
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                <span>Overview</span>
              </Link>
              <span className="pg-sidebar-title" style={{ fontSize: 13, color: "var(--pg-text-tertiary)", fontWeight: 500 }}>
                / Chat
              </span>
            </div>
          ) : (
            <Link
              href="/dashboard"
              className="pg-icon-btn"
              title="Back to Overview (Home page)"
              style={{ margin: "0 auto" }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </Link>
          )}
          <button
            className="pg-icon-btn"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setSidebarCollapsed((v) => !v)}
            style={{ marginLeft: sidebarCollapsed ? "auto" : "0" }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        </div>

        {!sidebarCollapsed && (
          <>
            {/* New chat button with shortcut */}
            <button className="pg-new-chat-btn" onClick={createRoom}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                New chat
              </span>
              <span className="pg-kbd-shortcut">⌘ /</span>
            </button>

            {/* Search rooms input */}
            <div className="pg-search-wrap">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="pg-search-input"
                placeholder="Search rooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Rooms meta & Select multi-delete */}
            <div className="pg-rooms-meta-row">
              <span className="pg-room-count-label">
                {rooms.length} room{rooms.length !== 1 ? "s" : ""}
              </span>
              <button
                className="pg-room-select-btn"
                onClick={() => {
                  setSelectMode((v) => !v);
                  setSelectedRooms([]);
                }}
              >
                {selectMode ? "Cancel" : "Select"}
              </button>
            </div>

            {selectMode && selectedRooms.length > 0 && (
              <div style={{ padding: "0 12px 6px" }}>
                <button
                  onClick={deleteSelectedRooms}
                  style={{
                    width: "100%",
                    padding: "5px 8px",
                    borderRadius: 6,
                    background: "rgba(239,68,68,0.12)",
                    color: "#ef4444",
                    fontSize: 11.5,
                    fontWeight: 600,
                    border: "1px solid rgba(239,68,68,0.25)",
                    cursor: "pointer",
                  }}
                >
                  Delete Selected ({selectedRooms.length})
                </button>
              </div>
            )}

            {/* Room list */}
            <div className="pg-room-list">
              <div className="pg-room-group-label">TODAY</div>
              {filteredRooms.map((room) => {
                const isSelected = selectedRooms.includes(room.id);
                return (
                  <div
                    key={room.id}
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    {selectMode && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          setSelectedRooms((prev) =>
                            isSelected ? prev.filter((id) => id !== room.id) : [...prev, room.id]
                          );
                        }}
                        style={{ marginLeft: 6, cursor: "pointer", accentColor: "var(--pg-accent)" }}
                      />
                    )}
                    <button
                      className={`pg-room-item ${activeRoom === room.id ? "active" : ""}`}
                      onClick={() => setActiveRoom(room.id)}
                      style={{ flex: 1 }}
                    >
                      <div className="pg-room-title">{room.title}</div>
                      {room.lastMsg && <div className="pg-room-preview">{room.lastMsg}</div>}
                    </button>
                    {!selectMode && rooms.length > 1 && (
                      <button
                        className="pg-icon-btn"
                        style={{ width: 22, height: 22, opacity: 0.5 }}
                        title="Delete chat"
                        onClick={(e) => deleteRoom(room.id, e)}
                      >
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom: Default Workspace with purple D avatar */}
            <Link
              href="/dashboard"
              className="pg-sidebar-user"
              style={{ textDecoration: "none" }}
              title="Back to Overview (Home page)"
            >
              <div className="pg-user-avatar-sq">D</div>
              <div className="pg-user-name">Default Workspace</div>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--pg-text-tertiary)" }}>
                <path d="M7 15l5 5 5-5M7 9l5-5 5 5" />
              </svg>
            </Link>
          </>
        )}
      </aside>

      {/* ── MAIN CHAT VIEW ───────────────────────────────────────────────── */}
      <main
        className="pg-main"
        onClick={() => {
          setModelDropdownOpen(false);
          setViewDropdownOpen(false);
        }}
      >
        {/* Topbar */}
        <header className="pg-chat-topbar">
          <div className="pg-chat-topbar-left" style={{ position: "relative" }}>
            {/* Add Model / Tab button */}
            <button
              className="pg-add-model-btn"
              onClick={(e) => {
                e.stopPropagation();
                setModelDropdownOpen((v) => !v);
              }}
              title="Add Model or Combo"
            >
              <span>+</span>
              <span className="pg-kbd-shortcut">⌘ J</span>
            </button>

            {/* Active Model / Combo Chip Tab */}
            <div
              className="pg-model-tab"
              onClick={(e) => {
                e.stopPropagation();
                setModelDropdownOpen((v) => !v);
              }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ color: "var(--pg-text)" }}>
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <span>{activeModelObj.displayName}</span>
              {activeModelObj.isCombo && (
                <span className="pg-badge-combo">Combo</span>
              )}
              <span
                className="pg-model-tab-close"
                title="Switch model or combo"
                onClick={(e) => {
                  e.stopPropagation();
                  setModelDropdownOpen((v) => !v);
                }}
              >
                ×
              </span>
            </div>

            {/* Model & Combo Selection Dropdown (Loaded dynamically from gateway) */}
            {modelDropdownOpen && (
              <div className="pg-model-dropdown" onClick={(e) => e.stopPropagation()}>
                {/* Search input */}
                <div className="pg-dropdown-search-wrap">
                  <input
                    className="pg-dropdown-search"
                    placeholder="Search models or combos..."
                    value={dropdownSearch}
                    onChange={(e) => setDropdownSearch(e.target.value)}
                    autoFocus
                  />
                </div>

                {/* Tabs: All / Combos / Models */}
                <div className="pg-dropdown-tabs">
                  {(["all", "combos", "models"] as const).map((tab) => (
                    <button
                      key={tab}
                      className={`pg-dropdown-tab-btn ${dropdownTab === tab ? "active" : ""}`}
                      onClick={() => setDropdownTab(tab)}
                    >
                      {tab.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* Dropdown Options List */}
                <div className="pg-dropdown-scroll">
                  {catalogLoading ? (
                    <div style={{ padding: "16px", textAlign: "center", color: "var(--pg-text-tertiary)", fontSize: 12 }}>
                      Loading models from gateway...
                    </div>
                  ) : filteredCatalog.length === 0 ? (
                    <div style={{ padding: "16px", textAlign: "center", color: "var(--pg-text-tertiary)", fontSize: 12 }}>
                      No matching models or combos found
                    </div>
                  ) : (
                    filteredCatalog.map((item) => {
                      const isSelected = selectedModel === item.id;
                      return (
                        <button
                          key={item.id}
                          className={`pg-model-option ${isSelected ? "active" : ""}`}
                          onClick={() => {
                            setSelectedModel(item.id);
                            setModelDropdownOpen(false);
                            showToast(`Selected: ${item.displayName}`);
                          }}
                        >
                          <span style={{ fontSize: 14 }}>
                            {item.isCombo ? "☲" : item.provider?.icon || "🤖"}
                          </span>
                          <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {item.displayName}
                            </span>
                            <span style={{ fontSize: 10.5, color: "var(--pg-text-tertiary)" }}>
                              {item.isCombo
                                ? `Strategy: ${item.strategy || "failover"}`
                                : `${item.provider?.name || "Provider"} · ${item.contextWindow || "128K"}`}
                            </span>
                          </div>
                          {item.isCombo ? (
                            <span className="pg-badge-combo">COMBO</span>
                          ) : (
                            <span className="pg-badge-model">
                              {item.inputPrice === 0 ? "FREE" : `$${item.inputPrice}/1M`}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="pg-chat-topbar-right">
            {/* View Mode: Side by side / List */}
            <div style={{ position: "relative" }}>
              <button
                className="pg-topbar-select-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewDropdownOpen((v) => !v);
                }}
              >
                <span>{viewMode}</span>
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {viewDropdownOpen && (
                <div
                  className="pg-model-dropdown"
                  style={{ minWidth: 140, width: 140, right: 0, left: "auto" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {(["Side by side", "List"] as const).map((mode) => (
                    <button
                      key={mode}
                      className={`pg-model-option ${viewMode === mode ? "active" : ""}`}
                      onClick={() => {
                        setViewMode(mode);
                        setViewDropdownOpen(false);
                      }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bookmark button */}
            <button
              className="pg-icon-btn"
              title="Bookmark conversation"
              onClick={() => showToast("Conversation bookmarked")}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>

            {/* Search in chat */}
            <button
              className="pg-icon-btn"
              title="Search in current chat"
              onClick={() => {
                const q = prompt("Search in this chat:");
                if (q) {
                  const found = currentMsgs.find((m) =>
                    m.content.toLowerCase().includes(q.toLowerCase())
                  );
                  if (found) showToast(`Found message matching "${q}"`);
                  else showToast("No matches found");
                }
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>

            {/* Theme Toggle Button */}
            <button
              className="pg-icon-btn"
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
              onClick={toggle}
            >
              {theme === "dark" ? (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            {/* Back to Overview button */}
            <Link
              href="/dashboard"
              className="pg-topbar-overview-btn"
              title="Back to Overview (Home page)"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>Overview</span>
            </Link>

            {/* Gateway Settings link */}
            <Link href="/dashboard/settings" className="pg-icon-btn" title="Gateway Settings">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
          </div>
        </header>

        {/* Messages Stream */}
        <div
          className="pg-messages"
          onClick={() => {
            setToolsPopoverOpen(false);
            setMemoryPopoverOpen(false);
          }}
        >
          {currentMsgs.length === 0 ? (
            /* Clean Empty State - No Fake Demo Messages */
            <div className="pg-welcome-wrap">
              <div className="pg-welcome-icon">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <h2 className="pg-welcome-title">How can I help you today?</h2>
              <p className="pg-welcome-sub">
                Ask a question or route live queries through <strong>{activeModelObj.displayName}</strong>.
              </p>
              <div className="pg-welcome-chips">
                {[
                  "Explain how freeroute combo failover works",
                  "Write a TypeScript function to fetch models",
                  "What is the current latency of active routes?",
                  "Compare round-robin vs latency-based routing",
                ].map((chip) => (
                  <button
                    key={chip}
                    className="pg-prompt-chip"
                    onClick={() => {
                      setInput(chip);
                      textareaRef.current?.focus();
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            currentMsgs.map((msg, idx) => {
              if (msg.role === "user") {
                return (
                  <div key={msg.id} className="pg-user-message-wrap">
                    <div className="pg-user-message-row">
                      <div className="pg-user-bubble">{msg.content}</div>
                      <div className="pg-user-avatar-circle">
                        <span>👤</span>
                      </div>
                    </div>
                    <div className="pg-user-actions-row">
                      <button
                        className="pg-msg-action-icon"
                        title="Regenerate from here"
                        onClick={() => regenerateResponse(idx)}
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M23 4v6h-6M1 20v-6h6" />
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                      </button>
                      <button
                        className="pg-msg-action-icon"
                        title="Copy message"
                        onClick={() => copyMessage(msg.content)}
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                      <button
                        className="pg-msg-action-icon"
                        title="Edit message"
                        onClick={() => editMessage(msg.content)}
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        className="pg-msg-action-icon"
                        title="Delete message"
                        onClick={() => deleteMessage(msg.id)}
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              }

              // Assistant message card
              const hasReasoning = !!msg.reasoning;
              const isReasoningExpanded = showReasoning[msg.id];
              const isCardCollapsed = !!collapsedCards[msg.id];

              return (
                <div key={msg.id} className="pg-assistant-card">
                  {/* Card Header: Model name + Restore link + collapse chevron */}
                  <div className="pg-card-header">
                    <div className="pg-card-header-left">
                      <div className="pg-model-name-title">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ color: "var(--pg-text)" }}>
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                        <span>{msg.model || activeModelObj.displayName}</span>
                      </div>
                      <button
                        className="pg-restore-link"
                        onClick={() => {
                          if (msg.model) {
                            const found = catalog.find(
                              (m) => m.displayName === msg.model || m.id === msg.model
                            );
                            if (found) setSelectedModel(found.id);
                          }
                          showToast(`Restored model ${msg.model || activeModelObj.displayName}`);
                        }}
                        title="Restore this model as active"
                      >
                        Restore
                      </button>
                    </div>
                    <button
                      className="pg-icon-btn"
                      title={isCardCollapsed ? "Expand message" : "Collapse message"}
                      onClick={() => setCollapsedCards((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                      style={{ width: 24, height: 24 }}
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d={isCardCollapsed ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
                      </svg>
                    </button>
                  </div>

                  {!isCardCollapsed && (
                    <>

                  {/* Reasoning pill badge if model returns reasoning */}
                  {hasReasoning && (
                    <div>
                      <button
                        className="pg-reasoning-pill"
                        onClick={() =>
                          setShowReasoning((prev) => ({
                            ...prev,
                            [msg.id]: !prev[msg.id],
                          }))
                        }
                        title="Toggle reasoning thoughts"
                        style={{ cursor: "pointer", border: "none" }}
                      >
                        <span>✧</span>
                        <span>Reasoning</span>
                        <span style={{ fontSize: 10, marginLeft: 2 }}>
                          {isReasoningExpanded ? "▲" : "▼"}
                        </span>
                      </button>
                      {isReasoningExpanded && typeof msg.reasoning === "string" && (
                        <div
                          style={{
                            marginTop: 8,
                            padding: "10px 12px",
                            borderRadius: 8,
                            background: "var(--pg-code-bg)",
                            fontSize: 12,
                            color: "var(--pg-text-secondary)",
                            fontFamily: "var(--font-mono)",
                            lineHeight: 1.5,
                            borderLeft: "2px solid var(--pg-accent)",
                          }}
                        >
                          {msg.reasoning}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Built-in Weather Widget Card */}
                  {msg.weather && <WeatherCard weather={msg.weather} />}

                  {/* Executed Tools & Command Output (Persisted and inspected after execution) */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <ToolCallsViewer toolCalls={msg.toolCalls} />
                  )}

                  {/* Card content text */}
                  <div className="pg-card-body">
                    <RenderMessage
                      content={msg.content}
                      userPrompt={
                        currentMsgs
                          .slice(0, idx)
                          .reverse()
                          .find((m) => m.role === "user")?.content
                      }
                      onOpenArtifact={(art) => {
                        setActiveArtifact({
                          id: `${msg.id}_${Date.now()}`,
                          ...art,
                        });
                      }}
                    />
                  </div>

                  {/* Card footer actions */}
                  <div className="pg-card-footer">
                    <div className="pg-msg-actions-left">
                      <button
                        className="pg-msg-action-icon"
                        title="Regenerate"
                        onClick={() => {
                          const prevUserMsg = currentMsgs
                            .slice(0, idx)
                            .reverse()
                            .find((m) => m.role === "user");
                          if (prevUserMsg) sendMessage(prevUserMsg.content);
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M23 4v6h-6M1 20v-6h6" />
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                      </button>
                      <button
                        className="pg-msg-action-icon"
                        title="Copy content"
                        onClick={() => copyMessage(msg.content)}
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                      <button
                        className="pg-msg-action-icon"
                        title="Edit to input"
                        onClick={() => editMessage(msg.content)}
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        className="pg-msg-action-icon"
                        title="Delete message"
                        onClick={() => deleteMessage(msg.id)}
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                      <button
                        className="pg-msg-action-icon"
                        title="Share / Export"
                        onClick={() => {
                          copyMessage(
                            `# Message from ${msg.model || "freeroute"}\n\n${msg.content}`
                          );
                          showToast("Copied formatted response");
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="19" x2="12" y2="5" />
                          <polyline points="5 12 12 5 19 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="pg-tok-meta">
                      <span className="pg-tok-cost">{msg.cost || "$0"}</span> ·{" "}
                      {msg.tokens ? `${msg.tokens} tok` : "0 tok"}
                      {msg.latencyMs ? ` · ${msg.latencyMs}ms` : ""}
                    </div>
                  </div>
                  </>
                )}
                </div>
              );
            })
          )}

          {/* Thinking Card when waiting for LLM completion - tools show while generating and disappear when complete */}
          {loading && (
            <div className="pg-typing-card" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                <div className="pg-model-name-title">
                  <span>{activeModelObj.displayName}</span>
                </div>
                <div className="pg-typing-indicator">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
              {activeRunningTools.length > 0 && (
                <div className="pg-tools-executed-bar" style={{ margin: 0, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {serverTools
                    .filter((t) => activeRunningTools.includes(t.id))
                    .map((t) => (
                      <div key={t.id} className="pg-tool-chip" style={{ cursor: "default", opacity: 0.9 }}>
                        <span>{t.icon}</span>
                        <span>{t.name}</span>
                        <span style={{ fontSize: 9, opacity: 0.65, fontWeight: 500 }}>running</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── BOTTOM INPUT AREA ────────────────────────────────────────────── */}
        <div className="pg-input-container">
          {/* Server Tools Popover (Image 1 + Drilldowns) */}
          {toolsPopoverOpen && (
            <div className="pg-server-tools-popover" onClick={(e) => e.stopPropagation()}>
              {!activeToolConfig ? (
                <>
                  <div className="pg-server-tools-header">
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span>Server tools</span>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </div>
                    <Link href="/dashboard/settings" className="pg-server-tools-link">
                      Configure ⚙
                    </Link>
                  </div>

                  {serverTools.map((tool) => (
                    <div
                      key={tool.id}
                      className="pg-server-tool-row"
                      onClick={() => setActiveToolConfig(tool.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <div className="pg-server-tool-icon">{tool.icon}</div>
                      <div className="pg-server-tool-info">
                        <div className="pg-server-tool-name">{tool.name}</div>
                        <div className="pg-server-tool-desc">{tool.desc}</div>
                        <div className="pg-server-tool-sub">{getToolSubtitle(tool.id)}</div>
                      </div>
                      <button
                        className={`pg-purple-switch ${tool.enabled ? "on" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTool(tool.id);
                        }}
                        title={`Toggle ${tool.name}`}
                      />
                      <div className="pg-server-tool-chevron">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                /* Submenu Drilldown Configuration View */
                (() => {
                  const currTool = serverTools.find((t) => t.id === activeToolConfig);
                  if (!currTool) return null;

                  return (
                    <div>
                      <div className="pg-drilldown-header">
                        <button
                          className="pg-drilldown-back"
                          onClick={() => setActiveToolConfig(null)}
                          title="Back to Server tools"
                        >
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="15 18 9 12 15 6" />
                          </svg>
                          <span>Back</span>
                        </button>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span>{currTool.icon}</span>
                          <span>{currTool.name}</span>
                        </span>
                        <button
                          className={`pg-purple-switch ${currTool.enabled ? "on" : ""}`}
                          onClick={() => toggleTool(currTool.id)}
                          title={`Toggle ${currTool.name}`}
                        />
                      </div>

                      <div className="pg-drilldown-content">
                        {/* 1. Web Search Drilldown */}
                        {activeToolConfig === "web_search" && (
                          <>
                            <div className="pg-drilldown-section">
                              <span className="pg-drilldown-label">Trigger Mode</span>
                              <div className="pg-drilldown-btn-group">
                                <button
                                  className={`pg-drilldown-btn-option ${
                                    toolConfigs.web_search.mode === "auto" ? "active" : ""
                                  }`}
                                  onClick={() =>
                                    setToolConfigs((c) => ({
                                      ...c,
                                      web_search: { ...c.web_search, mode: "auto" },
                                    }))
                                  }
                                >
                                  Auto
                                </button>
                                <button
                                  className={`pg-drilldown-btn-option ${
                                    toolConfigs.web_search.mode === "always" ? "active" : ""
                                  }`}
                                  onClick={() =>
                                    setToolConfigs((c) => ({
                                      ...c,
                                      web_search: { ...c.web_search, mode: "always" },
                                    }))
                                  }
                                >
                                  Always
                                </button>
                              </div>
                            </div>

                            <div className="pg-drilldown-section">
                              <span className="pg-drilldown-label">Search Depth</span>
                              <div className="pg-drilldown-btn-group">
                                {(["low", "medium", "high"] as const).map((d) => (
                                  <button
                                    key={d}
                                    className={`pg-drilldown-btn-option ${
                                      toolConfigs.web_search.depth === d ? "active" : ""
                                    }`}
                                    onClick={() =>
                                      setToolConfigs((c) => ({
                                        ...c,
                                        web_search: { ...c.web_search, depth: d },
                                      }))
                                    }
                                  >
                                    {d.charAt(0).toUpperCase() + d.slice(1)}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="pg-drilldown-info-box">
                              🌐 Grounded with DuckDuckGo & Perplexity. Injects fresh real-time information and web citations when current facts are needed.
                            </div>
                          </>
                        )}

                        {/* 2. Web Fetch Drilldown */}
                        {activeToolConfig === "web_fetch" && (
                          <>
                            <div className="pg-drilldown-section">
                              <span className="pg-drilldown-label">Trigger Mode</span>
                              <div className="pg-drilldown-btn-group">
                                <button
                                  className={`pg-drilldown-btn-option ${
                                    toolConfigs.web_fetch.mode === "auto" ? "active" : ""
                                  }`}
                                  onClick={() =>
                                    setToolConfigs((c) => ({
                                      ...c,
                                      web_fetch: { ...c.web_fetch, mode: "auto" },
                                    }))
                                  }
                                >
                                  Auto
                                </button>
                                <button
                                  className={`pg-drilldown-btn-option ${
                                    toolConfigs.web_fetch.mode === "always" ? "active" : ""
                                  }`}
                                  onClick={() =>
                                    setToolConfigs((c) => ({
                                      ...c,
                                      web_fetch: { ...c.web_fetch, mode: "always" },
                                    }))
                                  }
                                >
                                  Always
                                </button>
                              </div>
                            </div>

                            <div className="pg-drilldown-info-box">
                              🔗 Automatically extracts clean markdown text from any web URLs mentioned in your prompts, stripping ads and HTML navigation boilerplate.
                            </div>
                          </>
                        )}

                        {/* 3. Image Generation Drilldown */}
                        {activeToolConfig === "image_gen" && (
                          <>
                            <div className="pg-drilldown-section">
                              <span className="pg-drilldown-label">Resolution & Aspect Ratio</span>
                              <div className="pg-drilldown-btn-group">
                                {(
                                  [
                                    ["1024x1024", "1:1 Square"],
                                    ["1280x720", "16:9 Wide"],
                                    ["720x1280", "9:16 Tall"],
                                  ] as const
                                ).map(([sz, lbl]) => (
                                  <button
                                    key={sz}
                                    className={`pg-drilldown-btn-option ${
                                      toolConfigs.image_gen.size === sz ? "active" : ""
                                    }`}
                                    onClick={() =>
                                      setToolConfigs((c) => ({
                                        ...c,
                                        image_gen: { ...c.image_gen, size: sz },
                                      }))
                                    }
                                  >
                                    {lbl}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="pg-drilldown-info-box">
                              🖼️ Generates high-fidelity artwork and photo-realistic images using FLUX.1 Schnell and Pollinations AI, rendering images inline.
                            </div>
                          </>
                        )}

                        {/* 4. Datetime Drilldown */}
                        {activeToolConfig === "datetime" && (
                          <>
                            <div className="pg-drilldown-section">
                              <span className="pg-drilldown-label">Timezone</span>
                              <div className="pg-drilldown-btn-group">
                                <button
                                  className={`pg-drilldown-btn-option ${
                                    toolConfigs.datetime.timezone === "auto" ? "active" : ""
                                  }`}
                                  onClick={() =>
                                    setToolConfigs((c) => ({
                                      ...c,
                                      datetime: { ...c.datetime, timezone: "auto" },
                                    }))
                                  }
                                >
                                  Auto (Local)
                                </button>
                                <button
                                  className={`pg-drilldown-btn-option ${
                                    toolConfigs.datetime.timezone === "utc" ? "active" : ""
                                  }`}
                                  onClick={() =>
                                    setToolConfigs((c) => ({
                                      ...c,
                                      datetime: { ...c.datetime, timezone: "utc" },
                                    }))
                                  }
                                >
                                  UTC
                                </button>
                              </div>
                            </div>

                            <div className="pg-drilldown-info-box">
                              🕒 Injects exact live date, day of week, and timezone into the prompt context to prevent date hallucination and temporal errors.
                            </div>
                          </>
                        )}

                        {/* 5. Fusion Drilldown */}
                        {activeToolConfig === "fusion" && (
                          <>
                            <div className="pg-drilldown-section">
                              <span className="pg-drilldown-label">Panel Models (Select up to 3)</span>
                              <div className="pg-drilldown-list">
                                {[
                                  { id: "ling-3.0-flash", name: "Ling 3.0 Flash Sante (free)" },
                                  { id: "deepseek/deepseek-chat", name: "DeepSeek V3" },
                                  { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct" },
                                  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
                                  { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B Instruct" },
                                ].map((pm) => {
                                  const isChecked = toolConfigs.fusion.models.includes(pm.id);
                                  return (
                                    <div
                                      key={pm.id}
                                      className={`pg-drilldown-item ${isChecked ? "selected" : ""}`}
                                      onClick={() => {
                                        setToolConfigs((c) => {
                                          const prev = c.fusion.models;
                                          const next = isChecked
                                            ? prev.filter((m) => m !== pm.id)
                                            : prev.length < 3
                                            ? [...prev, pm.id]
                                            : [...prev.slice(1), pm.id];
                                          return { ...c, fusion: { ...c.fusion, models: next } };
                                        });
                                      }}
                                    >
                                      <span>{pm.name}</span>
                                      <span>{isChecked ? "✓" : "+"}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="pg-drilldown-info-box">
                              🔀 Multi-model deliberation queries a panel of models in parallel, compares consensus and edge cases, and synthesizes a unified high-confidence response.
                            </div>
                          </>
                        )}

                        {/* 6. Advisor Drilldown */}
                        {activeToolConfig === "advisor" && (
                          <>
                            <div className="pg-drilldown-section">
                              <span className="pg-drilldown-label">Frontier Advisor Model</span>
                              <div className="pg-drilldown-list">
                                {[
                                  { id: "anthropic/claude-3.7-sonnet", name: "Claude 3.7 Sonnet (Reasoning)" },
                                  { id: "deepseek/deepseek-r1", name: "DeepSeek R1 (Frontier Reasoning)" },
                                  { id: "openai/gpt-4o", name: "GPT-4o (OpenAI)" },
                                  { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B Instruct" },
                                ].map((adv) => {
                                  const isSelected = toolConfigs.advisor.model === adv.id;
                                  return (
                                    <div
                                      key={adv.id}
                                      className={`pg-drilldown-item ${isSelected ? "selected" : ""}`}
                                      onClick={() =>
                                        setToolConfigs((c) => ({
                                          ...c,
                                          advisor: { ...c.advisor, model: adv.id },
                                        }))
                                      }
                                    >
                                      <span>{adv.name}</span>
                                      <span>{isSelected ? "●" : "○"}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="pg-drilldown-info-box">
                              💡 Mid-generation consultation of a stronger advisor model for strategic guidance, architectural critique, and complex reasoning verification.
                            </div>
                          </>
                        )}

                        {/* 7. Subagent Drilldown */}
                        {activeToolConfig === "subagent" && (
                          <>
                            <div className="pg-drilldown-section">
                              <span className="pg-drilldown-label">Worker Subagent Model</span>
                              <div className="pg-drilldown-list">
                                {[
                                  { id: "deepseek/north-mini", name: "North Mini (High-speed)" },
                                  { id: "google/gemma-2-9b-it", name: "Gemma 2 9B (Efficient)" },
                                  { id: "meta-llama/llama-3-8b-instruct", name: "Llama 3 8B Instruct" },
                                  { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku" },
                                ].map((sub) => {
                                  const isSelected = toolConfigs.subagent.model === sub.id;
                                  return (
                                    <div
                                      key={sub.id}
                                      className={`pg-drilldown-item ${isSelected ? "selected" : ""}`}
                                      onClick={() =>
                                        setToolConfigs((c) => ({
                                          ...c,
                                          subagent: { ...c.subagent, model: sub.id },
                                        }))
                                      }
                                    >
                                      <span>{sub.name}</span>
                                      <span>{isSelected ? "●" : "○"}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="pg-drilldown-info-box">
                              🔲 Delegates routine subtasks, structural breakdown, and formatting verification to smaller, faster, cost-effective worker models.
                            </div>
                          </>
                        )}

                        {/* 8. Shell Drilldown */}
                        {activeToolConfig === "shell" && (
                          <>
                            <div className="pg-drilldown-section">
                              <span className="pg-drilldown-label">Execution Environment</span>
                              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                <div className="pg-drilldown-item selected">
                                  <span>Shell (30s Timeout)</span>
                                  <span>✓</span>
                                </div>
                              </div>
                            </div>

                            <div className="pg-drilldown-info-box">
                              🐚 Executes shell commands and scripts with a 30s safety timeout and returns outputs directly to the model.
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {/* Chat Memory Popover (Image 3) */}
          {memoryPopoverOpen && (
            <div className="pg-chat-memory-popover" onClick={(e) => e.stopPropagation()}>
              <div className="pg-memory-title-row">
                <span>Chat memory</span>
                <span>{memoryValue >= 20 ? "∞" : `${memoryValue} msgs`}</span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                value={memoryValue}
                onChange={(e) => setMemoryValue(Number(e.target.value))}
                className="pg-memory-slider"
              />
              <div className="pg-memory-subtext">
                {memoryValue >= 20
                  ? "Sends all messages from your conversation each request."
                  : `Sends the last ${memoryValue} messages from your conversation.`}
              </div>
            </div>
          )}

          {/* Input Box Card */}
          <div className="pg-input-box-card">
            <div className="pg-textarea-wrap">
              <textarea
                ref={textareaRef}
                className="pg-textarea-main"
                placeholder="Ask anything..."
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                rows={1}
                id="pg-message-input"
              />

              {/* Status indicator badges on top right inside textarea */}
              <div className="pg-search-status-badges">
                <div
                  className="pg-search-badge-green"
                  title="Web Search Tool Enabled"
                  style={{
                    opacity: serverTools.find((t) => t.id === "web_search")?.enabled ? 1 : 0.4,
                  }}
                >
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                  </svg>
                </div>
                <div className="pg-search-badge-green" title="Grounding Active">
                  <span>G</span>
                </div>
              </div>
            </div>

            {/* Bottom controls toolbar */}
            <div className="pg-input-controls-row">
              <div className="pg-input-tools-group">
                {/* Plus / Attach button */}
                <button
                  className="pg-input-tool-icon-btn"
                  title="Add prompt / attachment"
                  id="pg-attach-btn"
                  onClick={() => {
                    const sample = prompt("Add text snippet to message:");
                    if (sample) setInput((prev) => (prev ? `${prev}\n${sample}` : sample));
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>

                {/* Server tools trigger button (Image 1) */}
                <button
                  className={`pg-input-tool-icon-btn ${toolsPopoverOpen ? "active" : ""}`}
                  title="Server tools"
                  id="pg-server-tools-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMemoryPopoverOpen(false);
                    setToolsPopoverOpen((v) => !v);
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                </button>

                {/* Chat memory trigger button (Image 3) */}
                <button
                  className={`pg-input-tool-icon-btn ${memoryPopoverOpen ? "active" : ""}`}
                  title="Chat memory"
                  id="pg-chat-memory-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setToolsPopoverOpen(false);
                    setMemoryPopoverOpen((v) => !v);
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                  </svg>
                </button>

                {/* File upload prompt */}
                <button
                  className="pg-input-tool-icon-btn"
                  title="Upload files"
                  onClick={() => {
                    const inputElem = document.createElement("input");
                    inputElem.type = "file";
                    inputElem.accept = ".txt,.json,.md,.csv";
                    inputElem.onchange = async (e: any) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const content = await file.text();
                        setInput((prev) =>
                          prev
                            ? `${prev}\n\n[File: ${file.name}]\n${content}`
                            : `[File: ${file.name}]\n${content}`
                        );
                        showToast(`Attached ${file.name}`);
                      }
                    };
                    inputElem.click();
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </button>
              </div>

              <div className="pg-input-send-group">
                {/* Voice speech recognition */}
                <button
                  className="pg-input-tool-icon-btn"
                  title="Voice dictation"
                  onClick={() => {
                    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
                      const SpeechRec =
                        (window as any).SpeechRecognition ||
                        (window as any).webkitSpeechRecognition;
                      const recognition = new SpeechRec();
                      recognition.onresult = (event: any) => {
                        const transcript = event.results[0][0].transcript;
                        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
                      };
                      recognition.start();
                      showToast("Listening...");
                    } else {
                      showToast("Speech recognition not supported in this browser");
                    }
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </button>

                {/* Purple circular send button with white up-arrow */}
                <button
                  className={`pg-send-circle-btn ${input.trim() && !loading ? "active" : ""}`}
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  title="Send message (Enter)"
                  id="pg-send-btn"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="pg-disclaimer-text">
            Responses are AI-generated and can be inaccurate. Review all outputs before relying on them.
          </div>
        </div>
      </main>

      {/* ── RIGHT WEB DEVELOPMENT WORKSPACE IDE (Image 1 & 2) ────────── */}
      {activeArtifact && (
        <WorkspaceIDE
          artifact={activeArtifact}
          onClose={() => setActiveArtifact(null)}
        />
      )}
    </div>
  );
}
