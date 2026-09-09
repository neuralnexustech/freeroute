"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";
import { buildSrcdoc } from "@/lib/srcdoc";
import { parseArtifactProject, recoverStandaloneHtmlDocument, WorkspaceFile } from "@/lib/artifactParser";
import {
  Sparkles,
  Code2,
  Globe,
  Image as ImageIcon,
  Cloud,
  Table,
  FileSpreadsheet,
  FileCode2,
  Monitor,
  Smartphone,
  Send,
  Eye,
  Download,
  Copy,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Settings,
  Sun,
  Moon,
  Star,
  ThumbsUp,
  ThumbsDown,
  GitBranch,
  Wand2,
  Zap,
  Plus,
  Folder,
  Layers,
  LayoutGrid,
  MapPin,
  Droplets,
  BatteryMedium,
  User,
  ExternalLink,
  Bot,
  RefreshCw,
  Search,
  Sliders,
  Terminal,
  Paperclip,
  CheckCircle2,
  Home,
} from "lucide-react";

// ── File Type Icons ──────────────────────────────────────────────────────────
function getFileIcon(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return <Globe size={13} className="text-amber-400 inline" />;
  if (lower.endsWith(".css")) return <Layers size={13} className="text-sky-400 inline" />;
  if (lower.endsWith(".tsx") || lower.endsWith(".jsx")) return <Code2 size={13} className="text-indigo-400 inline" />;
  if (lower.endsWith(".ts") || lower.endsWith(".js")) return <FileCode2 size={13} className="text-yellow-400 inline" />;
  if (lower.endsWith(".json")) return <Settings size={13} className="text-slate-400 inline" />;
  if (lower.endsWith(".md")) return <FileCode2 size={13} className="text-emerald-400 inline" />;
  if (lower.endsWith(".csv") || lower.endsWith(".xlsx")) return <Table size={13} className="text-emerald-500 inline" />;
  return <FileCode2 size={13} className="text-slate-400 inline" />;
}

// ── Types ────────────────────────────────────────────────────────────────────
interface ToolCallResult {
  tool: string;
  name: string;
  icon: string;
  summary: string;
  details?: string;
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
  isGenerating?: boolean;
  statusStep?: string;
  steps?: string[];
  projectFiles?: WorkspaceFile[];
  thoughtDurationSec?: number;
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
  };
  isCombo?: boolean;
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

// ── Template Cards ────────────────────────────────────────────────────────────
const openDesignTemplates = [
  {
    id: "tpl_slide_deck",
    title: "Slide deck",
    desc: "Presentations & pitch decks",
    icon: <Layers size={18} />,
    color: "#6366f1",
    prompt: "Create a modern 6-slide investor pitch deck with cinematic typography, dark aesthetic, problem-solution narrative, and metrics slide.",
  },
  {
    id: "tpl_prototype",
    title: "Prototype",
    desc: "Interactive app mockups",
    icon: <Code2 size={18} />,
    color: "#10b981",
    prompt: "Build a modern interactive SaaS Analytics Dashboard prototype with revenue charts, conversion funnel, and interactive user table.",
  },
  {
    id: "tpl_wireframe",
    title: "Wireframe",
    desc: "Lo-fi screens & flows",
    icon: <LayoutGrid size={18} />,
    color: "#f59e0b",
    prompt: "Generate a clean high-conversion landing page wireframe with hero section, 3-column feature grid, social proof, and pricing table.",
  },
  {
    id: "tpl_mobile_app",
    title: "Mobile app",
    desc: "iOS & Android screens",
    icon: <Smartphone size={18} />,
    color: "#ec4899",
    prompt: "Design a photorealistic mobile banking and wallet app with card swipe carousel, recent transactions, quick transfer flow, and iPhone bezel.",
  },
  {
    id: "tpl_weather",
    title: "Weather & Radar",
    desc: "Live forecast & satellite",
    icon: <Cloud size={18} />,
    color: "#0ea5e9",
    prompt: "Show me the live weather report for Tokyo with 7-day forecast and hourly rainfall radar.",
  },
  {
    id: "tpl_sheet",
    title: "Spreadsheet",
    desc: "Interactive Excel grid",
    icon: <FileSpreadsheet size={18} />,
    color: "#22c55e",
    prompt: "Create an interactive financial Excel spreadsheet table for Q3 2026 budget with revenue, expenses, profit margin, and export to CSV.",
  },
];

// ── Built-in Weather Widget Card ───────────────────────────────────────────
function WeatherCard({ weather }: { weather: any }) {
  const [unit, setUnit] = useState<"C" | "F">("C");
  if (!weather || !weather.current) return null;

  const { location, current, tomorrow, daily } = weather;

  return (
    <div className="pg-weather-card">
      <div className="pg-weather-header">
        <div className="pg-weather-loc">
          <span className="pg-weather-pin"><MapPin size={15} className="text-emerald-500" /></span>
          <div>
            <div className="pg-weather-city">{location}</div>
            <div className="pg-weather-status">Live Radar & Satellite Grounding</div>
          </div>
        </div>
        <div className="pg-weather-unit-toggle">
          <button
            className={`pg-unit-btn ${unit === "C" ? "active" : ""}`}
            onClick={() => setUnit("C")}
          >
            °C
          </button>
          <button
            className={`pg-unit-btn ${unit === "F" ? "active" : ""}`}
            onClick={() => setUnit("F")}
          >
            °F
          </button>
        </div>
      </div>

      <div className="pg-weather-main">
        <div className="pg-weather-hero">
          <div className="pg-weather-icon-large">{current.icon}</div>
          <div className="pg-weather-temp">
            {unit === "C" ? `${current.tempC}°C` : `${current.tempF}°F`}
          </div>
        </div>
        <div className="pg-weather-details">
          <div className="pg-weather-condition">{current.condition}</div>
          <div className="pg-weather-sub">
            Feels like {unit === "C" ? `${current.feelsLikeC}°C` : `${current.feelsLikeF}°F`} · Humidity {current.humidity}% · Wind {current.windSpeedKmh} km/h
          </div>
        </div>
      </div>

      {tomorrow && (
        <div className="pg-weather-tomorrow-banner">
          <div className="pg-tomorrow-tag">TOMORROW · {tomorrow.dayName}</div>
          <div className="pg-tomorrow-desc">
            <span>{tomorrow.icon} {tomorrow.condition}</span>
            <span className="pg-tomorrow-temps">
              High: {unit === "C" ? `${tomorrow.maxC}°C` : `${tomorrow.maxF}°F`} · Low: {unit === "C" ? `${tomorrow.minC}°C` : `${tomorrow.minF}°F`}
            </span>
            <span className="pg-tomorrow-rain" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Droplets size={12} className="text-sky-400" /> {tomorrow.rainProb}% rain chance</span>
          </div>
        </div>
      )}

      {daily && daily.length > 0 && (
        <div className="pg-weather-daily-grid">
          {daily.slice(0, 5).map((day: any, i: number) => (
            <div key={i} className="pg-weather-day-item">
              <div className="pg-day-name">{day.dayName}</div>
              <div className="pg-day-icon">{day.icon}</div>
              <div className="pg-day-temp">
                {unit === "C" ? `${day.maxC}°` : `${day.maxF}°`}
              </div>
              <div className="pg-day-low">
                {unit === "C" ? `${day.minC}°` : `${day.minF}°`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Smart Interactive Table & Excel Spreadsheet Component ───────────────────
function SmartTableView({
  headers,
  rows,
  defaultToExcel = false,
}: {
  headers: string[];
  rows: string[][];
  defaultToExcel?: boolean;
}) {
  const [isExcelView, setIsExcelView] = useState(defaultToExcel);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [copied, setCopied] = useState(false);

  const filteredRows = useMemo(() => {
    let result = [...rows];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter((r) => r.some((cell) => cell.toLowerCase().includes(q)));
    }
    if (sortCol !== null) {
      result.sort((a, b) => {
        const valA = (a[sortCol] || "").trim();
        const valB = (b[sortCol] || "").trim();
        const numA = parseFloat(valA.replace(/[^0-9.-]+/g, ""));
        const numB = parseFloat(valB.replace(/[^0-9.-]+/g, ""));
        if (!isNaN(numA) && !isNaN(numB)) {
          return sortAsc ? numA - numB : numB - numA;
        }
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
    }
    return result;
  }, [rows, searchTerm, sortCol, sortAsc]);

  const handleDownloadCsv = () => {
    const csvContent = [
      headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","),
      ...filteredRows.map((r) => r.map((c) => `"${(c || "").replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `freeroute_sheet_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyTsv = () => {
    const tsvContent = [
      headers.join("\t"),
      ...filteredRows.map((r) => r.join("\t")),
    ].join("\n");
    navigator.clipboard.writeText(tsvContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`pg-smart-table-card ${isExcelView ? "excel-skin" : ""}`}>
      <div className="pg-table-toolbar">
        <div className="pg-table-toolbar-left">
          <button
            className={`pg-table-view-btn ${!isExcelView ? "active" : ""}`}
            onClick={() => setIsExcelView(false)}
          >
            <Table size={13} className="inline mr-1.5" />
            <span>Grid Table</span>
          </button>
          <button
            className={`pg-table-view-btn ${isExcelView ? "active" : ""}`}
            onClick={() => setIsExcelView(true)}
          >
            <FileSpreadsheet size={13} className="inline mr-1.5" />
            <span>Excel Sheet</span>
          </button>
          <span className="pg-table-badge">
            {filteredRows.length} {filteredRows.length === 1 ? "row" : "rows"}
          </span>
        </div>

        <div className="pg-table-toolbar-right">
          <input
            type="text"
            className="pg-table-search-input"
            placeholder="Search rows..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            className="pg-table-action-btn"
            onClick={handleCopyTsv}
            title="Copy for Excel"
          >
            {copied ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Check size={12} className="text-emerald-400" /> Copied
              </span>
            ) : (
              "Copy for Excel"
            )}
          </button>
          <button
            className="pg-table-action-btn"
            onClick={handleDownloadCsv}
            title="Download CSV"
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Download size={12} /> CSV
            </span>
          </button>
        </div>
      </div>

      <div className="pg-table-scroll-wrap">
        <table className="pg-data-table">
          <thead>
            {isExcelView && (
              <tr className="pg-excel-col-letters">
                <th className="pg-excel-corner">#</th>
                {headers.map((_, i) => (
                  <th key={i} className="pg-excel-letter-header">
                    {String.fromCharCode(65 + (i % 26))}
                  </th>
                ))}
              </tr>
            )}
            <tr>
              {isExcelView && <th className="pg-excel-row-num-header"></th>}
              {headers.map((h, i) => (
                <th
                  key={i}
                  onClick={() => {
                    if (sortCol === i) setSortAsc(!sortAsc);
                    else {
                      setSortCol(i);
                      setSortAsc(true);
                    }
                  }}
                  title="Sort"
                >
                  <div className="pg-th-inner">
                    <span>{h}</span>
                    {sortCol === i && <span>{sortAsc ? "▲" : "▼"}</span>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, rIdx) => (
              <tr key={rIdx}>
                {isExcelView && <td className="pg-excel-row-num">{rIdx + 1}</td>}
                {row.map((cell, cIdx) => (
                  <td key={cIdx}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Verified Tool Calls Inspector ───────────────────────────────────────────
function ToolCallsViewer({ toolCalls }: { toolCalls: ToolCallResult[] }) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  return (
    <div className="pg-tool-calls-container">
      {toolCalls.map((tc, idx) => {
        const isExp = !!expanded[idx];
        return (
          <div key={idx} className="pg-tool-call-pill-card">
            <div
              className="pg-tool-call-pill-header"
              onClick={() => setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }))}
            >
              <div className="pg-tool-call-pill-left">
                <span className="pg-tool-call-icon">
                  {tc.icon === "globe" || tc.tool === "web_search" ? (
                    <Globe size={13} className="text-sky-400 inline" />
                  ) : tc.icon === "image" || tc.tool === "image_gen" ? (
                    <ImageIcon size={13} className="text-purple-400 inline" />
                  ) : tc.tool === "weather" ? (
                    <Cloud size={13} className="text-emerald-400 inline" />
                  ) : (
                    <Terminal size={13} className="text-slate-400 inline" />
                  )}
                </span>
                <span className="pg-tool-call-name">{tc.name}</span>
                <span className="pg-tool-call-summary">{tc.summary}</span>
              </div>
              <button className="pg-tool-call-toggle-btn">
                {isExp ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>Hide <ChevronUp size={11} /></span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>Inspect <ChevronDown size={11} /></span>
                )}
              </button>
            </div>
            {isExp && tc.details && (
              <pre className="pg-tool-call-details">{tc.details}</pre>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Narrative Text Renderer ────────────────────────────────────────────────
function RenderNarrativeText({ text }: { text: string }) {
  const html = text
    .replace(
      /!\[(.*?)\]\((https?:\/\/[^\)]+)\)/g,
      '<div style="margin:10px 0;"><img src="$2" alt="$1" style="max-width:100%;max-height:420px;border-radius:12px;display:block;" /></div>'
    )
    .replace(
      /\[(.*?)\]\((https?:\/\/[^\)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--od-accent);text-decoration:underline;">$1</a>'
    )
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(
      /`([^`]+)`/g,
      '<code style="background:rgba(0,0,0,0.06);padding:2px 6px;border-radius:4px;font-family:monospace;font-size:12px">$1</code>'
    )
    .replace(/\n/g, "<br/>");
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── Arena Agent Response Card (No Code in Chat, Files Card, Next Steps) ────
function ArenaAgentCard({
  message,
  projectFiles,
  thoughtDurationSec,
  steps,
  onSelectFile,
  onMakeBetter,
  onNextStep,
}: {
  message: Message;
  projectFiles: WorkspaceFile[];
  thoughtDurationSec?: number;
  steps?: string[];
  onSelectFile?: (filePath: string) => void;
  onMakeBetter?: () => void;
  onNextStep?: (prompt: string) => void;
}) {
  const [showMore, setShowMore] = useState(false);
  const [copied, setCopied] = useState(false);

  const cleanNarrative = useMemo(() => {
    const raw = message.content || "";
    const stripped = raw.replace(/```[\s\S]*?```/g, "").trim();
    if (stripped && stripped.length > 20) return stripped;
    if (projectFiles.length > 0) {
      return "I've structured and developed the web application with interactive components, custom styling, and responsive layout. You can inspect the source code and preview in the right-side workspace.";
    }
    return raw || "Project workspace generated successfully.";
  }, [message.content, projectFiles]);

  const completedSteps = useMemo(() => {
    if (steps && steps.length > 0) return steps;
    return [
      "Explored project specifications & architecture",
      ...projectFiles.map((f) => `Created ${f.path} (${f.content.split(/\r?\n/).length} lines)`),
      "Compiled live workspace sandbox preview",
    ];
  }, [steps, projectFiles]);

  const durationText = thoughtDurationSec
    ? `${thoughtDurationSec} seconds`
    : message.latencyMs
    ? `${Math.max(1, Math.round(message.latencyMs / 1000))} seconds`
    : "18 seconds";

  return (
    <div className="pg-arena-agent-card">
      {/* Thought Duration */}
      <div className="pg-arena-thought-bar" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Clock size={13} className="text-slate-400" />
        <span>Thought for {durationText}</span>
      </div>

      {/* Narrative summary */}
      <div className="pg-arena-narrative">
        <RenderNarrativeText text={cleanNarrative} />
      </div>

      {/* FILES FROM THIS TURN (Open-Design Screenshot 4) */}
      {projectFiles && projectFiles.length > 0 && (
        <div className="pg-files-turn-card">
          <div className="pg-files-turn-header">
            <div className="pg-files-turn-title">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                <polyline points="13 2 13 9 20 9" />
              </svg>
              <span>FILES FROM THIS TURN</span>
              <span className="pg-files-turn-count">{projectFiles.length}</span>
            </div>
            <button
              className="pg-files-turn-viewall"
              onClick={() => onSelectFile?.(projectFiles[0].path)}
              title="Open all in right-side workspace"
            >
              Open workspace ↗
            </button>
          </div>

          <div className="pg-files-turn-list">
            {projectFiles.slice(0, 4).map((file) => {
              const fSizeKb = Math.max(0.4, Math.round((new Blob([file.content]).size / 1024) * 10) / 10);
              return (
                <div key={file.path} className="pg-files-turn-row">
                  <div className="pg-files-turn-left">
                    <span className="pg-files-turn-icon">{getFileIcon(file.name)}</span>
                    <span className="pg-files-turn-name" title={file.path}>
                      {file.name}
                    </span>
                    <span className="pg-files-turn-badge">Write</span>
                    <span className="pg-files-turn-size">{fSizeKb} KB</span>
                  </div>
                  <div className="pg-files-turn-actions">
                    <button
                      className="pg-files-turn-btn"
                      onClick={() => onSelectFile?.(file.path)}
                      title="Open in Code Editor"
                    >
                      Open
                    </button>
                    <button
                      className="pg-files-turn-btn"
                      onClick={() => {
                        const blob = new Blob([file.content], { type: "text/plain;charset=utf-8" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = file.name;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      title="Download file"
                    >
                      Download
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity Summary */}
      <div className="pg-arena-activity-box">
        <div
          className="pg-arena-activity-header"
          onClick={() => setShowMore((v) => !v)}
          title="Toggle execution activity log"
        >
          <div className="pg-arena-activity-summary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="pg-arena-chevron">{showMore ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
            <span>
              Explored {projectFiles.length} files, {completedSteps.length} build actions
            </span>
          </div>
          <button
            className="pg-arena-toggle-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowMore((v) => !v);
            }}
          >
            {showMore ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>Show Less <ChevronUp size={11} /></span>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>Show More <ChevronDown size={11} /></span>
            )}
          </button>
        </div>

        {showMore && (
          <div className="pg-arena-activity-details">
            {completedSteps.map((st, idx) => (
              <div key={idx} className="pg-arena-step-row">
                <span className="pg-arena-step-check"><Check size={11} strokeWidth={2.5} /></span>
                <span>{st}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="pg-arena-action-row">
        <div className="pg-arena-action-left">
          <button className="pg-arena-action-btn" title="Good response">
            <ThumbsUp size={13} />
          </button>
          <button className="pg-arena-action-btn" title="Bad response">
            <ThumbsDown size={13} />
          </button>
          <button
            className="pg-arena-action-btn"
            title="Copy narrative"
            onClick={() => {
              navigator.clipboard.writeText(cleanNarrative);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          </button>
          <button
            className="pg-arena-action-btn"
            title="Branch / Fork version"
            onClick={() => {
              navigator.clipboard.writeText(message.content);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            <GitBranch size={13} />
          </button>
        </div>
        <button
          className="pg-arena-make-better-btn"
          onClick={onMakeBetter}
          title="Improve this design"
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Sparkles size={12} /> make better</span>
        </button>
      </div>

      {/* NextStepActions (Open-Design NextStepActions) */}
      <div className="pg-next-steps-container">
        <div className="pg-done-status-row">
          <span className="pg-done-dot">●</span>
          <span className="pg-done-text">Done</span>
        </div>
        <div className="pg-next-steps-chips">
          <button
            className="pg-next-step-chip"
            onClick={() =>
              onNextStep?.("Match next step: Refine interactive state, add data persistence, and responsive layout polish")
            }
          >
            <Sparkles size={11} className="inline mr-1 text-amber-400" /> Match next step &gt;
          </button>
          <button
            className="pg-next-step-chip"
            onClick={() =>
              onNextStep?.("Design polish: Elevate typography, subtle micro-interactions, and dark mode support")
            }
          >
            <Wand2 size={11} className="inline mr-1 text-indigo-400" /> Design polish / ready to ship &gt;
          </button>
          <button
            className="pg-next-step-chip"
            onClick={() =>
              onNextStep?.("Add mobile navigation bar with gesture animations and clean drawer")
            }
          >
            <Smartphone size={11} className="inline mr-1 text-pink-400" /> Add mobile nav &gt;
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Smart Content Renderer ─────────────────────────────────────────────────
function RenderMessage({
  content,
  userPrompt,
}: {
  content: string;
  userPrompt?: string;
}) {
  const userWantsExcel = /(?:excel|\.xlsx|spreadsheet|csv|\bsheet\b|finance|budget)/i.test(userPrompt || "");
  const tableRegex = /((?:^\s*\|[^\n]+\|\s*(?:\r?\n|$))+)/gm;
  const parts: Array<{ type: "text" | "table"; content: string }> = [];
  let lastIdx = 0;
  let tMatch: RegExpExecArray | null;

  while ((tMatch = tableRegex.exec(content)) !== null) {
    if (tMatch.index > lastIdx) {
      parts.push({ type: "text", content: content.slice(lastIdx, tMatch.index) });
    }
    parts.push({ type: "table", content: tMatch[0] });
    lastIdx = tMatch.index + tMatch[0].length;
  }
  if (lastIdx < content.length) {
    parts.push({ type: "text", content: content.slice(lastIdx) });
  }

  return (
    <>
      {parts.map((p, i) => {
        if (p.type === "table") {
          const lines = p.content
            .trim()
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l.includes("|"));
          if (lines.length >= 2) {
            const headers = lines[0].split("|").map((c) => c.trim()).filter(Boolean);
            const dataRows = lines
              .slice(1)
              .filter((l) => !/^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/.test(l))
              .map((l) => l.split("|").map((c) => c.trim()).filter(Boolean));
            if (headers.length > 0 && dataRows.length > 0) {
              return (
                <SmartTableView
                  key={i}
                  headers={headers}
                  rows={dataRows}
                  defaultToExcel={userWantsExcel}
                />
              );
            }
          }
        }
        return <RenderNarrativeText key={i} text={p.content} />;
      })}
    </>
  );
}

// ── Right Studio Workspace IDE (Matching od-app-preview.webp) ──────────────
function WorkspaceIDE({
  artifact,
  onClose,
}: {
  artifact: ActiveArtifact;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"code" | "preview">(artifact.activeTab);
  const [previewKey, setPreviewKey] = useState(0);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [copied, setCopied] = useState(false);
  const [showFilesExplorer, setShowFilesExplorer] = useState(false);

  const files = useMemo(() => {
    if (artifact.projectFiles && artifact.projectFiles.length > 0) {
      return artifact.projectFiles;
    }
    return parseArtifactProject(artifact.code, artifact.title).files;
  }, [artifact.projectFiles, artifact.code, artifact.title]);

  const [activeFilePath, setActiveFilePath] = useState<string>(
    artifact.selectedFile || files[0]?.path || "index.html"
  );

  const [openTabs, setOpenTabs] = useState<string[]>(() => {
    const list: string[] = [];
    if (artifact.selectedFile) list.push(artifact.selectedFile);
    else if (files[0]) list.push(files[0].path);
    files.forEach((f) => {
      if (list.length < 4 && !list.includes(f.path)) list.push(f.path);
    });
    return list.length > 0 ? list : ["index.html"];
  });

  useEffect(() => {
    if (activeFilePath && !openTabs.includes(activeFilePath)) {
      setOpenTabs((prev) => [...prev, activeFilePath]);
    }
  }, [activeFilePath, openTabs]);

  const activeFile = useMemo(() => {
    return (
      files.find((f) => f.path === activeFilePath) ||
      files[0] || {
        name: artifact.title,
        path: artifact.title,
        language: artifact.language,
        content: artifact.code,
      }
    );
  }, [files, activeFilePath, artifact]);

  const compiledHtml = useMemo(() => {
    const primary = recoverStandaloneHtmlDocument(activeFile.content) || activeFile.content;
    return buildSrcdoc(primary, {
      title: activeFile.name,
      reloadKey: previewKey,
    });
  }, [activeFile, previewKey]);

  const handleDownload = () => {
    const content = tab === "preview" ? compiledHtml : activeFile.content;
    const blob = new Blob([content], { type: tab === "preview" ? "text/html" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = tab === "preview" ? "prototype.html" : activeFile.name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="od-split-right-stage">
      {/* 1. Top Document Tabs Bar (Open-Design Studio) */}
      <div className="od-stage-tabs-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            className={`od-pill-btn ${showFilesExplorer ? "active" : ""}`}
            onClick={() => setShowFilesExplorer((v) => !v)}
            title="Toggle Design Files Explorer"
          >
            <LayoutGrid size={12} />
            <span>Design Files</span>
          </button>

          {openTabs.map((tabPath) => {
            const fName = tabPath.split("/").pop() || tabPath;
            const isActive = tabPath === activeFilePath;
            return (
              <div
                key={tabPath}
                className={`pg-ws-doc-tab ${isActive ? "active" : ""}`}
                onClick={() => {
                  setActiveFilePath(tabPath);
                  setTab("code");
                }}
              >
                <span>{getFileIcon(fName)}</span>
                <span>{fName}</span>
                {openTabs.length > 1 && (
                  <button
                    className="pg-ws-doc-tab-close"
                    onClick={(e) => {
                      e.stopPropagation();
                      const rem = openTabs.filter((t) => t !== tabPath);
                      setOpenTabs(rem);
                      if (tabPath === activeFilePath && rem.length > 0) {
                        setActiveFilePath(rem[0]);
                      }
                    }}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            className={`pg-ws-toggle-btn ${tab === "preview" ? "active" : ""}`}
            onClick={() => setTab("preview")}
            title="Preview"
          >
            <Eye size={13} className="inline mr-1.5" />
            <span>Preview</span>
          </button>
          <button
            className={`pg-ws-toggle-btn ${tab === "code" ? "active" : ""}`}
            onClick={() => setTab("code")}
            title="Code"
          >
            <Code2 size={13} className="inline mr-1.5" />
            <span>Code</span>
          </button>

          <div className="pg-ws-viewport-btns">
            <button
              className={`pg-ws-viewport-btn ${device === "desktop" ? "active" : ""}`}
              onClick={() => setDevice("desktop")}
            >
              <Monitor size={12} className="inline mr-1" />
              <span>Desktop</span>
            </button>
            <button
              className={`pg-ws-viewport-btn ${device === "mobile" ? "active" : ""}`}
              onClick={() => setDevice("mobile")}
            >
              <Smartphone size={12} className="inline mr-1" />
              <span>Mobile</span>
            </button>
          </div>

          <button className="od-stage-download-pill" onClick={handleDownload} title="Download">
            <Download size={12} className="inline mr-1" />
            <span>Download</span>
          </button>

          <button className="od-chrome-icon-btn" onClick={onClose} title="Close Stage">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 2. Stage Canvas Body */}
      {tab === "preview" ? (
        <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0c10" }}>
          <div className={`pg-ws-stage-container ${device}`} style={{ width: device === "mobile" ? 375 : "100%", height: device === "mobile" ? 760 : "100%", position: "relative" }}>
            {device === "mobile" && (
              <div className="pg-ws-mobile-statusbar">
                <span className="pg-ws-mobile-time">9:41</span>
                <div className="pg-ws-device-pill" />
                <div className="pg-ws-mobile-icons">
                  <BatteryMedium size={14} className="text-slate-400" />
                </div>
              </div>
            )}
            <iframe
              key={`${previewKey}_${device}`}
              srcDoc={compiledHtml}
              sandbox="allow-scripts allow-modals allow-same-origin allow-forms allow-popups"
              className="pg-ws-iframe"
              title="Live Prototype"
              style={{ width: "100%", height: "100%", border: "none" }}
            />
            {device === "mobile" && <div className="pg-ws-home-bar" />}
          </div>
        </div>
      ) : (
        <div className="pg-ws-body" style={{ flex: 1, display: "flex" }}>
          {showFilesExplorer && (
            <aside className="pg-ws-files-sidebar" style={{ width: 180 }}>
              <div className="pg-ws-files-title">FILES ({files.length})</div>
              <div className="pg-ws-tree">
                {files.map((f) => (
                  <div
                    key={f.path}
                    className={`pg-ws-tree-item ${f.path === activeFilePath ? "active" : ""}`}
                    onClick={() => setActiveFilePath(f.path)}
                  >
                    <span>{getFileIcon(f.name)}</span>
                    <span className="pg-ws-tree-label">{f.name}</span>
                  </div>
                ))}
              </div>
            </aside>
          )}
          <main className="pg-ws-editor-pane" style={{ flex: 1 }}>
            <div className="pg-ws-editor-tabs-bar">
              <div className="pg-ws-active-tab">
                <span>{getFileIcon(activeFile.name)}</span>
                <span>{activeFile.name}</span>
              </div>
              <button className="pg-ws-icon-btn" onClick={handleCopy} style={{ marginLeft: "auto" }}>
                {copied ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Check size={12} className="text-emerald-400" /> Copied
                  </span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Copy size={12} /> Copy
                  </span>
                )}
              </button>
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
    </div>
  );
}

// ── Main Open-Design Playground Page ───────────────────────────────────────
export default function PlaygroundPage() {
  const { theme, toggle } = useTheme();

  // 1. Rooms State
  const [rooms, setRooms] = useState<Room[]>(() => {
    try {
      const saved = localStorage.getItem("fr_pg_rooms");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [{ id: "default_room", title: "New Project", updatedAt: Date.now() }];
  });

  const [activeRoom, setActiveRoom] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("fr_pg_active_room");
      if (saved) return saved;
    } catch {}
    return "default_room";
  });

  // 2. Messages & Artifacts
  const [messages, setMessages] = useState<Record<string, Message[]>>(() => {
    try {
      const saved = localStorage.getItem("fr_pg_messages");
      if (saved) return JSON.parse(saved);
    } catch {}
    return { default_room: [] };
  });

  const [roomArtifacts, setRoomArtifacts] = useState<Record<string, ActiveArtifact>>(() => {
    try {
      const saved = localStorage.getItem("fr_pg_artifacts");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem("fr_pg_rooms", JSON.stringify(rooms));
      localStorage.setItem("fr_pg_active_room", activeRoom);
      localStorage.setItem("fr_pg_messages", JSON.stringify(messages));
      localStorage.setItem("fr_pg_artifacts", JSON.stringify(roomArtifacts));
    } catch {}
  }, [rooms, activeRoom, messages, roomArtifacts]);

  // 3. Model Catalog
  const [catalog, setCatalog] = useState<CatalogModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("ling-3.0-flash");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  // Dual-Model State
  const [isDualModel, setIsDualModel] = useState(false);
  const [secondaryModel, setSecondaryModel] = useState("deepseek/deepseek-chat");
  const [secondaryDropdownOpen, setSecondaryDropdownOpen] = useState(false);
  const [activeModes, setActiveModes] = useState<string[]>([]);

  // 4. Input & Loading
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Server tools (toggled via capability pills or auto-detected)
  const [serverTools, setServerTools] = useState<ServerTool[]>([
    { id: "web_search", name: "Web Search", desc: "Search web", sub: "Auto", icon: "globe", enabled: false },
    { id: "image_gen", name: "Image Gen", desc: "Generate image", sub: "Auto", icon: "image", enabled: false },
  ]);

  const toggleTool = (id: string) => {
    setServerTools((tools) =>
      tools.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t))
    );
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // Load models from gateway catalog
  useEffect(() => {
    fetch("/v1/models")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.data)) {
          const list: CatalogModel[] = data.data.map((m: any) => ({
            id: m.id,
            displayName: m.name || m.id,
            provider: {
              slug: m.id.split("/")[0] || "freeroute",
              name: m.id.split("/")[0] || "Freeroute",
              icon: "freeroute",
            },
            isCombo: m.id.includes("combo") || m.id.includes("fallback"),
          }));
          setCatalog(list);
        }
      })
      .catch(() => {});
  }, []);

  const activeModelObj = useMemo(() => {
    return (
      catalog.find((m) => m.id === selectedModel) || {
        id: selectedModel,
        displayName: selectedModel.split("/").pop() || selectedModel,
        isCombo: false,
      }
    );
  }, [catalog, selectedModel]);

  const secondaryModelObj = useMemo(() => {
    return (
      catalog.find((m) => m.id === secondaryModel) || {
        id: secondaryModel,
        displayName: secondaryModel.split("/").pop() || secondaryModel,
        isCombo: false,
      }
    );
  }, [catalog, secondaryModel]);

  const activeArtifact = roomArtifacts[activeRoom] || null;
  const setActiveArtifact = useCallback(
    (art: ActiveArtifact | null) => {
      setRoomArtifacts((prev) => {
        if (!art) {
          const copy = { ...prev };
          delete copy[activeRoom];
          return copy;
        }
        return { ...prev, [activeRoom]: art };
      });
    },
    [activeRoom]
  );

  const currentMsgs = messages[activeRoom] || [];
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px";
  };

  const createRoom = useCallback(() => {
    const id = uid();
    const fresh: Room = { id, title: "New Project", updatedAt: Date.now() };
    setRooms((prev) => [fresh, ...prev]);
    setMessages((prev) => ({ ...prev, [id]: [] }));
    setActiveRoom(id);
    setInput("");
  }, []);

  // 5. Send Message (Auto-Intent & Dual-Model Execution)
  const sendMessage = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text || loading) return;

      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";

      const userMsg: Message = {
        id: uid(),
        role: "user",
        content: text,
        timestamp: new Date(),
      };

      const userWantsExcelOrTable = !activeModes.includes("web_dev") && /(?:excel|\.xlsx|spreadsheet|csv|\bsheet\b|table|grid)/i.test(text);
      const userWantsWeather = !activeModes.includes("web_dev") && /(?:weather|forecast|temperature|rain|radar)/i.test(text);
      const isExplicitImageReq = activeModes.includes("image_gen") || /(?:draw|paint|picture\s+of|image\s+of|photo\s+of|illustration\s+of|generate\s+image)/i.test(text);

      const isWebDevIntent =
        activeModes.includes("web_dev") ||
        (!userWantsExcelOrTable &&
          !userWantsWeather &&
          !isExplicitImageReq &&
          (/(?:website|web\s*app|landing\s*page|prototype|mockup|ui\s*design|dashboard|frontend|react\s*component|html\s*page)\b/i.test(text) ||
            /(?:build|develop|design)\s+(?:a|an)\s+(?:app|site|page|dashboard|interface|view|screen)/i.test(text)));

      const assistantId1 = uid();
      const assistantId2 = isDualModel && secondaryModel !== selectedModel ? uid() : null;

      const initialAssistantMsg1: Message = {
        id: assistantId1,
        role: "assistant",
        content: "",
        model: activeModelObj.displayName,
        timestamp: new Date(),
        isGenerating: true,
        statusStep: isWebDevIntent ? "Structuring design system & components..." : "Thinking...",
      };

      const initialAssistantMsg2: Message | null = assistantId2
        ? {
            id: assistantId2,
            role: "assistant",
            content: "",
            model: secondaryModelObj.displayName,
            timestamp: new Date(),
            isGenerating: true,
            statusStep: isWebDevIntent ? "Structuring design system & components..." : "Thinking...",
          }
        : null;

      // Update room title
      setRooms((rs) =>
        rs.map((r) =>
          r.id === activeRoom && (r.title === "New Project" || r.title === "")
            ? { ...r, title: text.slice(0, 24), lastMsg: text.slice(0, 36), updatedAt: Date.now() }
            : r.id === activeRoom
            ? { ...r, lastMsg: text.slice(0, 36), updatedAt: Date.now() }
            : r
        )
      );

      const updatedMsgs = initialAssistantMsg2
        ? [...currentMsgs, userMsg, initialAssistantMsg1, initialAssistantMsg2]
        : [...currentMsgs, userMsg, initialAssistantMsg1];

      setMessages((m) => ({ ...m, [activeRoom]: updatedMsgs }));
      setLoading(true);

      if (isWebDevIntent) {
        setActiveArtifact({
          id: `ws_${Date.now()}`,
          title: "index.html",
          language: "html",
          code: "",
          isHtml: true,
          activeTab: "preview",
          isBuilding: true,
        });
      }

      const historyToSend = updatedMsgs
        .filter((m) => !m.isGenerating && m.content)
        .slice(-20);

      const isSearchActive =
        activeModes.includes("web_search") ||
        Boolean(serverTools.find((t) => t.id === "web_search")?.enabled) ||
        userWantsWeather;
      const isImageActive =
        activeModes.includes("image_gen") ||
        Boolean(serverTools.find((t) => t.id === "image_gen")?.enabled) ||
        isExplicitImageReq;

      const basePayload = {
        messages: historyToSend.map((m) => ({ role: m.role, content: m.content })),
        tools: {
          ...Object.fromEntries(serverTools.map((t) => [t.id, t.enabled])),
          web_search: isSearchActive,
          image_gen: isImageActive,
        },
        activeModes,
        clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      const startTime = Date.now();

      // Primary Model
      const runPrimary = fetch("/api/playground/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer freeroute-playground",
        },
        body: JSON.stringify({ ...basePayload, model: selectedModel }),
      })
        .then(async (res) => {
          const latencyMs = Date.now() - startTime;
          if (res.ok) {
            const data = await res.json();
            const content = data.content ?? "";
            const isCodeResponse = /(?:```(?:html|tsx|jsx|css|javascript|typescript)|<!DOCTYPE\s+html|<html\b)/i.test(content);
            const files =
              (isWebDevIntent || isCodeResponse)
                ? parseArtifactProject(content, "index.html").files
                : [];

            if (files.length > 0 && files.some((f) => f.name.endsWith(".html") || f.name.endsWith(".tsx"))) {
              const mainFile = files.find((f) => f.name.endsWith(".html") || f.name.endsWith(".tsx")) || files[0];
              setActiveArtifact({
                id: `ws_${Date.now()}`,
                title: mainFile.name,
                language: mainFile.language,
                code: mainFile.content,
                isHtml: true,
                activeTab: "preview",
                isBuilding: false,
                projectFiles: files,
                selectedFile: mainFile.path,
              });
            } else if (!isWebDevIntent) {
              setActiveArtifact(null);
            }

            setMessages((m) => ({
              ...m,
              [activeRoom]: (m[activeRoom] || []).map((msg) =>
                msg.id === assistantId1
                  ? {
                      ...msg,
                      content,
                      isGenerating: false,
                      statusStep: undefined,
                      steps: files.length > 0
                        ? ["Explored specifications", ...files.map((f) => `Created ${f.path}`), "Mounted preview"]
                        : ["Verified context", "Generated response"],
                      projectFiles: files.length > 0 ? files : undefined,
                      thoughtDurationSec: Math.max(1, Math.round(latencyMs / 1000)),
                      tokens: data.usage?.total_tokens || 0,
                      cost: data.usage?.cost ? `$${Number(data.usage.cost).toFixed(4)}` : "$0",
                      latencyMs,
                      toolCalls: data.toolCalls,
                      weather: data.weather,
                    }
                  : msg
              ),
            }));
          } else {
            const err = await res.json().catch(() => ({}));
            setMessages((m) => ({
              ...m,
              [activeRoom]: (m[activeRoom] || []).map((msg) =>
                msg.id === assistantId1
                  ? {
                      ...msg,
                      content: `**Routing Notice**: ${err?.error?.message || "Failed to reach model"}`,
                      isGenerating: false,
                    }
                  : msg
              ),
            }));
          }
        })
        .catch((e) => {
          setMessages((m) => ({
            ...m,
            [activeRoom]: (m[activeRoom] || []).map((msg) =>
              msg.id === assistantId1
                ? {
                    ...msg,
                    content: `**Connection Error**: ${e.message}`,
                    isGenerating: false,
                  }
                : msg
            ),
          }));
        });

      // Secondary Model (if dual model active)
      const runSecondary = assistantId2
        ? fetch("/api/playground/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer freeroute-playground",
            },
            body: JSON.stringify({ ...basePayload, model: secondaryModel }),
          })
            .then(async (res) => {
              const latencyMs = Date.now() - startTime;
              if (res.ok) {
                const data = await res.json();
                const content = data.content ?? "";
                const isCodeResponse = /(?:```(?:html|tsx|jsx|css|javascript|typescript)|<!DOCTYPE\s+html|<html\b)/i.test(content);
                const files =
                  (isWebDevIntent || isCodeResponse)
                    ? parseArtifactProject(content, "index.html").files
                    : [];

                setMessages((m) => ({
                  ...m,
                  [activeRoom]: (m[activeRoom] || []).map((msg) =>
                    msg.id === assistantId2
                      ? {
                          ...msg,
                          content,
                          isGenerating: false,
                          statusStep: undefined,
                          steps: files.length > 0
                            ? ["Explored specifications", `Created ${files.length} files`, "Ready in workspace"]
                            : ["Completed analysis"],
                          projectFiles: files.length > 0 ? files : undefined,
                          thoughtDurationSec: Math.max(1, Math.round(latencyMs / 1000)),
                          tokens: data.usage?.total_tokens || 0,
                          cost: data.usage?.cost ? `$${Number(data.usage.cost).toFixed(4)}` : "$0",
                          latencyMs,
                          toolCalls: data.toolCalls,
                          weather: data.weather,
                        }
                      : msg
                  ),
                }));
              } else {
                const err = await res.json().catch(() => ({}));
                setMessages((m) => ({
                  ...m,
                  [activeRoom]: (m[activeRoom] || []).map((msg) =>
                    msg.id === assistantId2
                      ? {
                          ...msg,
                          content: `**Routing Error**: ${err?.error?.message || "HTTP Error"}`,
                          isGenerating: false,
                        }
                      : msg
                  ),
                }));
              }
            })
            .catch((e) => {
              setMessages((m) => ({
                ...m,
                [activeRoom]: (m[activeRoom] || []).map((msg) =>
                  msg.id === assistantId2
                    ? {
                        ...msg,
                        content: `**Connection Failed**: ${e.message}`,
                        isGenerating: false,
                      }
                    : msg
                ),
              }));
            })
        : Promise.resolve();

      await Promise.allSettled([runPrimary, runSecondary]);
      setLoading(false);
    },
    [
      input,
      loading,
      activeRoom,
      currentMsgs,
      selectedModel,
      secondaryModel,
      isDualModel,
      activeModelObj,
      secondaryModelObj,
      serverTools,
      activeModes,
      setActiveArtifact,
    ]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isHomeView = currentMsgs.length === 0 && !activeArtifact;

  return (
    <div className="od-root" data-theme={theme}>
      {toastMsg && (
        <div className="pg-toast" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Check size={14} className="text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ── 1. LEFT THIN ICON NAV RAIL ── */}
      <nav className="od-nav-rail">
        <div className="od-rail-logo" title="freeroute gateway" onClick={() => setActiveArtifact(null)}>
          <Layers size={18} className="text-indigo-400" />
        </div>

        <button className="od-rail-btn" onClick={createRoom} title="New Chat">
          <Plus size={16} />
        </button>

        <button
          className={`od-rail-btn ${isHomeView ? "active" : ""}`}
          onClick={() => {
            createRoom();
            setActiveArtifact(null);
          }}
          title="Home"
        >
          <Home size={16} />
        </button>

        <button
          className="od-rail-btn"
          onClick={() => {
            const list = rooms.map((r) => r.title).join("\n• ");
            alert(`Projects:\n• ${list}`);
          }}
          title="Projects"
        >
          <Folder size={16} />
        </button>

        <button
          className="od-rail-btn"
          onClick={() => {
            setInput("Build an interactive prototype with custom design system, dark mode, and responsive layout");
            textareaRef.current?.focus();
          }}
          title="Design Systems"
        >
          <Layers size={16} />
        </button>

        <div className="od-rail-bottom">
          <Link href="/dashboard" className="od-rail-btn" title="Dashboard">
            <LayoutGrid size={16} />
          </Link>
          <Link href="/dashboard/settings" className="od-rail-btn" title="Settings">
            <Settings size={16} />
          </Link>
          <div className="od-avatar-circle" title="User">F</div>
        </div>
      </nav>

      {/* ── 2. MAIN WORKSPACE CANVAS ── */}
      <div className="od-canvas">
        {/* Top Chrome Header */}
        <header className="od-top-chrome">
          <div className="od-chrome-tabs-left">
            <div
              className={`od-chrome-tab ${isHomeView ? "active" : ""}`}
              onClick={() => { createRoom(); setActiveArtifact(null); }}
            >
              <Home size={13} className="inline mr-1" />
              <span>Home</span>
            </div>

            {!isHomeView && (
              <div className="od-chrome-tab active">
                <Zap size={13} className="text-amber-400 inline mr-1" />
                <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {rooms.find((r) => r.id === activeRoom)?.title || "Project"}
                </span>
              </div>
            )}

            <button
              className="od-chrome-plus-btn"
              onClick={createRoom}
              title="New chat"
              style={{ width: 26, height: 26, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--od-border-subtle)", background: "transparent", cursor: "pointer", color: "var(--od-text-muted)" }}
            >
              <Plus size={13} />
            </button>
          </div>

          <div className="od-chrome-actions-right">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="od-github-star-pill"
              title="GitHub Star"
            >
              <Star size={12} className="text-amber-400" fill="currentColor" />
              <span>Star</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span style={{ fontWeight: 700 }}>71.3K</span>
            </a>

            <button className="od-chrome-icon-btn" onClick={toggle} title="Toggle Theme">
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <Link href="/dashboard/settings" className="od-chrome-icon-btn" title="Settings">
              <Settings size={15} />
            </Link>
          </div>
        </header>

        {/* ── 3. HOME VIEW (Matching od-home.webp EXACTLY) ── */}
        {isHomeView ? (
          <div className="od-home-scroll-pane">
            <div className="od-home-brand-badge">
              <Sparkles size={15} className="text-indigo-400" />
              <span>freeroute · AI Gateway & Design Studio</span>
            </div>

            <h1 className="od-home-title">What will you design today?</h1>
            <p className="od-home-subtitle">
              The open-source intelligent studio & multi-model gateway.
            </p>

            {/* Centered Composer Card */}
            <div className="od-composer-card">
              <textarea
                ref={textareaRef}
                className="od-composer-textarea"
                placeholder="Prototype a dashboard for tracking..."
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                rows={2}
              />

              <div className="od-composer-bottom-bar">
                <div className="od-composer-bar-left">
                  <button
                    className="od-pill-btn"
                    onClick={() => {
                      const inputElem = document.createElement("input");
                      inputElem.type = "file";
                      inputElem.onchange = async (e: any) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const text = await file.text();
                          setInput((prev) => (prev ? `${prev}\n\n[File: ${file.name}]\n${text}` : `[File: ${file.name}]\n${text}`));
                          showToast(`Attached ${file.name}`);
                        }
                      };
                      inputElem.click();
                    }}
                    title="Attach file"
                  >
                    +
                  </button>

                  <button
                    className="od-pill-btn"
                    onClick={() => {
                      setInput("Create a modern responsive landing page with glowing gradient hero, feature bento grid, and pricing table");
                      textareaRef.current?.focus();
                    }}
                  >
                    <span>⊞ Template None ▾</span>
                  </button>
                </div>

                <div className="od-composer-bar-right">
                  {/* Mode Pill */}
                  <button
                    className="od-pill-btn"
                    onClick={() => {
                      setActiveModes((prev) =>
                        prev.includes("web_dev") ? prev.filter((m) => m !== "web_dev") : [...prev, "web_dev"]
                      );
                      showToast(activeModes.includes("web_dev") ? "Default mode" : "Web Dev Studio active");
                    }}
                  >
                    <Sparkles size={12} className="text-amber-400" />
                    <span>Design</span>
                    <ChevronDown size={11} />
                  </button>

                  {/* Primary Model Pill */}
                  <button
                    className="od-model-pill"
                    onClick={() => setModelDropdownOpen((v) => !v)}
                    title="Select model"
                  >
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                    <span>{activeModelObj.displayName}</span>
                    <ChevronDown size={11} />
                  </button>

                  {/* Dual Model Toggle Pill */}
                  {isDualModel ? (
                    <button
                      className="od-model-pill"
                      style={{ borderColor: "rgba(194,83,45,0.4)", color: "var(--od-accent)" }}
                      onClick={() => setSecondaryDropdownOpen((v) => !v)}
                      title="Secondary Model"
                    >
                      <span>+ {secondaryModelObj.displayName}</span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsDualModel(false);
                        }}
                        style={{ display: "inline-flex", alignItems: "center", marginLeft: 4 }}
                      >
                        <X size={11} />
                      </span>
                    </button>
                  ) : (
                    <button
                      className="od-pill-btn"
                      onClick={() => setIsDualModel(true)}
                      title="Run 2 models at the same time"
                    >
                      <Plus size={11} />
                      <span>2nd Model</span>
                    </button>
                  )}

                  {/* Terracotta Send Button */}
                  <button
                    className="od-send-btn"
                    onClick={() => sendMessage()}
                    disabled={loading || !input.trim()}
                  >
                    <Send size={13} />
                    <span>Send</span>
                  </button>
                </div>
              </div>

              {/* Model Dropdown Popover */}
              {modelDropdownOpen && (
                <div className="pg-model-dropdown" style={{ top: "100%", right: 100, position: "absolute" }}>
                  <div className="pg-dropdown-list">
                    {catalog.slice(0, 8).map((m) => (
                      <div
                        key={m.id}
                        className={`pg-dropdown-item ${m.id === selectedModel ? "active" : ""}`}
                        onClick={() => {
                          setSelectedModel(m.id);
                          setModelDropdownOpen(false);
                          showToast(`Selected ${m.displayName}`);
                        }}
                      >
                        <span>{m.displayName}</span>
                        {m.id === selectedModel && <Check size={13} className="text-emerald-400" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Secondary Model Dropdown Popover */}
              {secondaryDropdownOpen && (
                <div className="pg-model-dropdown" style={{ top: "100%", right: 40, position: "absolute" }}>
                  <div className="pg-dropdown-list">
                    {catalog.slice(0, 8).map((m) => (
                      <div
                        key={m.id}
                        className={`pg-dropdown-item ${m.id === secondaryModel ? "active" : ""}`}
                        onClick={() => {
                          setSecondaryModel(m.id);
                          setSecondaryDropdownOpen(false);
                          showToast(`2nd model: ${m.displayName}`);
                        }}
                      >
                        <span>{m.displayName}</span>
                        {m.id === secondaryModel && <Check size={13} className="text-emerald-400" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Below Composer Row (Matching od-home.webp) */}
            <div className="od-below-composer-row">
              <div className="od-sub-pills-left">
                <button
                  className="od-pill-btn"
                  onClick={() => {
                    showToast("Clean normal chat mode");
                  }}
                >
                  <Wand2 size={12} className="text-slate-400" />
                  <span>No design system</span>
                  <ChevronDown size={11} />
                </button>
                <button
                  className="od-pill-btn"
                  onClick={() => {
                    showToast("Sandbox directory active");
                  }}
                >
                  <Folder size={12} className="text-slate-400" />
                  <span>Select directory</span>
                  <ChevronDown size={11} />
                </button>
              </div>
            </div>

            {/* Capability Modes Row (Simultaneous Multi-Mode) */}
            <div className="od-capability-modes-row">
              <button
                className={`od-cap-btn ${activeModes.includes("web_dev") ? "active" : ""}`}
                onClick={() => {
                  setActiveModes((prev) =>
                    prev.includes("web_dev") ? prev.filter((m) => m !== "web_dev") : [...prev, "web_dev"]
                  );
                }}
                title="Build live interactive web prototypes & React components"
              >
                <Code2 size={13} />
                <span>Web Dev</span>
              </button>

              <button
                className={`od-cap-btn ${activeModes.includes("web_search") || serverTools.find((t) => t.id === "web_search")?.enabled ? "active" : ""}`}
                onClick={() => {
                  setActiveModes((prev) =>
                    prev.includes("web_search") ? prev.filter((m) => m !== "web_search") : [...prev, "web_search"]
                  );
                  toggleTool("web_search");
                }}
                title="Real-time web research & citation grounding"
              >
                <Globe size={13} />
                <span>Web Search</span>
              </button>

              <button
                className={`od-cap-btn ${activeModes.includes("image_gen") || serverTools.find((t) => t.id === "image_gen")?.enabled ? "active" : ""}`}
                onClick={() => {
                  setActiveModes((prev) =>
                    prev.includes("image_gen") ? prev.filter((m) => m !== "image_gen") : [...prev, "image_gen"]
                  );
                  toggleTool("image_gen");
                }}
                title="AI Image & asset generation"
              >
                <ImageIcon size={13} />
                <span>Image Gen</span>
              </button>

              <button
                className={`od-cap-btn ${activeModes.includes("weather") ? "active" : ""}`}
                onClick={() => {
                  setActiveModes((prev) =>
                    prev.includes("weather") ? prev.filter((m) => m !== "weather") : [...prev, "weather"]
                  );
                  if (!input.trim()) {
                    setInput("Show me the live weather report and 7-day forecast for San Francisco with humidity and wind");
                  }
                }}
                title="Live Weather radar & forecast"
              >
                <Cloud size={13} />
                <span>Weather</span>
              </button>

              <button
                className={`od-cap-btn ${activeModes.includes("table") ? "active" : ""}`}
                onClick={() => {
                  setActiveModes((prev) =>
                    prev.includes("table") ? prev.filter((m) => m !== "table") : [...prev, "table"]
                  );
                  if (!input.trim()) {
                    setInput("Create an interactive table comparing LLM models by speed, cost per 1M tokens, latency, and context window");
                  }
                }}
                title="Interactive Table with search and export"
              >
                <Table size={13} />
                <span>Table</span>
              </button>

              <button
                className={`od-cap-btn ${activeModes.includes("sheet") ? "active" : ""}`}
                onClick={() => {
                  setActiveModes((prev) =>
                    prev.includes("sheet") ? prev.filter((m) => m !== "sheet") : [...prev, "sheet"]
                  );
                  if (!input.trim()) {
                    setInput("Generate a financial Excel spreadsheet model with Q1-Q4 revenue, COGS, EBITDA, and exportable CSV format");
                  }
                }}
                title="Excel spreadsheet model with CSV export"
              >
                <FileSpreadsheet size={13} />
                <span>Spreadsheet</span>
              </button>

              {activeModes.length >= 2 && (
                <div
                  className="od-pill-btn"
                  style={{ borderColor: "rgba(194, 83, 45, 0.4)", color: "var(--od-accent)", fontWeight: 600, background: "rgba(194, 83, 45, 0.08)" }}
                >
                  <Zap size={11} />
                  <span>{activeModes.length} modes active simultaneously</span>
                </div>
              )}
            </div>

            {/* Start with a Template Section (Matching od-home.webp EXACTLY) */}
            <div className="od-templates-section">
              <div className="od-templates-label">Start with a template...</div>

              <div className="od-templates-grid">
                {openDesignTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="od-template-card"
                    onClick={() => {
                      setInput(tpl.prompt);
                      textareaRef.current?.focus();
                    }}
                  >
                    <div
                      className="od-template-icon-wrap"
                      style={{ color: tpl.color, background: `${tpl.color}18`, border: `1px solid ${tpl.color}30` }}
                    >
                      {tpl.icon}
                    </div>
                    <div className="od-template-card-title">{tpl.title}</div>
                    <div className="od-template-card-desc">{tpl.desc}</div>
                  </div>
                ))}
              </div>

              <div
                className="od-blank-link"
                onClick={() => {
                  setInput("Build a clean, high-performance web application with modern layout");
                  textareaRef.current?.focus();
                }}
              >
                ...or start a blank project &gt;
              </div>
            </div>
          </div>
        ) : (
          /* ── 4. SPLIT STUDIO VIEW (Matching od-app-preview.webp) ── */
          <div className="od-split-view">
            {/* Left Chat & Narrative Pane */}
            <div className="od-split-left-pane">
              <div className="od-split-chat-stream">
                {currentMsgs.map((msg, idx) => {
                  if (msg.role === "user") {
                    return (
                      <div key={msg.id} className="pg-user-message-wrap">
                        <div className="pg-user-message-row">
                          <div className="pg-user-bubble">{msg.content}</div>
                          <div className="pg-user-avatar-circle">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const hasProjectFiles = Boolean(msg.projectFiles && msg.projectFiles.length > 0);

                  return (
                    <div key={msg.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                        <span>AMR</span>
                        <span style={{ fontSize: 11, fontWeight: 500, color: "var(--od-text-muted)" }}>
                          model {msg.model || activeModelObj.displayName}
                        </span>
                      </div>

                      {msg.weather && <WeatherCard weather={msg.weather} />}
                      {msg.toolCalls && msg.toolCalls.length > 0 && <ToolCallsViewer toolCalls={msg.toolCalls} />}

                      {hasProjectFiles ? (
                        <ArenaAgentCard
                          message={msg}
                          projectFiles={msg.projectFiles || parseArtifactProject(msg.content, "index.html").files}
                          thoughtDurationSec={msg.thoughtDurationSec}
                          steps={msg.steps}
                          onSelectFile={(filePath) => {
                            const files = msg.projectFiles || parseArtifactProject(msg.content, "index.html").files;
                            const found = files.find((f) => f.path === filePath) || files[0];
                            if (found) {
                              setActiveArtifact({
                                id: `ws_${Date.now()}`,
                                title: found.name,
                                language: found.language,
                                code: found.content,
                                isHtml: true,
                                activeTab: "code",
                                projectFiles: files,
                                selectedFile: found.path,
                              });
                            }
                          }}
                          onMakeBetter={() => {
                            setInput("Make better: enhance typography, add dark mode, responsive styling, and micro-interactions");
                            textareaRef.current?.focus();
                          }}
                          onNextStep={(nextPrompt) => {
                            setInput(nextPrompt);
                            textareaRef.current?.focus();
                          }}
                        />
                      ) : (
                        <RenderMessage
                          content={msg.content}
                          userPrompt={
                            currentMsgs
                              .slice(0, idx)
                              .reverse()
                              .find((m) => m.role === "user")?.content
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Composer in Split Mode */}
              <div className="od-split-composer-box">
                <div className="od-composer-card" style={{ marginBottom: 0 }}>
                  <textarea
                    ref={textareaRef}
                    className="od-composer-textarea"
                    placeholder="Describe what you want to generate..."
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    rows={1}
                  />
                  <div className="od-composer-bottom-bar">
                    <button
                      className="od-pill-btn"
                      onClick={() => setModelDropdownOpen((v) => !v)}
                      title="Change model"
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span>{activeModelObj.displayName}</span>
                        <ChevronDown size={11} />
                      </span>
                    </button>
                    <button
                      className="od-send-btn"
                      onClick={() => sendMessage()}
                      disabled={loading || !input.trim()}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <Send size={12} />
                        <span>Send</span>
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Live Stage Canvas (Open-Design Studio) */}
            {activeArtifact ? (
              <WorkspaceIDE artifact={activeArtifact} onClose={() => setActiveArtifact(null)} />
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#0e1017", color: "#64748b" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
                    <Zap size={36} className="text-amber-400" />
                  </div>
                  <p style={{ fontSize: 13, color: "var(--od-text-muted)" }}>
                    Send a design or build prompt to mount the live preview studio.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
