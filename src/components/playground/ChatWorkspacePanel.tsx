"use client";

import React, { useState, useEffect } from "react";
import {
  FileCode2,
  FolderTree,
  Play,
  RotateCcw,
  Copy,
  Check,
  Download,
  AlertOctagon,
  AlertTriangle,
  Info,
  ShieldAlert,
  ShieldCheck,
  Terminal as TerminalIcon,
  Layers,
  ChevronRight,
  ChevronDown,
  Sparkles,
  ExternalLink,
  Code2,
  FileCheck2,
  GitCompare,
  ArrowRight,
} from "lucide-react";
import { ToolResultWidget } from "./ToolResultWidget";
import { computeUnifiedDiff } from "@/lib/designerArtifact";

export interface WorkspaceFile {
  name: string;
  content: string;
  language?: string;
  additions?: number;
  deletions?: number;
  previousContent?: string;
}

export interface VulnerabilityDetail {
  id?: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  cwe?: string;
  line?: number;
  file?: string;
  vulnerableSnippet?: string;
  patchedSnippet?: string;
  description: string;
  recommendation?: string;
  alternatives?: string[];
}

interface Props {
  activeFile?: WorkspaceFile | null;
  files: WorkspaceFile[];
  onSelectFile: (name: string) => void;
  activeToolResult?: { type: string; data: any } | null;
  onSendPrompt?: (prompt: string) => void;
}

export function ChatWorkspacePanel({
  activeFile,
  files,
  onSelectFile,
  activeToolResult,
  onSendPrompt,
}: Props) {
  const [activeTab, setActiveTab] = useState<"file" | "review" | "tree" | "widget">("file");
  const [viewMode, setViewMode] = useState<"code" | "diff">("code");
  const [copied, setCopied] = useState(false);

  // Execution terminal state
  const [isRunning, setIsRunning] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<{
    stdout: string;
    stderr: string;
    exitCode: number;
    executionTimeMs: number;
    command: string;
  } | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(false);

  // Sync active tab based on what's active
  useEffect(() => {
    if (activeFile) {
      setActiveTab("file");
    } else if (activeToolResult?.type === "code_review") {
      setActiveTab("review");
    } else if (activeToolResult?.type === "file_tree" || files.length > 1) {
      setActiveTab(activeFile ? "file" : "tree");
    } else if (activeToolResult) {
      setActiveTab("widget");
    }
  }, [activeFile, activeToolResult]);

  const currentFile = activeFile || files[0] || null;

  // Detect language from filename or content
  const language = React.useMemo(() => {
    if (!currentFile) return "plaintext";
    const ext = currentFile.name.split(".").pop()?.toLowerCase();
    if (ext === "py") return "python";
    if (ext === "js" || ext === "mjs" || ext === "cjs") return "javascript";
    if (ext === "ts" || ext === "tsx") return "typescript";
    if (ext === "html") return "html";
    if (ext === "css") return "css";
    if (ext === "json") return "json";
    if (ext === "sh" || ext === "bash") return "bash";
    return currentFile.language || "plaintext";
  }, [currentFile]);

  const isRunnable = language === "python" || language === "javascript" || language === "typescript";

  const handleCopyCode = () => {
    if (!currentFile?.content) return;
    navigator.clipboard?.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!currentFile) return;
    const blob = new Blob([currentFile.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunCode = async () => {
    if (!currentFile || !isRunnable) return;
    setIsRunning(true);
    setTerminalOpen(true);
    const cmd = language === "python" ? `python ${currentFile.name}` : `node ${currentFile.name}`;

    try {
      const res = await fetch("/api/playground/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          code: currentFile.content,
          filename: currentFile.name,
        }),
      });
      const data = await res.json();
      setTerminalOutput({
        stdout: data.stdout || "",
        stderr: data.stderr || "",
        exitCode: data.exitCode ?? 0,
        executionTimeMs: data.executionTimeMs || 0,
        command: cmd,
      });
    } catch (err: any) {
      setTerminalOutput({
        stdout: "",
        stderr: `Execution Request Failed: ${err.message}`,
        exitCode: 1,
        executionTimeMs: 0,
        command: cmd,
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Compute unified diff lines if previous content exists
  const diffLines = React.useMemo(() => {
    if (!currentFile?.previousContent) return null;
    const res = computeUnifiedDiff(currentFile.previousContent, currentFile.content);
    return res.diffLines;
  }, [currentFile?.content, currentFile?.previousContent]);

  // Extract review data
  const reviewData = activeToolResult?.type === "code_review" ? activeToolResult.data : null;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-50/60 dark:bg-[#0e1017]">
      {/* 1. TOP HEADER & NAVIGATION TABS */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {/* File Tab */}
          {(currentFile || files.length > 0) && (
            <button
              onClick={() => setActiveTab("file")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "file"
                  ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-2xs"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              <FileCode2 size={14} className="text-blue-500" />
              <span className="truncate max-w-[130px]">{currentFile ? currentFile.name : "Code Viewer"}</span>
              {currentFile && (
                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  {language.toUpperCase()}
                </span>
              )}
            </button>
          )}

          {/* Code Review Tab */}
          {reviewData && (
            <button
              onClick={() => setActiveTab("review")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "review"
                  ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 shadow-2xs"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              <ShieldAlert size={14} className="text-rose-500" />
              <span>Vulnerability Review</span>
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            </button>
          )}

          {/* Project Tree Tab */}
          {files.length > 1 && (
            <button
              onClick={() => setActiveTab("tree")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "tree"
                  ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-2xs"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              <FolderTree size={14} className="text-amber-500" />
              <span>Project Files ({files.length})</span>
            </button>
          )}

          {/* Other Tools / Widgets Tab */}
          {activeToolResult && activeToolResult.type !== "code_review" && (
            <button
              onClick={() => setActiveTab("widget")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "widget"
                  ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-2xs"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              <Layers size={14} className="text-emerald-500" />
              <span>{activeToolResult.type.replace("_", " ").toUpperCase()}</span>
            </button>
          )}
        </div>

        {/* Action Controls for Active File */}
        {activeTab === "file" && currentFile && (
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Diff View Toggle (If previous version exists) */}
            {currentFile.previousContent && (
              <div className="flex items-center p-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-[11px] font-medium mr-1">
                <button
                  onClick={() => setViewMode("code")}
                  className={`px-2 py-0.5 rounded-md transition-colors ${
                    viewMode === "code"
                      ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs"
                      : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                  }`}
                >
                  Code
                </button>
                <button
                  onClick={() => setViewMode("diff")}
                  className={`px-2 py-0.5 rounded-md transition-colors flex items-center gap-1 ${
                    viewMode === "diff"
                      ? "bg-white dark:bg-neutral-700 text-emerald-600 dark:text-emerald-400 shadow-2xs font-semibold"
                      : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                  }`}
                >
                  <GitCompare size={11} />
                  <span>Diff</span>
                </button>
              </div>
            )}

            {/* Run Code Button */}
            {isRunnable && (
              <button
                onClick={handleRunCode}
                disabled={isRunning}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-medium text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                title={`Execute ${currentFile.name} with ${language === "python" ? "Python 3.11" : "Node.js"}`}
              >
                <Play size={12} className={isRunning ? "animate-spin" : "fill-current"} />
                <span>{isRunning ? "Running..." : "Run Code"}</span>
              </button>
            )}

            <button
              onClick={handleCopyCode}
              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="Copy Code"
            >
              {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </button>

            <button
              onClick={handleDownload}
              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="Download File"
            >
              <Download size={13} />
            </button>
          </div>
        )}
      </div>

      {/* 2. BODY CONTENT BASED ON ACTIVE TAB */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {activeTab === "file" && currentFile && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* File Info Bar */}
            <div className="px-4 py-2 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-100/50 dark:bg-neutral-900/40 flex items-center justify-between text-xs text-neutral-500">
              <div className="flex items-center gap-2">
                <span className="font-mono text-neutral-800 dark:text-neutral-200 font-semibold">
                  {currentFile.name}
                </span>
                <span>·</span>
                <span>{currentFile.content.split("\n").length} lines</span>
                <span>·</span>
                <span>{(currentFile.content.length / 1024).toFixed(1)} KB</span>
                {(currentFile.additions !== undefined || currentFile.deletions !== undefined) && (
                  <>
                    <span>·</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                      +{currentFile.additions || 0}
                    </span>
                    {currentFile.deletions && currentFile.deletions > 0 ? (
                      <span className="text-rose-500 dark:text-rose-400 font-mono font-semibold">
                        -{currentFile.deletions}
                      </span>
                    ) : null}
                  </>
                )}
              </div>

              {isRunnable && (
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Ready to run ({language})</span>
                </div>
              )}
            </div>

            {/* Code / Diff Viewer */}
            <div className="flex-1 overflow-auto font-mono text-[12.5px] leading-relaxed bg-white dark:bg-[#0c0d14] text-neutral-800 dark:text-neutral-200 select-text">
              {viewMode === "diff" && diffLines ? (
                <div className="py-2">
                  {diffLines.map((dl, idx) => {
                    const isAdd = dl.type === "add";
                    const isDel = dl.type === "del";
                    return (
                      <div
                        key={idx}
                        className={`flex items-start px-3 py-0.5 border-l-2 ${
                          isAdd
                            ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500"
                            : isDel
                            ? "bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500 line-through opacity-80"
                            : "border-transparent text-neutral-600 dark:text-neutral-400"
                        }`}
                      >
                        <span className="w-8 select-none text-right pr-3 text-[11px] text-neutral-400 dark:text-neutral-600 shrink-0">
                          {dl.newNo || dl.oldNo}
                        </span>
                        <span className="w-4 select-none text-center font-bold text-xs shrink-0">
                          {isAdd ? "+" : isDel ? "-" : " "}
                        </span>
                        <span className="whitespace-pre overflow-x-auto">{dl.line}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-2">
                  {currentFile.content.split("\n").map((line, idx) => (
                    <div
                      key={idx}
                      className="flex items-start px-3 py-0.5 hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40 transition-colors"
                    >
                      <span className="w-9 select-none text-right pr-4 text-[11px] text-neutral-400 dark:text-neutral-600 shrink-0">
                        {idx + 1}
                      </span>
                      <span className="whitespace-pre overflow-x-auto flex-1">{line}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. DOCKABLE TERMINAL OUTPUT CONSOLE (When code is run) */}
            {terminalOpen && (
              <div className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-900 text-neutral-100 font-mono text-xs flex flex-col shrink-0 max-h-56">
                <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-950/80 border-b border-neutral-800 text-[11px] text-neutral-400">
                  <div className="flex items-center gap-2">
                    <TerminalIcon size={13} className="text-emerald-400" />
                    <span className="font-semibold text-neutral-200">Terminal Console</span>
                    {terminalOutput && (
                      <>
                        <span>·</span>
                        <span className="text-neutral-500">{terminalOutput.command}</span>
                        <span>·</span>
                        <span
                          className={`font-semibold ${
                            terminalOutput.exitCode === 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          Exit {terminalOutput.exitCode}
                        </span>
                        <span>·</span>
                        <span className="text-neutral-500">{terminalOutput.executionTimeMs}ms</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleRunCode}
                      disabled={isRunning}
                      className="hover:text-neutral-200 p-1 transition-colors"
                      title="Re-run"
                    >
                      <RotateCcw size={11} className={isRunning ? "animate-spin" : ""} />
                    </button>
                    <button
                      onClick={() => setTerminalOpen(false)}
                      className="hover:text-neutral-200 px-1.5 py-0.5 rounded hover:bg-neutral-800 transition-colors text-[10px]"
                    >
                      Close ✕
                    </button>
                  </div>
                </div>

                <div className="p-3 overflow-y-auto flex-1 space-y-1 select-text">
                  {isRunning ? (
                    <div className="flex items-center gap-2 text-emerald-400 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>Executing code in isolated environment...</span>
                    </div>
                  ) : terminalOutput ? (
                    <>
                      {terminalOutput.stdout && (
                        <pre className="whitespace-pre-wrap text-emerald-300 font-mono leading-relaxed">
                          {terminalOutput.stdout}
                        </pre>
                      )}
                      {terminalOutput.stderr && (
                        <pre className="whitespace-pre-wrap text-rose-400 font-mono leading-relaxed">
                          {terminalOutput.stderr}
                        </pre>
                      )}
                      {!terminalOutput.stdout && !terminalOutput.stderr && (
                        <div className="text-neutral-500 italic">Program finished with no output.</div>
                      )}
                    </>
                  ) : (
                    <div className="text-neutral-500 italic">No output yet. Click &quot;Run Code&quot; to execute.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VULNERABILITY & SECURITY REVIEW VIEW */}
        {activeTab === "review" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Header Banner */}
            <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-gradient-to-br from-rose-500/10 via-amber-500/5 to-transparent shadow-xs">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/30 shrink-0">
                    <ShieldAlert size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white uppercase tracking-wider">
                        CRITICAL SEVERITY
                      </span>
                      <span className="text-xs font-mono text-neutral-500">CWE-95 / Eval Injection</span>
                    </div>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mt-1">
                      {reviewData?.summary || "1 Critical Security Vulnerability Detected"}
                    </h3>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Vulnerability Cards */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <AlertOctagon size={14} className="text-rose-500" />
                <span>Vulnerability Details</span>
              </h4>

              {(reviewData?.issues || [
                {
                  line: 1,
                  severity: "error",
                  message: "Using 'eval()' with user-supplied input allows arbitrary Remote Code Execution (RCE).",
                  suggestion: "NEVER use eval(). Use JSON.parse() for data or safe token verification libraries.",
                },
              ]).map((issue: any, idx: number) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-neutral-900/80 overflow-hidden shadow-sm"
                >
                  <div className="p-3.5 border-b border-neutral-100 dark:border-neutral-800 bg-rose-50/40 dark:bg-rose-950/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      <span className="font-semibold text-xs text-rose-700 dark:text-rose-300">
                        Line {issue.line || 1}: Remote Code Execution Vulnerability
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 font-bold">
                      CVSS 9.8
                    </span>
                  </div>

                  <div className="p-4 space-y-3 text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
                    <p>{issue.message}</p>

                    {/* Vulnerable vs Patched Code Comparison */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-neutral-500">Vulnerable Code:</div>
                      <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 font-mono text-[11.5px] text-rose-700 dark:text-rose-300">
                        <code>- eval(token); // Arbitrary attacker code execution</code>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-neutral-500">Recommended Remediated Code:</div>
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 font-mono text-[11.5px] text-emerald-700 dark:text-emerald-300">
                        <code>+ JSON.parse(token); // Safe parsing without evaluation</code>
                      </div>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="pt-2 flex items-center gap-2">
                      {files.length > 0 && (
                        <button
                          onClick={() => {
                            setActiveTab("file");
                            if (files[0]) onSelectFile(files[0].name);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-900 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <FileCheck2 size={13} />
                          <span>View Remediated File</span>
                        </button>
                      )}
                      {onSendPrompt && (
                        <button
                          onClick={() => onSendPrompt("Implement full JWT authentication with crypto verification to replace eval")}
                          className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium text-xs transition-colors cursor-pointer"
                        >
                          <span>Ask AI for JWT Fix</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PROJECT FILE STRUCTURE TREE VIEW */}
        {activeTab === "tree" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <FolderTree size={16} className="text-amber-500" />
                <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                  Project File Structure ({files.length} files)
                </h4>
              </div>
            </div>

            <div className="space-y-1 font-mono text-xs">
              {files.map((f, idx) => {
                const isCurrent = currentFile?.name === f.name;
                const ext = f.name.split(".").pop()?.toUpperCase() || "FILE";
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      onSelectFile(f.name);
                      setActiveTab("file");
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors text-left cursor-pointer ${
                      isCurrent
                        ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 font-semibold"
                        : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <FileCode2 size={14} className={isCurrent ? "text-blue-600" : "text-neutral-400"} />
                      <span className="truncate">{f.name}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[10.5px] shrink-0 font-normal">
                      <span className="font-bold text-neutral-400">{ext}</span>
                      {(f.additions !== undefined || f.deletions !== undefined) && (
                        <div className="flex items-center gap-1 font-mono">
                          <span className="text-emerald-600 dark:text-emerald-400">+{f.additions || 0}</span>
                          <span className="text-rose-500">-{f.deletions || 0}</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* GENERIC TOOL RESULT WIDGET (Weather, Table, Search) */}
        {activeTab === "widget" && activeToolResult && (
          <div className="flex-1 overflow-y-auto p-5">
            <ToolResultWidget type={activeToolResult.type as any} data={activeToolResult.data} />
          </div>
        )}

        {/* Empty State */}
        {!currentFile && !reviewData && files.length === 0 && !activeToolResult && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-400">
            <div className="w-12 h-12 rounded-2xl bg-neutral-200/50 dark:bg-neutral-800/50 flex items-center justify-center mb-3">
              <Code2 size={22} />
            </div>
            <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              Workspace Ready
            </h4>
            <p className="text-xs text-neutral-500 max-w-xs mt-1">
              Generated files, Python/JS code runners, and vulnerability reviews will dock right here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
