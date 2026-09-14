"use client";

import React, { useState } from "react";
import {
  Terminal as TerminalIcon,
  Play,
  RotateCcw,
  Copy,
  Check,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Code2,
} from "lucide-react";

export interface ConsoleLogEntry {
  level: "log" | "info" | "warn" | "error" | "debug";
  args: string[];
  message: string;
  time: number;
}

export interface TerminalOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  command: string;
  consoleLogs?: ConsoleLogEntry[];
}

interface Props {
  currentFile?: { name: string; content: string } | null;
  output: TerminalOutput | null;
  consoleLogs?: ConsoleLogEntry[];
  isRunning: boolean;
  onRunCode?: () => void;
  onClearOutput?: () => void;
}

export function TerminalPanel({
  currentFile,
  output,
  consoleLogs = [],
  isRunning,
  onRunCode,
  onClearOutput,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "commands" | "console">("all");

  const rawExt = currentFile?.name?.split(".").pop()?.toLowerCase() || "";
  const languageLabel =
    rawExt === "py"
      ? "Python 3.11"
      : rawExt === "ts"
      ? "TypeScript"
      : rawExt === "js" || rawExt === "mjs"
      ? "Node.js v20"
      : "Script";

  const isRunnable = rawExt === "py" || rawExt === "js" || rawExt === "ts" || rawExt === "mjs";

  const mergedLogs = React.useMemo(() => {
    return (output?.consoleLogs && output.consoleLogs.length > 0)
      ? output.consoleLogs
      : consoleLogs;
  }, [output?.consoleLogs, consoleLogs]);

  const handleCopy = () => {
    if (!output && mergedLogs.length === 0) return;
    let text = "";
    if (output) {
      text += `${output.command ? `$ ${output.command}\n` : ""}${output.stdout || ""}${output.stderr || ""}\n`;
    }
    if (mergedLogs.length > 0) {
      text += mergedLogs.map((l) => `[${l.level.toUpperCase()}] ${l.message}`).join("\n");
    }
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#090b10] text-neutral-200 font-mono text-xs select-text">
      {/* 1. TERMINAL TOP TOOLBAR */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f1219] border-b border-neutral-800 shrink-0">
        <div className="flex items-center gap-2.5 overflow-hidden">
          {/* macOS / IDE Terminal Dots */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>

          <span className="text-neutral-600">|</span>

          <div className="flex items-center gap-1.5 text-neutral-300 font-semibold text-[11.5px] truncate">
            <TerminalIcon size={14} className="text-emerald-400 shrink-0" />
            <span>Terminal</span>
            {currentFile && (
              <span className="text-neutral-500 truncate max-w-[140px]">
                ({currentFile.name})
              </span>
            )}
          </div>

          <span className="text-[10.5px] px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-400 font-medium shrink-0">
            {languageLabel}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {output && (
            <div className="flex items-center gap-2 pr-1 border-r border-neutral-800">
              <span
                className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded ${
                  output.exitCode === 0
                    ? "bg-emerald-950/70 text-emerald-400 border border-emerald-800/60"
                    : "bg-rose-950/70 text-rose-400 border border-rose-800/60"
                }`}
              >
                {output.exitCode === 0 ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                <span>Exit {output.exitCode}</span>
              </span>
              <span className="flex items-center gap-1 text-[10.5px] text-neutral-400 font-mono">
                <Clock size={11} />
                <span>{output.executionTimeMs}ms</span>
              </span>
            </div>
          )}

          {onRunCode && isRunnable && (
            <button
              onClick={onRunCode}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              title="Run code in isolated environment"
            >
              <Play size={11} className={`fill-current ${isRunning ? "animate-spin" : ""}`} />
              <span>{isRunning ? "Running..." : "Run"}</span>
            </button>
          )}

          {output && (
            <>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer text-[11px]"
                title="Copy terminal output"
              >
                {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>

              {onClearOutput && (
                <button
                  onClick={onClearOutput}
                  className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                  title="Clear terminal"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* SUB-TOOLBAR FOR FILTER TABS */}
      {(output || mergedLogs.length > 0) && (
        <div className="flex items-center gap-1 px-4 py-1.5 bg-[#0b0e14] border-b border-neutral-800/80 text-[11px]">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-2.5 py-0.5 rounded-md transition-colors cursor-pointer font-medium ${
              activeTab === "all"
                ? "bg-neutral-800 text-white"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            All
          </button>
          {output && (
            <button
              onClick={() => setActiveTab("commands")}
              className={`px-2.5 py-0.5 rounded-md transition-colors cursor-pointer font-medium ${
                activeTab === "commands"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Output
            </button>
          )}
          {mergedLogs.length > 0 && (
            <button
              onClick={() => setActiveTab("console")}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md transition-colors cursor-pointer font-medium ${
                activeTab === "console"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Preview Logs ({mergedLogs.length})</span>
            </button>
          )}
        </div>
      )}

      {/* 2. TERMINAL BODY / OUTPUT SCREEN */}
      <div className="flex-1 p-4 overflow-auto font-mono text-[12px] leading-relaxed space-y-2 select-text">
        {isRunning ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-neutral-400">
              <span className="text-emerald-500 font-bold">$</span>
              <span>
                {currentFile ? (rawExt === "py" ? `python ${currentFile.name}` : `node ${currentFile.name}`) : "executing script..."}
              </span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400 animate-pulse pl-4">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Executing script in isolated sandbox runtime...</span>
            </div>
          </div>
        ) : (output && (activeTab === "all" || activeTab === "commands")) ? (
          <div className="space-y-3">
            {/* Command Header */}
            {output.command && (
              <div className="flex items-center gap-2 text-neutral-400 font-bold border-b border-neutral-900 pb-2">
                <span className="text-emerald-500">$</span>
                <span className="text-neutral-200">{output.command}</span>
              </div>
            )}

            {/* Standard Output */}
            {output.stdout && (
              <pre className="whitespace-pre-wrap text-emerald-300 font-mono leading-relaxed selection:bg-emerald-900 selection:text-white">
                {output.stdout}
              </pre>
            )}

            {/* Standard Error */}
            {output.stderr && (
              <pre className="whitespace-pre-wrap text-rose-400 font-mono leading-relaxed bg-rose-950/20 p-2.5 rounded-lg border border-rose-900/40 selection:bg-rose-900 selection:text-white">
                {output.stderr}
              </pre>
            )}

            {/* Empty Output Case */}
            {!output.stdout && !output.stderr && (
              <div className="text-neutral-500 italic">
                (Script executed successfully with zero output)
              </div>
            )}

            {/* Process Exit Summary */}
            <div className="pt-2 text-[11px] text-neutral-500 flex items-center gap-2 border-t border-neutral-900">
              <span>● Process exited with code {output.exitCode}</span>
              <span>·</span>
              <span>Duration: {output.executionTimeMs}ms</span>
            </div>
          </div>
        ) : null}

        {/* Live Preview Console Logs Section */}
        {mergedLogs.length > 0 && (activeTab === "all" || activeTab === "console") && (
          <div className={`space-y-1.5 ${output && activeTab === "all" ? "pt-4 border-t border-neutral-800/80" : ""}`}>
            <div className="flex items-center justify-between text-[10.5px] text-neutral-500 pb-1 uppercase tracking-wider font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                <span>Live Browser Sandbox Logs</span>
              </div>
              <span>{mergedLogs.length} events</span>
            </div>

            <div className="space-y-1">
              {mergedLogs.map((log, idx) => {
                const timeStr = new Date(log.time).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
                const isError = log.level === "error";
                const isWarn = log.level === "warn";

                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-2.5 px-2.5 py-1 rounded border text-[11.5px] font-mono leading-relaxed ${
                      isError
                        ? "bg-rose-950/30 border-rose-900/50 text-rose-300"
                        : isWarn
                        ? "bg-amber-950/30 border-amber-900/50 text-amber-300"
                        : "bg-neutral-900/40 border-neutral-800/50 text-neutral-300"
                    }`}
                  >
                    <span className="text-[10px] text-neutral-500 shrink-0 pt-0.5 select-none">{timeStr}</span>
                    <span
                      className={`text-[9.5px] font-bold uppercase px-1.5 py-0.2 rounded shrink-0 select-none ${
                        isError
                          ? "bg-rose-900/80 text-rose-200"
                          : isWarn
                          ? "bg-amber-900/80 text-amber-200"
                          : "bg-blue-900/60 text-blue-300"
                      }`}
                    >
                      {log.level}
                    </span>
                    <div className="flex-1 overflow-x-auto whitespace-pre-wrap break-all">
                      {log.message}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty / Idle State */}
        {!isRunning && !output && mergedLogs.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-emerald-400">
              <TerminalIcon size={24} />
            </div>

            <div className="space-y-1 max-w-sm">
              <h4 className="text-xs font-semibold text-neutral-300">
                Sandbox Terminal Ready
              </h4>
              <p className="text-[11.5px] text-neutral-500 leading-normal">
                {currentFile
                  ? `Click "Run Script" to execute ${currentFile.name} and view stdout / stderr.`
                  : "Select a Python or Node.js file to execute code in the sandbox, or interact with preview to view console logs."}
              </p>
            </div>

            {currentFile && isRunnable && onRunCode && (
              <button
                onClick={onRunCode}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer shadow-md"
              >
                <Play size={13} className="fill-current" />
                <span>Run {currentFile.name}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
