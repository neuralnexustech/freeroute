"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowUp,
  Square,
  Paintbrush,
  MessageSquare,
  Sparkles,
  X,
  Image as ImageIcon,
  Crosshair,
  ChevronDown,
  Plus,
  Activity,
  Zap,
  ArrowDownLeft,
  ArrowUpRight,
  Palette,
  BarChart3,
  Wand2,
} from "lucide-react";
import { InspectedElement } from "./ArtifactPanel";
import { SlashCommandMenu, SlashCommandItem } from "./SlashCommandMenu";

export interface ModelOption {
  slug: string;
  name: string;
  provider: string;
  badge?: string;
  isFree?: boolean;
}

interface Props {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  mode: "chat" | "designer";
  onToggleMode: () => void;
  models: ModelOption[];
  selectedModel: string;
  onSelectModel: (slug: string) => void;
  inspectedElement: InspectedElement | null;
  onClearInspectedElement: () => void;
  screenshot: string | null;
  onClearScreenshot: () => void;
  telemetry?: {
    tokens: number;
    tokensPerSec?: number;
    latencyMs?: number;
    cost?: number;
    isStreaming: boolean;
  };
  conversationStats?: {
    totalInput: number;
    totalOutput: number;
    totalTokens: number;
    totalRequests: number;
    avgTokPerSec: number;
  };
}

export function ChatComposer({
  input,
  setInput,
  onSend,
  onStop,
  isStreaming,
  mode,
  onToggleMode,
  models,
  selectedModel,
  onSelectModel,
  inspectedElement,
  onClearInspectedElement,
  screenshot,
  onClearScreenshot,
  telemetry,
  conversationStats,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [slashMenuDismissed, setSlashMenuDismissed] = useState(false);

  // Slash command detection (/ or /skill)
  const slashMatch = input.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/);
  const isSlashActive = Boolean(slashMatch) && !slashMenuDismissed;
  const slashQuery = slashMatch ? slashMatch[1] : "";

  useEffect(() => {
    if (!input.includes("/")) {
      setSlashMenuDismissed(false);
    }
  }, [input]);

  const handleSelectSlashCommand = (item: SlashCommandItem) => {
    const replaced = input.replace(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/, (match) => {
      const leadingSpace = match.startsWith(" ") ? " " : "";
      return `${leadingSpace}${item.command} `;
    });
    setInput(replaced);
    setSlashMenuDismissed(false);
    textareaRef.current?.focus();
  };

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 192)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && input.trim()) {
        onSend();
      }
    }
  };

  const currentModelObj = models.find((m) => m.slug === selectedModel) || {
    name: selectedModel || "Default Model",
    slug: selectedModel,
    provider: "gateway",
  };

  const isDesigner = mode === "designer";

  return (
    <div className="w-full flex flex-col items-center px-4 pb-3">

      {/* Inspected Element / Screenshot Attached Chips */}
      {(inspectedElement || screenshot) && (
        <div className="w-full max-w-3xl mb-2 flex flex-wrap items-center gap-2">
          {inspectedElement && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-mono animate-in fade-in">
              <Crosshair size={12} className="text-blue-500" />
              <span>
                Target: &lt;{inspectedElement.tag}
                {inspectedElement.classes ? `.${inspectedElement.classes.split(" ")[0]}` : ""}&gt;
              </span>
              <button
                onClick={onClearInspectedElement}
                className="ml-1 hover:text-blue-900 dark:hover:text-blue-100 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {screenshot && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs animate-in fade-in">
              <ImageIcon size={12} className="text-emerald-500" />
              <img src={screenshot} alt="Attached snapshot" className="w-5 h-5 rounded object-cover" />
              <span>Snapshot attached</span>
              <button
                onClick={onClearScreenshot}
                className="ml-1 hover:text-emerald-900 dark:hover:text-emerald-100 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Composer Box with Slash Command Menu */}
      <div className="relative w-full max-w-3xl bg-white dark:bg-[#161821] rounded-2xl border border-neutral-200/90 dark:border-neutral-800 shadow-sm hover:shadow-md transition-all focus-within:border-neutral-300 dark:focus-within:border-neutral-700 p-2.5">
        {/* Floating Slash Command Skills Menu */}
        {isSlashActive && (
          <SlashCommandMenu
            query={slashQuery}
            onSelect={handleSelectSlashCommand}
            onClose={() => setSlashMenuDismissed(true)}
          />
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isDesigner
              ? "Design a modern landing page, pricing section, or interactive dashboard..."
              : "Ask anything, explore data, request code reviews, or research..."
          }
          rows={1}
          className="w-full bg-transparent resize-none outline-none text-[13.5px] leading-relaxed text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 px-2 py-1 max-h-48 font-sans"
        />

        {/* Bottom Controls Row: Mode Toggle + Model Selector + Send Button */}
        <div className="flex items-center justify-between mt-1 pt-2 border-t border-neutral-100 dark:border-neutral-800/60 text-xs">
          {/* Left Controls: Plus + Mode Toggle Icon */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="Add attachment"
            >
              <Plus size={15} />
            </button>

            {/* SMALL MODE TOGGLE ICON (Chat Mode vs Designer Mode) */}
            <button
              type="button"
              onClick={onToggleMode}
              title={
                isDesigner
                  ? "Designer Mode Active (Click to switch to Normal Chat Mode)"
                  : "Normal Chat Mode (Click to switch to Designer Mode)"
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition-all font-medium ${
                isDesigner
                  ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 shadow-xs"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              {isDesigner ? (
                <Paintbrush size={14} className="text-emerald-500 animate-pulse" />
              ) : (
                <MessageSquare size={14} />
              )}
              <span className="text-[11.5px]">{isDesigner ? "Design Mode" : "Chat Mode"}</span>
            </button>
          </div>

          {/* Right Controls: Model Selector + Send/Stop Button */}
          <div className="flex items-center gap-2">
            {/* Model Selector Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setModelMenuOpen((prev) => !prev)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-neutral-700 transition-colors text-[11.5px]"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                <span className="font-medium max-w-[110px] truncate">{currentModelObj.name}</span>
                <ChevronDown size={11} className="text-neutral-400" />
              </button>

              {modelMenuOpen && (
                <div className="absolute right-0 bottom-full mb-2 w-64 max-h-60 overflow-y-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in">
                  <div className="px-2 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                    Select Model
                  </div>
                  {models.map((m) => (
                    <button
                      key={m.slug}
                      type="button"
                      onClick={() => {
                        onSelectModel(m.slug);
                        setModelMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${
                        m.slug === selectedModel
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                          : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      }`}
                    >
                      <span className="truncate">{m.name}</span>
                      {m.badge && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono">
                          {m.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Send / Stop Button */}
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                className="p-1.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 hover:opacity-90 transition-opacity shadow-xs"
                title="Stop generating"
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onSend}
                disabled={!input.trim()}
                className="p-1.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 hover:opacity-90 transition-opacity disabled:opacity-30 shadow-xs"
                title="Send message"
              >
                <ArrowUp size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Down Chat Input: Conversation Totals (Total Input, Output, Total Tokens, Requests, Avg Speed, Live Rate) */}
      <div className="mt-2 w-full max-w-3xl flex flex-wrap items-center justify-between gap-y-1.5 gap-x-3 px-1 text-[11px] text-neutral-400 dark:text-neutral-500 font-mono">
        {/* Conversation Token Totals */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400 font-medium">
            <Activity size={12} className="text-neutral-400" />
            <span>Total:</span>
          </span>
          <span className="flex items-center gap-1" title="Total Input (Prompt) Tokens across conversation">
            <ArrowDownLeft size={11} className="text-blue-500" />
            <span>{(conversationStats?.totalInput || 0).toLocaleString()} in</span>
          </span>
          <span className="text-neutral-300 dark:text-neutral-700">·</span>
          <span className="flex items-center gap-1" title="Total Output (Completion) Tokens across conversation">
            <ArrowUpRight size={11} className="text-emerald-500" />
            <span>{(conversationStats?.totalOutput || 0).toLocaleString()} out</span>
          </span>
          <span className="text-neutral-300 dark:text-neutral-700">·</span>
          <span title="Total Tokens across conversation" className="font-semibold text-neutral-600 dark:text-neutral-300">
            {(conversationStats?.totalTokens || 0).toLocaleString()} tokens
          </span>
          <span className="text-neutral-300 dark:text-neutral-700">·</span>
          <span title="Total Completed Requests">
            {conversationStats?.totalRequests || 0} {(conversationStats?.totalRequests || 0) === 1 ? "request" : "requests"}
          </span>
          {(conversationStats?.avgTokPerSec || 0) > 0 && (
            <>
              <span className="text-neutral-300 dark:text-neutral-700">·</span>
              <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium" title="Average speed across all conversation turns">
                <Zap size={11} />
                <span>{conversationStats?.avgTokPerSec} tok/s avg</span>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
