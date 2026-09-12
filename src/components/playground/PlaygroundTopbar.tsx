"use client";

import React from "react";
import {
  Sidebar,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  Paintbrush,
  MessageSquare,
  Activity,
} from "lucide-react";
import { ModelOption } from "./ChatComposer";

interface Props {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  mode: "chat" | "designer";
  onToggleMode: () => void;
  models: ModelOption[];
  selectedModel: string;
  onSelectModel: (slug: string) => void;
  title?: string;
  isStreaming?: boolean;
}

export function PlaygroundTopbar({
  sidebarOpen,
  onToggleSidebar,
  rightPanelOpen,
  onToggleRightPanel,
  mode,
  onToggleMode,
  models,
  selectedModel,
  onSelectModel,
  title,
  isStreaming,
}: Props) {
  const isDesigner = mode === "designer";

  return (
    <header className="h-12 border-b border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-[#12141c]/70 backdrop-blur-md px-3 flex items-center justify-between z-10 shrink-0 text-xs">
      {/* Left controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSidebar}
          title="Toggle Sidebar"
          className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <Sidebar size={15} />
        </button>

        <div className="flex items-center gap-2 font-medium text-neutral-800 dark:text-neutral-200 truncate max-w-xs sm:max-w-md">
          <span className="truncate">{title || "Playground"}</span>
        </div>

        {/* Mode badge */}
        <button
          onClick={onToggleMode}
          title="Click to toggle mode"
          className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all ${
            isDesigner
              ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
              : "bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300"
          }`}
        >
          {isDesigner ? <Paintbrush size={11} className="text-emerald-500" /> : <MessageSquare size={11} />}
          <span>{isDesigner ? "Designer Mode" : "Chat Mode"}</span>
        </button>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {isStreaming && (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
            <Activity size={12} className="animate-pulse" />
            <span>Generating...</span>
          </div>
        )}

        {/* Right Panel Toggle */}
        <button
          onClick={onToggleRightPanel}
          title={rightPanelOpen ? "Collapse Right Panel" : "Expand Right Panel"}
          className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          {rightPanelOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
        </button>
      </div>
    </header>
  );
}
