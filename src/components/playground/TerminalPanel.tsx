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

export interface TerminalOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  command: string;
}

interface Props {
  currentFile?: { name: string; content: string } | null;
  output: TerminalOutput | null;
  isRunning: boolean;
  onRunCode?: () => void;
  onClearOutput?: () => void;
}

export function TerminalPanel({
  currentFile,
  output,
  isRunning,
  onRunCode,
  onClearOutput,
}: Props) {
  const [copied, setCopied] = useState(false);

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

  const handleCopy = () => {
    if (!output) return;
    const text = `${output.command ? `$ ${output.command}\n` : ""}${output.stdout || ""}${output.stderr || ""}`;
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
        ) : output ? (
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
        ) : (
          /* Empty / Idle State */
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
                  : "Select a Python or Node.js file to execute code in the sandbox."}
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
