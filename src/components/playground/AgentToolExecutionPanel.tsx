"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Terminal,
  FileCode2,
  FileEdit,
  Eye,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";

export interface AgentStep {
  id: string;
  action: "read" | "edit" | "command" | "present" | "think" | "custom";
  label?: string;
  target?: string;
  description?: string;
  output?: string;
  status: "running" | "completed" | "failed";
  timestamp?: number;
}

interface Props {
  steps: AgentStep[];
  isStreaming?: boolean;
}

export function AgentToolExecutionPanel({ steps, isStreaming }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  if (!steps || steps.length === 0) return null;

  // Compute summary count string matching user's screenshot:
  // e.g. "Edited a file, ran 4 commands, and 4 more tools"
  const editCount = steps.filter((s) => s.action === "edit").length;
  const commandCount = steps.filter((s) => s.action === "command").length;
  const readCount = steps.filter((s) => s.action === "read").length;
  const presentCount = steps.filter((s) => s.action === "present").length;
  const otherCount = steps.length - (editCount + commandCount);

  const summaryParts: string[] = [];
  if (editCount > 0) {
    summaryParts.push(editCount === 1 ? "Edited a file" : `Edited ${editCount} files`);
  }
  if (commandCount > 0) {
    summaryParts.push(commandCount === 1 ? "ran 1 command" : `ran ${commandCount} commands`);
  }
  if (readCount > 0 && summaryParts.length < 2) {
    summaryParts.push(readCount === 1 ? "read 1 file" : `read ${readCount} files`);
  }

  const remaining = steps.length - (editCount > 0 ? editCount : 0) - (commandCount > 0 ? commandCount : 0);
  if (remaining > 0 && summaryParts.length >= 2) {
    summaryParts.push(`and ${remaining} more ${remaining === 1 ? "tool" : "tools"}`);
  } else if (summaryParts.length === 0) {
    summaryParts.push(`Used ${steps.length} ${steps.length === 1 ? "tool" : "tools"}`);
  }

  const summaryText = summaryParts.join(", ");
  const activeStep = isStreaming ? steps.find((s) => s.status === "running") || steps[steps.length - 1] : null;

  return (
    <div className="w-full my-2 font-sans text-xs">
      {/* 1. Live 1-by-1 Tool Indicator (While actively running) */}
      {isStreaming && activeStep && (
        <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 animate-pulse font-mono text-[11.5px]">
          <Loader2 size={13} className="animate-spin text-emerald-500 shrink-0" />
          <span className="font-semibold capitalize">{activeStep.action}:</span>
          <span className="truncate">
            {activeStep.description || activeStep.target || activeStep.label || "Executing tool..."}
          </span>
        </div>
      )}

      {/* 2. Collapsible Header: Click to Hide/Unhide (Expand/Collapse) */}
      <div className="rounded-xl border border-neutral-200/90 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/60 shadow-2xs overflow-hidden">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between px-3.5 py-2.5 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors cursor-pointer text-left select-none"
        >
          <div className="flex items-center gap-2 truncate">
            <span className="font-medium text-[12px] text-neutral-700 dark:text-neutral-200">
              {summaryText}
            </span>
            {isStreaming && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono animate-pulse">
                (running...)
              </span>
            )}
          </div>
          <span className="text-neutral-400 shrink-0 ml-2">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        </button>

        {/* 3. Expanded Step-by-Step Checklist (Matching User's Screenshot 2) */}
        {isExpanded && (
          <div className="border-t border-neutral-200/80 dark:border-neutral-800 divide-y divide-neutral-200/60 dark:divide-neutral-800/60 bg-neutral-50/40 dark:bg-neutral-950/30">
            {steps.map((step, idx) => {
              const isOpen = expandedStepId === step.id;

              let icon = <Terminal size={13} className="text-neutral-400" />;
              let defaultLabel = "Ran a command";

              if (step.action === "read") {
                icon = <FileCode2 size={13} className="text-blue-500" />;
                defaultLabel = `Read a file ${step.target || ""}`.trim();
              } else if (step.action === "edit") {
                icon = <FileEdit size={13} className="text-amber-500" />;
                defaultLabel = step.description || `Edited a file ${step.target || ""}`.trim();
              } else if (step.action === "present") {
                icon = <Eye size={13} className="text-emerald-500" />;
                defaultLabel = "Presented file";
              } else if (step.action === "command") {
                icon = <Terminal size={13} className="text-neutral-500" />;
                defaultLabel = "Ran a command";
              }

              const rowTitle = step.label || defaultLabel;

              return (
                <div key={step.id || idx} className="text-[11.5px] transition-colors">
                  <button
                    type="button"
                    onClick={() => setExpandedStepId(isOpen ? null : step.id)}
                    className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-neutral-100/70 dark:hover:bg-neutral-800/50 cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span className="shrink-0">{icon}</span>
                      <span className="truncate text-neutral-700 dark:text-neutral-300 font-mono">
                        {rowTitle}
                      </span>
                      {step.target && !rowTitle.includes(step.target) && (
                        <span className="text-neutral-400 dark:text-neutral-500 font-semibold font-mono truncate">
                          {step.target}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {step.status === "running" ? (
                        <Loader2 size={12} className="animate-spin text-emerald-500" />
                      ) : step.status === "completed" ? (
                        <CheckCircle2 size={12} className="text-neutral-400 dark:text-neutral-500" />
                      ) : null}
                      <span className="text-neutral-400">
                        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </span>
                    </div>
                  </button>

                  {/* Step Detailed Drawer (Diff / Output / Notes) */}
                  {isOpen && (
                    <div className="px-4 py-2.5 bg-neutral-100/60 dark:bg-neutral-900/80 border-t border-neutral-200/50 dark:border-neutral-800/50 font-mono text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                      {step.description && <div className="mb-1 text-neutral-500 italic">{step.description}</div>}
                      {step.output ? (
                        <div className="p-2 rounded bg-black/5 dark:bg-black/40 border border-neutral-200/40 dark:border-neutral-800/40">
                          {step.output}
                        </div>
                      ) : (
                        <div className="text-neutral-400 italic">Action executed successfully.</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
