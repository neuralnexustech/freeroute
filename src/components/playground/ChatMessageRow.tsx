"use client";

import React, { useState } from "react";
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  FileCode2,
  Download,
  ExternalLink,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  User,
  Bot,
  Brain,
  Wand2,
  Zap,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
} from "lucide-react";
import { ReactMarkdownLite } from "./ReactMarkdownLite";
import { ToolResultWidget } from "./ToolResultWidget";
import { AgentToolExecutionPanel, AgentStep } from "./AgentToolExecutionPanel";
import { Bookmark, RotateCcw } from "lucide-react";

export interface MessageTurnFile {
  name: string;
  sizeBytes?: number;
  content: string;
  additions?: number;
  deletions?: number;
  previousContent?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  tokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  tokPerSec?: number;
  latencyMs?: number;
  streaming?: boolean;
  files?: MessageTurnFile[];
  toolCalls?: Array<{ type: string; data: any }>;
  reasoning?: string;
  steps?: AgentStep[];
  suggestions?: string[];
}

interface Props {
  message: ChatMessage;
  onOpenFileInPreview?: (fileName: string) => void;
  onDownloadFile?: (file: MessageTurnFile) => void;
  onSelectSuggestion?: (prompt: string) => void;
  mode: "chat" | "designer";
}

export function ChatMessageRow({
  message,
  onOpenFileInPreview,
  onDownloadFile,
  onSelectSuggestion,
  mode,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [voted, setVoted] = useState<"up" | "down" | null>(null);

  const [saved, setSaved] = useState(false);

  const isUser = message.role === "user";

  // Parse reasoning / <think>...</think> if present in assistant message
  const { thinkingContent, cleanContent } = React.useMemo(() => {
    if (isUser) return { thinkingContent: "", cleanContent: message.content };

    let thinking = message.reasoning || "";
    let cleaned = message.content || "";

    // 1. Extract all closed <think>...</think> blocks globally
    const thinkBlockRegex = /<think>([\s\S]*?)<\/think>/gi;
    const extractedBlocks: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = thinkBlockRegex.exec(cleaned)) !== null) {
      const part = match[1]?.trim();
      if (part) {
        extractedBlocks.push(part);
      }
    }

    if (extractedBlocks.length > 0) {
      const joined = extractedBlocks.join(extractedBlocks.length > 10 ? " " : "\n\n");
      thinking = thinking ? `${thinking}\n\n${joined}` : joined;
      cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "");
    }

    // 2. Extract any unclosed streaming <think> tag at the tail
    const unclosedMatch = cleaned.match(/<think>([\s\S]*)$/i);
    if (unclosedMatch) {
      const tail = unclosedMatch[1]?.trim();
      if (tail) {
        thinking = thinking ? `${thinking}\n\n${tail}` : tail;
      }
      cleaned = cleaned.replace(/<think>[\s\S]*$/i, "");
    }

    // 3. Strip any stray leftover tags
    cleaned = cleaned.replace(/<\/?think>/gi, "").trim();

    return { thinkingContent: thinking.trim(), cleanContent: cleaned };
  }, [message.content, message.reasoning, isUser]);

  // Parse inline <tool_call> tags if present in Chat Mode
  const { parsedToolCalls, displayContent } = React.useMemo(() => {
    if (isUser) return { parsedToolCalls: [], displayContent: cleanContent };

    const toolCalls: Array<{ type: any; data: any }> = [];
    let textWithoutTools = cleanContent;

    const toolRegex = /<tool_call\s+name="([^"]+)"(?:\s+location="([^"]+)")?(?:\s+title="([^"]+)")?(?:\s+file="([^"]+)")?(?:\s+root="([^"]+)")?>([\s\S]*?)<\/tool_call>/gi;
    let match;

    while ((match = toolRegex.exec(cleanContent)) !== null) {
      const toolName = match[1];
      const innerJson = match[6]?.trim();
      try {
        const parsed = JSON.parse(innerJson);
        toolCalls.push({ type: toolName, data: parsed });
      } catch {
        // Not valid json, ignore
      }
    }

    // Strip tool call tags from visible text
    textWithoutTools = textWithoutTools.replace(/<tool_call[\s\S]*?<\/tool_call>/gi, "").trim();

    return { parsedToolCalls: toolCalls, displayContent: textWithoutTools };
  }, [cleanContent, isUser]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(displayContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Strip raw <artifact>, <project>, <file>, <agent_step>, and <suggestions> XML from displaying in chat text
  const userFacingText = React.useMemo(() => {
    let text = displayContent
      .replace(/<project[\s\S]*?<\/project>/gi, "")
      .replace(/<project[\s\S]*$/i, "")
      .replace(/<artifact[\s\S]*?<\/artifact>/gi, "")
      .replace(/<artifact[\s\S]*$/i, "")
      .replace(/<file[\s\S]*?<\/file>/gi, "")
      .replace(/<file[\s\S]*$/i, "")
      .replace(/<agent_step[\s\S]*?<\/agent_step>/gi, "")
      .replace(/<agent_step[\s\S]*?\/>/gi, "")
      .replace(/<agent_step[^>]*>/gi, "")
      .replace(/<\/agent_step>/gi, "")
      .replace(/<suggestions>[\s\S]*?<\/suggestions>/gi, "")
      .replace(/<suggestions[\s\S]*?<\/suggestions>/gi, "")
      .replace(/\[\s*"[^"]*"[\s\S]*?<\/suggestions>/gi, "")
      .replace(/<\/?suggestions>/gi, "")
      .replace(/\[Inspected Component:[\s\S]*?User Request:/gi, "")
      .replace(/\[Inspected Component:[\s\S]*?\]/gi, "")
      .replace(/<\/?think>/gi, "");

    // Strip raw multiline code blocks (```...```, ````...````, '''...''', indented code fences)
    // from the chat conversation bubble so code is ONLY shown in dedicated File Cards and Workspace!
    // 1. Matched fences with matching closing delimiter
    text = text.replace(/(?:^|\n)[ \t]*([`']{3,})[^\n]*\n[\s\S]*?\n[ \t]*\1/g, "");
    // 2. Unmatched or mismatched 3+ fences
    text = text.replace(/(?:^|\n)[ \t]*[`']{3,}[^\n]*\n[\s\S]*?[`']{3,}/g, "");
    // 3. Trailing/unclosed code block while streaming
    if (message.streaming) {
      text = text.replace(/(?:^|\n)[ \t]*[`']{3,}[\s\S]*$/g, "");
    }
    // 4. Any lone fence lines
    text = text.replace(/(?:^|\n)[ \t]*[`']{3,}[^\n]*(?=\n|$)/g, "");
    text = text.replace(/\n{3,}/g, "\n\n").trim();

    return text;
  }, [displayContent, message.streaming]);

  if (isUser) {
    return (
      <div className="flex justify-end py-3 px-4">
        <div className="max-w-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 px-4 py-2.5 rounded-2xl text-[13.5px] leading-relaxed shadow-2xs">
          <p className="whitespace-pre-wrap">{userFacingText || message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col py-4 px-4 hover:bg-neutral-50/40 dark:hover:bg-neutral-900/40 transition-colors">
      <div className="max-w-3xl w-full mx-auto space-y-3">
        {/* 1. COLLAPSIBLE THINKING BLOCK */}
        {thinkingContent && (
          <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 overflow-hidden text-xs">
            <button
              onClick={() => setThinkingExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-2 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Brain size={14} className="text-purple-500" />
                <span className="font-semibold text-[11.5px]">Reasoning Process</span>
                {message.streaming && !cleanContent && (
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 animate-pulse font-mono font-normal">
                    thinking...
                  </span>
                )}
                {message.latencyMs !== undefined && (
                  <span className="text-[10px] text-neutral-400 font-mono">
                    ({(message.latencyMs / 1000).toFixed(1)}s)
                  </span>
                )}
              </div>
              <span className="text-neutral-400">
                {thinkingExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </button>

            {thinkingExpanded && (
              <div className="px-3 pb-3 pt-1 border-t border-neutral-200/50 dark:border-neutral-800/50 font-mono text-[11.5px] text-neutral-600 dark:text-neutral-400 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
                {thinkingContent}
              </div>
            )}
          </div>
        )}

        {/* 2. SYSTEMATIC AGENT TOOL EXECUTION PANEL */}
        {message.steps && message.steps.length > 0 && (
          <AgentToolExecutionPanel steps={message.steps} isStreaming={message.streaming} />
        )}

        {/* 3. ASSISTANT TEXT CONTENT */}
        {userFacingText ? (
          <ReactMarkdownLite content={userFacingText} />
        ) : message.streaming && thinkingContent ? (
          <div className="flex items-center gap-2 text-xs text-neutral-400 italic py-1">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            Thinking...
          </div>
        ) : null}

        {/* 4. INLINE TOOL RESULTS (Chat Mode) */}
        {parsedToolCalls.length > 0 && (
          <div className="space-y-3 pt-1">
            {parsedToolCalls.map((tc, idx) => (
              <ToolResultWidget key={idx} type={tc.type} data={tc.data} />
            ))}
          </div>
        )}

        {/* 5. FILES FROM THIS TURN: Dedicated File Cards */}
        {message.files && message.files.length > 0 && (
          <div className="pt-2 space-y-2">
            <div className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              Files from this turn
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {message.files.map((file, fi) => {
                const linesCount = file.content ? file.content.split("\n").length : 1;
                const additions = file.additions ?? Math.max(1, linesCount);
                const deletions = file.deletions ?? 0;
                const ext = file.name.split(".").pop()?.toUpperCase() || "FILE";
                const isRunnable = ext === "PY" || ext === "JS" || ext === "TS";

                return (
                  <div
                    key={fi}
                    className="flex items-center justify-between p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenFileInPreview?.(file.name)}
                      className="flex items-center gap-3 min-w-0 pr-2 text-left cursor-pointer group flex-1"
                    >
                      <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-900/60 shrink-0 group-hover:scale-105 transition-transform">
                        <FileCode2 size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-neutral-800 dark:text-neutral-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate" title={file.name}>
                          {file.name}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-neutral-400 mt-0.5">
                          <span className="font-bold text-blue-600 dark:text-blue-400">{ext}</span>
                          <span>·</span>
                          {deletions > 0 ? (
                            <>
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+{additions}</span>
                              <span className="text-rose-500 dark:text-rose-400 font-semibold">-{deletions}</span>
                              <span>changed</span>
                            </>
                          ) : file.previousContent ? (
                            <>
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+{additions}</span>
                              <span>new lines</span>
                            </>
                          ) : (
                            <>
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+{additions}</span>
                              <span>lines</span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0 text-xs">
                      {onOpenFileInPreview && (
                        <button
                          type="button"
                          onClick={() => onOpenFileInPreview(file.name)}
                          className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                            isRunnable
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100"
                              : "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                          }`}
                        >
                          {isRunnable && <span className="font-bold">▶</span>}
                          <span>{isRunnable ? "Run / Code" : "Open"}</span>
                        </button>
                      )}
                      {onDownloadFile && (
                        <button
                          type="button"
                          onClick={() => onDownloadFile(file)}
                          className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center transition-colors cursor-pointer shadow-2xs"
                          title="Download"
                        >
                          <Download size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. SMART FOLLOW-UP SUGGESTIONS (One-Click Execution) */}
        {!message.streaming && (
          <div className="pt-2">
            <div className="flex flex-wrap gap-2">
              {(message.suggestions && message.suggestions.length > 0
                ? message.suggestions
                : mode === "designer"
                ? [
                    "✨ Add dark mode toggle and theme switcher",
                    "⚡ Add Emil Kowalski spring micro-interactions",
                    "📊 Connect dynamic Chart.js mock datasets",
                    "📱 Optimize responsive mobile navbar",
                  ]
                : [
                    "Explain this step-by-step",
                    "Add TypeScript type definitions",
                    "Optimize performance",
                  ]
              ).map((sug, si) => (
                <button
                  key={si}
                  type="button"
                  onClick={() => onSelectSuggestion && onSelectSuggestion(sug)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-emerald-500/40 hover:text-emerald-600 dark:hover:text-emerald-400 text-xs text-neutral-700 dark:text-neutral-300 transition-all shadow-2xs cursor-pointer group"
                >
                  <Sparkles size={12} className="text-emerald-500 group-hover:rotate-12 transition-transform" />
                  <span>{sug}</span>
                  <ChevronRight size={11} className="text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 7. BOTTOM MESSAGE FOOTER */}
        {message.streaming ? (
          /* LIVE STREAMING TELEMETRY PILL (Down of Bubble while generation active) */
          <div className="flex items-center gap-2 pt-2">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium font-mono text-[11px] bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>Streaming · {message.tokens || 0} tokens</span>
              <span>· {message.tokPerSec || 0} tok/s</span>
              <span>· {((message.latencyMs || 0) / 1000).toFixed(1)}s</span>
            </div>
          </div>
        ) : (
          /* COMPLETED ACTION TOOLBAR + TURN TELEMETRY */
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-neutral-400 border-t border-neutral-100/80 dark:border-neutral-800/60">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                title="Copy message"
              >
                {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
              <button
                type="button"
                onClick={() => setVoted((v) => (v === "up" ? null : "up"))}
                className={`hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer ${
                  voted === "up" ? "text-emerald-500 font-semibold" : ""
                }`}
                title="Good response"
              >
                <ThumbsUp size={12} />
              </button>
              <button
                type="button"
                onClick={() => setVoted((v) => (v === "down" ? null : "down"))}
                className={`hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer ${
                  voted === "down" ? "text-red-500 font-semibold" : ""
                }`}
                title="Bad response"
              >
                <ThumbsDown size={12} />
              </button>
              <button
                type="button"
                onClick={() => setSaved((s) => !s)}
                className={`hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer ${
                  saved ? "text-amber-500 font-semibold" : ""
                }`}
                title="Bookmark response"
              >
                <Bookmark size={12} />
              </button>
            </div>

            {/* Granular Per-Turn Telemetry (In That Bubble Only) */}
            {(() => {
              const inTok = message.promptTokens ?? (message.tokens ? Math.round(message.tokens * 0.4) : undefined);
              const outTok = message.completionTokens ?? (message.tokens && inTok !== undefined ? message.tokens - inTok : undefined);
              const latencySec = message.latencyMs ? message.latencyMs / 1000 : 0;
              const tokPerSec = message.tokPerSec ?? (latencySec > 0 && outTok ? Math.round(outTok / latencySec) : undefined);

              if (inTok === undefined && outTok === undefined && !message.tokens) return null;

              return (
                <div className="flex flex-wrap items-center gap-2 text-[10.5px] font-mono text-neutral-400 dark:text-neutral-500 bg-neutral-100/80 dark:bg-neutral-800/40 px-2.5 py-1 rounded-lg border border-neutral-200/60 dark:border-neutral-800/60 shadow-2xs">
                  {inTok !== undefined && (
                    <span title="Prompt (input) tokens" className="flex items-center gap-1">
                      <ArrowDownLeft size={11} className="text-blue-500" />
                      <span>{inTok.toLocaleString()} in</span>
                    </span>
                  )}
                  {outTok !== undefined && (
                    <span title="Completion (output) tokens" className="flex items-center gap-1">
                      <ArrowUpRight size={11} className="text-emerald-500" />
                      <span>{outTok.toLocaleString()} out</span>
                    </span>
                  )}
                  {tokPerSec !== undefined && tokPerSec > 0 && (
                    <span title="Speed: tokens per second" className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium">
                      <Zap size={11} />
                      <span>{tokPerSec} tok/s</span>
                    </span>
                  )}
                  {latencySec > 0 && (
                    <span title="Turn latency" className="flex items-center gap-1">
                      <Clock size={11} className="text-amber-500" />
                      <span>{latencySec.toFixed(1)}s</span>
                    </span>
                  )}
                  {message.tokens !== undefined && (
                    <span className="text-neutral-500 dark:text-neutral-400 font-semibold" title="Total turn tokens">
                      ({message.tokens.toLocaleString()} total)
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
